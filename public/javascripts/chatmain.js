var socket = io.connect(hostname);

// Storage for the ID of the interval used to blink the title
// when there is a message waiting for the user.
var intervalID = undefined;
var windowFocused = true;
 
// Array of chat objects
var chats = new Array();
 
// Maps the name of a given server to the user's nick on that server.
var usernicks = {};

// The time since the epoch (in seconds) at which the last heartbeat packet was received
// and the difference between the most recent and the previous pulse.
var lastPulse = undefined;
var lastPulseDiff = 0;

// A list of commands that are covered by the UI and shouldn't have to have extra code
// to handle them as raw commands.
const DISALLOWED = ['part', 'join', 'connect', 'msg', 'privmsg', 'nick'];

// String.format method from `fearphage` on stackoverflow:
// https://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
if (!String.prototype.format) {
  String.prototype.format = function () {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

var checkHeartbeatIntervalID = setInterval(
  function () {
    if (lastPulseDiff > heartbeat_timeout) {
      clearInterval(checkHeartbeatIntervalID);
      var msg = '' +
        'It has been over ' + heartbeat_timeout + ' seconds since the server was heard from. ' +
        'You may want to log out and then log in again to reestablish the connection.';
      Notifier.info('The connection to the server was lost.', 'Connection Timeout');
      var $tabs = $('dl#chatList dd');
      for (var i = $tabs.length - 1; i >= 0; i--) {
        var $tab = $($tabs[i]);
        addMessage({
          from    : 'System',
          server  : $tab.data('server'),
          channel : $tab.data('channel'),
          message : msg
        });
      }
    }
  },
  heartbeat_interval
);

var chatElement = function (type, server, channel) {
  var $elems = $(type + '[data-server="' + server + '"]');
  for (var i = 0, len = $elems.length; i < len; i++) {
    var $elem = $($elems[i]);
    var e_channel = $elem.data('channel');
    if (channel != undefined && e_channel.toLowerCase() === channel.toLowerCase()) {
      return $elem;
    }
  }
  return undefined;
};

// Array remove - By John Resig
Array.prototype.remove = function (start, end) {
  var tail = this.slice((end || start) + 1 || this.length);
  this.length = start < 0 ? this.length + start : start;
  return this.push.apply(this, tail);
};

var addMessage = function (data) {
  var $msgDiv = chatElement('div', data.server, data.channel);
  var $tab = chatElement('dd', data.server, data.channel).children('a').first();
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  var user = chat.users[userIndex(chat.users, data.from)];
  if (user === undefined) {
    var picture = profilepic;
  } else {
    var picture = user.picture;
  }
  var time = ' at ' + formattedMessageTime(); // From users.js

  var highlight = '';
  if (data.from === usernicks[data.server]) {
    highlight = ' self'; // Space needed to separate class names
  } else if (data.message.indexOf(usernicks[data.server]) != -1) {
    highlight = ' mention';
  }

  var $newMsg = $(
    '<div class="message">' +
    '  <div class="left">' +
    '    <img src="' + picture + '" data-nick="' + data.from + '" />' +
    '  </div>' +
    '  <div>' +
    '    <div class="titlebar' + highlight + '">' +
    '      <span>' + data.from + ' in ' + data.channel + time + '</span>' +
    '    </div>' +
    '    <div class="messageContent' + highlight + '">' +
    '      <span>' + data.message + '</span>' +
    '    </div>' +
    '  </div>' +
    '</div>'
  );
  $msgDiv.append($newMsg);
  $tab.children('span.notifyLow').text(chat.lowPriorityNotifications());
  $tab.children('span.notifyHigh').text(chat.highPriorityNotifications());
  var scrollDist = $msgDiv[0].scrollHeight - $msgDiv[0].offsetHeight - $msgDiv[0].scrollTop;
  if (scrollDist >= 40) {
    $msgDiv.scrollTop($msgDiv[0].scrollHeight);
  }
};

var clearNotifications = function (evt) {
  var server = $(evt.currentTarget).data('server');
  var channel = $(evt.currentTarget).data('channel');
  var $anchor = $(evt.currentTarget).children('a');
  chats[chatIndex(chats, server, channel)].clearNotifications();
  $anchor.children('span.notifyLow').text('0');
  $anchor.children('span.notifyHigh').text('0');
};

// Add a new tab to the list of chat tabs and a content div to contain
// the nick list and messages.
var addChatSection = function (server, chanOrNick) {
  var $newTab = $(
    '<dd data-server="' + server + '" data-channel="' + chanOrNick + '">' +
    '  <a href="#panel_' + label(server, chanOrNick) + '">' +
    '    <span class="notifyLow">0</span>' +
    '    <span class="notifyHigh">0</span>' +
    '    <span>'+ chanOrNick + '</span>' +
    '  </a>' +
    '</dd>'
  );
  $('dl#chatList').append($newTab);
  $newTab.click(clearNotifications);
  $('div#chatContent').append($(
    '<div class="content" id="panel_' + label(server, chanOrNick) + '" ' +
         'data-server="' + server + '" data-channel="' + chanOrNick + '">' +
    '</div>'
  ));
  // Set the height for this and any other chat content areas to fit nicely.
  $('div.content').height(($(window).height() - 130) + 'px');
};

var joinChat = function (server, channel) {
  var newChat = new Chat(server, channel);
  chats.push(newChat);
  addChatSection(server, channel);
  return newChat;
};

var titleBlinker = function (origTitle, altTitle) {
  return (function () {
    document.title = altTitle;
    setTimeout(function () {
      document.title = origTitle;
    }, 500);
    });
};

// Display a message about some occurrence in the channel.
// the newdata field is only required for events involving some data changing.
// This could be a user's nick being changed, or something else.
var channelNotification = function (type, server, channel, data, newdata) {
  var message;
  if (type === 'joined') {
    message = data + ' has joined this channel.';
  } else if (type === 'departed') {
    message = data + ' has parted from this channel.';
  } else if (type === 'changedNick') {
    message = data + ' has changed their nick to ' + newdata + '.';
  } else if (type === 'action') {
    message = 'Action :: ' + data + ' ' + newdata; // data = nick, newdata = message 
  } else {
    message = 'Received unknown notification event of type ' + type + ' on ' + 
              server + '/' + channel + ' from ' + data;
  }
  addMessage({
    from    : 'System',
    server  : server,
    channel : channel,
    message : message
  });
};

socket.on('pulseCheck', function (timeSent) {
  socket.emit('pulseSignal', sid);
  lastPulse = timeSent;
});

socket.on('action', function (data) {
  channelNotification('action', data.server, data.channel, data.nick, data.message);
});

socket.on('serverNotification', function (data) {
  var fn;
  if (data.type === 'error') {
    fn = Notifier.error;
  } else if (data.type === 'info') {
    fn = Notifier.info;
  } else if (data.type === 'warning') {
    fn = Notifier.warning;
  } else if (data.type === 'success') {
    fn = Notifier.success;
  } else {
    fn = Notifier.info;
  }
  fn(data.message, 'Server Notification');
});

socket.on('notifyLow', function (data) {
  var $ad = $('div.active');
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  if ($ad.data('server') != data.server || $ad.data('channel') != data.channel) {
    if (data.message.indexOf(usernicks[data.server]) != -1) {
      chat.gotHighPriorityMessage();
    } else {
      chat.gotLowPriorityMessage(); 
    }
  }
  if (windowFocused === false && intervalID === undefined) {
    intervalID = setInterval(titleBlinker('aIRChat', '[!!] aIRChat [!!]'), 1000);
  }
  chat.users[userIndex(chat.users, data.from)].gotNewMessage();
  addMessage(data);
});

socket.on('notifyHigh', function (data) {
  var $activeDiv = $('div.active');
  var chat = chats[chatIndex(chats, data.server, data.from)];
  if (chat === undefined) {
    chat = joinChat(data.server, data.from);
    chat.users.push(new User(usernicks[data.server], profilepic, data.server));
    chat.users.push(new User(data.from, '/images/defaultusericon.jpg', data.server));
    socket.emit('dataRequest', {
      username : data.from,
      server   : data.server
    });
  }
  if ($activeDiv.data('server') != data.server || $activeDiv.data('channel') != data.channel) {
    chat.gotHighPriorityMessage();
  }
  chat.users[userIndex(chat.users, data.from)].gotNewMessage();
  addMessage({
    from    : data.from,
    server  : data.server,
    channel : data.from,
    message : data.message
  });
  if (windowFocused === false && intervalID === undefined) {
    intervalID = setInterval(titleBlinker('aIRChat', '[!!] aIRChat [!!]'), 1000);
  }
});

socket.on('dataResponse', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.nick)];
  var user = chat.users[userIndex(chat.users, data.nick)];
  var query = '' +
    'div.content[data-server="' + data.server + '"][data-channel="' + data.nick + '"] ' +
    'img[data-nick="' + data.nick + '"]';
  user.picture = data.picture;
  $(query).attr('src', user.picture);
});

socket.on('connected', function (server, channel) {
  usernicks[server] = username;
  Notifier.info(
    'You have been connected to ' + server + '. A chat tab will appear momentarily.',
    'Connection Successful'
  );
});

// Create a listing of nicks for the appropriate channel.
// The list will not be rendered until the channel is the active one.
socket.on('nickList', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  for (var i = data.users.length - 1; i >= 0; i--) {
    chat.users.push(new User(
      data.users[i].nick, 
      data.users[i].picture, 
      data.users[i].server
    ));
  }
  chat.users.push(new User(
    'System', '/images/defaultusericon.jpg', data.server
  ));
});

// Add a new nick to the list of nicks for the provided channel. 
// Create a new chat tab if the aIRChat user is the one joining.
socket.on('joined', function (data) {
  if (chatIndex(chats, data.server, data.channel) === -1) { 
    usernicks[data.server] = data.nick;
  }
  if (data.nick === usernicks[data.server] ) {
    joinChat(data.server, data.channel);
  } else {
    var index = chatIndex(chats, data.server, data.channel);
    chats[index].users.push(new User(
      data.nick, data.picture, data.server
    ));
    channelNotification('joined', data.server, data.channel, data.nick);
  }
});

// Display a message telling the user they were kicked from the channel.
// Also deactivate the send mechanism for this channel.
// TODO
// Block the user from trying to send messages to the channel
// that they were kicked from.
// Might want to use an alert or something and close the tab automatically.
socket.on('kicked', function (data) {
  if (data.nick === usernicks[data.server]) {
    addMessage({
      from    : 'System',
      server  : data.server,
      channel : data.channel,
      message : 'You were kicked by ' + data.by + '. Reason provided: ' + data.reason
    });
  } else {
    addMessage({
      from    : 'System',
      server  : data.server,
      channel : data.channel,
      message : data.nick + ' was kicked by ' + data.by + ', reason: ' + data.reason
    });
  }
});

socket.on('newNick', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  if (data.old === usernicks[data.server]) {
    usernicks[data.server] = data.new;
  } else {
    chat.getUser(data.old).changeNick(data.new);
  }
  // Rename the tab of an affected private chat
  if (chatElement('dd', data.server, data.old) /* exists */) {
    var label = $(
      'dd[data-server="' + data.server + '"][data-channel="' + data.old + '"] a span'
    ).last();
    var newLabel = label.text().replace(data.old, data.new);
    channelNotification('changedNick', data.server, data.old, data.old, data.new);
    label.text(newLabel);
    var pchat = chats[chatIndex(chats, data.server, data.old)];
    pchat.getUser(data.old).changeNick(data.new);
    pchat.channel = data.new;
    chatElement('dd', data.server, data.old).data('channel', data.new);
    chatElement('div', data.server, data.old).data('channel', data.new);
  }
  channelNotification('changedNick', data.server, data.channel, data.old, data.new);
});

socket.on('invited', function (data) {
  var msg = 'You have been invited to the channel ' + data.to;
  msg += ' on ' + data.server + ' by ' + data.by + '\n';
  msg += 'Would you like to join this channel now?';
  if (confirm(msg)) {
    socket.emit('joinChannel', {server: data.server, channel: data.to, sid: sid});
  }
});

socket.on('userLeft', function (data) {
  var cindex = chatIndex(chats, data.server, data.from);
  if (cindex === -1) { // The user is the one who left, and the chat has been deleted
    return;
  }
  var users = chats[cindex].users;
  users.remove(userIndex(users, data.nick));
  channelNotification('departed', data.server, data.from, data.nick);
});

$('#messageInput').keypress(function (evt) {
  var server = $('div.active').first().data('server');
  var dest = $('div.active').first().data('channel');
  if (evt.which === 13) { // On [Enter]
    if ($('div.tabs-content').length === 0 || !server) {
      Notifier.warning(
        'You cannot send a message until you join and select a chat.',
        'Missing Selection'
      );
      return;
    }
    var $ta = $('#messageInput');
    if ($ta.val()[0] === '/') {
      var command = $ta.val().slice(1);
      var name = command.split(' ')[0].toLowerCase();
      if (DISALLOWED.indexOf(name) >= 0) {
        addMessage({
          server  : server,
          channel : dest,
          from    : 'System',
          message : name + ' is imlpemented through the UI and not accepted as a raw command.'
        });
      } else {
        socket.emit('rawCommand', {
          command : command,
          server  : server,
          sid     : sid
        });
      }
    } else {
      addMessage({
        server  : server,
        channel : dest, 
        from    : usernicks[server], 
        message : $ta.val()
      });
      socket.emit('writeChat', {
        server      : server, 
        destination : dest, 
        message     : $ta.val(),
        sid         : sid
      });
    }
    $ta.val('');
  }
});

// TODO
// Make sure the channel name is valid
$('a#joinNewChannel').click(function (evt) {
  var server = $('div.active').data('server');
  var chanName = $('#newChannelName').val();
  if (server === undefined) {
    Notifier.warning(
      'You must select a chat tab for a channel belonging to the ' +
      'same server the channel you wish to join is in.',
      'Missing Selection'
    );
  } else if (chanName === '') {
    Notifier.warning(
      'You must provide a channel name (eg: #aIRChat) to join.',
      'Missing Input'
    );
  } else if (chanName[0] !== '#') {
    // This is a less-than-perfect quick check that will catch the most obvious mistake
    // a user might make by writing 'aIRChat' instead of '#aIRChat', but could be better.
    Notifier.warning(
      chanName + ' is not a valid channel name. Did you mean #' + chanName + '?',
      'Invalid Input'
    );
  } else {
    socket.emit('joinChannel', {
      server  : server, 
      channel : chanName, 
      sid     : sid
    });
  }
});

$('a#connectToNewServer').click(function (evt) {
  var serverName = $('#newServerAddr').val();
  var firstChannel = $('#newServerChannel').val();
  if (serverName === '' || firstChannel === '') {
    Notifier.warning(
      'You must specify both the server address and a channel to join to ' +
      'connect to a new server.',
      'Missing Input'
    );
  } else {
    socket.emit('serverJoin', {
      server   : serverName,
      nick     : username,
      channels : [firstChannel],
      sid      : sid
    });
  }
});

$('a[data-reveal-id=getNickList]').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  var server = $('div.active').first().data('server');
  if (channel === undefined || server === undefined) {
    $('div#getNickList div.row div.columns h1').text('No channel selected');
    return;
  }
  var users = chats[chatIndex(chats, server, channel)].users;
  $('div#getNickList div.row div.columns h1').text('Users in ' + channel);
  var $list = $('table#listOfNicks tbody');
  $list.html(''); // Clear out the table before filling it
  for (var i = users.length - 1; i >= 0; i--) {
    if (users[i].nick === usernicks[server]) {
      continue;
    }
    var lastMsg = (users[i].lastMessage === undefined) ? 'No messages received yet' : users[i].lastMessage;
    // The two buttons here will open their respective modals from within their
    // respective event handlers rather than using the data-reveal-id attribute.
    $list.prepend($(
      '<tr>' +
      '  <td>' + users[i].nick + '</td>' +
      '  <td>' + lastMsg + '</td>' + 
      '</tr>'
    ));
  }
});

$('a#sendPrivMsg').click(function (evt) {
  var msg = $('#privMsgContents').val();
  var nick = $('#privMsgNick').val();
  var server = $('div.active').first().data('server');
  if (chatElement('div', server, nick) /* exists */) {
    Notifier.warning(
      'You already have a private chat open with this user.',
      'Chat Already Exists'
    );
  } else if (msg === '' || nick === '') {
    Notifier.warning(
      'You must specify the nick of the user to send your message to ' +
      'as well as a message to send.',
      'Missing Input'
    );
  } else if (server === undefined) {
    Notifier.warning(
      'You must select a chat tab for a channel on the server that the user ' +
      'you wish to send your message to is on.',
      'Missing Selection'
    );
  } else {
    var chat = joinChat(server, nick);
    chat.users.push(new User(usernicks[server], profilepic, server));
    chat.users.push(new User(nick, '/images/defaultusericon.jpg', server));
    addMessage({
      server  : server, 
      channel : nick, 
      from    : usernicks[server], 
      message : msg
    });
    socket.emit('writeChat', {
      server      : server, 
      destination : nick, 
      message     : msg,
      sid         : sid
    });
    socket.emit('dataRequest', {
      username : nick,
      server   : server
    });
  }
});

$('a[data-reveal-id=partChannel]').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  var $modalTextSection = $('div#partChannel div.row div.columns p');
  if (channel === undefined) {
    $modalTextSection.text('No channel was selected to part from.');
  } else {
    $modalTextSection.text('Are you sure you want to leave ' + channel + '?');
  }
});

$('a#confirmPartChannel').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  var server = $('div.active').first().data('server');
  if (channel === undefined || server === undefined) {
    Notifier.warning(
      'You have not selected a channel to leave.',
      'Missing Selection'
    );
    return;
  }
  var index = chatIndex(chats, server, channel);
  chats.remove(index);
  $('dd.active').first().remove();
  $('div.active').first().remove();
  if (channel[0] === '#') { // Channel, not a private chat
    socket.emit('part', {
      server: server, 
      channel: channel, 
      message: 'aIRChat client parted.',
      sid: sid
    });
  }
});

$('a[data-reveal-id="toggleFave"]').click(function (evt) {
  var server = $('dd.active').first().data('server');
  var channel = $('dd.active').first().data('channel');
  if (server === undefined || channel === undefined) {
    Notifier.warning(
      'No channel is selected to be favorited.',
      'Missing Selection'
    );
    $('p#faveText').text('There is no channel selected to favorite.');
  } else {
    var favorites = stash.get('favorites');
    if (favorites[server] != undefined && favorites[server].indexOf(channel) >= 0) {
      $('p#faveText').text(
        'Are you sure you would like to remove ' + channel + ' on ' +
        server + ' from your favorites?'
      );
    } else {
      $('p#faveText').text(
        'Would you like to add ' + channel + ' on ' + server +
        ' to your favorites?'
      );
    }
  }
});

$('a#confirmToggleFave').click(function (evt) {
  var server = $('dd.active').first().data('server');
  var channel = $('dd.active').first().data('channel');
  if (server === undefined || channel === undefined) {
    Notifier.warning(
      'No channel is selected to be favorited.',
      'Missing Selection'
    );
  } else {
    var favorites = stash.get('favorites');
    if (favorites[server] != undefined) {
      var fchannels = favorites[server];
      var index = fchannels.indexOf(channel);
      if (index >= 0) {
        fchannels.remove(index);
        if (fchannels.length === 0) {
          delete favorites[server];
        }
      } else {
        fchannels.push(channel);
        favorites[server] = fchannels;
      }
      stash.set('favorites', favorites);
    } else {
      favorites[server] = [channel];
      stash.set('favorites', favorites);
    }
    Notifier.success('Your favorites were updated successfully!', 'Favorites Updated');
  }
});

$('a#changeNickConfirm').click(function (evt) {
  var newNick = $('input#newNickInput').val();
  var server = $('dd.active').first().data('server');
  if (newNick.length === 0) {
    Notifier.error('You have not provided a new nick.', 'Missing Field');
  } else if (server === undefined) {
    Notifier.warning(
      'To change your nick on a server, you must first select ' +
      'a chat tab for a channel on that server.',
      'Missing Selection'
    );
  } else {
    socket.emit('changeNick', {
      server : server, 
      sid    : sid, 
      nick   : newNick
    });
  }
});

$('#submitProfile').click(function (evt) {
  var pp = $('#profilePicLocation').val();
  if (pp.length === 0) {
    pp = profilepic;
  }
  $.ajax('/profileupdate', {
    type    : 'POST',
    data    : {
      username          : username,
      newPassword       : $('#newPassword').val(),
      newPasswordRepeat : $('#newPasswordRepeat').val(),
      password          : $('#passwordConfirm').val(),
      picture           : pp
    },
    error   : function (obj, status, errorThrown) {
      Notifier.error(
        status,
        'Update Failure'
      );
    },
    success : function (data, status, obj) {
      if (data.success) {
        Notifier.success('Your profile information was updated successfully.', 'Update Successful');
        $('#ownProfilePic').attr('src', pp);
        profilepic = pp;
      } else {
        Notifier.warning(
          'Please ensure that you have entered the correct password and try again.',
          'Invalid Password'
        );
      }
    }
  });
  $('#passwordConfirm').val('');
  $('#newPassword').val('');
  $('#newPasswordRepeat').val('');
});

$(window).on('resize', function (evt) {
  $('div.content').height(($(window).height() - 130) + 'px');
  $('div#nickListPane').height(($(window).height() - 250) + 'px');
});

$(document).ready(function () {
  // It doesn't make sense to set any chat content areas' height here
  // because none exist yet!
  $('div#nickListPane').height(($(window).height() - 250) + 'px');

  // Connect to the user's favorite servers and channels
  var favorites = stash.get('favorites');
  if (!favorites) { // None set yet
    stash.set('favorites', {});
    return;
  }
  var servers = Object.keys(favorites);
  for (var sindex = 0, slen = servers.length; sindex < slen; sindex++) {
    var server = servers[sindex];
    var channels = favorites[server];
    socket.emit('serverJoin', {
      sid      : sid,
      server   : server,
      channels : channels,
      nick     : username
    });
    Notifier.info(
      'Sent requests to join the channels ' + channels.join(', ') + ' on ' + server + '.',
      'Favorite Server Connection'
    );
  }
});

$(window).focus(function (evt) {
  windowFocused = true;
  if (intervalID != undefined) {
    clearInterval(intervalID);
    intervalID = undefined;
  }
});

$(window).blur(function (evt) {
  windowFocused = false;
});

$(window).unload(function () {
  socket.emit('leaving', {sid: sid});
  Notifier.info(
    'You are being disconnected.',
    'Disconnecting'
  );
});
