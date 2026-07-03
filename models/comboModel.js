const { getPool, sql } = require('../config/db');

class ComboModel {
  static async getAll({ search } = {}) {
    const pool = await getPool();
    const request = pool.request();
    let query = "SELECT * FROM Combo WHERE Status != 'Deleted'";
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      query += " AND ComboName LIKE @search";
    }
    query += " ORDER BY ComboID DESC";
    const result = await request.query(query);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query("SELECT * FROM Combo WHERE ComboID = @id AND Status != 'Deleted'");
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('comboName', sql.NVarChar, data.comboName)
      .input('description', sql.NVarChar, data.description || null)
      .input('price', sql.Decimal(18, 2), data.price)
      .input('imageURL', sql.NVarChar, data.imageURL || null)
      .input('status', sql.NVarChar, data.status || 'Active')
      .query(`
        INSERT INTO Combo (ComboName, Description, Price, ImageURL, Status, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@comboName, @description, @price, @imageURL, @status, GETDATE())
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await getPool();
    const request = pool.request().input('id', sql.Int, id);

    let updateFields = [];
    if (data.comboName !== undefined) {
      request.input('comboName', sql.NVarChar, data.comboName);
      updateFields.push("ComboName = @comboName");
    }
    if (data.description !== undefined) {
      request.input('description', sql.NVarChar, data.description);
      updateFields.push("Description = @description");
    }
    if (data.price !== undefined) {
      request.input('price', sql.Decimal(18, 2), data.price);
      updateFields.push("Price = @price");
    }
    if (data.imageURL !== undefined) {
      request.input('imageURL', sql.NVarChar, data.imageURL);
      updateFields.push("ImageURL = @imageURL");
    }
    if (data.status !== undefined) {
      request.input('status', sql.NVarChar, data.status);
      updateFields.push("Status = @status");
    }

    if (updateFields.length === 0) return await this.getById(id);

    const query = `
      UPDATE Combo 
      SET ${updateFields.join(', ')} 
      OUTPUT INSERTED.*
      WHERE ComboID = @id AND Status != 'Deleted'
    `;
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  static async softDelete(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query("UPDATE Combo SET Status = 'Deleted' WHERE ComboID = @id");
    return result.rowsAffected[0] > 0;
  }
}

module.exports = ComboModel;
