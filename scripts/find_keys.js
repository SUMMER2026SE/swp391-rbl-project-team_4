const fs = require('fs');
const content = fs.readFileSync('public/js/admin.js', 'utf8');
const matches = [...content.matchAll(/data-i18n(-placeholder|-dynamic-option)?="([a-zA-Z0-9_\.]+)"/g)].map(m => m[2]);
const unique = [...new Set(matches)];
console.log(unique.join('\n'));
