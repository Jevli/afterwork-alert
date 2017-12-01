"use strict";

var feedParser = require("./untappdFeedParser").handler;
var friendRequest = require("./friendRequest").handler;

feedParser({}, {}, (err, response) => {
  console.log(err, response);
});
