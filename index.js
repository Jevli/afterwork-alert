var UntappdClient = require("node-untappd");
var Slack = require('slack-node');
var _ = require('underscore');
var moment = require('moment');
var https = require('https');
var WebSocket = require('ws');
var config = require('./config')[process.env.mode];

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

// Set to true if you want to see all sort of nasty output on stdout.
var debug = false;
if (process.argv.length > 2 && process.argv[2] == 'debug') {
  debug = true;
}

// Create Untappd Client
var untappd = new UntappdClient(debug);
untappd.setClientId(clientId);
untappd.setClientSecret(clientSecret);
untappd.setAccessToken(accessToken); // TODO add accessToken adding LATER get accessToken
// Create Slack Client
var slack = new Slack(config.slackApiToken);

var getAfterworkFeed = function(cb) {
  untappd.activityFeed(function (err, obj) {
    if (debug) console.log(obj, err);

    var afterwork = [];

    // Check what counts is really | either this or items.size etc
    if (obj && obj.response && obj.response.checkins.count > 0) {

      var items = obj.response.checkins.items;

      for (var item of items) {
        afterwork.push({
          'time': item.created_at,
          'vid': item.venue !== undefined ? item.venue.venue_id : undefined,
          'vname': item.venue !== undefined ? item.venue.venue_name : undefined,
          'city': item.venue !== undefined && item.venue.location !== undefined ? item.venue.location.venue_city : undefined,
          'uid': item.user.uid,
          'name': item.user.first_name + ' ' + item.user.last_name
        });
      }

      var earliest_allowed_checkin = moment().subtract(whatIsCountedAsAfterWork); // TODO: change to timestamp

      afterwork = _.chain(afterwork)
        // Checkin has to be new enough
        .filter(function (elem) {
          return moment(elem.time, 'ddd, D MMM YYYY HH:mm:ss +0000').isAfter(earliest_allowed_checkin);
        })
        // Has to have venue
        .filter(function (elem) {
          return elem.vid;
        })
        .groupBy(function (elem) {
          return elem.vid;
        })
        .values()
        // Reduce all places where is no updates with diff under 15 minutes
        // Exludes same users drinks in same venue
        .map(function (elem) {
          return _.uniq(elem, false, function (a) {
            return a.uid + "--" + a.vid;
          });
        })
        // Has to have more than one user in same bar
        .filter(function (elem) {
          return elem.length > 0;
        })
        .value();

      if (debug) console.log(afterwork);
      cb(afterwork);
    }
  });
};

var parseAfterWorkAndSendToSlack = function(afterwork) {
  // for every venue, send message
  for (let venue of afterwork) {
    // build persons string
    var persons = "";
    for(let checkin of venue) {
      persons += checkin.name + ' ';
    }
    persons = persons.slice(0, -1);
    // build payload
    var payload = {
      'text': venue.length + ' henkilöä afterworkilla ravintolassa ' + venue[0].vname + ' (' + persons + ')',
      'channel': channels[venue[0].city],
      'username': botname
    }
    slack.api("chat.postMessage", payload, function(err, response) {
      if (debug) console.log(response);
    })
  }
};

// Helper for interval
var timer = function() {
  getAfterworkFeed(parseAfterWorkAndSendToSlack);
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
followSlack();
//timer();
//setInterval(timer, loopingTime);

// Send welcome message to all channels at slack
var sendWelcomeMessage = function() {
  Object.keys(channels).forEach(function(city) {
    slack.api('chat.postMessage', {
      text: 'Hei jos haluat minun kaveriksi lähetä kanavalle viesti: ```@seppokaljalla {untapdd-username}```',
      channel: channels[city],
      username: botname
    }, function (err, res) {
      if (debug) console.log(res);
    });
  });
}

// WebSocker lisner
var listenWebSocket = function (url, user_id) {
  if (debug) console.log(url, user_id);

  var ws = new WebSocket(url);

  ws.on('message', function(message) {
    if (debug)   console.log(message);
    
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
    if (debug) console.log(obj.response.user);
          
    untappd.requestFriends(function (err, obj) {
      console.log(obj);
    }, {'TARGET_ID': obj.response.user.uid });

  }, {"USERNAME" : user});
}

// Custom Slack Bot Stuff
function startBot() {
  if (debug) console.log("Bot not yet done");
};
