'use strict';
var doc = require('dynamodb-doc');
var dynamodb = new doc.DynamoDB();

exports.handler.login = (event, context, callback) => {
    var table = 'users';
    var loginInfo = JSON.parse(event.body);
    var response = {
        headers: {
            "Access-Control-Allow-Origin" : "*"
        }
    };
    if (loginInfo.uname && loginInfo.pwd) {
        var parameters;
        // TODO query parameters
        dynamodb.get({
            "TableName": table,
            "Key": {
                "uname": uname,
                "pwd": pwd
            }
        }, function (err, data) {
            if (err) {
                response['statusCode'] = 404;
                response['body'] = JSON.stringify({"error": "error", error: err});
                callback(response, null);
                context.done();
            } else {
                response['statusCode'] = 200
                response['body'] = JSON.stringify({"message": "succes"});
                callback(null, response)
                context.succeed();
            }
        });
        
    } else {
        callback("Missing Username or Password", null);
        context.done();
    }
};
