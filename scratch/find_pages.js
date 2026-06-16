const fs = require('fs');
const file = fs.readFileSync('public/admin.html', 'utf8');
file.split('\n').forEach((line, i) => {
  if (line.includes('class="page') || line.includes('id="page-')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
