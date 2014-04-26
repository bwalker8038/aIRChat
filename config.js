/** Client Configuration
  * Used to configure information the client needs to create a socket.io
  * connection to the server
  */
exports.host = 'http://localhost';

/** Database Configuration
  * The URI used to create a connection to the database.
  * 'localhost' should be changed to the address you are hosting aIRChat on
  * '27017'     should be changed to the port you have the database using
  * 'usersDb'   should be changed to the name of the database you have chosen
  */
exports.dbURI = 'mongodb://localhost:27017/usersDb';

/** Session secret
  * Express' sessions use a secret key to provide security.
  * This should never be shared with anyone once set.
  */
exports.secret = 'YOUR SECRET HERE';

/** Heartbeat interval
  * The aIRChat server will send a heartbeat signal to connected clients
  * every number of seconds provided. This is to check that the connection
  * is still strong and that messages should be being sent and received.
  */
exports.heartbeat_interval = 4; // Four seconds

/** Heartbeat timeout
  * If an aIRChat client fails te respond to a heartbeat signal after
  * this number of seconds, all of its IRC connections will be
  * disconnected to free the user's nick up for when (if) they reconnect.
  */
exports.heartbeat_timeout = 20; // Twenty seconds

/** Bitcoint donations
  * If showDonationButton is true, a couple of buttons will be placed on the
  * index page linking users to where they can donate bitcoins to the site's
  * owner.
  */
exports.showDonationButton = true;
exports.btcDonationAddress = '199euqg2NwUzPTDhhtwQ54vnWjbQ34ABTR';
