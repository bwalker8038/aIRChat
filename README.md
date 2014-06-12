aIRChat
=======

A beautiful browser-based IRC client built on Node.

![What it looks like now](https://airchatter.net/images/airchatscrot.png)

Requirements
============

To be able to run aIRChat, you need to have installed the following:

* [Node.JS](http://nodejs.org/)

Configuration
=============

Configuration information for aIRChat is contained in the file `config.js`.
The value of `exports.host` should be the address of the machine running the server.

Downloading
===========

Provided that you have installed Node, you can download aIRChat from
[its official site](https://airchatter.net/#download).
Instructions are provided there.

Running it yourself
===================

To run aIRChat yourself from the source, inside the Content directory, run:

`npm install`

Next, start up the application server:

`node app.js`

You're done! You can now visit your aIRChat instance on localhost, port 3000.
That is, simply enter `localhost:3000` into your browser's address bar.

You can stop the aIRChat server at any time by pressing `Ctrl+c` on your keyboard
with the terminal running the node process active.
