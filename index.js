var UntappdClient = require("./node_modules/node-untappd/UntappdClient",false);
var _ = require('underscore');

// Definitions
var clientId = "[ your api key goes here ]";
var clientSecret = "[ your client secret goes here ]";
var accessToken = "[ your access token goes here ]";

// Set to true if you want to see all sort of nasty output on stdout.
var debug = false;

//The user we want to lookup for this example.
var lookupuser = "jevli";

// Create Client
var untappd = new UntappdClient(debug);
untappd.setClientId(clientId);
untappd.setClientSecret(clientSecret);
untappd.setAccessToken(accessToken); // TODO add accessToken adding LATER get accessToken

// repeat 15 minutes
untappd.activityFeed(function(err,obj){
  //if (debug) console.log(obj, err);

  var afterwork;
  // Check what counts is really | either this or items.size etc
  /*if (obj & obj.checkins.count > 0) {
   for( var item of obj.items ) {
   afterwork.push({
   'time': item.created_at,
   'vid': item.venue.venue_id,
   'name': item.venue.venue_name,
   'uid': item.user.uid,
   'name': item.user.first_name + ' ' + item.user.last_name
   });
   }*/

  var testi = [
    {'vid': 1, 'name': 'Foo'},
    {'vid': 1, 'name': 'LoL'},
    {'vid': 2, 'name': 'Bar'},
    {'vid': 3, 'name': 'user1'},
    {'vid': 3, 'name': 'user2'}
  ]

  testi = _.chain(testi)
    .groupBy(function(elem) {
    return elem.vid;
    })
    .values().value();

  console.log(testi);

}, {'limit': 50});
