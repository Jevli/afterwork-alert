# afterwork-alert
This is Untappd-Slack integration for alerting Slack-users when there is afterwork going on somewhere. Slack users should have Untappd accounts and Slack team needs to use one users Untappd account or create account for bot in Untappd. That users (or bots) Untappd-friends checkins are followed and notified to Slack.
![alt text](https://raw.githubusercontent.com/jevli/afterwork-alert/master/images/notify.png)

Application is build of two different parts. First is parsing untappd feed and notifying Slack when there's afterwork group somewhere. Second is for creating Untappd friend requests and approving friend requests via Slack. Both are run with Serverless Framework in Amazon Web Services Lambdas and API Gateway. 
![alt text](https://raw.githubusercontent.com/jevli/afterwork-alert/master/images/drawio.png)

# Installation to AWS with Serverless Framework tools
* Create AWS Account
* Install serverless
    * https://serverless.com/framework/docs/providers/aws/guide/installation/
* Add your aws profile in to ~/.aws/credentials
* Create incoming webhook to Slack
    * Save webhook url to AFTWRK_SLACK_WEBHOOK environment variable as shown below
* Create slash command to Slack
    * Customize Slack -> Configure Apps -> Custom Integrations -> Slash Commands -> Add Configuration
    * URL is address for the AWS Lambdas API GATEWAY address
    * Token should be saved in AFTWRK_SLACK_SLASH_TOKEN environment variable as shown below
    * Method POST
* Get Untappd Access Token
    * https://untappd.com/api/register
* Set environment variables and deploy

```
export AFTWRK_PROFILE=your-aws-profile
export AFTWRK_SLACK_WEBHOOK=slack-incoming-webhook-url
export AFTWRK_SLACK_SLASH_TOKEN=slack-slash-token
export AFTWRK_UNTAPPD_ACCESS_TOKEN=untappd-access-token
export AFTWRK_BOTNAME=your-slack-botname
export AFTWRK_FALLBACK_CHANNEL=#afterwork-alert

cd untappdFeedParser/
npm install
sls deploy -v
cd ../commands/
npm install
sls deploy -v
```

# Example of parsing logic
* Runs once in every 10 minutes
* Fetches Untappd feed from last 20 minutes
* Creates groups from that time with logic
    * At least 1 checkin is from last 10 minute period from different Untappd-users
    * At least 2 checkins total within last 20 minutes from different Untappd-users
![alt text](https://raw.githubusercontent.com/jevli/afterwork-alert/master/images/parsingLogic.png)

# Slack slash commands (only friend requesting)
* If have given slash commands name 'KaljaSieppo' 
* Command in Slack: '/KaljaSieppo untappd-username'
* Checks if untappd-username exists in Untappd and sends Friend-request. Informs if request was made already or user have made Friend-request to bot user
![alt text](https://raw.githubusercontent.com/jevli/afterwork-alert/master/images/friendRequest.png)

# Backlog
Ideas, Backlog, In Progress and stuff are located at Repositorys project tab https://github.com/Jevli/afterwork-alert/projects/1

# Challenges and solutions
* Time handling has been pain in the ass. Moment.js made things a lot easier.
* All the parsing and stuff could be done without lodash. But lodash makes development much enjoyable.
    * Parsing logic originally had more complex logic than today. It filtered out all the checkins which had been used previously with some aw-notify and few other conditions.
    * Took lot of time to get logic together, but in the end it is quite easy to understand.
    * Logic was simplified after AWS Lambda refactor
* Lambda refactoring, stateless architecture and more configs on Slack and AWS. Serverless Framework made AWS configs much easier.
    * Simplified parsin algorithm so it doesn't need to save used checkins. 
    * Could solve this also by adding AWS DynamoDB 

