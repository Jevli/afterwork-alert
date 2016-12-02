# afterwork-alert
This is Untappd-Slack integration for alerting Slack-users of afterwork going on somewhere.
Untappd polling periodically and if more than one friend is drinking within small enough period of time, notifies to Slack that afterwork is being held.

* Config includes loopingTime as well as bot name and channels of multiple cities, based on venue locations
* more to come...


# Start application in prod or dev mode
Production mode will use production configs and dev will use development configs.
* ```npm run prod ```
* ```npm run dev ```

* Run docker-image

```docker
    docker build -t afterwork-alert .
    docker run afterwork-alert
```

# ToDo
## Fixes
* Time between checkins in same venue by different users: Calculate this often but ignore checkins which are used in some 'afterwork-alert' before. Try different approaches when to send new alert. 
## Features
### Slackbot commands
* Tell bot to send friend request in Untappd
### Untappd data analysis
* Analyze how many beverages and how high alcohol percentage within certain amount of time. If enough, moralize user in slack at next morning and ask about hangover 
