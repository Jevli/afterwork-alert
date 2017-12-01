var Slack = require('slack-node');
var UntappdClient = require("node-untappd");
var _ = require('lodash');
var request = require('request');
const AWS = require('aws-sdk');

// Environment
const untappdAccessToken = process.env.UNTAPPD_ACCESS_TOKEN;
const SlackWebhook = process.env.SLACK_WEBHOOK;
const botname = process.env.BOTNAME;
const slack_slash_token = process.env.SLACK_SLASH_TOKEN;
const dbb_table = process.env.DBB_TABLE;

// Constant strings etc
const untappdUserPage = "https://untappd.com/user/";

// Create clients
var untappd = new UntappdClient();
untappd.setAccessToken(untappdAccessToken);
var slack = new Slack();
slack.setWebhook(SlackWebhook);

// Not used at the moment.
// var sendToSlack = function(channel, message) {
//   slack.api('chat.postMessage', {
//     text: message,
//     channel: channel,
//     username: botname
//   }, function(err, res) {
//     console.log(err, res);
//   });
// };

// accept pending request
var acceptPending = function(user, user_uid, cb) {
  untappd.acceptFriends(function(err, obj) {
    if (err) {
      cb(err, "Error while accepting your friend request.");
    } else if (obj.meta.code !== 200) {
      cb(obj, "Error while accepting your friend request.");
    } else {
      cb(null, "I accepted friend request from Untapdd user " + user);
    }
  }, {TARGET_ID: user_uid});
};

// Create friend request from untappd
var createFriendRequest = function(user, cb) {
  untappd.userInfo(function(err, obj){
    console.log("Fetched UserInfo. OBJ: ", obj);
    if (err) {
      cb(err, "Error while getting user info from Untappd.");
    } 
    if (obj && obj.meta && obj.meta.code === 500) {
      if (obj.meta.error_detail === 'There is no user with that username.') {
        cb(obj, "Could not found user " + user);
      } else {
        cb(obj, "Unknown error on creating friend request.");
      }
    } else if (obj.meta.code === 200) {
      untappd.requestFriends(function (err, friendReqObj) {
        console.log("Requested friend. friendReqOBJ: ", friendReqObj);
        if (err) {
          cb(err, "Error on creating friend request.");
        }
        if (friendReqObj && friendReqObj.meta && friendReqObj.meta.code === 500) {
          if (friendReqObj.meta.error_detail === 'This request is pending your approval.') {
            acceptPending(user, obj.response.user.uid, cb);
          }
          else if (friendReqObj.meta.error_detail === "This request is pending the user\'s approval.") {
            cb(null, "Friend request has already made for Untappd user " + user + ". Go and accept it at " + untappdUserPage + user);
          }
          else if (friendReqObj.meta.error_detail === 'You are already friends with this user.') {
            cb(null, "Untappd-user " + user + " and I are already friends!");
          }
          else {
            cb(friendReqObj, "Tuntematon virhe");
          }
        }
        else if (friendReqObj && friendReqObj.meta && friendReqObj.meta.code === 200) {
          cb(null, "Untappd-user " + user  + ": I made friend request for you! Go and accept it at " + untappdUserPage + user);
        }
      }, {TARGET_ID: obj.response.user.uid}); // for requestFriends
    } else {
      cb(obj, "Unknown error on getting user info");
    }
  }, {"USERNAME" : user}); // for userInfo
};

exports.handler = function(event, context, callback) {
  var body = _.chain(event.body)
  .split("&")
  .map(function(n) {
    return _.split(n, "=");
  })
  .fromPairs()
  .value();

  if (body.token !== slack_slash_token) {
    console.log("Incorrect token: ", body.token, slack_slash_token);
    callback(null, {
      statusCode: 401
    });
  } else {
    console.log(body.user_name + ": " +  body.text);

    var words = body.text.split("+");
    if (words.length !== 1 || (words.length > 0 && (words[0].toLowerCase().trim() === "help" || words[0].trim() === ""))) {
      console.log("SUCCESS: not command");
      callback(null, {
        statusCode: 200,
        body: "Command Seppo to create friend request or to accept friend request from Untappd-user with command '/KaljaSieppo untappd-username'"
      });
    } else {
      callback(null, {
        statusCode: 200,
        body: "Creating or accepting friend request, wait for a few seconds..."
      });
      console.log("Start creating request");
      createFriendRequest(body.text, function(err, value) { 
        if (err) {
          console.log("ERROR: ", err);
          var responseBody = JSON.stringify({
            "text": value
          })
        } else {
          console.log("SUCCESS", value);
          var responseBody = {
            "channel": decodeURIComponent(body.channel),
            "text": value,
            "response_type": "in_channel"
          }
          var host = decodeURIComponent(body.response_url);
          // fire request
          request({
            url: host,
            method: "POST",
            json: responseBody
          }, function(err, resp, bod) {
            console.log("err", err);
            console.log("resp", resp);
            console.log("body", bod);
          });
        }
      });
    }
  }
};

