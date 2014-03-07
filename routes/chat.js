var irc = require('irc');
var config = require('../config');

var clients = new Array();

// Array remove - By John Resig (MIT LICENSED)
Array.prototype.remove = function (start, end) {
  var tail = this.slice((end || start) + 1 || this.length);
  this.length = start < 0 ? this.length + start : start;
  return this.push.apply(this, tail);
};

exports.newClient = function (socket) {
  clients.push(socket);
  console.log('New connection.');

  socket.on('message', function (message, callback) {
    console.log("received: " + message);
  });
  
  socket.on('disconnect', function () {
    clients.remove(clients.indexOf(socket));
  });
};

exports.main = function (req, res) {
  res.render('chat', {title: 'aIRChat', host: config.host});
};
