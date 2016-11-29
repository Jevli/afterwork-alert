var UntappdClient = require("node-untappd/UntappdClient",false);
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
var slackWebhookURL = [ config.slackWebhookURL ];
var channels = {
  'Helsinki': '#afterwork-hki',
  'Tampere': '#afterwork-tre',
  'Jyväksylä': '#afterwork-jkl'
};

// Set to true if you want to see all sort of nasty output on stdout.
var debug = false;

// Create Client
var untappd = new UntappdClient(debug);
untappd.setClientId(clientId);
untappd.setClientSecret(clientSecret);
untappd.setAccessToken(accessToken); // TODO add accessToken adding LATER get accessToken

untappd.activityFeed(function(err,obj){
  if (debug) console.log(obj, err);
  console.log(obj);

  var afterwork;
  // Check what counts is really | either this or items.size etc
  /*if (obj & obj.checkins.count > 0) {
    for( var item of obj.items ) {
      afterwork.push({
        'time': item.created_at,
        'vid': item.venue.venue_id,
        'vname': item.venue.venue_name,
        'city': item.venue.location.venue_city,
        'uid': item.user.uid,
        'name': item.user.first_name + ' ' + item.user.last_name
      });
    }*/

    // mockup data. parsing this data properly should result to only one afterwork bar (vid: 1)
    var current_time = moment('Sun, 27 Nov 2016 15:51:00 +0000', 'ddd, D MMM YYYY HH:mm:ss +0000').subtract(3, 'd'); // TODO: change to timestamp

    var testi = [
      {'vid': 1, 'vname': 'bar1', 'name': 'user1', 'city': 'Tampere', 'created_at': 'Sun, 27 Nov 2016 15:51:00 +0000'},
      {'vid': 1, 'vname': 'bar1', 'name': 'user2', 'city': 'Tampere', 'created_at': 'Sun, 27 Nov 2016 15:51:00 +0000'},
      {'vid': 2, 'vname': 'bar2', 'name': 'user3', 'city': 'Tampere', 'created_at': 'Sun, 27 Nov 2016 15:51:00 +0000'},
      {'vid': 3, 'vname': 'bar3', 'name': 'user4', 'city': 'Tampere', 'created_at': 'Sun, 20 Nov 2016 13:51:00 +0000'},
      {'vid': 3, 'vname': 'bar3', 'name': 'user5', 'city': 'Tampere', 'created_at': 'Sun, 27 Nov 2016 13:51:00 +0000'}
    ]

    afterwork = _.chain(testi)
      .filter(function(elem) {
        return moment(elem.created_at, 'ddd, D MMM YYYY HH:mm:ss +0000').isAfter(current_time);
      })
      .groupBy(function(elem) {
        return elem.vid;
      })
      .values()
      .filter(function(elem) {
        return elem.length > 1;
      })
      .value();

    console.log(afterwork);

    // Slack stuff
    slack.setWebhook(slackWebhookURL); // set url
    // for every venue, send message
    for (let venue of afterwork) {
      // build persons string
      var persons = "";
      for(let checkin of venue) {
        persons += checkin.name + ' ';
      }
      // build payload
      var payload = {
        'text': 'ravintolassa ' + venue[0].vname + ' ' + venue.length + ' henkilöä afterworkilla ( ' + persons + ')',
        'channel': channels[venue[0].city],
        'username': 'SeppoKaljalla'
      }
      slack.webhook(payload, function(err, response) {
        console.log(response);
      })
    }
  //}

}, {'limit': 50});
