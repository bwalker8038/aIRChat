/** The Chat object contains information about a channel on a given server.
  * It makes use of the User object provided by users.js.
  */

var Chat = function (server, channel) {
  this.server = server;
  this.channel = channel;
  this.users = new Array();
  this.notifications = {low: 0, high: 0};
};

Chat.prototype.sameChat = function (server, channel) {
  return this.server === server && this.channel.toLowerCase() === channel.toLowerCase();
};

Chat.prototype.getUser = function (nick) {
  var index = userIndex(this.users, nick);
  return this.users[index];
};

Chat.prototype.gotLowPriorityMessage = function () {
  this.notifications.low++;
};

Chat.prototype.gotHighPriorityMessage = function () {
  this.notifications.high++;
};

Chat.prototype.lowPriorityNotifications = function () {
  return this.notifications.low;
};

Chat.prototype.highPriorityNotifications = function () {
  return this.notifications.high;
};

Chat.prototype.clearNotifications = function () {
  this.notifications.low = 0;
  this.notifications.high = 0;
};

function chatIndex(chatList, server, channel) {
  return chatList.findIndex(function (e, i, a) {
    return e.sameChat(server, channel);
  });
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
