const { sql, getPool } = require('../config/db');

function normalizeVietnamPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return digits;
}

class AuthModel {
  static async checkEmailExist(email) {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserID, RoleID FROM Users WHERE LOWER(Email) = LOWER(@email)');
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async checkPhoneExist(phone, excludeUserId = null) {
    const normalizedPhone = normalizeVietnamPhone(phone);
    if (!normalizedPhone) return null;

    const phoneCountry = normalizedPhone.startsWith('0') ? `84${normalizedPhone.slice(1)}` : normalizedPhone;
    const pool = await getPool();
    const result = await pool.request()
      .input('phone', sql.NVarChar, normalizedPhone)
      .input('phoneCountry', sql.NVarChar, phoneCountry)
      .input('excludeUserId', sql.Int, excludeUserId)
      .query(`
        WITH NormalizedUsers AS (
          SELECT UserID, RoleID,
                 REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(Phone, ''), ' ', ''), '-', ''), '.', ''), '(', ''), ')', ''), '+', '') AS NormalizedPhone
          FROM Users
        )
        SELECT TOP 1 UserID, RoleID
        FROM NormalizedUsers
        WHERE NormalizedPhone IN (@phone, @phoneCountry)
          AND (@excludeUserId IS NULL OR UserID <> @excludeUserId)
      `);
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
    const normalizedPhone = phone ? normalizeVietnamPhone(phone) : null;
    const pool = await getPool();
    const result = await pool.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('hashedPassword', sql.NVarChar, hashedPassword)
      .input('phone', sql.NVarChar, normalizedPhone || null)
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

  static async findUsersByEmailOrPhoneWithRole(identifier) {
    const phoneDigits = String(identifier || '').replace(/\D/g, '');
    const phoneLocal = phoneDigits.startsWith('84') ? `0${phoneDigits.slice(2)}` : phoneDigits;
    const phoneCountry = phoneDigits.startsWith('0') ? `84${phoneDigits.slice(1)}` : phoneDigits;
    const pool = await getPool();
    const result = await pool.request()
      .input('identifier', sql.NVarChar, identifier)
      .input('phoneDigits', sql.NVarChar, phoneDigits)
      .input('phoneLocal', sql.NVarChar, phoneLocal)
      .input('phoneCountry', sql.NVarChar, phoneCountry)
      .query(`
        WITH NormalizedUsers AS (
          SELECT u.UserID, u.FullName, u.Email, u.PasswordHash, u.Phone, u.RoleID, u.AvatarURL, u.IsActive,
                 r.RoleName,
                 REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(u.Phone, ''), ' ', ''), '-', ''), '.', ''), '(', ''), ')', ''), '+', '') AS NormalizedPhone
          FROM   Users u
          JOIN   Roles r ON u.RoleID = r.RoleID
        )
        SELECT UserID, FullName, Email, PasswordHash, Phone, RoleID, AvatarURL, IsActive, RoleName
        FROM   NormalizedUsers
        WHERE  LOWER(Email) = LOWER(@identifier)
           OR  Phone = @identifier
           OR  (
                 @phoneDigits <> ''
                 AND NormalizedPhone IN (@phoneDigits, @phoneLocal, @phoneCountry)
               )
        ORDER BY UserID
      `);
    return result.recordset;
  }

  static async findUserByEmailOrPhoneWithRole(identifier) {
    const users = await this.findUsersByEmailOrPhoneWithRole(identifier);
    return users.length > 0 ? users[0] : null;
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
