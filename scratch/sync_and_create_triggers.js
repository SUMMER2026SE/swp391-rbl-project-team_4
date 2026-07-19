const { getPool } = require('../config/db');

async function run() {
  try {
    const pool = await getPool();
    console.log('Connected to DB.');

    // 1. Sync existing data from Voucher (singular) to Vouchers (plural)
    console.log('Synchronizing existing Voucher data to Vouchers...');
    await pool.request().query(`
      -- Insert missing vouchers
      INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderValue, MaxDiscount, UsageLimit, UsedCount, StartDate, EndDate, IsActive)
      SELECT 
          VoucherCode,
          CASE WHEN DiscountType = 'Percentage' THEN 'percent' ELSE 'fixed' END,
          DiscountValue,
          MinimumOrder,
          CASE WHEN DiscountType = 'Percentage' THEN MaximumDiscount ELSE NULL END,
          UsageLimit,
          UsedCount,
          StartDate,
          EndDate,
          CASE WHEN Status = 'Active' THEN 1 ELSE 0 END
      FROM Voucher
      WHERE VoucherCode NOT IN (SELECT Code FROM Vouchers);
      
      -- Update existing vouchers
      UPDATE V
      SET 
          V.DiscountType = CASE WHEN I.DiscountType = 'Percentage' THEN 'percent' ELSE 'fixed' END,
          V.DiscountValue = I.DiscountValue,
          V.MinOrderValue = I.MinimumOrder,
          V.MaxDiscount = CASE WHEN I.DiscountType = 'Percentage' THEN I.MaximumDiscount ELSE NULL END,
          V.UsageLimit = I.UsageLimit,
          V.UsedCount = I.UsedCount,
          V.StartDate = I.StartDate,
          V.EndDate = I.EndDate,
          V.IsActive = CASE WHEN I.Status = 'Active' THEN 1 ELSE 0 END
      FROM Vouchers V
      INNER JOIN Voucher I ON V.Code = I.VoucherCode;
    `);
    console.log('Existing vouchers synchronized.');

    // 2. Create trigger trg_SyncVoucherToVouchers
    console.log('Creating trigger trg_SyncVoucherToVouchers...');
    await pool.request().query(`
      CREATE OR ALTER TRIGGER trg_SyncVoucherToVouchers
      ON Voucher
      AFTER INSERT, UPDATE, DELETE
      AS
      BEGIN
          SET NOCOUNT ON;
          IF TRIGGER_NESTLEVEL() > 1 RETURN;
          
          -- Handle DELETE
          IF NOT EXISTS (SELECT * FROM inserted)
          BEGIN
              DELETE FROM Vouchers 
              WHERE Code IN (SELECT VoucherCode FROM deleted);
          END
          -- Handle INSERT or UPDATE
          ELSE
          BEGIN
              -- 1. Update existing
              UPDATE V
              SET 
                  V.DiscountType = CASE WHEN I.DiscountType = 'Percentage' THEN 'percent' ELSE 'fixed' END,
                  V.DiscountValue = I.DiscountValue,
                  V.MinOrderValue = I.MinimumOrder,
                  V.MaxDiscount = CASE WHEN I.DiscountType = 'Percentage' THEN I.MaximumDiscount ELSE NULL END,
                  V.UsageLimit = I.UsageLimit,
                  V.UsedCount = I.UsedCount,
                  V.StartDate = I.StartDate,
                  V.EndDate = I.EndDate,
                  V.IsActive = CASE WHEN I.Status = 'Active' THEN 1 ELSE 0 END
              FROM Vouchers V
              INNER JOIN inserted I ON V.Code = I.VoucherCode;
              
              -- 2. Insert new
              INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderValue, MaxDiscount, UsageLimit, UsedCount, StartDate, EndDate, IsActive)
              SELECT 
                  I.VoucherCode,
                  CASE WHEN I.DiscountType = 'Percentage' THEN 'percent' ELSE 'fixed' END,
                  I.DiscountValue,
                  I.MinimumOrder,
                  CASE WHEN I.DiscountType = 'Percentage' THEN I.MaximumDiscount ELSE NULL END,
                  I.UsageLimit,
                  I.UsedCount,
                  I.StartDate,
                  I.EndDate,
                  CASE WHEN I.Status = 'Active' THEN 1 ELSE 0 END
              FROM inserted I
              WHERE NOT EXISTS (SELECT 1 FROM Vouchers V WHERE V.Code = I.VoucherCode);
          END
      END
    `);
    console.log('Trigger trg_SyncVoucherToVouchers created.');

    // 3. Create trigger trg_SyncVouchersToVoucher
    console.log('Creating trigger trg_SyncVouchersToVoucher...');
    await pool.request().query(`
      CREATE OR ALTER TRIGGER trg_SyncVouchersToVoucher
      ON Vouchers
      AFTER UPDATE, DELETE
      AS
      BEGIN
          SET NOCOUNT ON;
          IF TRIGGER_NESTLEVEL() > 1 RETURN;
          
          -- Handle DELETE
          IF NOT EXISTS (SELECT * FROM inserted)
          BEGIN
              DELETE FROM Voucher 
              WHERE VoucherCode IN (SELECT Code FROM deleted);
          END
          -- Handle UPDATE
          ELSE
          BEGIN
              UPDATE V
              SET 
                  V.UsedCount = I.UsedCount,
                  V.Status = CASE WHEN I.IsActive = 1 THEN 'Active' ELSE 'Inactive' END
              FROM Voucher V
              INNER JOIN inserted I ON V.VoucherCode = I.Code;
          END
      END
    `);
    console.log('Trigger trg_SyncVouchersToVoucher created.');

    console.log('Verification: checking HE2026 details in Vouchers table...');
    const verifyResult = await pool.request().query("SELECT * FROM Vouchers WHERE Code = 'HE2026'");
    console.log(verifyResult.recordset);

    console.log('SUCCESS!');
    process.exit(0);
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  }
}

run();
