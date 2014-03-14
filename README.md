aIRChat
=======

IRC in the Air (cloud)- a modernized web interface to IRC with sugary extras.

![What it looks like now](http://i.imgur.com/tdOX5F4.png)

The plan
========

As well as just being a more pleasant looking web-based IRC client, I intend
for aIRChat to provide some extra features on top of regular IRC conversation.

1. User profiles on the aIRChat server would allow storing of information such as
a profile picture, bio, and contact information for other aIRChat users to see.
2. Multiple server support. To my knowledge, most existing web-based IRC clients
only really support connections to a single server at a time.
3. Links to aIRChat that automatically connect to a specified server and [list of]
channels.

Surely, in time, more ideas will be evaluated, but for now the idea is to build
something that makes using IRC a much more friendly and comfortable experience.
Most of this is accomplished just by making things look good, but by adding
features like message counters in chat tabs, profile pictures, etc., it becomes
possible to create an experience remniscient of popular chat clients. Doing this
should make it easier for people who want to communicate over IRC to do so, and
generally more pleasant for current IRC users to continue doing so.

Running
=======

To run aIRChat yourself, first, install dependancies:
`npm install`

Next, start up the application server:
`node app.js`

You're done! You can now visit your aIRChat instance on localhost, port 3000.
That is, simply enter `localhost:3000` into your browser's address bar.
