const fs = require('fs');
const path = require('path');

// 1. Rewrite i18n in app.js
const appJsPath = path.join(__dirname, 'public/app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const newI18n = `const i18n = {
    lang: localStorage.getItem('appLang') || 'vi',
    dict: {},
    timer: null,
    async init() {
        if (this.lang !== 'vi') {
            try {
                const res = await fetch(\`/locales/\${this.lang}.json\`);
                this.dict = await res.json();
            } catch (err) {
                console.error("Failed to load language dict", err);
            }
        }
        this.updateDOM();
    },
    setLang(lang) {
        if (lang === this.lang) return;
        localStorage.setItem('appLang', lang);
        window.location.reload();
    },
    t(key, fallback) {
        if (this.lang === 'vi') return fallback || key;
        const keys = key.split('.');
        let val = this.dict;
        for (const k of keys) {
            if (val && val[k]) val = val[k];
            else return fallback || key;
        }
        return val || fallback || key;
    },
    updateDOM() {
        if (this.lang === 'vi') return;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key, '');
            if (translation) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.placeholder) el.placeholder = translation;
                    else el.value = translation;
                } else {
                    el.innerHTML = translation;
                }
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.t(key, '');
            if (translation) el.placeholder = translation;
        });
        document.querySelectorAll('[data-i18n-dynamic-option]').forEach(el => {
            const key = el.getAttribute('data-i18n-dynamic-option');
            const suffix = el.getAttribute('data-i18n-suffix') || '';
            const translation = this.t(key, '');
            if (translation) el.innerHTML = translation + suffix;
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
    
    const observer = new MutationObserver((mutations) => {
        if (i18n.lang === 'vi') return;
        let shouldUpdate = false;
        for (const m of mutations) {
            if (m.addedNodes.length > 0) {
                shouldUpdate = true;
                break;
            }
        }
        if (shouldUpdate) {
            clearTimeout(i18n.timer);
            i18n.timer = setTimeout(() => i18n.updateDOM(), 50);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Inject Custom Toggle into Navbar
    const navActions = document.querySelector('.nav-actions') || document.querySelector('.admin-header-right');
    if (navActions) {
        const langToggle = document.createElement('div');
        langToggle.className = 'custom-lang-toggle';
        const isLight = getComputedStyle(document.body).getPropertyValue('--bg-white');
        langToggle.style.cssText = \`display:flex; gap:5px; margin-left:15px; background:\${isLight ? 'var(--bg, #f1f3f8)' : 'rgba(255,255,255,0.1)'}; padding:4px; border-radius:20px; align-items:center; border: 1px solid var(--border, transparent); z-index: 9999;\`;
        
        const activeBg = 'var(--primary, var(--accent, #e50914))';
        const inactiveBg = 'transparent';
        const activeColor = '#fff';
        const inactiveColor = 'var(--text2, var(--text, #fff))';
        
        const btnVi = document.createElement('button');
        btnVi.innerText = 'VI';
        btnVi.style.cssText = \`padding: 4px 10px; border-radius: 16px; border: none; font-weight: bold; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; color: \${i18n.lang === 'vi' ? activeColor : inactiveColor}; background: \${i18n.lang === 'vi' ? activeBg : inactiveBg};\`;
        
        const btnEn = document.createElement('button');
        btnEn.innerText = 'EN';
        btnEn.style.cssText = \`padding: 4px 10px; border-radius: 16px; border: none; font-weight: bold; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; color: \${i18n.lang === 'en' ? activeColor : inactiveColor}; background: \${i18n.lang === 'en' ? activeBg : inactiveBg};\`;

        btnVi.onclick = () => i18n.setLang('vi');
        btnEn.onclick = () => i18n.setLang('en');

        langToggle.appendChild(btnVi);
        langToggle.appendChild(btnEn);
        navActions.insertBefore(langToggle, navActions.firstChild);
    }
});`;

appJs = appJs.replace(/const i18n = \{[\s\S]*?\}\s*\};\s*document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\}\);/m, newI18n);

// Fallback if regex failed due to syntax error in previous steps:
if (!appJs.includes('i18n.updateDOM')) {
    appJs = appJs.replace(/const i18n = \{[\s\S]*/m, newI18n);
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Restored traditional i18n in app.js');

// 2. Add /api/translate/auto-dict route to translateRoutes.js
const translateRoutesPath = path.join(__dirname, 'routes/translateRoutes.js');
let translateRoutes = fs.readFileSync(translateRoutesPath, 'utf8');

const autoDictCode = `
router.post('/auto-dict', async (req, res) => {
    try {
        const { type, items } = req.body;
        // items = [ { key: 'title_1', vi: 'Lật Mặt' }, { key: 'desc_1', vi: '...' } ]
        if (!items || !items.length) return res.json({ success: true });

        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

        const textsToTranslate = items.map(i => i.vi);
        const prompt = \`Translate the following JSON array of strings from Vietnamese to English. Return ONLY a valid JSON array of strings in the exact same order. Strings to translate: \${JSON.stringify(textsToTranslate)}\`;
        
        let translations = textsToTranslate; // fallback
        if (apiKey) {
            try {
                const result = await model.generateContent(prompt);
                let text = result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
                translations = JSON.parse(text);
            } catch (err) {
                console.error("Auto-dict translation error:", err);
            }
        }

        const fs = require('fs');
        const path = require('path');
        const enPath = path.join(__dirname, '../public/locales/en.json');
        const viPath = path.join(__dirname, '../public/locales/vi.json');
        
        const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        const viDict = JSON.parse(fs.readFileSync(viPath, 'utf8'));

        if (!enDict[type]) enDict[type] = {};
        if (!viDict[type]) viDict[type] = {};

        items.forEach((item, idx) => {
            enDict[type][item.key] = translations[idx] || item.vi;
            viDict[type][item.key] = item.vi;
        });

        fs.writeFileSync(enPath, JSON.stringify(enDict, null, 4), 'utf8');
        fs.writeFileSync(viPath, JSON.stringify(viDict, null, 4), 'utf8');

        res.json({ success: true, message: 'Updated dict successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});
`;

if (!translateRoutes.includes('/auto-dict')) {
    translateRoutes = translateRoutes.replace(/module\.exports = router;/, autoDictCode + '\nmodule.exports = router;');
    fs.writeFileSync(translateRoutesPath, translateRoutes, 'utf8');
    console.log('Added auto-dict route to translateRoutes.js');
}

// 3. Patch admin.js to inject data-i18n and call /auto-dict
const adminJsPath = path.join(__dirname, 'public/js/admin.js');
let adminJs = fs.readFileSync(adminJsPath, 'utf8');

// Replace {m.Title} with <span data-i18n="...">
adminJs = adminJs.replace(/<div class="m-title">\$\{m\.Title\}<\/div>/g, '<div class="m-title" data-i18n="movies.title_${m.MovieID}">${m.Title}</div>');
adminJs = adminJs.replace(/<option value="\$\{m\.MovieID\}">\$\{m\.Title\} \(\$\{m\.Duration\} phút\)<\/option>/g, '<option value="${m.MovieID}" data-i18n-dynamic-option="movies.title_${m.MovieID}" data-i18n-suffix=" (${m.Duration} phút)">${m.Title} (${m.Duration} phút)</option>');

// Update saveMovie to call /auto-dict after success
const oldSaveMovie = `if (data.success) {
            showAdminToast(data.message, 'success');
            closeMovieModal();
            loadMovies();
        }`;
const newSaveMovie = `if (data.success) {
            // Auto translate via /auto-dict
            const movieId = data.data && data.data.MovieID ? data.data.MovieID : id;
            if (movieId) {
                fetch('/api/translate/auto-dict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
                    body: JSON.stringify({
                        type: 'movies',
                        items: [
                            { key: 'title_' + movieId, vi: document.getElementById('movieTitle').value },
                            { key: 'desc_' + movieId, vi: document.getElementById('movieDescription').value }
                        ]
                    })
                }).then(() => loadMovies()).catch(() => loadMovies());
            } else {
                loadMovies();
            }

            showAdminToast(data.message, 'success');
            closeMovieModal();
        }`;
adminJs = adminJs.replace(oldSaveMovie, newSaveMovie);

fs.writeFileSync(adminJsPath, adminJs, 'utf8');
console.log('Patched admin.js for auto-dict');
