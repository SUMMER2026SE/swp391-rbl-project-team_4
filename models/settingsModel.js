const { sql, getPool } = require('../config/db');

class SettingsModel {
  static cache = {};

  static async initCache() {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`SELECT SettingKey, SettingValue FROM SystemSettings`);
      result.recordset.forEach(row => {
        SettingsModel.cache[row.SettingKey] = row.SettingValue;
      });
      console.log('[Settings] Cache initialized.');
    } catch (e) {
      console.error('[Settings] Cache init failed:', e);
    }
  }

  static async getAllSettings() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT SettingKey, SettingValue, Description 
      FROM SystemSettings
    `);
    
    const settings = {};
    result.recordset.forEach(row => {
      settings[row.SettingKey] = row.SettingValue;
      SettingsModel.cache[row.SettingKey] = row.SettingValue; // Update cache
    });
    return settings;
  }

  static async getSetting(key) {
    const pool = await getPool();
    const request = pool.request();
    request.input('key', sql.VarChar, key);
    const result = await request.query(`
      SELECT SettingValue FROM SystemSettings WHERE SettingKey = @key
    `);
    return result.recordset.length ? result.recordset[0].SettingValue : null;
  }

  static async updateSettings(settingsArray) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const request = new sql.Request(transaction);

      for (const item of settingsArray) {
        // use distinct parameter names for each iteration or reset
        const tempReq = new sql.Request(transaction);
        tempReq.input('key', sql.VarChar, item.key);
        tempReq.input('val', sql.NVarChar, String(item.value));
        
        await tempReq.query(`
          UPDATE SystemSettings 
          SET SettingValue = @val, UpdatedAt = GETDATE()
          WHERE SettingKey = @key
        `);
      }

      await transaction.commit();
      
      // Update cache
      settingsArray.forEach(item => {
        SettingsModel.cache[item.key] = String(item.value);
      });

      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = SettingsModel;
