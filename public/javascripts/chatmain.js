var socket = io.connect(hostname, {
  'sync disconnect on unload' : true,
  'reconnect' : false
});

// Storage for the ID of the interval used to blink the title
// when there is a message waiting for the user.
var intervalID = undefined;
var windowFocused = true;
 
// Array of chat objects
var chats = new Array();

// Mapping of server_channel -> length of the longest nick amongst users in the channel.
// Used to space nicks and messages evenly.
var longestNickInChannel = {};
 
// Maps the name of a given server to the user's nick on that server.
var usernicks = {};

// Message status icons for no message, low and high priority message statuses.
const NO_MSG_ICON = '/images/icons/graydot.png';
const LP_MSG_ICON = '/images/icons/greendot.png';
const HP_MSG_ICON = '/images/icons/reddot.png';

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

var longestNick = function (nicks) {
  var max = 0;
  for (var i = 0, len = nicks.length; i < len; i++) {
    if (nicks[i].length > max) {
      max = nicks[i].length;
    }
  }
  return max;
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
  return string.replaceAll('"', '&#34;').replaceAll("'", '&#39;')
               .replaceAll('>', '&gt;').replaceAll('<', '&lt;')
               .replaceAll('/', '&#47;').replaceAll('\\', '&#92;');
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

const COMMAND_HELP = '' +
  'Any commands not in this list must be sent using the format specified by the IRC standard.<br />' +
  'part - Leave the currently selected channel.<br />' +
  'join &lt;channel&gt; - Join "channel" on the server hosting the currently selected channel.<br />' +
  'connect %lt;server&gt; &lt;channel1,channel2,...&gt; - Connect to the specified channels on "server".<br />' +
  'msg/privmsg &lt;nick&gt; &lt;msg&gt; - Send "msg" to "nick" on the server hosting the currently selected channel.<br />' +
  'nick &lt;newnick&gt; - Sets your nick on the server hosting the currently selected channel to "newnick".<br />';
var handleCommand = function (cmdstr) {
  var haveUISupport = ['part', 'join', 'connect', 'msg', 'privmsg', 'nick', 'help'];
  var activeServer = $('dd.active').first().data('server');
  var activeChannel = $('dd.active').first().data('channel');
  var parts = cmdstr.split(' ');
  parts[0] = parts[0].toLowerCase();
  if (haveUISupport.indexOf(parts[0]) === -1) {
    console.log('Raw command: ' + cmdstr);
    socket.emit('rawCommand', {
      command : cmdstr,
      server  : activeServer
    });
  } else if (parts[0] === 'part') {
    var message = parts.slice(1).join(' ');
    if (message.length === 0) {
      message = 'aIRChat user parted.';
    }
    socket.emit('part', {
      server  : activeServer,
      channel : activeChannel,
      message : message
    });
    $('dd.active').first().remove();
    $('div.active').first().remove();
    chats.remove(chatIndex(chats, activeServer, activeChannel));
  } else if (parts[0] === 'join') {
    if (parts.length < 2) {
      Notifier.error('No channel argument supplied to JOIN', 'Missing Arguments');
      return;
    }
    socket.emit('joinChannel', {
      server  : activeServer,
      channel : parts[1]
    });
  } else if (parts[0] === 'connect') {
    if (parts.length < 3) {
      Notifier.error('Not enough arguments to CONNECT.', 'Missing Arguments');
      return;
    }
    socket.emit('serverJoin', {
      channels : parts[2].split(','),
      server   : parts[1],
      nick     : usernicks[activeServer]
    });
  } else if (parts[0] === 'msg' || parts[0] === 'privmsg') {
    if (parts.length < 3) {
      Notifier.error('Not enough arguments to (PRIV)MSG.', 'Missing Arguments');
      return;
    }
    var msg = parts.slice(2).join(' ');
    socket.emit('writeChat', {
      destination : parts[1],
      server      : activeServer,
      message     : msg
    });
    var chat = joinChat(activeServer, parts[1]);
    chat.users = [usernicks[activeServer], parts[1], 'System'];
    addMessage({
      server  : activeServer,
      channel : parts[1],
      from    : usernicks[activeServer],
      message : msg
    });
  } else if (parts[0] === 'nick') {
    if (parts.length < 2) {
      Notifier.error('No new nick supplied to NICK command.', 'Missing Arguments');
      return;
    }
    socket.emit('changeNick', {
      server : activeServer,
      nick   : parts[1]
    });
  } else if (parts[0] === 'help') {
    addMessage({
      server  : activeServer,
      channel : activeChannel,
      from    : 'System',
      message : COMMAND_HELP
    });
  }
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
    return string.replaceAll('&#34;', '"').replaceAll('&#39;', "'")
                 .replaceAll('&gt;', '>').replaceAll('&lt;', '<')
                 .replaceAll('&#47;', '/').replaceAll('&#92;', '\\');
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
  var maxSpaces = longestNickInChannel[data.server + data.channel];
  for (var i = maxSpaces - data.from.length - 1; i >= 0; i--) {
    spaces += '&nbsp;';
  }
  var $newMsg = $(
    '<div class="message">' +
    '  <div class="messageContent' + highlight + '">' +
    '    <span>' + time + spaces + '</span><span class="bold">' + data.from + ' </span>' +
    '    <span>' + htmlify(data.message) + '</span>' +
    '  </div>' +
    '</div>'
  );
  $msgDiv.append($newMsg);
  var scrollDist = $msgDiv[0].scrollHeight - $msgDiv[0].offsetHeight - $msgDiv[0].scrollTop;
  if (scrollDist >= 25) {
    $msgDiv.scrollTop($msgDiv[0].scrollHeight);
  }
};

var setStatusIcon = function (server, channel, type) {
  var icon = NO_MSG_ICON;
  if (type === 'high') {
    icon = HP_MSG_ICON;
  } else if (type === 'low') {
    icon = LP_MSG_ICON;
  }
  var ce = $('dd[data-server="' + server + '"][data-channel="' + channel + '"] img').first();
  // Only update the orb color if we are either clearing the notification or the
  // incoming message priority is higher than that which the current status represents.
  if (icon === NO_MSG_ICON || ce.attr('src') !== HP_MSG_ICON) {
    ce.attr('src', icon);
  }
};

var clearNotifications = function (evt) {
  var server = $(evt.currentTarget).data('server');
  var channel = $(evt.currentTarget).data('channel');
  setStatusIcon(server, channel, 'none');
  chatElement('dd', server, channel).children('img').first().attr('src', NO_MSG_ICON);
};

// Add a new tab to the list of chat tabs and a content div to contain
// the nick list and messages.
var addChatSection = function (server, chanOrNick) {
  var $newTab = $(
    '<dd data-server="' + server + '" data-channel="' + chanOrNick + '">' +
    '  <a href="#panel_' + label(server, chanOrNick) + '">' +
    '    <img class="statusIcon" src="' + NO_MSG_ICON + '" />' +
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
  if (typeof chat === 'undefined') {
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
    message = data + ' has parted from this channel. ' + newdata;
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
  var msg = 'The connection to the aIRChat server was lost. Refresh the page to reconnect. ' +
            'You will be automatically reconnected to the channels you were in.';
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
    'You have successfully connected to your aIRChat server.',
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
  var title = '[*] aIRChat';
  if ($ad.data('server') != data.server || $ad.data('channel') != data.channel) {
    if (data.message.indexOf(usernicks[data.server]) != -1) {
      setStatusIcon(data.server, data.channel, 'high');
      title = '[!] aIRChat';
    } else {
      setStatusIcon(data.server, data.channel, 'low');
    }
  }
  if (windowFocused === false && typeof intervalID === 'undefined') {
    intervalID = setInterval(titleBlinker('aIRChat', title), 1000);
  }
  addMessage(data);
});

socket.on('notifyHigh', function (data) {
  var $activeDiv = $('div.active');
  var chat = chats[chatIndex(chats, data.server, data.from)];
  if (typeof chat === 'undefined') {
    chat = joinChat(data.server, data.from);
    chat.users = [usernicks[data.server], data.from, 'System'];
  }
  if ($activeDiv.data('server') != data.server || $activeDiv.data('channel') != data.channel) {
    setStatusIcon(data.server, data.channel, 'high');
  }
  addMessage({
    from    : data.from,
    server  : data.server,
    channel : data.from,
    message : data.message
  });
  if (windowFocused === false && typeof intervalID === 'undefined') {
    intervalID = setInterval(titleBlinker('aIRChat', '[!] aIRChat'), 1000);
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
socket.on('nickList', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  if (typeof chat === 'undefined') {
    chat = joinChat(data.server, data.channel);
  }
  longestNickInChannel[data.server + data.channel] = longestNick(data.nicks);
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
    var chat = chats[chatIndex(chats, data.server, data.channel)];
    chat.users.push(data.nick);
    channelNotification('joined', data.server, data.channel, data.nick);
  }
  if (data.nick.length > longestNickInChannel[data.server + data.channel]) {
    longestNickInChannel[data.server + data.channel] = data.nick.length;
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
    var chat = chats[chatIndex(chats, data.server, data.channel)];
    var index = chat.users.indexOf(data.nick);
    chat.users.remove(index);
    longestNickInChannel[data.server + data.channel] = longestNick(chat.users);
  }
});

socket.on('newNick', function (data) {
  if (data.new.length > longestNickInChannel[data.server + data.channel]) {
    longestNickInChannel[data.server + data.channel] = data.new.length;
  }
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
    socket.emit('joinChannel', {server: data.server, channel: data.to});
  }
});

socket.on('userLeft', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.from)];
  if (typeof chat === 'undefined') {
    return;
  }
  chat.users.remove(chat.users.indexOf(data.nick));
  channelNotification('departed', data.server, data.from, data.nick, data.reason);
  longestNickInChannel[data.server + data.channel] = longestNick(chat.users);
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
      handleCommand(command);
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
        message     : $ta.val()
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
  if (typeof server === 'undefined') {
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
      channel : chanName
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
      channels : [firstChannel]
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
  if (typeof channel === 'undefined' || typeof server === 'undefined') {
    Notifier.warning(
      'No channel was selected to get the list of users for.',
      'Missing Selection'
    );
    return;
  }
  var chat = chats[chatIndex(chats, server, channel)];
  var users = chat.users.sort().join(', ');
  addMessage({
    server  : server,
    channel : channel,
    from    : 'System',
    message : 'Users in ' + channel + ' on ' + server + ' : ' + users
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
  } else if (typeof server === 'undefined') {
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
      message     : msg
    });
  }
});

$('a[data-reveal-id=partChannel]').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  var $modalTextSection = $('div#partChannel div.row div.columns p');
  if (typeof channel === 'undefined') {
    $modalTextSection.text('No channel was selected to part from.');
  } else {
    $modalTextSection.text('Are you sure you want to leave ' + channel + '?');
  }
});

$('a#confirmPartChannel').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  var server = $('div.active').first().data('server');
  if (typeof channel === 'undefined' || typeof server === 'undefined') {
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
      message: 'aIRChat client parted.'
    });
  }
});

$('a#changeNickConfirm').click(function (evt) {
  var newNick = $('input#newNickInput').val();
  var server = $('dd.active').first().data('server');
  if (newNick.length === 0) {
    Notifier.error('You have not provided a new nick.', 'Missing Field');
  } else if (typeof server === 'undefined') {
    Notifier.warning(
      'To change your nick on a server, you must first select ' +
      'a chat tab for a channel on that server.',
      'Missing Selection'
    );
  } else {
    socket.emit('changeNick', {
      server : server,
      nick   : newNick
    });
  }
});

$(window).on('resize', function (evt) {
  $('div.content').height(($(window).height() - 130) + 'px');
});

$(document).ready(function () {
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

var getCurrentChats = function () {
  var chatdata = {};
  for (var i = chats.length - 1; i >= 0; i--) {
    var server = chats[i].server;
    var channel = chats[i].channel;
    if (typeof chatdata[server] === 'undefined') {
      chatdata[server] = [channel];
    } else {
      chatdata[server].push(channel);
    }
  }
  return chatdata;
};

$(window).unload(function () {
  stash.set('nicks', usernicks);
  stash.set('favorites', getCurrentChats());
  socket.disconnect();
});
