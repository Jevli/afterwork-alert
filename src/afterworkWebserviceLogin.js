exports.handler = (event, context, callback) => {
    console.log("Start login")
    if (event.uname && event.pwd) {
        console.log("Uname and pwd found")
        // TODO check uname and pwd match
        
        console.log("succeed")
        callback(null, {"ApiKey": process.env.APIKEY})
        context.succeed();
        
    } else {
        callback("Missing Username or Password", null);
        context.done();
    }
};
