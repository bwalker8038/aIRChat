/** The Chat object contains information about a channel on a given server.
  * It makes use of the User object provided by users.js.
  */
var Chat = function (server, channel) {
  this.server = server;
  this.channel = channel;
  this.users = new Array();
};

const nickColors = [
  'light-green',  'dark-green',
  'light-blue',   'dark-blue',
  'light-purple', 'dark-purple',
  'light-yellow', 'dark-yellow',
  'light-orange', 'dark-orange',
  'light-red',    'dark-red'
];


Chat.prototype.sameChat = function (server, channel) {
  return this.server === server && this.channel.toLowerCase() === channel.toLowerCase();
};

Chat.prototype.removeUser = function (nick) {
  var index = this.users.indexOf(nick);
  if (index >= 0) {
    this.users.remove(index);
  }
}

Chat.prototype.addUser = function (nick) {
  this.users.push(nick);
}

Chat.prototype.colorForNick = function (nick) {
  var sum = 0;
  for (var i = 0; i < nick.length; i++) {
    sum += nick.charCodeAt(i);
  }
  console.log('Sum of character codes in ' + nick + ' is ' + sum);
  return nickColors[sum % nickColors.length];
}

function chatIndex(chatList, server, channel) {
  for (var index = 0, len = chatList.length; index < len; index++) {
    if (chatList[index].sameChat(server, channel)) {
      return index;
    }
  }
  return -1;
}

Array.prototype.remove = function (start, end) {
  var tail = this.slice((end || start) + 1 || this.length);
  this.length = start < 0 ? this.length + start : start;
  return this.push.apply(this, tail);
};

// Used for the anchors from chat tabs to the corresponding content div.
function label(server, channel) {
  while (server.indexOf('.') !== -1) {
    server = server.replace('.', '_');
  }
  while (channel.indexOf('/') !== -1) {
    channel = channel.replace('/', '_');
  }
  while (channel.indexOf('#') !== -1) {
    channel = channel.replace('#', '-');
  }
  return server + '_' + channel;
}
