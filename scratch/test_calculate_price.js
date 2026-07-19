const { getPool } = require('../config/db');
const BookingModel = require('../models/bookingModel');

async function run() {
  try {
    const pool = await getPool();
    console.log('Testing calculateBookingPrice with HE2026...');
    
    // We need a valid showtimeId and seatId. Let's query one.
    const stResult = await pool.request().query('SELECT TOP 1 ShowtimeID FROM Showtimes WHERE Status = \'active\'');
    const showtimeId = stResult.recordset[0]?.ShowtimeID || 1;

    const seatResult = await pool.request().query('SELECT TOP 2 SeatID FROM Seats');
    const seatIds = seatResult.recordset.map(r => r.SeatID);

    console.log(`Using showtimeId: ${showtimeId}, seatIds: ${seatIds}`);

    // Query active food item if any
    const fnbResult = await pool.request().query('SELECT TOP 1 FnBID FROM FoodBeverages WHERE IsAvailable = 1');
    const foodItems = [];
    if (fnbResult.recordset.length > 0) {
      foodItems.push({ fnbId: fnbResult.recordset[0].FnBID, quantity: 1 });
    }

    const result = await BookingModel.calculateBookingPrice(1, {
      showtimeId,
      seatIds,
      foodItems,
      voucherCode: 'HE2026'
    });

    console.log('Calculation Result:', result);
    process.exit(0);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  }
}
run();
