const fs = require('fs');

const files = ['public/app.js', 'public/js/admin.js', 'public/js/auth.js'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace getters
  content = content.replace(/localStorage\.getItem\('token'\)/g, "(localStorage.getItem('token') || sessionStorage.getItem('token'))");
  content = content.replace(/localStorage\.getItem\('user'\)/g, "(localStorage.getItem('user') || sessionStorage.getItem('user'))");

  // Replace removers
  content = content.replace(/localStorage\.removeItem\('token'\);/g, "localStorage.removeItem('token'); sessionStorage.removeItem('token');");
  content = content.replace(/localStorage\.removeItem\('user'\);/g, "localStorage.removeItem('user'); sessionStorage.removeItem('user');");

  fs.writeFileSync(file, content);
}
console.log('Getters and Removers updated!');
