const { getPool, sql } = require('./config/db');
async function check() {
    try {
        const pool = await getPool();
        const userId = 1; // Assuming there is a user 1
        const r = await pool.request()
            .input('userId', sql.Int, userId)
            .input('fullName', sql.NVarChar, 'Test')
            .input('phone', sql.NVarChar, '0123456789')
            .input('dob', sql.Date, '2019-06-27')
            .input('address', sql.NVarChar, 'Da Nang')
            .query(`
                UPDATE Users 
                SET FullName = COALESCE(@fullName, FullName),
                    Phone = COALESCE(@phone, Phone),
                    DOB = COALESCE(@dob, DOB),
                    Address = COALESCE(@address, Address)
                WHERE UserID = @userId
            `);
        console.log('Update success');
    } catch(e) {
        console.error('Update error:', e);
    } finally {
        process.exit(0);
    }
}
check();
