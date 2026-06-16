const fs = require('fs');
const file = fs.readFileSync('public/admin.html', 'utf8');

file.split('\n').forEach((line, i) => {
  if (line.includes('</div><!-- end main-wrap -->') || line.includes('main-wrap') || line.includes('</body') || line.includes('chatbot.js')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
