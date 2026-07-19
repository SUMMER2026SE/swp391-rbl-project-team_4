const http = require('http');
const fs = require('fs');
const path = require('path');

const imgPath = path.join(__dirname, '../public/images/promo_voucher.png');
const fileData = fs.readFileSync(imgPath);

const boundary = '--------------------------' + Date.now().toString(16);
const header = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="promo_voucher.png"\r\nContent-Type: image/png\r\n\r\n`;
const footer = `\r\n--${boundary}--\r\n`;

const body = Buffer.concat([
  Buffer.from(header, 'utf8'),
  fileData,
  Buffer.from(footer, 'utf8')
]);

async function testPath(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 9999,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[${res.statusCode}] ${urlPath} =>`, data);
        resolve(res.statusCode);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Testing /api/admin/vouchers/upload ...');
  await testPath('/api/admin/vouchers/upload');
  console.log('Testing /admin/vouchers/upload ...');
  await testPath('/admin/vouchers/upload');
  process.exit(0);
}

run();
