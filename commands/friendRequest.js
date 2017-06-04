var Slack = require('slack-node');
var UntappdClient = require("node-untappd");
var _ = require('lodash');

// Environment
const untappdAccessToken = process.env.UNTAPPD_ACCESS_TOKEN;
const SlackWebhook = process.env.SLACK_WEBHOOK;
const botname = process.env.BOTNAME;
const slack_slash_token = process.env.SLACK_SLASH_TOKEN;

// Create clients
var untappd = new UntappdClient();
untappd.setAccessToken(untappdAccessToken);
var slack = new Slack();
slack.setWebhook(SlackWebhook);


const untappdUserPage = "https://untappd.com/user/";

// Not used at the moment.
var sendToSlack = function(channel, message) {
  slack.api('chat.postMessage', {
    text: message,
    channel: channel,
    username: botname
  }, function(err, res) {
    console.log(err, res);
  });
};

// accept pending request
var acceptPending = function(user_uid, cb) {
  untappd.acceptFriends(function(err, obj) {
    if (!err) {
      cb(null, "Hyväksyin sun kaveripyyntösi!");
    } else {
      cb(err, "Kaveripyyntösi hyväksynnässä oli jokin ongelma.");
    }
  }, {'TARGET_ID': user_uid});
};

// Create friend request from untappd
var createFriendRequest = function(user, cb) {
  untappd.userInfo(function(err, obj){
    if (err) {
      cb(err, "Virhe userInfon hakemisessa Untappd:sta");
    } 
    if (obj && obj.meta && obj.meta.code === 500) {
      if (obj.meta.error_detail === 'There is no user with that username.') {
        cb(obj, "Ei löytynyt käyttäjää " + user);
      } else {
        cb(obj, "Tuntematon ongelma kaveripyynnön luonnissa.");
      }
    } else if (obj.meta.code === 200) {
      untappd.requestFriends(function (err, obj) {
        if (err) {
          cb(err, "Virhe kaveripyynnön tekemisessä");
        }
        if (obj && obj.meta && obj.meta.code === 500) {
          if (obj.meta.error_detail === 'This request is pending your approval.') {
            acceptPending(obj.response.user_uid, cb);
          }
          else if (obj.meta.error_detail === "This request is pending the user\'s approval.") {
            cb(null, "Sulle on jo kaveripyyntö odottamassa. Käy hyväksymässä osoitteessa " + untappdUserPage + user);
          }
          else if (obj.meta.error_detail === 'You are already friends with this user.') {
            cb(null, "Ollaan jo kavereita!");
          }
          else {
            cb(obj, "Tuntematon virhe");
          }
        }
        else if (obj && obj.meta && obj.meta.code === 200) {
          cb(null, "Tein sulle kaveripyynnön! Käy hyväksymässä osoitteessa " + untappdUserPage + user);
        }
      }, {'TARGET_ID': obj.response.user.uid});
    } else {
      cb(obj, "Tuntematon ongelma kaveripyynnön luonnissa.");
    }
  }, {"USERNAME" : user});
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
    callback(null, {
      statusCode: 401
    });
  } else {
    console.log(body.token, slack_slash_token);

    console.log(body.user_name + ": " +  body.text);

    var words = body.text.split("+");
    if (words.length !== 1 || (words.length > 0 && words[0].toLowerCase() === "help")) {
      console.log("SUCCESS: ei komento");
      callback(null, {
        statusCode: 200,
        body: "Käske Seppoa tekemään kaveripyyntö '/KaljaSieppo untappd-nimimerkki'"
      });
    } else {
      createFriendRequest(body.text, function(err, value) { 
        if (err) {
          console.log("ERROR: ", err);
          callback(null, {
            statusCode: 200,
            body: value
          });
        } else {
          console.log("SUCCESS", value);
          callback(null, {
            statusCode: 200,
            body: value
          });
        }
      });
    }
  }
};

