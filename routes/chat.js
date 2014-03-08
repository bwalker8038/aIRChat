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
    socket.emit('notifyLow', {channel: 'Server Messages', from: 'Server', messge: msg});
  });

  newClient.addListener('names', function (channel, nicks) {
    socket.emit('nickList', {channel: channel, nicks: nicks});
  });

  newClient.addListener('join', function (channel, nick, msg) {
    socket.emit('joined', channel);
  });

  newClient.addListener('kick', function (channel, nick, by, reason, msg) {
    socket.emit('kicked', {channel: channel, by: by, reason: reason});
  });

  newClient

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
    clients.remove(clients.indexOf(socket));
  });

  socket.on('serverJoin', function (data) {
    ircClients[clients.indexOf(socket)].push(createIRCClient(socket, data));
  });

  socket.on('writeChat', function (data) {
    ircClients[clients.indexOf(socket)][0].say(data.destination, data.message);
  });
};

exports.main = function (req, res) {
  res.render('chat', {title: 'aIRChat', host: config.host});
};
