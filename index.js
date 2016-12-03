var UntappdClient = require("node-untappd");
var Slack = require('slack-node');
var _ = require('underscore');
var moment = require('moment');
var https = require('https');
var WebSocket = require('ws');
var config = require('./config')[process.env.mode];

// Definitions
var clientId = [ config.clientId ];
var clientSecret = [ config.clientSecret ];
var accessToken = [ config.accessToken ];
var loopingTime = config.loopingTime; 
var whatIsCountedAsAfterWork = config.whatIsCountedAsAfterWork;
var lookupuser = config.lookupuser;
var slackApiToken = config.slackApiToken;
var channels = config.channels;
var botname = config.botname;

var old;

// Set to true if you want to see all sort of nasty output on stdout.
var debug = false;
if (process.argv.length > 2 && process.argv[2] == 'debug') {
  debug = true;
}

// Create Untappd Client
var untappd = new UntappdClient(debug);
untappd.setClientId(clientId);
untappd.setClientSecret(clientSecret);
untappd.setAccessToken(accessToken); // TODO add accessToken adding LATER get accessToken
// Create Slack Client
var slack = new Slack(config.slackApiToken);

var getAfterworkFeed = function(cb) {
  untappd.activityFeed(function (err, obj) {
    if (debug) console.log(obj, err);

    var afterwork = [];

    // Check what counts is really | either this or items.size etc
    if (obj && obj.response && obj.response.checkins.count > 0) {

      var items = obj.response.checkins.items;

      for (var item of items) {
        afterwork.push({
          'time': item.created_at,
          'vid': item.venue !== undefined ? item.venue.venue_id : undefined,
          'vname': item.venue !== undefined ? item.venue.venue_name : undefined,
          'city': item.venue !== undefined && item.venue.location !== undefined ? item.venue.location.venue_city : undefined,
          'uid': item.user.uid,
          'name': item.user.first_name + ' ' + item.user.last_name
        });
      }

      var earliest_allowed_checkin = moment().subtract(whatIsCountedAsAfterWork); // TODO: change to timestamp

      afterwork = _.chain(afterwork)
        // Checkin has to be new enough
        .filter(function (elem) {
          return moment(elem.time, 'ddd, D MMM YYYY HH:mm:ss +0000').isAfter(earliest_allowed_checkin);
        })
        // Has to have venue
        .filter(function (elem) {
          return elem.vid;
        })
        .groupBy(function (elem) {
          return elem.vid;
        })
        .values()
        // Reduce all places where is no updates with diff under 15 minutes
        // Exludes same users drinks in same venue
        .map(function (elem) {
          return _.uniq(elem, false, function (a) {
            return a.uid + "--" + a.vid;
          });
        })
        // Has to have more than one user in same bar
        .filter(function (elem) {
          return elem.length > 0;
        })
        .value();

      if (debug) console.log(afterwork);
      cb(afterwork);
    }
  });
};

var parseAfterWorkAndSendToSlack = function(afterwork) {
  // for every venue, send message
  for (let venue of afterwork) {
    // build persons string
    var persons = "";
    for(let checkin of venue) {
      persons += checkin.name + ' ';
    }
    persons = persons.slice(0, -1);
    // build payload
    var payload = {
      'text': venue.length + ' henkilöä afterworkilla ravintolassa ' + venue[0].vname + ' (' + persons + ')',
      'channel': channels[venue[0].city],
      'username': botname
    }
    slack.api("chat.postMessage", payload, function(err, response) {
      if (debug) console.log(response);
    })
  }
};

// Actually call methods
function timer() {
  getAfterworkFeed(parseAfterWorkAndSendToSlack);
}

timer();
//setInterval(timer, loopingTime);

slack.api("rtm.start", function(err, response) {
  //var uId = getUserId();
  //openWebsocket(response.url);
});

function openWebsocket(url) {
  var ws = new WebSocket(url);

  ws.on('message', function(message) {
    console.log(message);
    message = JSON.parse(message);
    if (message.type == 'message') {
      if (message.text.indexOf("@U39NVR4BV")) {
        console.log(message.text.split(' ')[1]);
        var untappdId;        
        untappd.userInfo(function(err, obj){
          console.log(obj.response.user.uid);
          untappdId = obj.response.user.uid;
        }, {"USERNAME" : message.text.split(' ')[1]});
        // EI TESTATTU OSUUS
        /*untappd.friendRequest(function (err, obj) {
          console.log('add friend');
        }, {'TARGET_ID': untappdId });*/
      }
    }
  });
}


// Custom Slack Bot Stuff
function startBot() {
  if (debug) console.log("Bot not yet done");
};
