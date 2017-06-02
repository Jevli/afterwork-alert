var Slack = require('slack-node');
var UntappdClient = require("node-untappd");
var _ = require('lodash');
var moment = require('moment');
var https = require('https');
var WebSocket = require('ws');

// Environment
const untappdAccessToken = process.env.UNTAPPD_ACCESS_TOKEN;
const SlackWebhook = process.env.SLACK_WEBHOOK;
const botname = process.env.BOTNAME;

// Create clients
var untappd = new UntappdClient();
untappd.setAccessToken(untappdAccessToken);
var slack = new Slack();
slack.setWebhook(SlackWebhook);

function sendToSlack(channel, message) {
  slack.api('chat.postMessage', {
    text: message,
    channel: channel,
    username: botname
  }, function(err, res) {
    log(err, res);
  });
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

