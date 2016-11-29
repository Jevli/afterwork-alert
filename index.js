var UntappdClient = require("node-untappd");
var Slack = require('slack-node');
var slack = new Slack();
var _ = require('underscore');
var moment = require('moment');
var config = require('./config');

// Definitions
var clientId = [ config.clientId ];
var clientSecret = [ config.clientSecret ];
var accessToken = [ config.accessToken ];
var loopingTime = config.loopingTime; 
var whatIsCountedAsAfterWork = config.whatIsCountedAsAfterWork;
var lookupuser = config.lookupuser;
var slackWebhookURL = config.slackWebhookURL;
var channels = config.channels;
var botname = config.botname;

// Set to true if you want to see all sort of nasty output on stdout.
var debug = false;
if (process.argv.length > 2 && process.argv[2] == 'debug') {
  debug = true;
}

// Create Client
var untappd = new UntappdClient(debug);
untappd.setClientId(clientId);
untappd.setClientSecret(clientSecret);
untappd.setAccessToken(accessToken); // TODO add accessToken adding LATER get accessToken

// setInterval(get, 1000);
get();
function get() {
untappd.activityFeed(function(err,obj){
  if (debug) console.log(obj, err);

  var afterwork = [];

  // Check what counts is really | either this or items.size etc
  if (obj && obj.response && obj.response.checkins.count > 0) {
  
    var items = obj.response.checkins.items;

    for( var item of items ) {
      afterwork.push({
        'time': item.created_at,
        'vid': item.venue !== undefined ? item.venue.venue_id : undefined,
        'vname': item.venue !== undefined ? item.venue.venue_name : undefined,
        'city': item.venue !== undefined && item.venue.location !== undefined ? item.venue.location.venue_city : undefined,
        'uid': item.user.uid,
        'name': item.user.first_name + ' ' + item.user.last_name
      });
    }

    var current_time = moment().subtract(2, 'd'); // TODO: change to timestamp

    /*var testi = [
      {'vid': 1, 'vname': 'bar1', 'name': 'user1', 'city': 'Tampere', 'time': 'Sun, 27 Nov 2016 15:51:00 +0000'},
      {'vid': 1, 'vname': 'bar1', 'name': 'user2', 'city': 'Tampere', 'time': 'Sun, 27 Nov 2016 15:51:00 +0000'},
      {'vid': 2, 'vname': 'bar2', 'name': 'user3', 'city': 'Tampere', 'time': 'Sun, 27 Nov 2016 15:51:00 +0000'},
      {'vid': 3, 'vname': 'bar3', 'name': 'user4', 'city': 'Tampere', 'time': 'Sun, 20 Nov 2016 13:51:00 +0000'},
      {'vid': 3, 'vname': 'bar3', 'name': 'user5', 'city': 'Tampere', 'time': 'Sun, 27 Nov 2016 13:51:00 +0000'}
    ]*/

    afterwork = _.chain(afterwork)
      .filter(function(elem) {
        return moment(elem.time, 'ddd, D MMM YYYY HH:mm:ss +0000').isAfter(current_time);
      })
      .filter(function(elem) {
        return elem.vid;
      })
      .groupBy(function(elem) {
        return elem.vid;
      })
      .values()
      .map(function(elem) {
        return _.uniq(elem, false, function(a) {
          return a.uid + "--" + a.vid;
        });
      })
      .filter(function(elem) {
        return elem.length > 1;
      })
      .value();

    if (debug) console.log(afterwork);

    // Slack stuff
    slack.setWebhook(slackWebhookURL); // set url
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
      slack.webhook(payload, function(err, response) {
        if (debug) console.log(response);
      })
    }
  }

});
}
