var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;
var bcrypt = require('bcrypt');

const DEFAULT_PICTURE = '/images/defaultusericon.jpg';
const DEFAULT_FAVES = {'irc_freenode_net': ['#aIRChat']};

// Array remove - By John Resig
Array.prototype.remove = function (start, end) {
  var tail = this.slice((end || start) + 1 || this.length);
  this.length = start < 0 ? this.length + start : start;
  return this.push.apply(this, tail);
};

var replaceAll = function (str, from, to) {
  var i = str.indexOf(from);
  while (i != -1) {
    str.replace(from, to);
    i = str.indexOf(from, i);
  }
  return str;
}

var encodeServerNameAsKey = function (serverName) {
  return replaceAll(serverName, '.', '_');
};

var decodeServerNameFromKey = function (serverName) {
  return replaceAll(serverName, '_', '.');
};

var userFavoritesCoding = function (users, method) {
  if (users.length === undefined) {
    users = [users];
  }
  for (var i = 0, len = users.length; i < len; i++) {
    var keys = Object.keys(users[i].favorites);
    for (var j = 0, klen = keys.length; j < klen; j++) {
      var channels = users[i].favorites[keys[j]];
      var newName = method(users[i].favorites[keys[j]]);
      delete users[i].favorites[keys[j]];
      users[i].favorites[newName] = channels;
    }
  }
  return users;
}


var UserProvider = function (connection) {
  this.db = connection;
};

UserProvider.prototype.getCollection = function (callback) {
  this.db.createCollection('users', {w: 1}, function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      callback(null, user_collection);
    }
  });
};

UserProvider.prototype.findAll = function (callback) {
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      user_collection.find().toArray(function (error, results) {
        if (error) {
          callback(error);
        } else {
          results = userFavoritesCoding(results, decodeServerNameFromKey);
          callback(null, results);
        }
      });
    }
  });
};

UserProvider.prototype.findById = function (id, callback) {
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      user_collection.findOne(
        {
          _id: user_collection
               .db
               .bson_serializer
               .ObjectID
               .createFromHexString(id)
        },
        function (error, result) {
          if (error) {
            callback(error);
          } else {
            result = userFavoritesCoding(result, decodeServerNameFromKey);
            callback(null, result);
          }
        }
      );
    }
  });
};

UserProvider.prototype.profileInfo = function (usernames, callback) {
  var filterData = function (error, users) {
    if (error) {
      callback(error);
    } else {
      for (var i = users.length - 1; i >= 0; i--) {
        delete users[i].password_hash;
        users[i].nick = users[i].username;
        // Filter the original list of usernames so that default profiles can be built for them
        usernames.remove(usernames.indexOf(users[i].username));
        delete users[i].username;
        delete users[i].id;
      }
      for (var i = usernames.length - 1; i >= 0; i--) {
        users.push(
          {
            nick      : usernames[i],
            picture   : '/images/defaultusericon.jpg'
          }
        );
      }
      callback(null, users);
    }
  };
  var handleUsers = function (error, result) {
    if (error) {
      callback(error);
    } else if (result) {
      result.toArray(filterData);
    } else {
      callback(null, []);
    }
  };
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      user_collection.find({username: {$in: usernames}}, handleUsers);
    }
  });
};

UserProvider.prototype.updateProfile = function (user, callback) {
  var hUpdate = function (error, result) {
    console.log('Update result status: ' + result);
  };
  var callIfError = function (error, result) {
    if (error) {
      callback(error);
    }
  };
  var hashPass = function (error, salt, user_collection) {
    bcrypt.hash(user.newPassword, salt, function (error, hashpw) {
      if (!error) {
        user_collection.update(
          {username: user.username}, 
          {$set: {password_hash: hashpw}}, 
          callIfError
        );
      }
    });
  };
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      if (user.picture === undefined) {
        user.picture = DEFAULT_PICTURE;
      }
      user_collection.update({username: user.username}, {$set: {picture: user.picture}}, hUpdate);
      if (user.newPassword != undefined) {
        bcrypt.genSalt(10, function (error, salt) {
          hashPass(error, salt, user_collection);
        });
      }
      callback(null, user);
    }
  });
};

UserProvider.prototype.authenticate = function (username, password, callback) {
  var checkPassword = function (error, result) {
    if (error) callback(error);
    else callback(null, result);
  };
  var checkUserExistence = function (error, user) {
    if (error) {
      callback(error);
    } else {
      if (!user || user.password_hash === undefined) {
        callback(new Error('No user ' + username));
      } else {
        bcrypt.compare(password, user.password_hash, checkPassword);
      }
    }
  };
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      user_collection.findOne({'username': username}, checkUserExistence);
    }
  });
};
          

UserProvider.prototype.register = function (username, password, callback) {
  var handleInsertion = function (error, data) {
    if (error) callback(error);
    else callback(null, true);
  };
  var insertUser = function (user_collection, error, pwhash) {
    if (error) {
      callback(error);
    } else {
      user_collection.insert(
        {
          username     : username,
          password_hash: pwhash,
          picture      : DEFAULT_PICTURE,
        },
        handleInsertion
      );
    }
  };
  var hashpw = function (user_collection, error, salt) {
    if (error) callback(error);
    else bcrypt.hash(password, salt, function (error, pwhash) {
      insertUser(user_collection, error, pwhash);
    });
  };
  var storeUser = function (user_collection, error, user) {
    if (error || user) callback(new Error('Could not store user.'));
    else bcrypt.genSalt(10, function (error, salt) {
      hashpw(user_collection, error, salt);
    });
  };
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      // Check to see if the user already exists, otherwise salt and hash their
      // password and store their user information.
      user_collection.findOne({username: username}, function (error, user) {
        storeUser(user_collection, error, user);
      });
    }
  });
};

exports.UserProvider = UserProvider;
