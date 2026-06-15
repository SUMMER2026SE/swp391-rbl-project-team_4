const fs = require('fs');
const content = fs.readFileSync('public/admin.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('page-fnb')) {
        console.log(`Line ${index + 1}: ${line}`);
    }
});
