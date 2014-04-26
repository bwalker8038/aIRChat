var config = require('../config');

exports.index = function(req, res) {
  res.render('index', {
    title: 'aIRChat',
    showDonationButton: config.showDonationButton,
    btcDonationAddress: config.btcDonationAddress
  });
};
