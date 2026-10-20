
const axios = require('axios');

async function testRegister() {
  try {
    const res = await axios.post('http://127.0.0.1:5000/api/auth/register', {
      name: 'Test User',
      email: 'test' + Date.now() + '@example.com',
      password: 'password123',
      tamilRole: 'owners'
    });
    console.log('Success:', res.data);
  } catch (err) {
    if (err.response) {
      console.log('Error Status:', err.response.status);
      console.log('Error Data:', err.response.data);
    } else {
      console.log('Error:', err.message);
    }
  }
}

testRegister();
