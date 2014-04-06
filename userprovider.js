var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;
var bcrypt = require('bcrypt');

const DEFAULT_PICTURE = '/images/defaultusericon.jpg';
const DEFAULT_BIO = 'This user has not set a bio for themselves yet.';
const DEFAULT_CONTACT = 'This user has not provided any contact information.';
const DEFAULT_FAVES = {'irc.freenode.net', ['#aIRChat']};

var UserProvider = function (host, port) {
  this.db = new Db('airchat', new Server(host, port, {auto_reconnect: true}, {}));
  this.db.open(function () {});
};

UserProvider.prototype.getCollection = function (callback) {
  this.db.collection('users', function (error, user_collection) {
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
          callback(null, results);
        }
      });
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
          callback(null, result);
        }
      });
    }
  });
};

UserProvider.prototype.updateProfile = function (users, callback) {
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      if (users.length === undefined) {
        users = [users];
      }
      for (var i = 0; i < users.length; i++) {
        user = users[i];
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
        }
        user_collection.update({username: user.username}, {'$set': {
          picture  : user.picture,
          bio      : user.bio,
          contact  : user.contact,
          favorites: user.favorites
        }});
      }
      callback(null, users);
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
        });
      }
  });
};

UserProvider.prototype.register = function (username, password, callback) {
  this.getCollection(function (error, user_collection) {
    if (error) {
      callback(error);
    } else {
      bcrypt.genSalt(10, function (error, salt) {
        if (err) {
          callback(error);
        } else {
          bcrypt.hash(password, salt, function (error, hash) {
            user_collection.save({
              username     : username,
              password_hash: hash,
              picture      : DEFAULT_PICTURE,
              bio          : DEFAULT_BIO,
              contact      : DEFAULT_CONTACT,
              favorites    : DEFAULT_FAVES
            });
            callback(null, true);
          });
        }
      });
    }
  });
};

exports.UserProvider = UserProvider;
