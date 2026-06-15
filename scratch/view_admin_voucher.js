const fs = require('fs');

function printContext(filePath) {
    console.log(`\n--- ${filePath} ---`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes('voucher')) {
            console.log(`Line ${index + 1}: ${line.trim()}`);
        }
    });
}

printContext('routes/adminRoutes.js');
printContext('controllers/adminController.js');
printContext('models/adminModel.js');
