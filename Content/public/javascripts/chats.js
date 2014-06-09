/** The Chat object contains information about a channel on a given server.
  * It makes use of the User object provided by users.js.
  */
var Chat = function (server, channel) {
  this.server = server;
  this.channel = channel;
  this.users = new Array();
  this.userColors = new Array();
  this.cIndex = 0;
};

const nickColors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];

Chat.prototype.sameChat = function (server, channel) {
  return this.server === server && this.channel.toLowerCase() === channel.toLowerCase();
};

Chat.prototype.removeUser = function (nick) {
  var index = this.users.indexOf(nick);
  if (index >= 0) {
    this.users.remove(index);
    this.userColors.remove(index);
  }
}

Chat.prototype.addUser = function (nick) {
  this.users.push(nick);
  this.userColors.push(nickColors[this.cIndex]);
  this.cIndex = (this.cIndex + 1) % nickColors.length;
}

Chat.prototype.colorForNick = function (nick) {
  var index = this.users.indexOf(nick);
  if (index >= 0) {
    return this.userColors[index];
  }
  return 'self';
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
