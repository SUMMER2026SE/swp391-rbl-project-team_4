const fs = require('fs');
const path = require('path');

// 1. Patch server.js
const serverPath = path.join(__dirname, 'server.js');
let server = fs.readFileSync(serverPath, 'utf8');

if (!server.includes('translateRoutes')) {
    server = server.replace(
        /const adminNewsCompatRoutes = require\('\.\/routes\/adminNewsCompatRoutes'\);/,
        "const adminNewsCompatRoutes = require('./routes/adminNewsCompatRoutes');\nconst translateRoutes = require('./routes/translateRoutes');"
    );
    server = server.replace(
        /app\.use\('\/admin', adminNewsCompatRoutes\);/,
        "app.use('/admin', adminNewsCompatRoutes);\napp.use('/api/translate', translateRoutes);"
    );
    fs.writeFileSync(serverPath, server, 'utf8');
    console.log('Patched server.js');
}

// 2. Patch app.js
const appJsPath = path.join(__dirname, 'public/app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const newI18n = `const i18n = {
    lang: localStorage.getItem('appLang') || 'vi',
    init() {
        if (this.lang === 'en') {
            this.translatePage();
        }
    },
    setLang(lang) {
        if (lang === this.lang) return;
        localStorage.setItem('appLang', lang);
        window.location.reload();
    },
    async translatePage() {
        if (this.lang === 'vi') return;
        
        const nodes = [];
        const texts = [];
        const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                const parentTag = node.parentNode ? node.parentNode.tagName : '';
                if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE'].includes(parentTag)) return NodeFilter.FILTER_REJECT;
                
                const val = node.nodeValue.trim();
                // Check if string contains Vietnamese characters or is long enough to be translated
                if (val.length > 1 && /[a-zA-Záàãảạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/.test(val)) {
                    // Avoid translating numbers/dates only
                    if (!/^\\d{1,4}[\\-\\/\\:\\s]*\\d{1,4}[\\-\\/\\:\\s]*\\d{1,4}$/.test(val)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
                return NodeFilter.FILTER_REJECT;
            }
        });

        while (treeWalker.nextNode()) {
            nodes.push(treeWalker.currentNode);
            texts.push(treeWalker.currentNode.nodeValue.trim());
        }

        if (texts.length === 0) return;

        const batchSize = 30;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batchTexts = texts.slice(i, i + batchSize);
            const batchNodes = nodes.slice(i, i + batchSize);
            
            try {
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texts: batchTexts, targetLanguage: 'en' })
                });
                const data = await response.json();
                if (data.translations && data.translations.length === batchNodes.length) {
                    batchNodes.forEach((node, idx) => {
                        node.nodeValue = node.nodeValue.replace(batchTexts[idx], data.translations[idx]);
                    });
                }
            } catch (err) {
                console.error("Translation error:", err);
            }
        }
    }
};`;

appJs = appJs.replace(/const i18n = \{[\s\S]*?window\.location\.reload\(\);\s*\}\s*\};/m, newI18n);

appJs = appJs.replace(/const observer = new MutationObserver\(\(mutations\) => \{[\s\S]*?\}\);/m, 
`const observer = new MutationObserver((mutations) => {
        if (i18n.lang === 'vi') return;
        let shouldTranslate = false;
        for (const m of mutations) {
            if (m.addedNodes.length > 0) {
                shouldTranslate = true;
                break;
            }
        }
        if (shouldTranslate) {
            clearTimeout(i18n.timer);
            i18n.timer = setTimeout(() => i18n.translatePage(), 500);
        }
    });`);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Patched app.js');
