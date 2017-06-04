# afterwork-alert
This is Untappd-Slack integration for alerting Slack-users when there is afterwork going on somewhere. Slack users should have Untappd accounts and Slack team needs to use one users Untappd account or create account for bot in Untappd. That users (or bots) Untappd-friends checkins are followed and notified to Slack.

Application is build of two different parts. First is parsing untappd feed and notifying Slack when there's afterwork group somewhere. Second is for creating Untappd friend requests and approving friend requests via Slack. Both are run with Serverless Framework in Amazon Web Services Lambdas and API Gateway. 

# Installation to AWS with Serverless Framework tools
* Create AWS Account
* Install serverless (https://serverless.com/framework/docs/providers/aws/guide/installation/)
* Add your aws profile in to ~/.aws/credentials
* Create incoming webhook to Slack
* Create slash command to Slack
* Get Untappd Access Token
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

# Slack slash commands (only friend requesting)
* If have given slash commands name 'KaljaSieppo' 
* Command in Slack: '/KaljaSieppo untappd-username'
* Checks if untappd-username exists in Untappd and sends Friend-request. Informs if request was made already or user have made Friend-request to bot user

# Backlog
Ideas, Backlog, In Progress and stuff are located at Repositorys project tab https://github.com/Jevli/afterwork-alert/projects/1

# Challenges and solutions
## How to parse Untappd activity feed to recognize afterwork groups
* Sort checkins by time
* Filter too old checkins, checkins without venue and checkins which are already used in some previous group
* Group checkins by venue. After this, main level list elements are lists which each include one venues checkins.
 Run a reduce function for each venues list:
    * Loop through oldest checkin to the newest:
    * If aw-group is empty, add checkin to the aw-group
    * If aw-group is not empty and checkin is close enough (30min) to the first one in aw-group or close enough (10min) to the last in aw-group -> add checkin to the aw-group
    * If aw-group size is one and checkin not close enough, clear aw-group and add checkin to the aw-group (as first in aw-group)
    * Take next oldest checkin from venues checkin list and test it
* At this stage, the main list includes lists of aw-groups. Each group is in different venue. 
* Last, remove groups which don't have minimum amount of checkins
* Lambda Refactoring, stateless architecture and more configs on Slack and AWS. Serverless Framework made AWS configs much easier.
