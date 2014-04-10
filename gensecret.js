var crypto = require('crypto');

var pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
var secret_bytes = 64;

crypto.randomBytes(secret_bytes, function (ex, buf) {
  if (ex) throw ex;
  var secret = '';
  for (var i = 0, len = buf.length; i < len; i++) {
    secret += pool[buf[i] % pool.length];
  }
  console.log(secret);
});
