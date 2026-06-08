const { getPool } = require('./config/db');

async function updateFnB() {
    const pool = await getPool();
    await pool.request().query("UPDATE FoodBeverages SET ImageURL = 'images/combo_solo.png' WHERE FnBID = 1;");
    await pool.request().query("UPDATE FoodBeverages SET ImageURL = 'images/combo_couple.png' WHERE FnBID = 2;");
    await pool.request().query("UPDATE FoodBeverages SET ImageURL = 'images/combo_mega.png' WHERE FnBID = 3;");
    await pool.request().query("UPDATE FoodBeverages SET ImageURL = 'images/combo_popcorn.png' WHERE FnBID IN (4, 5);");
    await pool.request().query("UPDATE FoodBeverages SET ImageURL = 'images/snack_nachos.png' WHERE FnBID = 6;");
    await pool.request().query("UPDATE FoodBeverages SET ImageURL = 'images/drink_coca_cola.png' WHERE FnBID = 7;");
    await pool.request().query("UPDATE FoodBeverages SET ImageURL = 'images/drink_peach_tea.png' WHERE FnBID = 8;");
    await pool.request().query("UPDATE FoodBeverages SET ImageURL = 'images/drink_water.png' WHERE FnBID = 9;");
    console.log('Successfully updated FoodBeverages images');
    process.exit(0);
}

updateFnB().catch(console.error);
