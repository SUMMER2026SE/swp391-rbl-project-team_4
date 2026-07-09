const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.post('/', async (req, res) => {
    try {
        const { texts, targetLanguage } = req.body;
        if (!texts || !texts.length) return res.json({ translations: [] });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

        // Prepare prompt
        const prompt = `Translate the following JSON array of strings from Vietnamese to ${targetLanguage}. 
You must return ONLY a valid JSON array of strings in the exact same order and length. 
Do not include any explanations, markdown formatting (\`\`\`json), or extra text.
If a string is already in ${targetLanguage} or is a proper noun (like movie title), keep it unchanged.
Strings to translate:
${JSON.stringify(texts)}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text();

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const translations = JSON.parse(text);

        if (translations.length !== texts.length) {
            throw new Error("Translation length mismatch");
        }

        res.json({ translations });
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: 'Translation failed' });
    }
});


router.post('/auto-dict', async (req, res) => {
    try {
        const { type, items } = req.body;
        // items = [ { key: 'title_1', vi: 'Lật Mặt' }, { key: 'desc_1', vi: '...' } ]
        if (!items || !items.length) return res.json({ success: true });

        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

        const textsToTranslate = items.map(i => i.vi);
        const prompt = `Translate the following JSON array of strings from Vietnamese to English. Return ONLY a valid JSON array of strings in the exact same order. Strings to translate: ${JSON.stringify(textsToTranslate)}`;

        let translations = textsToTranslate; // fallback
        if (apiKey) {
            try {
                const result = await model.generateContent(prompt);
                let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
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

module.exports = router;
