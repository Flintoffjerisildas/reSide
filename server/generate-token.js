const jwt = require('jsonwebtoken');

const payload = {
  user: {
    id: '6996a40018ad01eba750a88c' // Owner ID from debug output
  }
};

const token = jwt.sign(payload, 'secret', { expiresIn: 3600 });
console.log(token);
