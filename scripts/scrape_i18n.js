const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const publicDir = path.join(__dirname, 'public');
const enPath = path.join(publicDir, 'locales/en.json');
const viPath = path.join(publicDir, 'locales/vi.json');

const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const viDict = JSON.parse(fs.readFileSync(viPath, 'utf8'));

const keys = new Set();
const viMap = {};

// Scan HTML
fs.readdirSync(publicDir).forEach(file => {
    if (file.endsWith('.html')) {
        const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
        const matches = content.match(/data-i18n="([^"]+)"/g) || [];
        matches.forEach(m => {
            const key = m.replace('data-i18n="', '').replace('"', '');
            keys.add(key);
            
            // Extract the original text from HTML to build viMap
            const re = new RegExp('data-i18n="' + key + '"[^>]*>([^<]+)<', 'i');
            const extract = content.match(re);
            if (extract && extract[1] && extract[1].trim() !== '') {
                viMap[key] = extract[1].trim();
            }
        });
    }
});

const items = [];
Array.from(keys).forEach(key => {
    const parts = key.split('.');
    let hasEn = true;
    let curr = enDict;
    for(const p of parts) {
        if(!curr[p]) { hasEn = false; break; }
        curr = curr[p];
    }
    
    if (!hasEn && viMap[key]) {
        items.push({ key, vi: viMap[key] });
    }
});

if (items.length === 0) {
    console.log('No missing static translations.');
    process.exit(0);
}

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

const textsToTranslate = items.map(i => i.vi);
const prompt = 'Translate the following JSON array of strings from Vietnamese to English. Return ONLY a valid JSON array of strings in the exact same order. Strings to translate: ' + JSON.stringify(textsToTranslate);

model.generateContent(prompt).then(result => {
    let text = result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    const translations = JSON.parse(text);

    items.forEach((item, idx) => {
        const parts = item.key.split('.');
        
        let currEn = enDict;
        let currVi = viDict;
        for(let i=0; i<parts.length-1; i++) {
            if(!currEn[parts[i]]) currEn[parts[i]] = {};
            if(!currVi[parts[i]]) currVi[parts[i]] = {};
            currEn = currEn[parts[i]];
            currVi = currVi[parts[i]];
        }
        currEn[parts[parts.length-1]] = translations[idx] || item.vi;
        currVi[parts[parts.length-1]] = item.vi;
    });

    fs.writeFileSync(enPath, JSON.stringify(enDict, null, 4), 'utf8');
    fs.writeFileSync(viPath, JSON.stringify(viDict, null, 4), 'utf8');
    console.log("Restored static translations!");
}).catch(console.error);
