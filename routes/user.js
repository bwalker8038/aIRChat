/** For now, just have the login and register functions redirect
  * to the chat page to test all the important stuff.
  */

exports.login = function (req, res, userProvider) {
  if (req.route.method === 'get') {
    console.log('Inside GET for login');
    if (req.session.loggedIn === true) {
      res.redirect('/chat');
    } else {
      res.redirect(401, '/');
    }
  } else if (req.route.method === 'post') {
    console.log('Inside POST for login');
    console.log(req.body);
    userProvider.authenticate(req.body.username, req.body.password, function (err, result) {
      if (err) {
        res.redirect(500, '/');
      } else if (result) {
        req.session.loggedIn = true;
        req.session.username = req.body.username;
        console.log('User ' + req.body.username + ' logged in.');
        res.redirect('/chat');
      } else {
        res.redirect(401, '/');
      }
    });
  } else {
    res.redirect(400, '/');
  }
};

exports.register = function (req, res, userProvider) {
  if (req.route.method === 'get') {
    console.log('Inside GET for register');
    if (req.session.loggedIn === true) {
      res.redirect('/chat');
    } else {
      res.redirect(400, '/'); 
    }
  } else if (req.route.method === 'post') {
    console.log('Inside POST for register');
    console.log(req.body);
    if (req.body.password != req.body.passwordrepeat) {
      res.redirect(401, '/');
    } else {
      userProvider.register(req.body.username, req.body.password, function (err, result) {
        if (err || !result) {
          res.redirect(500, '/');
        } else {
          req.session.loggedIn = true;
          req.session.username = req.body.username;
          res.redirect('/chat');
        }
      });
    }
  } else {
    res.redirect(400, '/'); 
  }
};

exports.logout = function (req, res) {
  req.session = null;
  res.redirect(303, '/');
};
