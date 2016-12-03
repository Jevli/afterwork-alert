var UntappdClient = require("node-untappd");
var Slack = require('slack-node');
var _ = require('underscore');
var moment = require('moment');
var https = require('https');
var WebSocket = require('ws');
var config = require('./config')[process.env.mode];
var mockData = require('./config').mockData;

// Definitions
var clientId = [ config.clientId ];
var clientSecret = [ config.clientSecret ];
var accessToken = [ config.accessToken ];
var loopingTime = config.loopingTime; 
var whatIsCountedAsAfterWork = config.whatIsCountedAsAfterWork;
var lookupuser = config.lookupuser;
var slackApiToken = config.slackApiToken;
var channels = config.channels;
var botname = config.botname;
var timeFormat = 'ddd, D MMM YYYY HH:mm:ss +0000';
var usedCids = [];

// Set to true if you want to see all sort of nasty output on stdout.
var debug = false;
if ((process.argv.length > 2 && process.argv[2] == 'debug') || (process.env.mode === 'dev')) {
  debug = true;
}

// Create Untappd Client
var untappd = new UntappdClient(debug);
untappd.setClientId(clientId);
untappd.setClientSecret(clientSecret);
untappd.setAccessToken(accessToken); // TODO add accessToken adding LATER get accessToken
// Create Slack Client
var slack = new Slack(config.slackApiToken);

function getUntappdFeed() {
  return new Promise((resolve, reject) => {
    untappd.activityFeed(function (err, obj) {
      log(obj, err);
      var afterwork = [];
      // Check what counts is really | either this or items.size etc
      if (obj && obj.response && obj.response.checkins.count > 0) {
        var items = obj.response.checkins.items;
        for (var item of items) {
          afterwork.push({
            'cid': item.checkin_id,
            'time': item.created_at,
            'vid': item.venue !== undefined ? item.venue.venue_id : undefined,
            'vname': item.venue !== undefined ? item.venue.venue_name : undefined,
            'city': item.venue !== undefined && item.venue.location !== undefined ? item.venue.location.venue_city : undefined,
            'uid': item.user.uid,
            'name': item.user.first_name + ' ' + item.user.last_name
          });
        }
        return resolve(afterwork);
      }
    })
  });
}

function getMockFeed() {
  return new Promise((resolve, reject) => {
    return resolve(mockData);
  });
}

function parseAfterworkers(feed) {
  return new Promise((resolve, reject) => {
    var earliest_allowed_checkin = moment().subtract(whatIsCountedAsAfterWork).subtract({months: 2}); // subtract more for debugging
    log("feed: ", feed, "end of feed");
    afterwork = _.chain(feed)
      .filter((checkin) => {
        return moment(checkin.time, timeFormat).isAfter(earliest_allowed_checkin);
      })
      .filter((checkin) => {
        return (!usedCids.includes(checkin.cid)); // checkin id not used to another aw before
      })
      // Has to have venue
      .filter((checkin) => {
        return checkin.vid;
      })
      // Group by venue
      .groupBy((checkin) => {
        return checkin.vid;
      })
      .values()
      .map(function (checkInsInOneVenue) { // Do this for all users grouped by venue
        return checkInsInOneVenue.reduce((a, b) => {
          if(a.length === 0) { // as first
            a.push(b);
            return a;
          }
          var isAW = isCountedInAW(a, b);
          if(a.length === 1 && !isAW) { // if not with first, change this to first
            a.pop();
            a.push(b);
            return a;
          }
          if(a.length > 0 && isAW) { // if aw with previous, add
            a.push(b);
          }
          return a;
        }, []);
      })
      // Has to have more than one user in same venue
      .filter((elem) => {
        return elem.length > 1;
      })
      .value();
    log("parsed afterworkers: ", afterwork, "end of parsed afterworkers");
    // Add afterwork content to used cids
    afterwork.map((checkinGroups) => {
      checkinGroups.map((checkin) => {
        usedCids.push(checkin.cid);
      });
    });
    resolve(afterwork);
  });
}

// a: list of current checkins which are having AW
// b: checkin to be tested against a
function isCountedInAW(a, b) {
  var min = moment(a[0].time, timeFormat);
  var max = moment(min).add(whatIsCountedAsAfterWork);
  var current = moment(b.time, timeFormat);
  if (current.isBetween(min, max)
   && (a.find((checkin) => { return checkin.uid === b.uid }) === undefined)) {
    return true;
  }
  return false;
}

function buildPayload(afterwork) {
  return new Promise((resolve, reject) => {
    // for every venue, send message
    for (let venue of afterwork) {
      // build persons string
      var persons = "";
      for (let checkin of venue) {
        persons += checkin.name + ' ';
      }
      persons = persons.slice(0, -1);
      // build payload
      var payload = {
        'text': venue.length + ' henkilöä afterworkilla ravintolassa ' + venue[0].vname + ' (' + persons + ')',
        'channel': channels[venue[0].city],
        'username': botname
      }
      resolve(payload);
    }
  });
}

// Helper for interval
var timer = function() {
  // getMockFeed()
  getUntappdFeed()
    .then(parseAfterworkers)
    .then(buildPayload)
    .then((resolve, reject) => {
      slack.api("chat.postMessage", payload, function (err, response) {
        log("slac response", response);
      })
      log("resolve: ", resolve);
    })
    .catch((reason) => {
      log("reason: ", reason);
    });
}

// Helper for starting to follow slack
var followSlack = function () {
  slack.api('rtm.start', function(err, response) {
    sendWelcomeMessage();
    slack.api('auth.test', function(err, res) {
      listenWebSocket(response.url, res.user_id);
    });
  });
}

// Accual calls for start different parts of application
// followSlack();
// timer();
setInterval(timer, loopingTime * 1000);


// Send welcome message to all channels at slack
var sendWelcomeMessage = function() {
  Object.keys(channels).forEach(function(city) {
    slack.api('chat.postMessage', {
      text: 'Hei jos haluat minun kaveriksi lähetä kanavalle viesti: ```@seppokaljalla {untapdd-username}```',
      channel: channels[city],
      username: botname
    }, function (err, res) {
      log("res: ", res);
    });
  });
}

// WebSocker lisner
var listenWebSocket = function (url, user_id) {
  log(url, user_id);

  var ws = new WebSocket(url);

  ws.on('message', function(message) {
    log(message);

    message = JSON.parse(message);
    
    if (message.type === 'message' && message.subtype !== 'bot_message') {
      
      if (message.text.indexOf(user_id)) {
        createFriendRequest(message.text.split(' ')[1]);
      }
    }
  });
}


// Create friend request from untappd
var createFriendRequest = function (user) {
  untappd.userInfo(function(err, obj){
    log(obj.response.user);
          
    untappd.requestFriends(function (err, obj) {
      log(obj);
    }, {'TARGET_ID': obj.response.user.uid });

  }, {"USERNAME" : user});
}

// Custom Slack Bot Stuff
function startBot() {
  log("Bot not yet done");
};

function log(...args) {
  // could add some real logging to file etc.
  args.map((arg) => {
    console.log(arg);
  })
}
