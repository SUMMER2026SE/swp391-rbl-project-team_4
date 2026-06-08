const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:9999${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    console.log('--- Testing /api/movies/showtimes/1 ---');
    const showtime = await testEndpoint('/api/movies/showtimes/1');
    console.log(JSON.stringify(showtime, null, 2));

    console.log('\n--- Testing /api/movies/showtimes/1/seats (Top 5 seats) ---');
    const seats = await testEndpoint('/api/movies/showtimes/1/seats');
    if (seats && seats.success) {
      console.log('Success! Total seats:', seats.data.length);
      console.log('Sample seats:', seats.data.slice(0, 5));
    } else {
      console.log('Failed!', seats);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
