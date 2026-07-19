const fs = require('fs');
const html = fs.readFileSync('public/admin.html', 'utf8');

const start = html.indexOf('id="page-schedule"');
if (start > -1) {
    console.log(html.substring(start + 5000, start + 8000));
} else {
    console.log('Not found page-schedule');
}
