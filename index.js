"use strict";

const slack_slash_token = process.env.SLACK_SLASH_TOKEN;

let friendRequest = require("./friendRequest").handler;
let untappdFeedParser = require("./untappdFeedParser").handler;

let foo = (err, data) => {
  console.log("back to callback:", data);
}

untappdFeedParser();


// friendRequest({
//   body: "token=" + slack_slash_token + "&text=OzQu&user_name=oskari&channel=#afterwork-alert"
// }, {}, foo);
