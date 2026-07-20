const { sql, getPool } = require('../config/db');
const { sendShowtimeReminderEmail } = require('./emailService');

const DEFAULT_SCAN_INTERVAL_MINUTES = 15;
const DEFAULT_MINUTES_BEFORE_SHOWTIME = 120;

let schedulerHandle = null;
let isRunning = false;
let schemaReady = false;

function intFromEnv(name, fallback) {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatShowtime(startTime) {
  const date = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(date.getTime())) return String(startTime || '');
  return date.toLocaleString('vi-VN', {
    timeZone: process.env.REMINDER_TIMEZONE || 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseTicketIds(value) {
  return String(value || '')
    .split(',')
    .map(id => parseInt(id, 10))
    .filter(id => Number.isInteger(id) && id > 0);
}

async function ensureReminderColumn() {
  if (schemaReady) return;

  const pool = await getPool();
  await pool.request().query(`
    IF COL_LENGTH('Tickets', 'ReminderSentAt') IS NULL
    BEGIN
      ALTER TABLE Tickets ADD ReminderSentAt DATETIME NULL;
    END

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_Tickets_ReminderScan'
        AND object_id = OBJECT_ID('dbo.Tickets')
    )
    BEGIN
      CREATE INDEX IX_Tickets_ReminderScan
      ON dbo.Tickets (Status, ReminderSentAt, ShowtimeID, UserID)
      INCLUDE (SeatID, QRCode);
    END
  `);

  schemaReady = true;
}

async function getUpcomingReminderGroups() {
  const minutesBefore = intFromEnv('REMINDER_MINUTES_BEFORE', DEFAULT_MINUTES_BEFORE_SHOWTIME);
  const scanInterval = intFromEnv('REMINDER_SCAN_INTERVAL_MINUTES', DEFAULT_SCAN_INTERVAL_MINUTES);
  const minBefore = Math.max(0, minutesBefore);
  const maxBefore = minBefore + scanInterval;

  const pool = await getPool();
  const result = await pool.request()
    .input('minBefore', sql.Int, minBefore)
    .query(`
      SELECT
        u.UserID,
        u.Email,
        COALESCE(NULLIF(u.FullName, ''), N'Khách hàng') AS CustomerName,
        st.ShowtimeID,
        st.StartTime,
        st.EndTime,
        m.Title AS MovieTitle,
        c.CinemaName,
        r.RoomName,
        STRING_AGG(CAST(t.TicketID AS varchar(20)), ',') AS TicketIds,
        STRING_AGG(CONCAT(s.SeatRow, s.SeatNumber), ', ') AS Seats,
        STRING_AGG(COALESCE(NULLIF(t.QRCode, ''), CAST(t.TicketID AS nvarchar(50))), ', ') AS TicketCodes
      FROM Tickets t
      JOIN Users u ON t.UserID = u.UserID
      JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN Movies m ON st.MovieID = m.MovieID
      JOIN Rooms r ON st.RoomID = r.RoomID
      JOIN Cinemas c ON r.CinemaID = c.CinemaID
      JOIN Seats s ON t.SeatID = s.SeatID
      WHERE t.Status = 'confirmed'
        AND t.ReminderSentAt IS NULL
        AND u.Email IS NOT NULL
        AND LTRIM(RTRIM(u.Email)) <> ''
        AND st.Status = 'active'
        AND st.StartTime <= DATEADD(minute, @minBefore, GETUTCDATE())
        AND st.StartTime > GETUTCDATE()
      GROUP BY
        u.UserID, u.Email, u.FullName,
        st.ShowtimeID, st.StartTime, st.EndTime,
        m.Title, c.CinemaName, r.RoomName
      ORDER BY st.StartTime ASC;
    `);

  return result.recordset;
}

async function markReminderSent(ticketIds) {
  const ids = ticketIds.filter(id => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return;

  const pool = await getPool();
  await pool.request().query(`
    UPDATE Tickets
    SET ReminderSentAt = GETUTCDATE()
    WHERE TicketID IN (${ids.join(',')})
      AND ReminderSentAt IS NULL;
  `);
}

async function runShowtimeReminderScan() {
  if (isRunning) return;
  isRunning = true;

  try {
    await ensureReminderColumn();
    const reminders = await getUpcomingReminderGroups();

    if (reminders.length === 0) {
      console.log('[Reminder] No upcoming showtime reminders to send.');
      return;
    }

    for (const reminder of reminders) {
      const ticketIds = parseTicketIds(reminder.TicketIds);
      try {
        await sendShowtimeReminderEmail(reminder.Email, {
          customerName: reminder.CustomerName,
          movieTitle: reminder.MovieTitle,
          cinemaName: reminder.CinemaName,
          roomName: reminder.RoomName,
          showtime: formatShowtime(reminder.StartTime),
          seats: reminder.Seats,
          ticketCodes: reminder.TicketCodes,
        });
        await markReminderSent(ticketIds);
        console.log(`[Reminder] Sent showtime reminder to ${reminder.Email} for showtime ${reminder.ShowtimeID}.`);
      } catch (err) {
        console.error(`[Reminder] Failed to send reminder to ${reminder.Email}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Reminder] Showtime reminder scan failed:', err.message);
  } finally {
    isRunning = false;
  }
}

function startShowtimeReminderScheduler() {
  if (process.env.REMINDER_ENABLED === 'false') {
    console.log('[Reminder] Showtime reminder scheduler disabled by REMINDER_ENABLED=false.');
    return null;
  }

  if (schedulerHandle) return schedulerHandle;

  const scanInterval = intFromEnv('REMINDER_SCAN_INTERVAL_MINUTES', DEFAULT_SCAN_INTERVAL_MINUTES);
  const intervalMs = scanInterval * 60 * 1000;

  console.log(`[Reminder] Showtime reminder scheduler started. Scan interval: ${scanInterval} minute(s).`);
  runShowtimeReminderScan();
  schedulerHandle = setInterval(runShowtimeReminderScan, intervalMs);
  return schedulerHandle;
}

module.exports = {
  startShowtimeReminderScheduler,
  runShowtimeReminderScan,
};
