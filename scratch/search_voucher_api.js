const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                searchDir(fullPath);
            }
        } else {
            if (file.endsWith('.js')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.toLowerCase().includes('voucher')) {
                    console.log(`Found in: ${fullPath}`);
                }
            }
        }
    }
}

searchDir('.');
