let Slack = require('slack-node');
const Untappd = require("untappd-js");
let _ = require('lodash');
let request = require('request');
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

// Environment
const untappdAccessToken = process.env.UNTAPPD_ACCESS_TOKEN;
const SlackWebhook = process.env.SLACK_WEBHOOK;
const botname = process.env.BOTNAME;
const slack_slash_token = process.env.SLACK_SLASH_TOKEN;
const dbb_table = process.env.DBB_TABLE;

// Constant strings etc
const untappdUserPage = "https://untappd.com/user/";

// Create clients
let untappd = new Untappd(untappdAccessToken);
let slack = new Slack();
slack.setWebhook(SlackWebhook);

// Create friend request from untappd
let createFriendRequest = (username) => {
  return new Promise((resolve, reject) => {
    untappd.userInfo({USERNAME: username})
      .then((data) => {
        if (data.meta.code === 200) {
          console.log("UserInfo fetched");
          return untappd.requestFriends({TARGET_ID: data.response.user.uid});
        }
      }).then((data) => {
        if (data.meta.code === 200) {
          console.log("FriendRequest successful");
          return resolve({status: 200, message:"Untappd-user " + username + ": I made friend request for you! Go and accept it at " + untappdUserPage + username});
        }
      }).catch((reason) => { // Catch reject and handle. Designed to work this way...
        console.log("Can't create friendRequest");
        if (reason.response.status === 500) {
          if (reason.response.data.meta.error_detail === "This request is pending the user\'s approval.") {
            console.log("pending request");
            return new Promise((resolve, reject) => {
              resolve({status: 200, message: "Untappd-user " + username + ": I have already made friend request for you! Go and accept it at " + untappdUserPage + username});
            });
          } else if (reason.response.data.meta.error_detail === 'You are already friends with this user.') {
            console.log("already friends");
            return new Promise((resolve, reject) => {
              resolve({status: 200, message: "Untappd-user " + username + ": We are already friends!"});
            });
          } else if (reason.response.data.meta.error_detail === 'This request is pending your approval.') {
            console.log("accepting request");
            return untappd.acceptFriends({TARGET_ID: reason.config.params.TARGET_ID});
          } else if (reason.response.data.meta.error_detail === 'There is no user with that username.') {
            console.log("no user with that name");
            return new Promise((resolve, reject) => {
              resolve({status: 200, message: "There is no user with name: " + username});
            });
          } else {
            return new Promise((resolve,reject) => {
              reject("Unknown Server Error")
            });
          }
        }
      }).then((data) => {
        if (data && data.meta) {
          console.log(data);
          if (data.meta.code === 200) {
            resolve({status: 200, message: "Untappd-user " + username + ": I accepted your friend request!"});
          } else {
            reject(data);
          }
        }
        if (data && data.status === 200) {
          resolve(data);
        } else {
          reject(data);
        }
      }).catch((reason) => {
        console.log(reason);
      });
  });
};


// Handler for lambda
exports.handler = (event, context, callback) => {
  let body;
  if (event.slackEvent) {
    // so called 'second phase' handling
    body = event.slackEvent;
  } else {
    body = _.chain(event.body)
      .split("&")
      .map((n) => {
        return _.split(n, "=");
      })
      .fromPairs()
      .value();
  }
  if (body.token !== slack_slash_token) {
    console.log("Incorrect token: ", body.token, slack_slash_token);
    callback(null, {
      statusCode: 401
    });
  } else if (!event.slackEvent) {
    // 'first phase' handling
    console.log(body.user_name + ": " +  body.text);
    let words = body.text.split("+");
    if (words.length !== 1 || (words.length > 0 && (words[0].toLowerCase().trim() === "help" || words[0].trim() === ""))) {
      console.log("SUCCESS: not command");
      callback(null, {
        statusCode: 200,
        body: "Command Seppo to create friend request or to accept friend request from Untappd-user with command '/KaljaSieppo untappd-username'"
      });
    } else {
      console.log("createFriendRequest...");
      return new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: context.functionName,
          InvocationType: 'Event',
          Payload: JSON.stringify({
            slackEvent: body // use this to recognize 'second phase'
          }),
          Qualifier: context.functionVersion
        }, (err, done) => {
          if (err) return reject(err);
          resolve();
        });
      }).then(() => {
        console.log("Send fast response to Slack");
        callback(null, {
          statusCode: 200,
          body: "Creating or accepting friend request, wait for a few seconds..."
        });
      });
    }
  } else {
    // so called 'second phase' handling'
    createFriendRequest(body.text)
      .then((data) => {
        console.log("friendRequest handled");
        if (data.status === 200) {
          let responseBody = {
            "channel": decodeURIComponent(body.channel),
            "text": data.message,
            "response_type": "in_channel"
          }
          if (body.response_url && responseBody) {
            let host = decodeURIComponent(body.response_url);
            console.log("Sending delayed response to [" + host + "] after success: ", responseBody);
            // fire request
            request({
              url: host,
              method: "POST",
              json: responseBody
            });
          } else {
            // debugging probably...
            console.log("Can't send response");
          }
        } else {
          reject(data);
        }
      }).catch((reason) => {
        console.log("Error with Slack delayed response: ", reason);
      });
  }
};
