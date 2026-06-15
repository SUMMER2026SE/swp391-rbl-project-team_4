// Use native fetch or fall back

async function test() {
  try {
    console.log('Testing /api/movies/now-showing...');
    let res = await fetch('http://localhost:9999/api/movies/now-showing');
    let json = await res.json();
    console.log('Now Showing Success:', json.success);
    console.log('Count:', json.data ? json.data.length : 0);

    console.log('Testing /api/movies/coming-soon...');
    res = await fetch('http://localhost:9999/api/movies/coming-soon');
    json = await res.json();
    console.log('Coming Soon Success:', json.success);
    console.log('Count:', json.data ? json.data.length : 0);

    console.log('Testing /api/movies...');
    res = await fetch('http://localhost:9999/api/movies');
    json = await res.json();
    console.log('All Movies Success:', json.success);
    console.log('Count:', json.data ? json.data.length : 0);
    if (json.data && json.data.length > 0) {
      console.log('Sample Movie:', JSON.stringify(json.data[0], null, 2));
    }
  } catch (err) {
    console.error('API Fetch failed:', err.message);
  }
}

test();
