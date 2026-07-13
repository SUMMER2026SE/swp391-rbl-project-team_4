const { sql, getPool } = require('../config/db');

class AuthModel {
  static async checkEmailExist(email) {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserID, RoleID FROM Users WHERE Email = @email');
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async getRoleIdByName(roleName) {
    const pool = await getPool();
    const result = await pool.request()
      .input('roleName', sql.NVarChar, roleName)
      .query('SELECT RoleID FROM Roles WHERE RoleName = @roleName');
    return result.recordset.length > 0 ? result.recordset[0].RoleID : null;
  }

  static async createUser({ fullName, email, hashedPassword, phone, roleId }) {
    const pool = await getPool();
    const result = await pool.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('hashedPassword', sql.NVarChar, hashedPassword)
      .input('phone', sql.NVarChar, phone || null)
      .input('roleId', sql.Int, roleId)
      .query(`
        INSERT INTO Users (FullName, Email, PasswordHash, Phone, RoleID, CreatedAt)
        OUTPUT INSERTED.UserID, INSERTED.FullName, INSERTED.Email
        VALUES (@fullName, @email, @hashedPassword, @phone, @roleId, GETDATE())
      `);
    return result.recordset[0];
  }

  static async findUserByEmailWithRole(email) {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT u.UserID, u.FullName, u.Email, u.PasswordHash, u.Phone, u.RoleID, u.AvatarURL, u.IsActive,
               r.RoleName
        FROM   Users u
        JOIN   Roles r ON u.RoleID = r.RoleID
        WHERE  u.Email = @email
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async findUserByIdWithRole(userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT u.UserID, u.FullName, u.Email, u.Phone, u.CreatedAt, u.RoleID, u.IsActive,
               u.AvatarURL, r.RoleName
        FROM   Users u
        JOIN   Roles r ON u.RoleID = r.RoleID
        WHERE  u.UserID = @userId
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async deleteUnusedOTP(userId) {
    const pool = await getPool();
    await pool.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM PasswordResets WHERE UserID = @userId AND IsUsed = 0');
  }

  static async createOTP(userId, otpHash, expiresAt) {
    const pool = await getPool();
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('otpHash', sql.NVarChar, otpHash)
      .input('expiresAt', sql.DateTime, expiresAt)
      .query(`
        INSERT INTO PasswordResets (UserID, OTPHash, ExpiresAt)
        VALUES (@userId, @otpHash, @expiresAt)
      `);
  }

  static async getLatestUnusedOTP(userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('now', sql.DateTime, new Date())
      .query(`
        SELECT TOP 1 ResetID, OTPHash, ExpiresAt
        FROM PasswordResets
        WHERE UserID = @userId AND IsUsed = 0 AND ExpiresAt > @now
        ORDER BY CreatedAt DESC
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async markOTPAsUsed(resetId) {
    const pool = await getPool();
    await pool.request()
      .input('resetId', sql.Int, resetId)
      .query('UPDATE PasswordResets SET IsUsed = 1 WHERE ResetID = @resetId');
  }

  static async deleteAllOTPs(userId) {
    const pool = await getPool();
    await pool.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM PasswordResets WHERE UserID = @userId');
  }
}

module.exports = AuthModel;
