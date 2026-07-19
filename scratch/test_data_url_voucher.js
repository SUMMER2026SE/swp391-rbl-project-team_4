const VoucherModel = require('../models/voucherModel');

async function testDataUrlVoucher() {
  try {
    console.log('Testing VoucherModel with long Data URL...');
    const dummyBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(5000);
    const testCode = 'DATAURL' + Math.floor(Math.random() * 1000);

    const created = await VoucherModel.create({
      voucherCode: testCode,
      voucherType: 'Mã Khuyến Mãi',
      voucherName: 'Test Base64 Image Voucher',
      discountType: 'Percentage',
      discountValue: 20,
      minimumOrder: 100000,
      maximumDiscount: 50000,
      usageLimit: 50,
      startDate: new Date(),
      endDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      status: 'Active',
      description: 'Test voucher with base64 data url image',
      imageUrl: dummyBase64
    });

    console.log('✅ Created voucher ID:', created.VoucherID);
    console.log('Image URL length:', created.ImageUrl.length);

    await VoucherModel.hardDelete(created.VoucherID);
    console.log('✅ Cleaned up test voucher.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Data URL test failed:', err);
    process.exit(1);
  }
}

testDataUrlVoucher();
