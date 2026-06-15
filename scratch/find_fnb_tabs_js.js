const fs = require('fs');
const content = fs.readFileSync('public/js/admin.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('fnb-tab') || line.includes('Voucher') || line.includes('vouchers')) {
        console.log(`Line ${index + 1}: ${line}`);
    }
});
