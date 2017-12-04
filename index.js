"use strict";

const slack_slash_token = process.env.SLACK_SLASH_TOKEN;

var friendRequest = require("./friendRequest").handler;

var foo = (err, data) => {
  console.log("back to callback:", data);
}

friendRequest({
  body: "token=" + slack_slash_token + "&text=OzQu&user_name=oskari&channel=#afterwork-alert"
}, {}, foo);
