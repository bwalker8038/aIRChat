/** The Chat object contains information about a channel on a given server.
  * It makes use of the User object provided by users.js.
  */

var Chat = function (server, channel) {
  this.server = server;
  this.channel = channel;
  this.users = new Array();
};

Chat.prototype.sameChat = function (server, channel) {
  return this.server === server && this.channel.toLowerCase() === channel.toLowerCase();
};

function chatIndex(chatList, server, channel) {
  for (var index = 0, len = chatList.length; index < len; index++) {
    if (chatList[index].sameChat(server, channel)) {
      return index;
    }
  }
  return -1;
}

// Used for the anchors from chat tabs to the corresponding content div.
function label(server, channel) {
  while (server.indexOf('.') !== -1) {
    server = server.replace('.', '_');
  }
  while (channel.indexOf('/') !== -1) {
    channel = channel.replace('/', '_');
  }
  return server + '_' + channel.replace('#', '-');
}
