var irc = require('../node-irc/lib/irc');
var config = require('../config');

// Maps a network name (eg: irc.freenode.net) to the client connected to that network
var clients = {};

// Server notification types.
const SN_ERROR = 'error';
const SN_WARN = 'warning';
const SN_INFO = 'info';
const SN_SUCCESS = 'success';

// Array remove - By John Resig (MIT LICENSED)
Array.prototype.remove = function (start, end) {
  var tail = this.slice((end || start) + 1 || this.length);
  this.length = start < 0 ? this.length + start : start;
  return this.push.apply(this, tail);
};

String.prototype.replaceAll = function (sub, newstr) {
  var index = this.indexOf(sub);
  var tmp = this;
  while (index >= 0) {
    tmp = tmp.replace(sub, newstr);
    index = tmp.indexOf(sub);
  }
  return tmp;
};

var sanitize = function (string) {
  return string.replaceAll('"', '&#34;').replaceAll("'", '&#39;')
               .replaceAll('>', '&gt;').replaceAll('<', '&lt;')
               .replaceAll('/', '&#47;').replaceAll('\\', '&#92;');
};

var createIRCClient = function (socket, params) {
  var newClient = new irc.Client(params.server, params.nick, {
    channels   : params.channels,
    userName   : 'aIRChat_' + params.nick,
    realName   : 'Airchat User',
    autoRejoin : false
  });

  newClient.addListener('message', function (from, to, msg) {
    if (to === params.nick) {
      return; // Let private messages be handled by the pm handler.
    }
    socket.emit('notifyLow', {
      channel : to, 
      from    : from, 
      message : sanitize(msg),
      server  : params.server
    });
  });

  newClient.addListener('pm', function (from, msg) {
    socket.emit('notifyHigh', {
      channel : from,
      from    : from, 
      message : sanitize(msg),
      server  : params.server
    });
  });

  newClient.addListener('action', function (from, to, parts, msg) {
    socket.emit('action', {
      nick    : from,
      server  : params.server,
      channel : to,
      message : parts
    });
  });

  newClient.addListener('registered', function (msg) {
    socket.emit('serverConnected', {server : params.server, nick : msg.args[0]});
  });

  newClient.addListener('topic', function (chan, topic, nick, msg) {
    socket.emit('topic', {
      channel : chan,
      server  : params.server,
      topic   : topic
    });
  });

  newClient.addListener('ctcp', function (from, to, text, type, msg) {
    if (type === 'privmsg') return;
    socket.emit('ctcp', {
      server  : params.server,
      channel : 'System',
      info    : 'Type ' + type + ': ' + text
    });
  });

  newClient.addListener('+mode', function (channel, by, mode, argument, msg) {
    if (typeof by === 'undefined') {
      by = 'ChanServ';
    }
    socket.emit('setMode', {
      channel : channel,
      server  : params.server,
      mode    : '+' + mode,
      by      : by,
      on      : argument
    });
  });

  newClient.addListener('-mode', function (channel, by, mode, argument, msg) {
    if (typeof by === 'undefined') {
      by = 'ChanServ';
    }
    socket.emit('setMode', {
      channel : channel,
      server  : params.server,
      mode    : '-' + mode,
      by      : by,
      on      : argument
    });
  });

  newClient.addListener('whois', function (info) {
    var infoMsg = info.nick + '@' + info.host + ', user ' + info.user + ', realname: ' + info.realname;
    infoMsg += ' is on the channels ' + info.channels.join(', ') + '. ';
    socket.emit('gotWhois', {
      channel : 'System',
      server  : params.server,
      info    : infoMsg
    });
  });

  newClient.addListener('names', function (channel, nicks) {
    var nicknames = Object.keys(nicks);
    socket.emit('nickList', {
      channel : channel,
      server  : params.server,
      nicks   : nicknames
    });
  });

  newClient.addListener('join', function (channel, nick, msg) {
    socket.emit('joined', {
      channel : channel,
      nick    : nick,
      server  : params.server
    });
  });

  newClient.addListener('kick', function (channel, nick, by, reason, msg) {
    socket.emit('kicked', {
      server  : params.server, 
      channel : channel, 
      nick    : nick,
      by      : by, 
      reason  : reason
    });
  });

  newClient.addListener('nick', function (oldnick, newnick, channels, msg) {
    for (var i = channels.length - 1; i >= 0; i--) {
      socket.emit('newNick', {
        old     : oldnick, 
        new     : newnick, 
        server  : params.server, 
        channel : channels[i]
      });
    }
  });

  newClient.addListener('invite', function (channel, from) {
    socket.emit('invited', {
      server : params.server, 
      to     : channel, 
      by     : from
    });
  });

  newClient.addListener('part', function (channel, nick, reason, msg) {
    socket.emit('userLeft', {
      server : params.server, 
      from   : channel, 
      nick   : nick, 
      reason : reason
    });
  });

  // TODO
  // Change this to send one message with the array of channels instead of multiple
  // messages. Involves changing chatmain as well.
  newClient.addListener('quit', function (nick, reason, channels, msg) {
    for (var i = channels.length - 1; i >= 0; i--) {
      socket.emit('userLeft', {
        server : params.server,
        from   : channels[i], 
        nick   : nick, 
        reason : reason
      });
    }
  });

  newClient.addListener('error', function (error) {
    socket.emit('serverNotification', {
      message: error.args.join(' '),
      type   : SN_ERROR
    });
  });

  return newClient;
};

var disconnectClients = function () {
  var servers = Object.keys(clients);
  for (var i = servers.length - 1; i >= 0; i--) {
    clients[servers[i]].disconnect('Connection to server closed.');
  }
  clients = {};
};

exports.newClient = function (socket) {
  socket.on('rawCommand', function (data) {
    var client = clients[data.server];
    client.send.apply(client, data.command.split(' '));
  });

  socket.on('part', function (data) {
    clients[data.server].part(data.channel, data.message);
  });
  
  socket.on('serverJoin', function (data) {
    if (!clients[data.server]) {
      clients[data.server] = createIRCClient(socket, data);
    } else {
      socket.emit('serverNotification', {
        message : 'You are already connected to ' + data.server + '.',
        type    : SN_ERROR
      });
    }
  });

  socket.on('joinChannel', function (data) {
    if (clients[data.server].opt.channels.indexOf(data.channel) === -1) {
      clients[data.server].join(data.channel);
    } else {
      socket.emit('serverNotification', {
        message : 'You have already joined ' + data.channel + '.',
        type    : SN_ERROR
      });
    }
  });

  socket.on('writeChat', function (data) {
    clients[data.server].say(data.destination, data.message);
  });

  socket.on('changeNick', function (data) {
    if (typeof clients[data.server] === 'undefined') {
      socket.emit('serverNotification', {
        message : 'Not connected to ' + data.server + '.',
        type    : SN_ERROR
      });
    } else {
      clients[data.server].send('nick', data.nick);
    }
  });

  socket.on('disconnect', function () {
    disconnectClients();
  });
};

exports.main = function (req, res) {
  res.render('chat', {
    host  : config.host,
    title : 'aIRChat'
  });
};
