const fs = require('fs');
const content = fs.readFileSync('public/js/admin.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('navigate') || line.includes('switchTab') || line.includes('VOUCHER')) {
        console.log(`Line ${index + 1}: ${line}`);
    }
});
