var UntappdClient = require("node-untappd");
var Slack = require('slack-node');
var _ = require('lodash');
var moment = require('moment');
var https = require('https');
var WebSocket = require('ws');
var config = require('./config')[process.env.mode];
var mockData = require('./config')["mockData"];

// Definitions
var clientId = [ config.clientId ];
var clientSecret = [ config.clientSecret ];
var accessToken = [ config.accessToken ];
var loopingTime = config.loopingTime; 
var whatIsCountedAsAfterWork = config.whatIsCountedAsAfterWork;
var whatIsCountedAfterPrevious = config.whatIsCountedAfterPrevious;
var lookupuser = config.lookupuser;
var untappdUserPage = "https://untappd.com/user/";
var slackApiToken = config.slackApiToken;
var channels = config.channels;
var fallbackChannel = config.fallbackChannel;
var botname = config.botname;
var timeFormat = 'ddd, DD MMM YYYY HH:mm:ss +0000';
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
var slack = new Slack(slackApiToken);

function getUntappdFeed() {
  return new Promise((resolve, reject) => {
    untappd.activityFeed(function (err, obj) {
      if (err) {
        reject(err);
      }
      log(obj, err);
      var afterwork = [];
      // Check what counts is really | either this or items.size etc
      if (obj && obj.response && obj.response.checkins && obj.response.checkins.count > 0) {
        var items = obj.response.checkins.items;
        for (var item of items) {
          afterwork.push({
            'cid': item.checkin_id,
            'time': item.created_at,
            'vid': item.venue !== undefined ? item.venue.venue_id : undefined,
            'vname': item.venue !== undefined ? item.venue.venue_name : undefined,
            'city': item.venue !== undefined && item.venue.location !== undefined ? item.venue.location.venue_city : undefined,
            'uid': item.user.uid,
            'fname': item.user.first_name,
            'lname': item.user.last_name
          });
        }
      }
      return resolve(afterwork);
    })
  });
}

function getMockFeed() {
  return new Promise((resolve, reject) => {
    if (mockData) {
      return resolve(mockData);
    }
    return reject("Error: no mockData provided");
  });
}

function parseAfterworkers(feed) {
  return new Promise((resolve, reject) => {
    // subtract twice to get afterworks between loops
    var earliest_allowed_checkin = moment().utc()
      .subtract(whatIsCountedAsAfterWork)
      .subtract(whatIsCountedAsAfterWork);
    log("PARSER earliest: " + earliest_allowed_checkin.toString());
    afterwork = _.chain(feed)
      .sortBy((checkin) => {
        return moment(checkin.time, timeFormat);
      })
      .filter((checkin) => {
      log("PARSER " + checkin.fname + checkin.lname.charAt(0).toUpperCase() + " (" + checkin.vname + "): "
        + moment(checkin.time, timeFormat).utc().toString());

        return moment(checkin.time, timeFormat).utc().isAfter(earliest_allowed_checkin) // Not too long time ago
          && (!usedCids.includes(checkin.cid)) // checkin id not used to another aw before
          && (checkin.vid); // has to have venue
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
    log("PARSER afterworkers: ", afterwork, "end of parsed afterworkers");
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
  var min = moment(a[0].time, timeFormat); // First one's checkin time
  var max = a.length < 2
    ? moment(min).add(whatIsCountedAsAfterWork) // First one + maxTime
    : moment(a[a.length - 1].time, timeFormat).add(whatIsCountedAfterPrevious); // Previous added + maxTimeAfterPrevious
  var current = moment(b.time, timeFormat);
  if (current.isBetween(min, max)
   && (a.find((checkin) => { return checkin.uid === b.uid }) === undefined)) {
    return true;
  }
  return false;
}

function buildPayloads(afterwork) {
  return new Promise((resolve, reject) => {
    // for every venue, send message
    var payloads = [];
    for (let venue of afterwork) {
      // build persons string
      var persons = "";
      for (let checkin of venue) {
        persons += checkin.fname.replace(/\W/g, '') + checkin.lname.replace(/\W/g, '').charAt(0).toUpperCase() + ', ';
      }
      persons = persons.slice(0, -2);
      // build payload
      var channel = channels[venue[0].city] || fallbackChannel;
      var payload = {
        'text': venue.length + ' henkilöä afterworkilla sijainnissa ' + venue[0].vname + ' (' + persons + ')',
        'channel': channel,
        'username': botname
      }
      if (channel && botname) {
        payloads.push(payload);
      }
    }
    resolve(payloads);
  });
}

function sendToSlack(channel, message) {
  slack.api('chat.postMessage', {
    text: message,
    channel: channel,
    username: botname
  }, function(err, res) {
    log(err, res);
  });
}

// Helper for starting to follow slack
function followSlack() {
  slack.api('rtm.start', function(err, response) {
    slack.api('auth.test', function(err, res) {
      listenWebSocket(response.url, res.user_id);
    });
  });
}

// Send welcome message to all channels at slack
function sendWelcomeMessageToAll(channel) {
  Object.keys(channels).forEach(function(city) {
    sendWelcomeToChannel(channels[city]);
  });
  sendWelcomeToChannel(fallbackChannel);
}

function sendWelcomeToChannel(channel) {
  sendToSlack(channel, 'Hei, mun kaveriksi pääset komennolla: ```@' + botname + ' {untappd-username}```');
}

// WebSocket listening for commands
function listenWebSocket(url, user_id) {

  var ws = new WebSocket(url);

  sendWelcomeToChannel(fallbackChannel);
  ws.on('open', function(message) {
    log("WEBSOCKET connected");
    log("WEBSOCKET url: " + url);
    log("WEBSOCKET user_id to watch: " + user_id);
  })

  ws.on('message', function(message) {

    log('SLACK message: ' + message);
    message = JSON.parse(message);
    if (message && message.type !== "presence_change") {
      log('SLACK parsed message:', message);
    }

    if (isFriendRequest(message, user_id)) {
      var user = message.text.split(' ')[1];
      var channel = message.channel;
      createFriendRequest(channel, user);
    } else if (isHelp(message, user_id)) {
      // var user = message.text.split(' ')[1];
      var channel = message.channel;
      sendWelcomeToChannel(channel);
    }
  });

  ws.on('close', function(code, reason) {
    sendToSlack(fallbackChannel, "WEBSOCKET closed with code: " + code + ", reason: " + reason);
    log("WEBSOCKET closed with code: " + code + ", reason: " + reason);
    listenWebSocket(url, user_id);
  });

  ws.on('ping', function(data, flags) {
    log("WEBSOCKET ping -> pong: ");
    ws.pong(data);
  })
}

function isHelp(message, user_id) {
  if(message.type === 'message'
    && message.subtype !== 'bot_message'
    && message.text !== undefined
    && message.text.indexOf(user_id) === 2
    && (message.text.split(' ').length === 1
    || (message.text.split(' ').length === 2
    && message.text.split(' ')[1] === ''))) {
    return true;
  }
  return false;
}

function isFriendRequest(message, user_id) {
  if(message.type === 'message'
    && message.subtype !== 'bot_message'
    && message.text !== undefined
    && message.text.indexOf(user_id) === 2
    && (message.text.split(' ').length === 2
      || (message.text.split(' ').length === 3
        && message.text.split(' ')[2] === ''))) {
    return true;
  }
  return false;
}

// accept pending request
function acceptPending(channel, username, user_uid) {
  untappd.acceptFriends(function(err, obj) {
    if (!err) {
      sendToSlack(channel, username + ": Hyväksyin sun kaveripyyntösi!");
    }
  }, {'TARGET_ID': user_uid});
}

// Create friend request from untappd
function createFriendRequest(channel, user) {
  log("FRIEND REQUEST create friend request for " + user);
  untappd.userInfo(function(err, obj){
    if (obj && obj.meta && obj.meta.code === 500) {
      if (obj.meta.error_detail === 'There is no user with that username.') {
        sendToSlack(channel, 'Ei löytynyt käyttäjää ' + user);
      }
      log("FRIEND REQUEST ERROR");
    } else {
      log("USERINFO OBJ", obj);
      log("USERINFO ERR", err);
      var user_uid = obj.response.user.uid;
      untappd.requestFriends(function (err, obj) {
        log("OBJ", obj);
        log("ERR", err);
        if (obj && obj.meta && obj.meta.code === 500) {
          if (obj.meta.error_detail === 'This request is pending your approval.') {
            acceptPending(channel, user, user_uid);
          }
          if (obj.meta.error_detail === "This request is pending the user\'s approval.") {
            sendToSlack(channel, user + ": Sulla on jo kaveripyyntö odottamassa. Käy hyväksymässä osoitteessa " + untappdUserPage + lookupuser);
          }
          if (obj.meta.error_detail === 'You are already friends with this user.') {
            sendToSlack(channel, user + ": Ollaan jo kavereita!");
          }
        }
        else if (obj && obj.meta && obj.meta.code === 200) {
          sendToSlack(channel, user + ": Tein sulle kaveripyynnön! Käy hyväksymässä osoitteessa " + untappdUserPage + lookupuser);
        }
      }, {'TARGET_ID': obj.response.user.uid});
    }
  }, {"USERNAME" : user});
}

function log(...args) {
  // could add here some real logging to file etc.
  args.map((arg) => {
    if (typeof arg === "string") {
      console.log(moment().format("YYYY-MM-DD HH:MM:SS ") + arg);
    } else {
      console.log(arg);
    }
  })
}

// Helper for interval
function timer() {
  // getMockFeed()
  getUntappdFeed()
    .then(parseAfterworkers)
    .then(buildPayloads)
    .then((resolve, reject) => {
      resolve.map((payload) => {
        slack.api("chat.postMessage", payload, function (err, response) {
          log("SLACK response: ", response);
        })
        log("SLACK resolve: ", payload);
      });
    })
    .catch((reason) => {
      log("ERROR reason: ", reason);
    });
}

// Accual calls for start different parts of application
// timer();
setInterval(timer, loopingTime * 1000 * 60);
followSlack();
