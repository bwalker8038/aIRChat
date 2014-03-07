/** For now, just have the login and register functions redirect
  * to the chat page to test all the important stuff.
  */

exports.login = function (req, res) {
  res.redirect('/chat');
};

exports.register = function (req, res) {
  res.redirect('/chat');
};
