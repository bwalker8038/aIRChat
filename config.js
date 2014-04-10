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
exports.secret = 'DDxkIMtKdkDSG8hMqtuc7r6y4sETUcdQoe9zrLie3FFvgUAIHTBSjS7XjMuFp8ro';
