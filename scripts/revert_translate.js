const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public/app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const newI18n = `const i18n = {
    lang: localStorage.getItem('appLang') || 'vi',
    init() {
        const gtDiv = document.createElement('div');
        gtDiv.id = 'google_translate_element';
        gtDiv.style.display = 'none';
        document.body.appendChild(gtDiv);

        window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement({
                pageLanguage: 'vi',
                includedLanguages: 'en,vi',
                autoDisplay: false
            }, 'google_translate_element');
        };

        const gtScript = document.createElement('script');
        gtScript.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        document.body.appendChild(gtScript);

        // Siêu CSS ẩn toàn bộ UI của Google Translate
        const style = document.createElement('style');
        style.innerHTML = \`
            /* Ẩn banner trên cùng */
            .goog-te-banner-frame.skiptranslate, .goog-te-gadget-icon { display: none !important; }
            body { top: 0px !important; }
            
            /* Ẩn mọi popup, tooltip đánh giá bản dịch */
            #goog-gt-tt, .goog-te-balloon-frame { display: none !important; opacity: 0 !important; visibility: hidden !important; }
            .goog-tooltip { display: none !important; }
            .goog-tooltip:hover { display: none !important; }
            
            /* Tắt hiệu ứng bôi đen khi di chuột vào chữ đã dịch */
            .goog-text-highlight { 
                background-color: transparent !important; 
                border: none !important; 
                box-shadow: none !important; 
                pointer-events: none !important; 
            }
            
            /* Các class mã hóa của iframe đánh giá (rate translation) */
            .VIpgJd-Zvi9od-ORHb-OEVmcd, 
            .VIpgJd-Zvi9od-aZ2wEe-wOHMyf, 
            .VIpgJd-yAWNEb-hvhVDb { 
                display: none !important; 
            }
            
            iframe[name="goog_te_banner_frame"] { display: none !important; }
        \`;
        document.head.appendChild(style);

        // Ngăn chặn sự kiện hover mở popup của Google Translate
        document.addEventListener('mouseover', function(e) {
            if (e.target.classList && e.target.classList.contains('goog-text-highlight')) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
    },
    setLang(lang) {
        if (lang === this.lang) return;
        localStorage.setItem('appLang', lang);

        const domain = window.location.hostname;
        if (lang === 'en') {
            document.cookie = "googtrans=/vi/en; path=/";
            if(domain !== "localhost" && domain !== "") document.cookie = \`googtrans=/vi/en; domain=\${domain}; path=/\`;
        } else {
            document.cookie = "googtrans=/vi/vi; path=/";
            if(domain !== "localhost" && domain !== "") document.cookie = \`googtrans=/vi/vi; domain=\${domain}; path=/\`;
        }
        window.location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
    
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

// Remove the old i18n and observer
appJs = appJs.replace(/const i18n = \{[\s\S]*?\}\s*\};\s*document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\}\);/m, newI18n);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Reverted to Hidden Google Translate in app.js');
