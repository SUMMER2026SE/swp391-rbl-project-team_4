const { getPool } = require('../config/db');
const VoucherModel = require('../models/voucherModel');
const BookingModel = require('../models/bookingModel');

async function testVoucherImageFlow() {
  try {
    console.log('1. Connecting to database...');
    const pool = await getPool();
    console.log('✅ Connected to database.');

    console.log('\n2. Testing VoucherModel.create with imageUrl...');
    const testCode = 'TESTIMG' + Math.floor(Math.random() * 1000);
    const created = await VoucherModel.create({
      voucherCode: testCode,
      voucherType: 'Mã Khuyến Mãi',
      voucherName: 'Chương Trình Test Tải Ảnh',
      discountType: 'Percentage',
      discountValue: 15,
      minimumOrder: 50000,
      maximumDiscount: 20000,
      usageLimit: 100,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      status: 'Active',
      description: 'Đây là mô tả chi tiết chương trình khuyến mãi test có kèm ảnh.',
      imageUrl: 'images/promo_voucher.png'
    });
    console.log('✅ Created voucher:', created);

    console.log('\n3. Testing VoucherModel.getById...');
    const fetched = await VoucherModel.getById(created.VoucherID);
    console.log('Fetched voucher ImageUrl:', fetched.ImageUrl);
    if (fetched.ImageUrl !== 'images/promo_voucher.png') {
      throw new Error('ImageUrl does not match stored value!');
    }

    console.log('\n4. Testing VoucherModel.update imageUrl...');
    const updated = await VoucherModel.update(created.VoucherID, {
      imageUrl: 'images/promo_sweet_combo.png',
      description: 'Cập nhật mô tả voucher test.'
    });
    console.log('✅ Updated voucher ImageUrl:', updated.ImageUrl);

    console.log('\n5. Testing BookingModel.getActiveVouchers (Customer API model)...');
    const activeVouchers = await BookingModel.getActiveVouchers();
    console.log('✅ Active vouchers count:', activeVouchers.length);
    const testVoucherInActive = activeVouchers.find(v => v.Code === testCode);
    console.log('Found test voucher in Customer active list:', testVoucherInActive);

    console.log('\n6. Cleaning up test voucher...');
    await VoucherModel.hardDelete(created.VoucherID);
    console.log('✅ Cleaned up test voucher.');

    console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testVoucherImageFlow();
