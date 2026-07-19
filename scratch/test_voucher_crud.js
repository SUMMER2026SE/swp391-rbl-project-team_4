const { getPool } = require('../config/db');
const VoucherModel = require('../models/voucherModel');

async function test() {
  try {
    const pool = await getPool();
    console.log('Testing create voucher...');
    const testCode = 'TESTVOUCHER_' + Math.floor(Math.random() * 1000000);
    const newV = await VoucherModel.create({
      voucherCode: testCode,
      voucherType: 'Đối tác',
      voucherName: 'Voucher Đối Tác Đặc Biệt',
      discountType: 'Percentage',
      discountValue: 15.5,
      minimumOrder: 100000,
      maximumDiscount: 50000,
      usageLimit: 200,
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000 * 24 * 7),
      status: 'Active',
      description: 'Mô tả test'
    });
    console.log('Created voucher successfully:', newV);
    
    if (newV.VoucherType !== 'Đối tác') {
      throw new Error(`Expected VoucherType 'Đối tác', got '${newV.VoucherType}'`);
    }

    console.log('Testing update voucher...');
    const updatedV = await VoucherModel.update(newV.VoucherID, {
      voucherType: 'D-Cinema Voucher',
      voucherName: 'Voucher D-Cinema Cập Nhật'
    });
    console.log('Updated voucher successfully:', updatedV);
    
    if (updatedV.VoucherType !== 'D-Cinema Voucher') {
      throw new Error(`Expected VoucherType 'D-Cinema Voucher', got '${updatedV.VoucherType}'`);
    }

    console.log('Testing delete voucher...');
    const deleted = await VoucherModel.hardDelete(newV.VoucherID);
    console.log('Deleted successfully:', deleted);

    console.log('CRUD TEST PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('CRUD TEST FAILED:', err);
    process.exit(1);
  }
}

test();
