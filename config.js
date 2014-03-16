/** Database Configuration
  * Used to build the URL to access the postgres database, form:
  * postgres://<username>:<password>@<location>
  */
exports.username = '';
exports.password = '';
exports.location = 'localhost/postgres';

/** Client Configuration
  * Used to configure information the client needs to create a socket.io
  * connection to the server
  */
exports.host = 'http://localhost';

/** Session secret
  * Express' sessions use a secret key to provide security.
  * This should never be shared with anyone once set.
  */
exports.secret = 'your secret key value';
