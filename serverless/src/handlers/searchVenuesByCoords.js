var https = require('https');

exports.handler = (event, context, callback) => {
    var url = 'https://api.foursquare.com/v2/venues/search' +
            '?client_id=' + process.env.CLIENT_ID +
            '&client_secret=' + process.env.CLIENT_SECRET +
            '&v=20161001&radius=50&intent=checkin' +
            '&radius=' + process.env.RADIUS +
            '&ll=' + event.ll;
    console.log('Event:', event);
    console.log('Url: ', url);
    
    https.get(url, (res) => {
        console.log('Res: ', res)
        if (res.statusCode !== 200) {
            callback('Looks like there was a problem. Status Code: ' + res, null);
        }
        
        var rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
            try {
                var venues = JSON.parse(rawData).response.venues;
                console.log(venues);
                console.log('succeed')
                callback(null, venues)
                context.succeed();
            } catch (e) {
                console.log('error')
                callback('Error: ' + e, null);
                context.done();
            }
        });
        
    });
};
