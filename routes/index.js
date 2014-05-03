var config = require('../config');

exports.index = function(req, res) {
  console.log('Got query:');
  console.log(req.query);
  var ajServer = req.query.server;
  var ajChannel = req.query.channel;
  console.log('ajServer = ' + ajServer);
  console.log('ajChannel = ' + ajChannel);
  res.render('index', {
    title              : 'aIRChat',
    showDonationButton : config.showDonationButton,
    btcDonationAddress : config.btcDonationAddress,
    autoJoinServer     : ajServer,
    autoJoinChannel    : ajChannel
  });
};
