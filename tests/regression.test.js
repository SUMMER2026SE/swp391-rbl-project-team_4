const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const test = require('node:test');

const PORT = process.env.TEST_PORT || '10091';
const BASE_URL = `http://localhost:${PORT}`;
const CUSTOMER = {
  email: process.env.TEST_CUSTOMER_EMAIL || 'nam@gmail.com',
  password: process.env.TEST_CUSTOMER_PASSWORD || '123456',
};

let server;
let customerToken;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function waitForHealth() {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 20000) {
    try {
      const { response, body } = await request('/api/health');
      if (response.ok && body && body.status === 'OK') return;
    } catch (err) {
      lastError = err;
    }
    await wait(500);
  }
  throw lastError || new Error('Server did not become healthy in time.');
}

test.before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT,
      NODE_ENV: 'development',
      REMINDER_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  server.stdout.on('data', chunk => { logs += chunk.toString(); });
  server.stderr.on('data', chunk => { logs += chunk.toString(); });

  try {
    await waitForHealth();
  } catch (err) {
    throw new Error(`${err.message}\nServer output:\n${logs.slice(-4000)}`);
  }
});

test.after(async () => {
  if (!server || server.killed) return;
  server.kill();
  await wait(500);
});

test('auth rejects weak password at API layer', async () => {
  const { response, body } = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Weak Password User',
      email: `weak-${Date.now()}@example.com`,
      password: '123456',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /Chữ cái đầu tiên|Mật khẩu/);
});

test('customer login still works with seed credentials', async () => {
  const { response, body } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(CUSTOMER),
  });

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.user.roleName, 'Customer');
  assert.ok(body.token);
  customerToken = body.token;
});

test('public ticket details do not expose email or phone', async (t) => {
  assert.ok(customerToken, 'customer login must run first');

  const bookings = await request('/api/bookings/my-bookings', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(bookings.response.status, 200);

  const firstTicket = Array.isArray(bookings.body.data) ? bookings.body.data[0] : null;
  if (!firstTicket) {
    t.skip('Seed customer has no bookings to verify.');
    return;
  }

  const { response, body } = await request(`/api/bookings/public/${firstTicket.TicketID}`);
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(Object.hasOwn(body.data, 'customerEmail'), false);
  assert.equal(Object.hasOwn(body.data, 'customerPhone'), false);
});

test('booking defaults payment method to qrpay and can be cancelled', async (t) => {
  assert.ok(customerToken, 'customer login must run first');

  const seats = await request('/api/movies/showtimes/24/seats');
  assert.equal(seats.response.status, 200);

  const seat = Array.isArray(seats.body.data)
    ? seats.body.data.find(item => item.SeatStatus === 'available')
    : null;
  if (!seat) {
    t.skip('No available seat for showtime 24.');
    return;
  }

  const created = await request('/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      showtimeId: 24,
      seatIds: [seat.SeatID],
      foodItems: [],
    }),
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.body.success, true);
  assert.equal(created.body.data.paymentMethod, 'qrpay');

  const ticketIds = created.body.data.ticketIds;
  const cancelled = await request('/api/bookings/cancel', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ ticketIds }),
  });

  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.success, true);
});
