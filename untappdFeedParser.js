"use strict";
var Slack = require("slack-node");
var UntappdClient = require("node-untappd");
var _ = require('lodash');
var moment = require('moment');

var UntappdAccessToken = process.env.UNTAPPD_ACCESS_TOKEN;
var SlackWebhook = process.env.SLACK_WEBHOOK;
var whatIsCountedAsAfterwork = process.env.WHAT_IS_COUNTED_AS_AFTERWORK;
var whatIsCountedAfterPrevious = process.env.WHAT_IS_COUNTED_AS_PREVIOUS;
var fallbackChannel = process.env.FALLBACK_CHANNEL;
var botname = process.env.BOTNAME;

var timeFormat = 'ddd, DD MMM YYYY HH:mm:ss +0000';

var untappd = new UntappdClient();
untappd.setAccessToken(UntappdAccessToken);

var slack = new Slack();
slack.setWebhook(SlackWebhook);

function getUntappdFeed() {
  return new Promise(function(resolve, reject) {
    untappd.activityFeed(function (err, obj) {
      if (err) {
        reject(err);
      }
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

function parseAfterworkers(feed) {
  return new Promise(function(resolve, reject) {
    // subtract twice to get afterworks between loops
    var earliest_allowed_checkin = moment().utc().subtract({ minutes: whatIsCountedAsAfterwork*2 });
    console.log("PARSER earliest: " + earliest_allowed_checkin.toString());
    var afterwork = _.chain(feed)
      .sortBy(function(checkin) {
        return moment(checkin.time, timeFormat);
      })
      .filter(function(checkin) {
        console.log("PARSER " + checkin.fname + checkin.lname.charAt(0).toUpperCase() + " (" + checkin.vname + "): "
          + moment(checkin.time, timeFormat).utc().toString());

        return moment(checkin.time, timeFormat).utc().isAfter(earliest_allowed_checkin) // Not too long time ago
          && (checkin.vid)// has to have venue
      })
      // Group by venue
      .groupBy(function(checkin) {
        return checkin.vid;
      })
      .values()
      .map(function (checkInsInOneVenue) { // Do this for all users grouped by venue
        return checkInsInOneVenue.reduce(function(a, b) {
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
            return a;
          }
          return a;
        }, []);
      })
      // Has to have more than one user in same venue
      .filter(function(elem) {
        return elem.length > 1;
      })
      .value();
    console.log("PARSER afterworkers: ", afterwork, "end of parsed afterworkers");
    resolve(afterwork);
  });
}

// a: list of current checkins which are having AW
// b: checkin to be tested against a
function isCountedInAW(a, b) {
  var min = moment(a[0].time, timeFormat); // First one's checkin time
  var max = a.length < 2
    ? moment(min).add({ minutes: whatIsCountedAsAfterwork }) // First one + maxTime
    : moment(a[a.length - 1].time, timeFormat).add({ minutes: whatIsCountedAfterPrevious }); // Previous added + maxTimeAfterPrevious
  var current = moment(b.time, timeFormat);
  if (current.isBetween(min, max)
    && (a.find(function(checkin) { return checkin.uid === b.uid }) === undefined)) {
    return true;
  }
  return false;
}

function buildPayloads(afterwork) {
  return new Promise(function(resolve, reject) {
    // for every venue, send message
    var payloads = [];
    for (var i = 0; i < afterwork.length; i++) {
      var venue = afterwork[i];
      // build persons string
      var persons = "";
      for (var j = 0; j < venue.length; j++) {
        var checkin = venue[j];
        persons += checkin.fname.replace(/\W/g, '') + checkin.lname.replace(/\W/g, '').charAt(0).toUpperCase() + ', ';
      }
      persons = persons.slice(0, -2);
      // build payload
      // TODO find better way to save city: channel -values
      var channel = process.env["CHANNEL_" + venue[0].city.toUpperCase()] || fallbackChannel;
      var payload = {
        'text': venue.length + ' henkilöä afterworkilla sijainnissa ' + venue[0].vname + ' (' + persons + ')',
        'channel': channel,
        // 'channel': '#afterwork-alert',
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
  slack.webhook({
    text: message,
    channel: channel,
    username: botname
  }, function(err, res) {
    console.log(err, res);
  });
}

exports.handler = function(event, context, callback) {
  getUntappdFeed()
    .then(parseAfterworkers)
    .then(buildPayloads)
    .then(function(resolve, reject) {
      console.log(resolve);
      resolve.map(function(payload) {
        slack.webhook(payload, function(err, response) {
          console.log("SLACK response: ", response);
        });
        console.log("SLACK resolve: ", payload);
        callback(null, "Success");
      });
    })
    .catch(function(reason) {
      console.log("ERROR reason: ", reason);
      callback(reason, null);
    });
}

// exports.handler(null, null, function(err, res) {});
