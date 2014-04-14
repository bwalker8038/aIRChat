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

Requirements
============

To be able to run aIRChat, you need to have installed the following:

* [Node.JS](http://nodejs.org/)
* [npm](https://www.npmjs.org/)
* [MongoDB](http://www.mongodb.org/) 

Configuration
=============

Configuration information for aIRChat is contained in the file `config.js`.

If you are just running aIRChat on your own computer for testing purposes, you
do not need to change either the `host` nor the `dbURI` variables.  
  
If, however, you are hosting aIRChat on a server somewhere for others to connect to, 
the host variable should contain the URL used to reach the site, as it is used for
a client's browser to create a connection back to the server to communicate messages
and commands.
Likewise, the dbURI variable must be changed to contain the URI through which a 
connection to the database can be made.

If it is your first time running aIRChat, you must configure it to use your own
secret key value for securing session data. aIRChat comes packaged with a small
program `gensecret.js` which will generate a pseudorandom secret for you. Run
the command:

`node gensecret.js`

and copy the string of characters it produces (make sure you get all of them!), and
then open the file `config.js` in your favorite text editor and replace the text inside
the single-quotes on the line containing exports.secret = ... with the key you copied.
Make sure that your pasted key is contained within the single-quotes and that the line
ends in a semi-colon.



Running
=======

To run aIRChat yourself, first, install dependancies:

`npm install`

Secondly, start the Mongo database server daemon:

`mongod --dbpath data/db&`

Next, start up the application server:

`node app.js`

You're done! You can now visit your aIRChat instance on localhost, port 3000.
That is, simply enter `localhost:3000` into your browser's address bar.

You can stop the aIRChat server at any time by pressing `Ctrl+c` on your keyboard
with the terminal running the node process active.
