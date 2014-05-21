var socket = io.connect(hostname, {
  'reconnection delay'        : 500,
  'reconnection limit'        : 10000,
  'max reconnection attempts' : 10,
  'sync disconnect on unload' : true
});

// Storage for the ID of the interval used to blink the title
// when there is a message waiting for the user.
var intervalID = undefined;
var windowFocused = true;
 
// Array of chat objects
var chats = new Array();
 
// Maps the name of a given server to the user's nick on that server.
var usernicks = {};

// A list of commands that are covered by the UI and shouldn't have to have extra code
// to handle them as raw commands.
const DISALLOWED = ['part', 'join', 'connect', 'msg', 'privmsg', 'nick'];

// TODO
// Create constants for all the different types of channel notifications

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

String.prototype.replaceAll = function (sub, newstr) {
  var index = this.indexOf(sub);
  var tmp = this;
  while (index >= 0) {
    tmp = tmp.replace(sub, newstr);
    index = tmp.indexOf(sub);
  }
  return tmp;
};

var secondsSinceEpoch = function () {
  return Math.round((new Date()).getTime() / 1000.0);
};

var formattedMessageTime = function () {
  var date = new Date();
  var hours = date.getHours() + '';
  var mins = date.getMinutes() + '';
  if (mins.length === 1) {
    mins = '0' + mins;
  }
  if (hours.length === 1) {
    hours = '0' + hours;
  }
  return hours + ':' + mins;
};

// Protect the user from themselves.
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

// Return the input string with urls wrapped in anchor tags
// and images in a clearing lightbox at the end for inline viewing
var htmlify = function (string) {
  var isURL = /^https?:\/\/(www\.)?\S+$/;
  var isImg = /^https?:\/\/(www\.)?\S+\/\S+\.(jpg|jpeg|gif|png|bmp)$/;
  var tokens = string.split(' ');
  var images = [];
  var html = '';
  // Need a function to convert the sanitized input into its original desanitized form
  // so that the regexes above will match both the user's input and incoming content.
  var desanitize = function (string) {
    string = string.replaceAll('&amp;', '&').replaceAll('&#61;', '=');
    string = string.replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    string = string.replaceAll('&#91;', '[').replaceAll('&#93;', '[');
    string = string.replaceAll('&#123;', '{').replaceAll('&#125;', '}');
    string = string.replaceAll('&#34;', '"').replaceAll('&#39;', "'");
    string = string.replaceAll('&#40;', '(').replaceAll('&#41;', ')');
    string = string.replaceAll('&#47;', '/').replaceAll('&#92;', '\\');
    string = string.replaceAll('&#37;', '%').replaceAll('&#58;', ':');
    return string;
  };

  for (var i = 0, len = tokens.length; i < len; i++) {
    var token = desanitize(tokens[i]);
    if (isURL.test(token)) {
      if (isImg.test(token)) {
        images.push(tokens[i]);
      }
      html += '<a href="' + tokens[i] + '" target="_blank">' + tokens[i] + '</a> ';
    } else {
      html += tokens[i] + ' ';
    }
  }
  if (images.length > 0) {
    html += '<br /><br /><ul class="inline-list">';
    for (var i = 0, len = images.length; i < len; i++) {
      html += '<li><a target="_blank" href="' + images[i] + '">' +
              '<img class="thumbnail" src="' + images[i] + '" /></a></li>';
    }
    html += '</ul>';
  }
  return html;
};

var addMessage = function (data) {
  var $msgDiv = chatElement('div', data.server, data.channel);
  var $tab = chatElement('dd', data.server, data.channel).children('a').first();
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  var time = formattedMessageTime(); // From users.js

  var highlight = '';
  if (data.from === usernicks[data.server]) {
    highlight = ' self'; // Space needed to separate class names
  } else if (data.message.indexOf(usernicks[data.server]) != -1) {
    highlight = ' mention';
  }

  var spaces = '&nbsp;';
  for (var i = 16 - data.from.length; i >= 0; i--) {
    spaces += '&nbsp;';
  }
  var $newMsg = $(
    '<div class="message">' +
    '  <div class="messageContent' + highlight + '">' +
    '    <span>' + time + '</span><span class="bold">' + data.from + spaces + ' |</span>' +
    '    <span>' + htmlify(data.message) + '</span>' +
    '  </div>' +
    '</div>'
  );
  $msgDiv.append($newMsg);
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
};

// Add a new tab to the list of chat tabs and a content div to contain
// the nick list and messages.
var addChatSection = function (server, chanOrNick) {
  var $newTab = $(
    '<dd data-server="' + server + '" data-channel="' + chanOrNick + '">' +
    '  <a href="#panel_' + label(server, chanOrNick) + '">' +
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
  var chat = chats[chatIndex(chats, server, channel)];
  if (chat === undefined) {
    chat = new Chat(server, channel);
    chats.push(chat);
    addChatSection(server, channel);
  }
  return chat;
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

var notifyConnectionLost = function () {
  var msg = 'The connection to the aIRChat server was lost. You may want to try to log out ' +
            'and then back in to reestablish the connection.';
  Notifier.warning('The connection to the server was lost.', 'Connection Lost');
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
};

socket.on('connect', function () {
  Notifier.success(
    'You have successfully connected to the aIRChat server.',
    'Connection Successful'
  );
});

socket.on('disconnect', function () {
  notifyConnectionLost();
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
  addMessage(data);
});

socket.on('notifyHigh', function (data) {
  var $activeDiv = $('div.active');
  var chat = chats[chatIndex(chats, data.server, data.from)];
  if (chat === undefined) {
    chat = joinChat(data.server, data.from);
    chat.users = [usernicks[data.server], data.from, 'System'];
  }
  if ($activeDiv.data('server') != data.server || $activeDiv.data('channel') != data.channel) {
    chat.gotHighPriorityMessage();
  }
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

socket.on('serverConnected', function (data) {
  usernicks[data.server] = data.nick;
  Notifier.info(
    'You have been connected to ' + data.server + '.',
    'Connection Successful'
  );
});

// Create a listing of nicks for the appropriate channel.
// The list will not be rendered until the channel is the active one.
// TODO
// Reduce network strain by not sending the server name with every user
socket.on('nickList', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  if (chat === undefined) {
    chat = joinChat(data.server, data.channel);
  }
  chat.users = data.nicks;
  chat.users.push('System');
});

// Add a new nick to the list of nicks for the provided channel. 
// Create a new chat tab if the aIRChat user is the one joining.
socket.on('joined', function (data) {
  if (data.nick === usernicks[data.server] ) {
    joinChat(data.server, data.channel);
    Notifier.info('Joined ' + data.channel + '.', 'Joined Channel');
    if ($('dd.active').length === 0) { // No active chats
      // Disable the default active content section
      $('div.active').first().attr('class', 'content');
      chatElement('dd', data.server, data.channel).attr('class', 'active');
      chatElement('div', data.server, data.channel).attr('class', 'content active');
    }
  } else {
    var index = chatIndex(chats, data.server, data.channel);
    chats[index].users.push(data.nick);
    channelNotification('joined', data.server, data.channel, data.nick);
  }
});

// Display a message telling the user they were kicked from the channel.
// Also deactivate the send mechanism for this channel.
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
    var index = chats.users.indexOf(data.nick);
    chats.users.remove(index);
  }
});

socket.on('newNick', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  if (data.old === usernicks[data.server]) {
    usernicks[data.server] = data.new;
  } else {
    var index = chat.users.indexOf(data.old);
    chat.users.remove(index);
    chat.users.push(data.new);
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
  chats[cindex].users.remove(chats[cindex].users.indexOf(data.nick));
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
        Notifier.error(
          name + ' is implemented through the UI and not accepted as a raw command.',
          'Disallowed Command'
        );
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
        message : sanitize($ta.val())
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
  var username = $('#serverNick').val();
  if (serverName === '' || firstChannel === '' || username === '') {
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
    Notifier.info(
      'Submitted request to connect to ' + serverName + '. You should connect shortly.',
      'Request Submitted'
    );
  }
});

$('a#showNickList').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  var server = $('div.active').first().data('server');
  if (channel === undefined || server === undefined) {
    Notifier.warning(
      'No channel was selected to get the list of users for.',
      'Missing Selection'
    );
    return;
  }
  var chat = chats[chatIndex(chats, server, channel)];
  addMessage({
    server  : server,
    channel : channel,
    from    : 'System',
    message : 'Users in ' + channel + ' on ' + server + ' : ' + chat.users.join(', ')
  });
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
    chat.users = [usernicks[server], nick, 'System'];
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
    stash.set('nicks', usernicks);
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
  var nicks = stash.get('nicks');
  if (!favorites) { // None set yet
    stash.set('favorites', {});
    if (!nicks) {
      stash.set('nicks', {});
    }
    return;
  } else if (!nicks) {
    stash.set('nicks', {});
    return;
  }
  var servers = Object.keys(favorites);
  for (var sindex = 0, slen = servers.length; sindex < slen; sindex++) {
    var server = servers[sindex];
    var channels = favorites[server];
    var nick = nicks[server];
    if (!nick) {
      nick = 'Guest';
      for (var i = 0; i < 6; i++) {
        nick += '' + Math.floor(Math.random() * 1000 % 10);
      }
    }
    socket.emit('serverJoin', {
      sid      : sid,
      server   : server,
      channels : channels,
      nick     : nick
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
  stash.set('nicks', usernicks);
  socket.emit('leaving', {sid: sid});
});
