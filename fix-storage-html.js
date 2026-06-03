const fs = require('fs');
const path = require('path');

function replaceInHtml(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInHtml(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            if (content.includes("localStorage.getItem('token')")) {
                content = content.replace(/localStorage\.getItem\('token'\)/g, "(localStorage.getItem('token') || sessionStorage.getItem('token'))");
                modified = true;
            }
            if (content.includes("localStorage.getItem('user')")) {
                content = content.replace(/localStorage\.getItem\('user'\)/g, "(localStorage.getItem('user') || sessionStorage.getItem('user'))");
                modified = true;
            }
            if (content.includes("localStorage.removeItem('token')")) {
                content = content.replace(/localStorage\.removeItem\('token'\);?/g, "{localStorage.removeItem('token'); sessionStorage.removeItem('token');}");
                modified = true;
            }
            if (content.includes("localStorage.removeItem('user')")) {
                content = content.replace(/localStorage\.removeItem\('user'\);?/g, "{localStorage.removeItem('user'); sessionStorage.removeItem('user');}");
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log('Updated:', fullPath);
            }
        }
    }
}

replaceInHtml('public');
