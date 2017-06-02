# afterwork-alert
This is Untappd-Slack integration for alerting Slack-users of afterwork going on somewhere.

Application is build of two different parts. First is parsing untappd feed and notifying Slack when there's afterwork group somewhere. Second is creating friend requests and approving friend requests. Both are run with Serverless Framework with Amazon Lambdas and API Gateway. 

First create aws account. Then copy default_serverless.yml to serverless.yml and fill it with your own credentials and other nescessary configs. Then run, in linux with command 'sls deploy'.

# Example of logic
* Runs once in every 10 minutes
* Untappd feed from last 20 minutes
* Creates groups from that time with logic
    * At least 1 checkin is from last 10 minute period from different Untappd-users
    * At least 2 checkins total within last 20 minutes
* This way application may notify twice from some checkins, if group size increases in next 10 minute period, but that is not a problem

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
