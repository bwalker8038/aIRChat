var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

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

UserProvider.prototype.save = function (users, callback) {
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
          user.picture = '/images/defaultusericon.jpg';
        }
        if (user.bio === undefined) {
          user.bio = 'This user has not written anything about themselves yet.';
        }
        if (user.contact === undefined) {
          user.contact = 'This user has not listed any contact information.';
        }
        if (user.favorites === undefined) {
          user.favorites = {}; // Mapping of server name to array of channel names
        }
      }
      user_collection.insert(users, function () {
        callback(null, users);
      });
  });
};

exports.UserProvider = UserProvider;
