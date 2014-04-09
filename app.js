var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var chat = require('./routes/chat');
var config = require('./config');
var http = require('http');
var path = require('path');
var socketio = require('socket.io');

var MongoClient = require('mongodb').MongoClient;
var UserProvider = require('./userprovider').UserProvider;

var app = express();
var userProvider;

MongoClient.connect(config.dbURI, function (error, db) {
  if (!error) {
    userProvider = new UserProvider(db);
    console.log('A connection to the database has been successfully established.');
  } else {
    console.log('A connection to the database could not be established.');
    throw new Error('Could not connect to DB: ' + config.dbURI);
  }
});

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({secret: config.secret}));
app.use(express.bodyParser());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.post('/login', function (req, res) {
  user.login(req, res, userProvider);
});
app.post('/register', function (req, res) {
  user.register(req, res, userProvider);
});
app.get('/login', user.login);
app.get('/register', user.register);
app.get('/logout', user.logout);
app.get('/chat', chat.main);
app.post('/profileupdate', function (req, res) {
  user.updateProfile(req, res, userProvider);
});

var server = http.createServer(app);

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var io = socketio.listen(server);
io.on('connection', function (socket, params) {
  chat.newClient(socket, params, userProvider);
});
