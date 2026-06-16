const fs = require('fs');
const css = fs.readFileSync('public/css/admin.css', 'utf8');

css.split('\n').forEach((line, i) => {
  if (line.includes('topbar') || line.includes('ttab') || line.includes('main-wrap')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
