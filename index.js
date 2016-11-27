var UntappdClient = require("./node_modules/node-untappd/UntappdClient",false);

// Definitions
var clientId = "[ your api key goes here ]";
var clientSecret = "[ your client secret goes here ]";
var accessToken = "[ your access token goes here ]";

// Set to true if you want to see all sort of nasty output on stdout.
var debug = true;

//The user we want to lookup for this example.
var lookupuser = "jevli";	

// Create Client
var untappd = new UntappdClient(debug);
untappd.setClientId(clientId);
untappd.setClientSecret(clientSecret);
untappd.setAccessToken(accessToken); // TODO add accessToken adding LATER get accessToken

// repeat 15 minutes
untappd.activityFeed(function(err,obj){

    console.log(obj);
  
}, {'limit': 50} );