var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var chat = require('./routes/chat');
var config = require('./config');
var http = require('http');
var path = require('path');
var socketio = require('socket.io');
var UserProvider = require('./userprovider').UserProvider;

var app = express();
var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? 
           process.env['MONGO_NODE_DRIVER_HOST']         :
           'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ?
           process.env['MONGO_NODE_DRIVER_PORT']         :
           27017;
var userProvider = new UserProvider(host, port);

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
app.get('/chat', function (req, res) {
  chat.main(req, res, userProvider);
});

var server = http.createServer(app);

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var io = socketio.listen(server);
io.on('connection', chat.newClient);
