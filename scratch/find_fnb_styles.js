const fs = require('fs');
const content = fs.readFileSync('public/css/admin.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('fnb') || line.includes('voucher') || line.includes('.page')) {
        console.log(`Line ${index + 1}: ${line}`);
    }
});
