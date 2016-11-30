# afterwork-alert
This is Untappd-Slack integration for alerting Slack-users of afterwork going on somewhere.
Untappd polling periodically and if more than one friend is drinking within small enough period of time, notifies to Slack that afterwork is being held.

* Config includes loopingTime as well as bot name and channels of multiple cities, based on venue locations
* more to come...


# Start application in prod or dev mode
Production mode will use production configs and dev will use development configs.
* ```npm run prod ```
* ```npm run dev ```