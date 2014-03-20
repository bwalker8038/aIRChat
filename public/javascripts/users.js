var formattedMessageTime = function () {
  var date = new Date();
  var days = [
    'Monday', 
    'Tuesday', 
    'Wednesday', 
    'Thursday', 
    'Friday', 
    'Saturday', 
    'Sunday'
  ];
  return days[date.getDay()] + ' ' + date.getHours() + ':' + date.getMinutes();
};

var User = function (nick, bio, contact, picture, server) {
  this.nick = nick;
  this.bio = bio;
  this.contact = contact;
  this.picture = picture;
  this.lastMessage = undefined;
};

User.prototype.sameUserAs = function (nick) {
  return this.nick === nick;
};

User.prototype.gotNewMessage = function () {
  this.lastMessage = formattedMessageTime();
};

User.prototype.changeNick = function (newNick) {
  this.nick = newNick;
};

// Polyfill for the findIndex method.
if (!Array.prototype.findIndex) {
  // Having a 'thisArg' parameter is overkill for what I need.
  Array.prototype.findIndex = function (callback) {
    var length = this.length;
    for (var i = 0; i < length; i++) {
      if (callback(this[i], i, this)) {
        console.log('Found result at ' + i);
        return i;
      }
    }
    return -1;
  };
}

function userIndex(userList, nick) {
  return userList.findIndex(function (e, i, a) {
    return e.sameUserAs(nick);
  });
}
