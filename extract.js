const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const cssDir = path.join(publicDir, 'css');

const indexCss = fs.readFileSync(path.join(cssDir, 'index.css'), 'utf8');

// Extract Navbar styles
// It starts at "/* ─── Navbar (Light Theme) ─── */" and goes until "/* ─── Buttons ─── */"
const navbarStart = indexCss.indexOf('/* ─── Navbar (Light Theme) ─── */');
const buttonsStart = indexCss.indexOf('/* ─── Buttons ─── */');
let navbarCss = indexCss.substring(navbarStart, buttonsStart);

// Also need .btn-login specific styles, wait, .btn-login is inside Navbar block in index.css?
// Let's check. Yes, .btn-login is between navbar and buttons block.

// Extract Footer styles
// It starts at "/* ─── Footer (Light Theme) ─── */" (Wait, let me just use regex to find footer)
// Let me grep the index.css for Footer
// Actually, I can just copy the relevant blocks.
