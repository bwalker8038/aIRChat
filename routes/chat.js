var crypto = require('crypto');
var irc = require('../node-irc/lib/irc');
var config = require('../config');

// Maps the user's session ID to an object mapping the names of servers that
// the user is connected to to an array of the names of channels they have joined.
var clients = {};

// Maps the user's session ID to the interval ID of the function being used
// to check the health of a connection.
var intervalIDs = {};

// Maps the user's session ID to the number of seconds since the epoch at the
// point that the user's last heartbeat response was received.
var responseTimes = {};

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

var userID = function (username, sid) {
  return username + '!' + sid;
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

var createIRCClient = function (socket, params, userProvider) {
  var newClient = new irc.Client(params.server, params.nick, {
    channels   : [params.firstchannel],
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
    socket.emit('connected', params.server);
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
      }
    });
  });

  newClient.addListener('kick', function (channel, nick, by, reason, msg) {
    socket.emit('kicked', {
      server  : params.server, 
      channel : channel, 
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
    socket.emit('gotError', error);
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

var secondsSinceEpoch = function () {
  return Math.round((new Date()).getTime() / 1000);
};

var heartbeat = function (sid, socket) {
  var newTime = secondsSinceEpoch();
  if ( intervalIDs[sid] != undefined
    && responseTimes[sid] != undefined
    && newTime - responseTimes[sid] > config.heartbeat_timeout )
  {
    disconnectClients(sid);
    clearInterval(intervalIDs[sid]);
    delete responseTimes[sid];
    delete intervalIDs[sid];
  } else {
    socket.emit('pulseCheck', newTime);
  }
};

exports.newClient = function (socket, userProvider) {
  socket.on('rawCommand', function (data) {
    if (data.sid === undefined || clients[data.sid] === undefined) return;
    var client = clients[data.sid][data.server];
    client.send.apply(client, data.args);
  });

  socket.on('dataRequest', function (data) {
    userProvider.profileInfo([data.username], function (error, users) {
      if (error) {
        return; // Raplce with a notification
      } else if (users.length === 0) {
        return; // Replace with a notification
      } else {
        var result = users[0];
        result.server = data.server;
        socket.emit('dataResponse', result); 
      }
    });
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
    // Once the user has joined a server, start issuing heartbeats to check connectivity.
    // This has to happen in a handler so that we have access to the user's SID.
    if (intervalIDs[data.sid] != undefined) {
      return;
    }
    intervalIDs[data.sid] = setInterval(
      function () {
        responseTimes[data.sid] = undefined;
        heartbeat(data.sid, socket);
      },
      config.heartbeat_interval * 1000
    );
  });

  socket.on('pulseSignal', function (sid) {
    if (intervalIDs[sid] === undefined) return;
    responseTimes[sid] = secondsSinceEpoch();
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
      intervalIDs[sessions[i]] = undefined;
      responseTimes[sessions[i]] = undefined;
    }
  }
  var sessionID = randString(64);
  if (!sessionID) {
    res.redirect(500, '/');
    return;
  }
  var uid = userID(req.session.username, sessionID);
  clients[uid] = {};
  intervalIDs[uid] = undefined;
  userProvider.profileInfo([req.session.username], function (error, info) {
    if (!error) {
      info = info[0];
      req.session.sessionID = uid;
      res.render('chat', {
        profilepic         : info.picture,
        username           : req.session.username,
        sessionID          : uid,
        host               : config.host,
        heartbeat_timeout  : config.heartbeat_timeout,
        heartbeat_interval : config.heartbeat_interval,
        title              : 'aIRChat'
      });
    } else {
      res.redirect(500, '/');
    }
  });
};
