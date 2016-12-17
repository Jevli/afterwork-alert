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
