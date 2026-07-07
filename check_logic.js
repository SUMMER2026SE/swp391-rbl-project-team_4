const fs = require('fs');
const html = fs.readFileSync('public/payment-success.html', 'utf8');
console.log('Pending screen:', html.includes('id="pendingScreen"') || html.includes('class="pending-screen"'));
console.log('Check Payment Interval:', html.includes('checkPaymentStatus'));
console.log('ShowTicket:', html.includes('function showTicket'));
