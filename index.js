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

followSlack();

