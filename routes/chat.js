var irc = require('irc');
var config = require('../config');

// Parallel arrays. 
// ircClients[i] is an array of IRC clients used by clients[i].
var clients = new Array();
var ircClients = new Array();

// Array remove - By John Resig (MIT LICENSED)
Array.prototype.remove = function (start, end) {
  var tail = this.slice((end || start) + 1 || this.length);
  this.length = start < 0 ? this.length + start : start;
  return this.push.apply(this, tail);
};

var createIRCClient = function (socket, params) {
  var newClient = new irc.Client(params.server, params.nick, {
    channels: [params.firstchannel]
  });

  newClient.addListener('pm', function (from, msg) {
    socket.emit('notifyHigh', {from: from, message: msg}); 
  });

  newClient.addListener('message', function (from, to, msg) {
    socket.emit('notifyLow', {channel: to, from: from, message: msg});
  });

  newClient.addListener('registered', function (msg) {
    socket.emit('connected');
  });

  newClient.addListener('names', function (channel, nicks) {
    socket.emit('nickList', {channel: channel, nicks: nicks});
  });

  newClient.addListener('join', function (channel, nick, msg) {
    socket.emit('joined', {channel: channel, nick: nick});
  });

  newClient.addListener('kick', function (channel, nick, by, reason, msg) {
    socket.emit('kicked', {channel: channel, by: by, reason: reason});
  });

  newClient.addListener('nick', function (oldnick, newnick, channels, msg) {
    for (var i = channels.length - 1; i >= 0; i--) {
      socket.emit('newNick', {old: oldnick, new: newnick, channel: channels[i]});
    }
  });

  newClient.addListener('invite', function (channel, from) {
    socket.emit('invited', {to: channel, by: from});
  });

  newClient.addListener('part', function (channel, nick, reason, msg) {
    socket.emit('userLeft', {from: channel, nick: nick, reason: reason});
  });

  newClient.addListener('quit', function (nick, reason, channels, msg) {
    for (var i = channels.length - 1; i >= 0; i--) {
      socket.emit('userLeft', {from: channels[i], nick: nick, reason: reason});
    }
  });

  newClient.addListener('error', function (message) {
    console.log('IRC Client error: ' + message);
  });

  return newClient;
 };

exports.newClient = function (socket) {
  clients.push(socket);
  ircClients.push(new Array());
  console.log('New connection.');

  socket.on('message', function (message, callback) {
    console.log("received: " + message);
  });
  
  socket.on('disconnect', function () {
    var index = clients.indexOf(socket);
    clients.remove(index);
    for (var i = ircClients[index].length - 1; i >= 0; i--) {
      ircClients[index][i].disconnect('Client closed connection to the server.');
    }
    ircClients.remove(index);

  });

  // TODO
  // Don't bother trying to connect to a server if there is already a client
  // running for the user that is connected to that server.
  socket.on('serverJoin', function (data) {
    ircClients[clients.indexOf(socket)].push(createIRCClient(socket, data));
  });

  // TODO
  // Have this function be able to deal with joining the provided channel
  // on the correct server.
  socket.on('joinChannel', function (data) {
    var index = clients.indexOf(socket);
    // Here, 0 should be replaced with the index of the appropriate server's client.
    ircClients[index][0].join(data.channel);
  });

  // TODO
  // Tweak this to make sure the message is being sent to the right channel
  // on the right server.
  socket.on('writeChat', function (data) {
    var clientsIndex = clients.indexOf(socket);
    for (var i = ircClients[clientsIndex].length - 1; i >= 0; i--) {
      var client = ircClients[clientsIndex][i];
      if (client.opt.channels.indexOf(data.destination) != -1) {
        client.say(data.destination, data.message);
        return;
      }
    }
  });
};

exports.main = function (req, res) {
  res.render('chat', {title: 'aIRChat', host: config.host, username: req.session.username});
};
