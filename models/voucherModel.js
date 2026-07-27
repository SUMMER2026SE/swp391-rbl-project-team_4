const { getPool, sql } = require('../config/db');

class VoucherModel {
  static async syncVoucherTables(pool) {
    try {
      await pool.request().query(`
        INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderValue, MaxDiscount, UsageLimit, UsedCount, StartDate, EndDate, IsActive)
        SELECT v.VoucherCode,
               CASE WHEN v.DiscountType = 'Percentage' THEN 'percent' ELSE 'fixed' END,
               v.DiscountValue,
               ISNULL(v.MinimumOrder, 0),
               ISNULL(v.MaximumDiscount, 0),
               v.UsageLimit,
               ISNULL(v.UsedCount, 0),
               v.StartDate,
               v.EndDate,
               CASE WHEN v.Status = 'Active' THEN 1 ELSE 0 END
        FROM Voucher v
        WHERE NOT EXISTS (SELECT 1 FROM Vouchers vs WHERE vs.Code = v.VoucherCode);

        INSERT INTO Voucher (VoucherCode, VoucherName, DiscountType, DiscountValue, MinimumOrder, MaximumDiscount, UsageLimit, UsedCount, StartDate, EndDate, Status, Description)
        SELECT vs.Code,
               CASE 
                 WHEN vs.DiscountType = 'percent' THEN N'Ưu đãi giảm ' + CAST(CAST(vs.DiscountValue AS INT) AS NVARCHAR(50)) + '%'
                 ELSE N'Ưu đãi giảm ' + CAST(CAST(vs.DiscountValue AS INT) AS NVARCHAR(50)) + N'đ'
               END,
               CASE WHEN vs.DiscountType = 'percent' THEN 'Percentage' ELSE 'Fixed Amount' END,
               vs.DiscountValue,
               ISNULL(vs.MinOrderValue, 0),
               ISNULL(vs.MaxDiscount, 0),
               vs.UsageLimit,
               ISNULL(vs.UsedCount, 0),
               vs.StartDate,
               vs.EndDate,
               CASE WHEN vs.IsActive = 1 THEN 'Active' ELSE 'Inactive' END,
               CASE 
                 WHEN vs.DiscountType = 'percent' THEN N'Giảm giá ' + CAST(CAST(vs.DiscountValue AS INT) AS NVARCHAR(50)) + '% cho hóa đơn từ ' + CAST(CAST(ISNULL(vs.MinOrderValue,0) AS INT) AS NVARCHAR(50)) + N'đ.'
                 ELSE N'Giảm trực tiếp ' + CAST(CAST(vs.DiscountValue AS INT) AS NVARCHAR(50)) + N'đ cho hóa đơn từ ' + CAST(CAST(ISNULL(vs.MinOrderValue,0) AS INT) AS NVARCHAR(50)) + N'đ.'
               END
        FROM Vouchers vs
        WHERE NOT EXISTS (SELECT 1 FROM Voucher v WHERE v.VoucherCode = vs.Code);
      `);
    } catch (err) {
      // ignore if tables don't exist yet
    }
  }

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
    await this.syncVoucherTables(pool);
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
      .input('voucherCode', sql.NVarChar(50), data.voucherCode)
      .input('voucherType', sql.NVarChar(255), data.voucherType || 'Mã Khuyến Mãi')
      .input('voucherName', sql.NVarChar(255), data.voucherName)
      .input('discountType', sql.VarChar(50), data.discountType)
      .input('discountValue', sql.Decimal(18, 2), data.discountValue)
      .input('minimumOrder', sql.Decimal(18, 2), data.minimumOrder || 0)
      .input('maximumDiscount', sql.Decimal(18, 2), data.maximumDiscount || 0)
      .input('usageLimit', sql.Int, data.usageLimit || 1)
      .input('usedCount', sql.Int, data.usedCount || 0)
      .input('startDate', sql.DateTime, data.startDate)
      .input('endDate', sql.DateTime, data.endDate)
      .input('status', sql.VarChar(50), data.status || 'Active')
      .input('description', sql.NVarChar(sql.MAX), data.description || null)
      .input('imageUrl', sql.NVarChar(sql.MAX), data.imageUrl || null)
      .query(`
        INSERT INTO Voucher (VoucherCode, VoucherType, VoucherName, DiscountType, DiscountValue, MinimumOrder, MaximumDiscount, UsageLimit, UsedCount, StartDate, EndDate, Status, Description, ImageUrl, CreatedAt)
        VALUES (@voucherCode, @voucherType, @voucherName, @discountType, @discountValue, @minimumOrder, @maximumDiscount, @usageLimit, @usedCount, @startDate, @endDate, @status, @description, @imageUrl, GETDATE());

        SELECT * FROM Voucher WHERE VoucherID = SCOPE_IDENTITY();
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await getPool();
    const request = pool.request().input('id', sql.Int, id);
    
    let updateFields = [];
    if (data.voucherCode !== undefined) {
      request.input('voucherCode', sql.NVarChar(50), data.voucherCode);
      updateFields.push("VoucherCode = @voucherCode");
    }
    if (data.voucherType !== undefined) {
      request.input('voucherType', sql.NVarChar(255), data.voucherType);
      updateFields.push("VoucherType = @voucherType");
    }
    if (data.voucherName !== undefined) {
      request.input('voucherName', sql.NVarChar(255), data.voucherName);
      updateFields.push("VoucherName = @voucherName");
    }
    if (data.discountType !== undefined) {
      request.input('discountType', sql.VarChar(50), data.discountType);
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
      request.input('status', sql.VarChar(50), data.status);
      updateFields.push("Status = @status");
    }
    if (data.description !== undefined) {
      request.input('description', sql.NVarChar(sql.MAX), data.description);
      updateFields.push("Description = @description");
    }
    if (data.imageUrl !== undefined) {
      request.input('imageUrl', sql.NVarChar(sql.MAX), data.imageUrl);
      updateFields.push("ImageUrl = @imageUrl");
    }

    if (updateFields.length === 0) return await this.getById(id);

    const query = `
      UPDATE Voucher 
      SET ${updateFields.join(', ')} 
      WHERE VoucherID = @id;

      SELECT * FROM Voucher WHERE VoucherID = @id;
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
