const fs = require('fs');

let code = fs.readFileSync('public/admin.html', 'utf8');

code = code.replace(/<span data-i18n="admin\.gvev05"><span data-i18n="admin\.staff">Nhân viên<\/span><\/span>/g, '<span data-i18n="admin.staff">Nhân viên</span>');
code = code.replace(/<span data-i18n="admin\.2q6x0x"><span data-i18n="admin\.manager">Quản lý<\/span><\/span>/g, '<span data-i18n="admin.manager">Quản lý</span>');

fs.writeFileSync('public/admin.html', code, 'utf8');
console.log('Fixed admin.html!');
