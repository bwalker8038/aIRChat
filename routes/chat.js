var crypto = require('crypto');
var irc = require('irc');
var config = require('../config');

// Maps the socket used to communicate with a given client to an object mapping
// the names of IRC servers to the client object communicating with that server.
var clients = {};

// Array remove - By John Resig (MIT LICENSED)
Array.prototype.remove = function (start, end) {
  var tail = this.slice((end || start) + 1 || this.length);
  this.length = start < 0 ? this.length + start : start;
  return this.push.apply(this, tail);
};

var randString = function (bytes, source) {
  if (!source) {
    source = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  }
  try {
    var s = '';
    var buf = crypto.randomBytes(bytes);
    for (var i = buf.length - 1; i >= 0; i--) {
      s += source[buf[i] % source.length];
    }
    return s;
  } catch (ex) {
    return null;
  }
};

var sanitize = function (string) {
  string = string.replace('&', '&amp;').replace('=', '&#61;');
  string = string.replace('<', '&lt;').replace('>', '&gt;');
  string = string.replace('[', '&#91;').replace(']', '&#93;');
  string = string.replace('{', '&#123;').replace('}', '&#125;');
  string = string.replace('"', '&#34;').replace("'", '&#39;');
  string = string.replace('(', '&#40;').replace(')', '&#41;');
  string = string.replace('/', '&#47;').replace('\\', '&#92;');
  return string.replace('%', '&#37;').replace(':', '&#58;');
};

var createIRCClient = function (socket, params) {
  var newClient = new irc.Client(params.server, params.nick, {
    channels: [params.firstchannel],
    userName: 'aIRChat_' + params.nick,
    realName: 'Airchat User',
    autoRejoin: false
  });

  newClient.addListener('message', function (from, to, msg) {
    console.log('Received ' + msg + ' from ' + from);
    if (to === params.nick) {
      return; // Let private messages be handled by the pm handler.
    }
    socket.emit('notifyLow', {
      channel: to, 
      from: from, 
      message: sanitize(msg),
      server: params.server
    });
  });

  newClient.addListener('pm', function (from, msg) {
    console.log('Received ' + msg + ' from ' + from);
    socket.emit('notifyHigh', {
      channel: from,
      from: from, 
      message: sanitize(msg),
      server: params.server
    });
  });

  newClient.addListener('registered', function (msg) {
    socket.emit('connected', params.server);
  });

  newClient.addListener('names', function (channel, nicks) {
    nicks = Object.keys(nicks);
    var users = new Array();
    // This is where user aIRChat user data will be loaded up from the
    // database in the future.
    for (var i = nicks.length - 1; i >= 0; i--) {
      // Package users as simple objects to be created on the client side
      users.push({
        nick: nicks[i],
        bio: '',
        contact: '',
        picture: '/images/defaultusericon.jpg',
        server: params.server
      });
    }
    socket.emit('nickList', {server: params.server, channel: channel, users: users});
  });

  newClient.addListener('join', function (channel, nick, msg) {
    // Information for the default fields here will be filled with
    // stored user info when accounts are implemented.
    socket.emit('joined', {
      channel: channel, 
      nick: nick,
      bio: '',
      picture: '/images/defaultusericon.jpg',
      contact: '',
      server: params.server
    });
  });

  newClient.addListener('kick', function (channel, nick, by, reason, msg) {
    socket.emit('kicked', {
      server: params.server, 
      channel: channel, 
      by: by, 
      reason: reason
    });
  });

  newClient.addListener('nick', function (oldnick, newnick, channels, msg) {
    for (var i = channels.length - 1; i >= 0; i--) {
      socket.emit('newNick', {
        old: oldnick, 
        new: newnick, 
        server: params.server, 
        channel: channels[i]
      });
    }
  });

  newClient.addListener('invite', function (channel, from) {
    socket.emit('invited', {server: params.server, to: channel, by: from});
  });

  newClient.addListener('part', function (channel, nick, reason, msg) {
    socket.emit('userLeft', {
      server: params.server, 
      from: channel, 
      nick: nick, 
      reason: reason
    });
  });

  newClient.addListener('quit', function (nick, reason, channels, msg) {
    for (var i = channels.length - 1; i >= 0; i--) {
      socket.emit('userLeft', {
        server: params.server,
        from: channels[i], 
        nick: nick, 
        reason: reason
      });
    }
  });

  newClient.addListener('error', function (message) {
    console.log('IRC Client error: ' + message);
  });

  return newClient;
 };

exports.newClient = function (socket) {
  socket.on('part', function (data) {
    if (clients[data.sid] === undefined) return;
    clients[data.sid][data.server].part(data.channel, data.message);
  });
  
  socket.on('disconnect', function (data) {
    if (!data || !data.sid || !clients[data.sid]) return;
    var servers = Object.keys(clients[data.sid]);
    for (var i = servers.length - 1; i >= 0; i--) {
      clients[data.sid][servers[i]].disconnect('Connect to server closed.');
    }
    delete clients[data.sid];
  });

  socket.on('serverJoin', function (data) {
    if (clients[data.sid] === undefined) return;
    if (!clients[data.sid][data.server]) {
      clients[data.sid][data.server] = createIRCClient(socket, data);
    }
  });

  socket.on('joinChannel', function (data) {
    if (clients[data.sid] === undefined) return;
    if (clients[data.sid][data.server].opt.channels.indexOf(data.channel) === -1) {
      clients[data.sid][data.server].join(data.channel);
    }
  });

  socket.on('writeChat', function (data) {
    if (clients[data.sid] === undefined) return;
    clients[data.sid][data.server].say(data.destination, data.message);
  });

  socket.on('changeNick', function (data) {
    if (clients[data.sid] === undefined) return;
    clients[data.sid][data.server].send('nick', data.nick);
  });
};

// Will need to load the user's data from the DB for this section.
exports.main = function (req, res) {
  if (req.session.loggedIn != true) {
    res.redirect(401, '/');
  }
  var sessionID = randString(128);
  if (!sessionID) {
    res.redirect(500, '/');
    return;
  }
  clients[sessionID] = {};
  res.render('chat', {
    title: 'aIRChat', 
    host: config.host, 
    username: req.session.username,
    sessionID: sessionID,
    profilepic: '/images/defaultusericon.jpg',
    userbio: 'Your biography',
    contact: 'How can you be reached?'
  });
};
