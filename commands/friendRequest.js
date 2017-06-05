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
      cb(err, "Virhe kaveripyyntösi hyväksymisessä.");
    } else if (obj.meta.code !== 200) {
      cb(obj, "Kaveripyyntösi hyväksynnässä oli jokin ongelma.");
    } else {
      cb(null, "Hyväksyin Untappd-tunnuksen " + user + " kaveripyynnön!");
    }
  }, {TARGET_ID: user_uid});
};

// Create friend request from untappd
var createFriendRequest = function(user, cb) {
  untappd.userInfo(function(err, obj){
    console.log("Fetched UserInfo. OBJ: ", obj);
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
      untappd.requestFriends(function (err, friendReqObj) {
        console.log("Requested friend. friendReqOBJ: ", friendReqObj);
        if (err) {
          cb(err, "Virhe kaveripyynnön tekemisessä");
        }
        if (friendReqObj && friendReqObj.meta && friendReqObj.meta.code === 500) {
          if (friendReqObj.meta.error_detail === 'This request is pending your approval.') {
            acceptPending(user, obj.response.user.uid, cb);
          }
          else if (friendReqObj.meta.error_detail === "This request is pending the user\'s approval.") {
            cb(null, "Untappd-käyttäjälle " + user + " on jo kaveripyyntö odottamassa. Käy hyväksymässä osoitteessa " + untappdUserPage + user);
          }
          else if (friendReqObj.meta.error_detail === 'You are already friends with this user.') {
            cb(null, "Untappd-käyttäjä " + user + " ja minä ollaan jo kavereita!");
          }
          else {
            cb(friendReqObj, "Tuntematon virhe");
          }
        }
        else if (friendReqObj && friendReqObj.meta && friendReqObj.meta.code === 200) {
          cb(null, "Untappd-käyttäjä " + user  + ": tein sulle kaveripyynnön! Käy hyväksymässä osoitteessa " + untappdUserPage + user);
        }
      }, {TARGET_ID: obj.response.user.uid}); // for requestFriends
    } else {
      cb(obj, "Tuntematon ongelma käyttäjätietojen haussa.");
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
    callback(null, {
      statusCode: 401
    });
  } else {
    console.log(body.token, slack_slash_token);
    console.log(body.user_name + ": " +  body.text);

    var words = body.text.split("+");
    if (words.length !== 1 || (words.length > 0 && (words[0].toLowerCase().trim() === "help" || words[0].trim() === ""))) {
      console.log("SUCCESS: ei komento");
      callback(null, {
        statusCode: 200,
        body: "Käske Seppoa tekemään tai hyväksymään kaveripyyntö '/KaljaSieppo untappd-nimimerkki'"
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
            // body: value
            body: JSON.stringify({
              "response_type": "in_channel",
              "text": value
            })
          });
        }
      });
    }
  }
};

