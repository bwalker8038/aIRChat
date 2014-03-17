/** For now, just have the login and register functions redirect
  * to the chat page to test all the important stuff.
  */

var authenticates = function (user, pass) {
  return true;
};

var register = function (user, pass, passr) {
  return true;
};

exports.login = function (req, res) {
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
    if (authenticates(req.body.username, req.body.password) === true) {
      req.session.loggedIn = true;
      req.session.username = req.body.username;
      console.log('Logged in as ' + req.session.username);
      res.redirect('/chat');
    } else {
      res.redirect(401, '/');
    }
  } else {
    res.redirect(400, '/');
  }
};

exports.register = function (req, res) {
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
    if (register(
          req.body.username, req.body.password, req.body.paswordrepeat
        ) === true) {
      req.session.loggedIn = true;
      req.session.username = req.body.username;
      res.redirect('/chat');
    } else {
      res.redirect(500, '/'); // Use internal server error for reg. failure
    }
  } else {
    res.redirect(400, '/'); 
  }
};

exports.logout = function (req, res) {
  req.session = null;
  res.redirect(303, '/');
};
