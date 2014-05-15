var crypto = require('crypto');
var irc = require('../node-irc/lib/irc');
var config = require('../config');

// Maps the user's session ID to an object mapping the names of servers that
// the user is connected to to an array of the names of channels they have joined.
var clients = {};

// Server notification types.
const SN_ERROR = 'error';
const SN_WARN = 'warning';
const SN_INFO = 'info';
const SN_SUCCESS = 'success';

// Test to see that the user has a session to protect against CSRF.
exports.userHasSession = function (sessionID) {
  return typeof clients[sessionID] != 'undefined';
};

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

var userID = function (username, sid) {
  return username + '!' + sid;
};

var sanitize = function (string) {
  string = string.replaceAll('&', '&amp;').replaceAll('=', '&#61;');
  string = string.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  string = string.replaceAll('[', '&#91;').replaceAll(']', '&#93;');
  string = string.replaceAll('{', '&#123;').replaceAll('}', '&#125;');
  string = string.replaceAll('"', '&#34;').replaceAll("'", '&#39;');
  string = string.replaceAll('(', '&#40;').replaceAll(')', '&#41;');
  string = string.replaceAll('/', '&#47;').replaceAll('\\', '&#92;');
  return string.replaceAll('%', '&#37;').replaceAll(':', '&#58;');
};

var createIRCClient = function (socket, params, userProvider) {
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
    socket.emit('serverConnected', params.server);
  });

  newClient.addListener('names', function (channel, nicks) {
    var nicknames = Object.keys(nicks);
    userProvider.profileInfo(nicknames, function (error, userdata) {
      if (!error) {
        socket.emit('nickList', {
          server  : params.server,
          channel : channel,
          users   : userdata
        });
      } else {
        socket.emit('serverNotification', {
          message : 'Failed to retrieve information about the users on ' + channel + '.',
          type    : SN_ERROR
        });
      }
    });
  });

  newClient.addListener('join', function (channel, nick, msg) {
    // Information for the default fields here will be filled with
    // stored user info when accounts are implemented.
    userProvider.profileInfo([nick], function (error, info) {
      if (!error) {
        if (info.length > 0) {
          info = info[0];
          socket.emit('joined', {
            channel : channel,
            nick    : nick,
            picture : info.picture,
            server  : params.server
          });
        } else {
          socket.emit('joined', {
            channel : channel,
            nick    : nick,
            picture : '/images/defaultusericon.jpg',
            server  : params.server
          });
        }
      } else {
        socket.emit('serverNotification', {
          message : 'Could not obtain information for ' + nick + '.',
          type    : SN_ERROR
        });
      }
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
    socket.emit('invited', {server: params.server, to: channel, by: from});
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

var disconnectClients = function (sid) {
  var servers = Object.keys(clients[sid]);
  for (var i = servers.length - 1; i >= 0; i--) {
    clients[sid][servers[i]].disconnect('Connection to server closed.');
  }
  delete clients[sid];
};

exports.newClient = function (socket, userProvider) {
  socket.on('rawCommand', function (data) {
    if (data.sid === undefined || clients[data.sid] === undefined) return;
    var client = clients[data.sid][data.server];
    client.send.apply(client, data.command.split(' '));
  });

  socket.on('dataRequest', function (data) {
    userProvider.profileInfo([data.username], function (error, users) {
      if (error) {
        socket.emit('serverNotification', {
          type    : SN_ERROR,
          message : 'Could not retrieve user data for ' + data.username + '.'
        });
      } else if (users.length === 0) {
        socket.emit('serverNotification', {
          type    : SN_INFO,
          message : 'No information about ' + data.username + ' was found.'
        });
      } else {
        var result = users[0];
        result.server = data.server;
        socket.emit('dataResponse', result); 
      }
    });
  });

  socket.on('reconnectChats', function (data) {
    if (clients[data.sid] === undefined) return;
    disconnectClients(data.sid);
    clients[data.sid] = {};
    for (var i = 0, slen = data.servers.length; i < slen; i++) {
      clients[data.sid][data.servers[i]] = createIRCClient(
        socket,
        { server   : data.servers[i],
          channels : data.channels[i],
          nick     : data.nicks[i] },
        userProvider
      );
    }
  });

  socket.on('part', function (data) {
    if (clients[data.sid] === undefined) return;
    clients[data.sid][data.server].part(data.channel, data.message);
  });
  
  socket.on('serverJoin', function (data) {
    if (clients[data.sid] === undefined) return;
    if (!clients[data.sid][data.server]) {
      clients[data.sid][data.server] = createIRCClient(socket, data, userProvider);
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
    if (clients[data.sid][data.server] === undefined) {
      socket.emit('serverNotification', {
        message : 'Not connected to ' + data.server + '.',
        type    : SN_ERROR
      });
    } else {
      clients[data.sid][data.server].send('nick', data.nick);
    }
  });

  socket.on('leaving', function (data) {
    if (clients[data.sid] === undefined) return;
    disconnectClients(data.sid);
  });
};

exports.logout = function (req, res) {
  var sid = req.session.sessionID;
  // Avoid causing a TypeError if a user tries to navigate to /logout without
  // ever having had a collection of servers created for them.
  if (!sid || !clients[sid]) {
    res.redirect(400, '/');
  } else {
    disconnectClients(sid);
    req.session = null;
    res.redirect(303, '/');
  }
};

exports.main = function (req, res, userProvider) {
  if (req.session.loggedIn != true) {
    res.redirect(401, '/');
  }
  // Disconnect and destroy any clients that may not have been gotten rid of
  // under circumstances where the user disconnected but no signal of them
  // doing so has already been received.
  var sessions = Object.keys(clients);
  for (var i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].indexOf(req.session.username + '!') === 0) {
      disconnectClients(sessions[i]); 
    }
  }
  var sessionID = randString(64);
  if (!sessionID) {
    res.redirect(500, '/');
    return;
  }
  var uid = userID(req.session.username, sessionID);
  clients[uid] = {};
  userProvider.profileInfo([req.session.username], function (error, info) {
    if (!error) {
      info = info[0];
      req.session.sessionID = uid;
      res.render('chat', {
        profilepic         : info.picture,
        username           : req.session.username,
        sessionID          : uid,
        host               : config.host,
        heartbeat_interval : config.heartbeat_interval,
        title              : 'aIRChat'
      });
    } else {
      res.redirect(500, '/');
    }
  });
};
