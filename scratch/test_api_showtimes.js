const fetch = require('node-fetch'); // wait, is node-fetch installed? Let's check or use http module
const http = require('http');

http.get('http://localhost:9999/api/movies/showtimes?cinemaId=11&date=2026-06-16', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('API Response:', JSON.stringify(json, null, 2));
    } catch(e) {
      console.log('Error parsing response:', data);
    }
  });
}).on('error', (err) => {
  console.error('API Error:', err);
});
