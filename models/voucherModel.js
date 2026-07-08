const { getPool, sql } = require('../config/db');

class VoucherModel {
  static async syncExpired() {
    const pool = await getPool();
    await pool.request().query(`
      UPDATE Voucher 
      SET Status = 'Expired' 
      WHERE EndDate < GETDATE() AND Status != 'Expired'
    `);
  }

  static async getAll({ search, status } = {}) {
    await this.syncExpired();
    const pool = await getPool();
    const request = pool.request();
    
    let query = "SELECT * FROM Voucher WHERE 1=1";
    
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      query += " AND (VoucherCode LIKE @search OR VoucherName LIKE @search)";
    }
    
    if (status) {
      request.input('status', sql.VarChar, status);
      query += " AND Status = @status";
    } else {
      query += " AND Status != 'Inactive'";
    }
    
    query += " ORDER BY CreatedAt DESC";
    
    const result = await request.query(query);
    return result.recordset;
  }

  static async getById(id) {
    await this.syncExpired();
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query("SELECT * FROM Voucher WHERE VoucherID = @id");
    return result.recordset[0] || null;
  }

  static async getByCode(code) {
    await this.syncExpired();
    const pool = await getPool();
    const result = await pool.request()
      .input('code', sql.VarChar, code)
      .query("SELECT * FROM Voucher WHERE VoucherCode = @code");
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('voucherCode', sql.VarChar, data.voucherCode)
      .input('voucherName', sql.NVarChar, data.voucherName)
      .input('discountType', sql.VarChar, data.discountType)
      .input('discountValue', sql.Decimal(18, 2), data.discountValue)
      .input('minimumOrder', sql.Decimal(18, 2), data.minimumOrder || 0)
      .input('maximumDiscount', sql.Decimal(18, 2), data.maximumDiscount || 0)
      .input('usageLimit', sql.Int, data.usageLimit || 1)
      .input('usedCount', sql.Int, data.usedCount || 0)
      .input('startDate', sql.DateTime, data.startDate)
      .input('endDate', sql.DateTime, data.endDate)
      .input('status', sql.VarChar, data.status || 'Active')
      .input('description', sql.NVarChar, data.description || null)
      .query(`
        INSERT INTO Voucher (VoucherCode, VoucherName, DiscountType, DiscountValue, MinimumOrder, MaximumDiscount, UsageLimit, UsedCount, StartDate, EndDate, Status, Description, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@voucherCode, @voucherName, @discountType, @discountValue, @minimumOrder, @maximumDiscount, @usageLimit, @usedCount, @startDate, @endDate, @status, @description, GETDATE())
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await getPool();
    const request = pool.request().input('id', sql.Int, id);
    
    let updateFields = [];
    if (data.voucherCode !== undefined) {
      request.input('voucherCode', sql.VarChar, data.voucherCode);
      updateFields.push("VoucherCode = @voucherCode");
    }
    if (data.voucherName !== undefined) {
      request.input('voucherName', sql.NVarChar, data.voucherName);
      updateFields.push("VoucherName = @voucherName");
    }
    if (data.discountType !== undefined) {
      request.input('discountType', sql.VarChar, data.discountType);
      updateFields.push("DiscountType = @discountType");
    }
    if (data.discountValue !== undefined) {
      request.input('discountValue', sql.Decimal(18, 2), data.discountValue);
      updateFields.push("DiscountValue = @discountValue");
    }
    if (data.minimumOrder !== undefined) {
      request.input('minimumOrder', sql.Decimal(18, 2), data.minimumOrder);
      updateFields.push("MinimumOrder = @minimumOrder");
    }
    if (data.maximumDiscount !== undefined) {
      request.input('maximumDiscount', sql.Decimal(18, 2), data.maximumDiscount);
      updateFields.push("MaximumDiscount = @maximumDiscount");
    }
    if (data.usageLimit !== undefined) {
      request.input('usageLimit', sql.Int, data.usageLimit);
      updateFields.push("UsageLimit = @usageLimit");
    }
    if (data.usedCount !== undefined) {
      request.input('usedCount', sql.Int, data.usedCount);
      updateFields.push("UsedCount = @usedCount");
    }
    if (data.startDate !== undefined) {
      request.input('startDate', sql.DateTime, data.startDate);
      updateFields.push("StartDate = @startDate");
    }
    if (data.endDate !== undefined) {
      request.input('endDate', sql.DateTime, data.endDate);
      updateFields.push("EndDate = @endDate");
    }
    if (data.status !== undefined) {
      request.input('status', sql.VarChar, data.status);
      updateFields.push("Status = @status");
    }
    if (data.description !== undefined) {
      request.input('description', sql.NVarChar, data.description);
      updateFields.push("Description = @description");
    }

    if (updateFields.length === 0) return await this.getById(id);

    const query = `
      UPDATE Voucher 
      SET ${updateFields.join(', ')} 
      OUTPUT INSERTED.*
      WHERE VoucherID = @id
    `;
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  static async hardDelete(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query("DELETE FROM Voucher WHERE VoucherID = @id");
    return result.rowsAffected[0] > 0;
  }

  static async softDelete(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query("UPDATE Voucher SET Status = 'Inactive' WHERE VoucherID = @id");
    return result.rowsAffected[0] > 0;
  }
}

module.exports = VoucherModel;
