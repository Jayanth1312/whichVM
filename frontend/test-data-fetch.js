const http = require('http');

// Test 1: Fetch meta through Next.js proxy
console.log('Testing meta endpoint...');
http.get('http://localhost:3000/api/data/meta/index.json', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const meta = JSON.parse(data);
    console.log('✓ Meta loaded:', meta.providers?.azure?.regions?.length, 'Azure regions');
    console.log('Response status:', res.statusCode);
  });
}).on('error', (e) => {
  console.error('✗ Meta Error:', e.message);
  console.log('Make sure frontend dev server is running on port 3000');
});
