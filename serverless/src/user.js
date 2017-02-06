'use strict';
var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB.DocumentClient();

module.exports.login = (event, context, callback) => {
    var table = 'afterworkUsers';
    var loginInfo = JSON.parse(event.body);
    var response = {
        headers: {
            "Access-Control-Allow-Origin" : "*"
        }
    };
    console.log('LoginInfo: ', loginInfo);
    if (loginInfo.uname && loginInfo.pwd) {
        dynamodb.scan({
            "TableName": table
        }, function (err, data) {
            if (err) {
                response['statusCode'] = 500;
                response['body'] = JSON.stringify({"error": "error", error: err});
                callback(response, null);
                context.done();
            } else {
                data.Items.forEach(function (user) {
                    if (user.uname === loginInfo.uname && loginInfo.pwd === user.pwd) {
                        response['statusCode'] = 200
                        response['body'] = JSON.stringify({"message": "succes"});
                        callback(null, response)
                        context.succeed();
                    } else {
                        response['statusCode'] = 401;
                        response['body'] = JSON.stringify({"error": "error", error: err});
                        callback(response, null);
                        context.done();
                    }
                })
            }
        });
        
    } else {
        callback("Missing Username or Password", null);
        context.done();
    }
};

module.exports.register = (event, context, callback) => {
    var data;
    event.body.token ? data = event.body : data = parse(event.body)
    var uname = data.text.split(' ')[0]
    var slack_id = data.user_id;
    console.time("Duration");
    if (data.token === process.env.SLACK_REGISTER_TOKEN) {
        dynamodb.scan({
            "TableName": "afterworkUsers"
        }, (err, results) => {
            if (err) {
                console.log("err")
            } else {
                if (canReqister(results.Items, uname, slack_id)) {
                    registerUser(data, context, callback)
                } else {
                    createResponse(400, 'No right to user change or create', context, callback)
                }
            }
        })
    }
}

function canReqister(results, uname, slack_id) {
    if (results.lenght === 0) {
        return false;
    }
    var canRegister = true;
    results.forEach((user) => {
        console.log(user)
        if (user.uname === uname && user.slack_id != slack_id) {
            canRegister = false;
        }
    })
    return canRegister
}

function registerUser(data, ctx, cb) {
    console.log('Start register')
    var item = {};
    item["uname"] = data.text;
    item["slack_id"] = data.user_id;
    item["pwd"] = '';
    
    for(var i = 0; i < 4; i++) {
        item["pwd"] += Math.floor(Math.random() * 10); 
    }

    dynamodb.put({
        "TableName": "afterworkUsers",
        "Item": item
    }, (err, d) => {
        if (err) {
            createResponse(500, 'Create error in databe', ctx, cb)
        } else {
            createResponse(200, 'Password is: ' + item.pwd, ctx, cb)
        }
    })
}

function parse(body) {
    var data = {};
    body.split('&').forEach(function(object) {
        var keyValue = object.split('=');
        if (keyValue[0] === 'response_url') {
            data[keyValue[0]] = decodeURIComponent(keyValue[1]);
        } else {
            data[keyValue[0]] = keyValue[1];
        }
    });
    console.log("parse ready")
    return data;
}

function createResponse(code, msg, context, callback) {
    console.log('Code: ', code)
    console.log('MSG ', msg)

    var response = {
        statusCode: code,
        body: msg
    };
    //{"text": msg, "username": "bot", "markdown": true}
    console.timeEnd("Duration");
    if (code >= 300) {
        callback(response, null);
        context.fail();
    } else if (code >= 200) {
        callback(null, response);
        context.succeed();
    }
}