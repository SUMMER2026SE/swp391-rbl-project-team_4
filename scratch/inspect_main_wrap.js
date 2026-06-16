const fs = require('fs');
const html = fs.readFileSync('public/admin.html', 'utf8');

// A simple regex or line-by-line inspection to find children of <div class="main-wrap">
let insideMainWrap = false;
let openDivs = 0;
let lines = html.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes('<div class="main-wrap">')) {
    insideMainWrap = true;
    console.log(`Line ${i+1}: Started main-wrap`);
    continue;
  }
  if (insideMainWrap) {
    if (line.includes('<div') && !line.includes('</div')) openDivs++;
    if (line.includes('</div') && !line.includes('<div')) openDivs--;
    
    // Print direct children (openDivs should be 1 if it's a direct child of main-wrap, since main-wrap itself is the outer context)
    // Wait, let's just match lines with class="page" or other main containers
    if (line.includes('class="page"') || line.includes('class="page active"') || line.includes('<header') || line.includes('id="page-')) {
      console.log(`Line ${i+1}: ${line.trim()}`);
    }
  }
}
