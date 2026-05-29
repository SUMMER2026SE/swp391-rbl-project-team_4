const { sql, getPool } = require('../config/db');

class UserModel {
  // Lấy thông tin cơ bản của user
  static async findById(userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT UserID, FullName, Email, Phone, CreatedAt, DOB, Address, RewardPoints, AvatarURL
        FROM Users
        WHERE UserID = @userId
      `);
    return result.recordset.length ? result.recordset[0] : null;
  }

  // Cập nhật thông tin profile
  static async updateProfile(userId, { fullName, phone, dob, address }) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('fullName', sql.NVarChar, fullName || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('dob', sql.Date, dob || null)
      .input('address', sql.NVarChar, address || null)
      .query(`
        UPDATE Users 
        SET FullName = COALESCE(@fullName, FullName),
            Phone = COALESCE(@phone, Phone),
            DOB = COALESCE(@dob, DOB),
            Address = COALESCE(@address, Address)
        WHERE UserID = @userId
      `);
    return result;
  }

  // Lấy hash mật khẩu hiện tại
  static async getPasswordHash(userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT PasswordHash FROM Users WHERE UserID = @userId');
    return result.recordset.length ? result.recordset[0].PasswordHash : null;
  }

  // Cập nhật mật khẩu mới
  static async updatePassword(userId, newPasswordHash) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('newPasswordHash', sql.NVarChar, newPasswordHash)
      .query('UPDATE Users SET PasswordHash = @newPasswordHash WHERE UserID = @userId');
    return result;
  }

  // Cập nhật URL ảnh đại diện
  static async updateAvatar(userId, avatarUrl) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('avatarUrl', sql.NVarChar, avatarUrl)
      .query(`
        UPDATE Users
        SET AvatarURL = @avatarUrl
        WHERE UserID = @userId
      `);
    return result;
  }
}

module.exports = UserModel;
