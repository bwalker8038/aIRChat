var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;
var bcrypt = require('bcrypt');

const DEFAULT_PICTURE = '/images/defaultusericon.jpg';
const DEFAULT_BIO = 'This user has not set a bio for themselves yet.';
const DEFAULT_CONTACT = 'This user has not provided any contact information.';
const DEFAULT_FAVES = {'irc_freenode_net': ['#aIRChat']};

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
  console.log('Stored connection object');
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
      user_collection.findOne({
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
      });
    }
  });
};

UserProvider.prototype.profileInfo = function (username, callback) {
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      user_collection.findOne({username: username}, function (error, result) {
        if (error) {
          callback(error);
        } else {
          callback(null, {
            username  : username,
            bio       : result.bio,
            contact   : result.contact,
            picture   : result.picture,
            favorites : userFavoritesCoding(result, decodeServerNameFromKey)
          });
        }
      });
    }
  });
};

UserProvider.prototype.updateProfile = function (user, callback) {
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      if (user.picture === undefined) {
        user.picture = DEFAULT_PICTURE;
      }
      if (user.bio === undefined) {
        user.bio = DEFAULT_BIO;
      }
      if (user.contact === undefined) {
        user.contact = DEFAULT_CONTACT;
      }
      if (user.favorites === undefined) {
        user.favorites = DEFAULT_FAVES;
      } else {
        user = userFavoritesCoding(user, encodeServerNameAsKey);
      }
      user_collection.update({username: user.username}, {'$set': {
        picture  : user.picture,
        bio      : user.bio,
        contact  : user.contact,
        favorites: user.favorites
      }});
      callback(null, user);
    }
  });
};

UserProvider.prototype.authenticate = function (username, password, callback) {
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      var user = user_collection.find({username: username});
      if (!user.password_hash) {
        callback(null, false);
      } else {
        bcrypt.compare(password, user.password_hash, function (error, result) {
          if (error) {
            callback(error);
          } else {
            callback(null, result);
          }
        }); // The last sip of tea
      }     // at one AM in the morn'
    }       // escaping callbacks
  });       // by
};          // redwire

UserProvider.prototype.register = function (username, password, callback) {
  console.log('Register function called.');
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      console.log('Got user collection.');
      bcrypt.genSalt(10, function (error, salt) {
        if (error) {
          callback(error);
        } else {
          console.log('Generated a salt to has password with.');
          bcrypt.hash(password, salt, function (error, hash) {
            if (error) {
              callback(error);
            } else {
              console.log('Hashed password');
              user_collection.insert({
                username     : username,
                password_hash: hash,
                picture      : DEFAULT_PICTURE,
                bio          : DEFAULT_BIO,
                contact      : DEFAULT_CONTACT,
                favorites    : DEFAULT_FAVES
              },
              function (error, data) {
                if (error) {
                  console.log('Error inserting new user: ' + error);
                  callback(error);
                } else {
                  console.log('Inserted new user');
                  callback(null, true);
                }
              });
            }   // We're getting awfully close to what
          });   // people are always complaining about
        }       // with regards to Node.js, here
      });       // With these way-too-deeply nested
    }           // callback functions, whose closing
  });           // brackets take up so much space that
};              // I could fit this monolog in here.

exports.UserProvider = UserProvider;
