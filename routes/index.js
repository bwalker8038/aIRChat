var config = require('../config');

exports.index = function(req, res) {
  var ajServer = req.query.server;
  var ajChannel = req.query.channel;
  res.render('index', {
    title              : 'aIRChat',
    showDonationButton : config.showDonationButton,
    btcDonationAddress : config.btcDonationAddress,
    autoJoinServer     : ajServer,
    autoJoinChannel    : ajChannel
  });
};
