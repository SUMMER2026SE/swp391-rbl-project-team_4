const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/booking.html');
const content = fs.readFileSync(filePath, 'utf8');

const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
let match;
let index = 1;
let hasError = false;

while ((match = scriptRegex.exec(content)) !== null) {
  const scriptContent = match[1];
  if (scriptContent.trim().length === 0) continue;
  try {
    new Function(scriptContent);
    console.log(`✅ Script block #${index} in booking.html is syntactically valid.`);
  } catch (err) {
    console.error(`❌ Syntax error in Script block #${index} in booking.html:`, err.message);
    hasError = true;
  }
  index++;
}

if (!hasError) {
  console.log('🎉 ALL JS SCRIPT BLOCKS IN booking.html ARE 100% VALID WITH ZERO SYNTAX ERRORS!');
  process.exit(0);
} else {
  process.exit(1);
}
