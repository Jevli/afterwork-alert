"use strict";

const Slack = require("slack-node");
const UntappdClient = require("node-untappd");
const _ = require('lodash');
const moment = require('moment');
const geolib = require('geolib');
const util = require('./util');

// Environment
const UntappdAccessToken = process.env.UNTAPPD_ACCESS_TOKEN;
const SlackWebhook = process.env.SLACK_WEBHOOK;
const afterworkTimeSequence = process.env.AFTERWORK_TIME_SEQUENCE;
const fallbackChannel = process.env.FALLBACK_CHANNEL;
const duringworkChannel = process.env.DURINGWORK_CHANNEL;
const botname = process.env.BOTNAME;
const cities = process.env.CITIES.split(" ").map(value => {
  return {
    city: value,
    channel: process.env['CHANNEL_' + value],
    latitude: _.head(process.env['GEO_' + value].split(" ")),
    longitude: _.tail(process.env['GEO_' + value].split(" "))
  }
});

const timeFormat = 'ddd, DD MMM YYYY HH:mm:ss Z';

// Create clients
let untappd = new UntappdClient();
untappd.setAccessToken(UntappdAccessToken);
let slack = new Slack();
slack.setWebhook(SlackWebhook);

// utils
let get = util.get;
let removeDiacritics = util.removeDiacritics;
// 
function getUntappdFeed() {
  return new Promise(function(resolve, reject) {
    untappd.activityFeed(function (err, obj) {
      if (err) {
        reject(err);
      }
      let afterwork = [];
      // Check what counts is really | either this or items.size etc
      if (obj && obj.response && obj.response.checkins && obj.response.checkins.count > 0) {
        let items = obj.response.checkins.items;
        for (let item of items) {
          // City primarily from Untappd-checkins city, secondarily from checkins geolocation's closest city's channel
          let city = util.get(item, 'venue.location.venue_city')
            || getNearestCitysChannel(util.get(item, 'venue.location.lat'), util.get(item, 'venue.location.lng'));
          afterwork.push({
            'cid': item.checkin_id,
            'time': item.created_at,
            'vid': util.get(item, "venue.venue_id"),
            'vname': util.get(item, "venue.venue_name"),
            'city': city,
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

// 
function parseAfterworkers(feed) {
  return new Promise(function(resolve, reject) {
    let earliestAllowedCheckin = moment().utc().subtract({ minutes: afterworkTimeSequence });
    let countedAsAfterwork = moment().utc().subtract({ minutes: afterworkTimeSequence/2 });
    console.log("PARSER earliest: " + earliestAllowedCheckin.toString());
    let afterwork = _.chain(feed)
      .sortBy(function(checkin) {
        return moment(checkin.time, timeFormat);
      })
      .filter(function(checkin) {
        console.log("PARSER " + checkin.fname + checkin.lname.charAt(0).toUpperCase() 
                    + " (" + checkin.vname + " - " + checkin.city +"): "
                    + moment(checkin.time, timeFormat).utc().toString());

        return moment(checkin.time, timeFormat).utc().isAfter(earliestAllowedCheckin) // Not too long time ago
          && (checkin.vid)// has to have venue
      })
      // Group by venue
      .groupBy(function(checkin) {
        return checkin.vid;
      })
      .values()
      .map(function (checkinsInOneVenue) { // Do this for all users grouped by venue
        let checkinsOnLaterHalf = _.chain(checkinsInOneVenue)
        .filter(function(checkin) {
          return moment(checkin.time, timeFormat).utc().isAfter(countedAsAfterwork)
        })
        .uniqBy('uid')
        .value();

        if (checkinsOnLaterHalf.length > 0) {
          return _.uniqBy(checkinsInOneVenue, 'uid');
        } else {
          return [];
        }
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

// 
function buildPayloads(afterwork) {
  return new Promise(function(resolve, reject) {
    // for every venue, send message
    let payloads = [];
    for (let i = 0; i < afterwork.length; i++) {
      let venue = afterwork[i];
      // build persons string
      let persons = "";
      for (let j = 0; j < venue.length; j++) {
        let checkin = venue[j];
        persons += checkin.fname.replace(/\W/g, '') + checkin.lname.replace(/\W/g, '').charAt(0).toUpperCase() + ', ';
      }
      persons = persons.slice(0, -2);
      // build payload
      // TODO find better way to save {city: channel} -values
      var channel = process.env[util.removeDiacritics("CHANNEL_" + venue[0].city.toUpperCase())] || fallbackChannel;
      if (moment().isBetween(moment().hours(5), moment().hours(12))) {
        // something like this. Hopefully works.
        channel = DURINGWORK_CHANNEL;
      }
      let payload = {
        'text': venue.length + ' persons having a nice afterwork at venue ' + venue[0].vname + ' (' + persons + ')',
        'channel': channel,
        'username': botname
      }
      if (channel && botname) {
        payloads.push(payload);
      }
    }
    resolve(payloads);
  });
}

function getNearestCitysChannel(lat, lng) {
  if (lat === undefined || lng === undefined) {
    return undefined;
  }

  geolib.orderByDistance({latitude: lat, longitude: lng}, cities);
  return _.head(cities).city;
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
  console.log("1. Fetch feed 2. Parse afterworks 3. Build payloads 4. Send to Slack");
  getUntappdFeed()
    .then(parseAfterworkers)
    .then(buildPayloads)
    .then(function(resolve, reject) {
      resolve.map(function(payload) {
        console.log("payload:", payload);
        slack.webhook(payload, function(err, response) {
          console.log("SLACK response: ", response);
          callback(null, response);
        });
      });
    })
    .catch(function(reason) {
      console.log("ERROR reason: ", reason);
      callback(reason, null);
    });
};

// exports.handler(null, null, function(err, res) {});

