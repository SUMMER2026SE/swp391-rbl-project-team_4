const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const dbPath = path.join(__dirname, 'config/cinemamanagements.sql');
const enPath = path.join(__dirname, 'public/locales/en.json');
const viPath = path.join(__dirname, 'public/locales/vi.json');

const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const viDict = JSON.parse(fs.readFileSync(viPath, 'utf8'));

if (!enDict.movies) enDict.movies = {};
if (!viDict.movies) viDict.movies = {};

const db = new sqlite3.Database(dbPath);

db.all('SELECT MovieID, Title, Description FROM Movies', async (err, movies) => {
    if (err) {
        console.error(err);
        return;
    }

    const items = [];
    movies.forEach(m => {
        if (!enDict.movies['title_' + m.MovieID]) {
            items.push({ key: 'title_' + m.MovieID, vi: m.Title });
        }
        if (m.Description && !enDict.movies['desc_' + m.MovieID]) {
            items.push({ key: 'desc_' + m.MovieID, vi: m.Description });
        }
    });

    if (items.length === 0) {
        console.log("No missing movie translations.");
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log("No API key, skipping full translation");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    const textsToTranslate = items.map(i => i.vi);
    const prompt = 'Translate the following JSON array of strings from Vietnamese to English. Return ONLY a valid JSON array of strings in the exact same order. Strings to translate: ' + JSON.stringify(textsToTranslate);
    
    try {
        console.log("Translating " + items.length + " existing movies...");
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const translations = JSON.parse(text);

        items.forEach((item, idx) => {
            enDict.movies[item.key] = translations[idx] || item.vi;
            viDict.movies[item.key] = item.vi;
        });

        fs.writeFileSync(enPath, JSON.stringify(enDict, null, 4), 'utf8');
        fs.writeFileSync(viPath, JSON.stringify(viDict, null, 4), 'utf8');
        console.log("Successfully translated existing movies!");
    } catch (err) {
        console.error("Translation error:", err);
    }
});
