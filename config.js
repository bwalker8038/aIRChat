/** Client Configuration
  * Used to configure information the client needs to create a socket.io
  * connection to the server
  */
exports.host = 'http://localhost';

/** Session secret
  * Express' sessions use a secret key to provide security.
  * This should never be shared with anyone once set.
  */
exports.secret = 'YOUR SECRET HERE';

/** Bitcoint donations
  * If showDonationButton is true, a couple of buttons will be placed on the
  * index page linking users to where they can donate bitcoins to the site's
  * owner.
  */
exports.showDonationButton = true;
exports.btcDonationAddress = '199euqg2NwUzPTDhhtwQ54vnWjbQ34ABTR';
