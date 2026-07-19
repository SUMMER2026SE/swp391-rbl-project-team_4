const VoucherModel = require('../models/voucherModel');

async function testEditImageFlow() {
  try {
    console.log('1. Creating test voucher without image...');
    const testCode = 'EDITTEST' + Math.floor(Math.random() * 1000);
    const created = await VoucherModel.create({
      voucherCode: testCode,
      voucherType: 'Mã Khuyến Mãi',
      voucherName: 'Chương Trình Test Sửa Ảnh',
      discountType: 'Percentage',
      discountValue: 10,
      minimumOrder: 0,
      maximumDiscount: 0,
      usageLimit: 100,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      status: 'Active',
      description: 'Mô tả ban đầu'
    });
    console.log('✅ Initial voucher created:', created.VoucherID, 'ImageUrl:', created.ImageUrl);

    console.log('\n2. Updating voucher with new ImageUrl...');
    const newImageUrl = 'images/voucher_sweet_combo.png';
    const updated = await VoucherModel.update(created.VoucherID, {
      imageUrl: newImageUrl,
      description: 'Mô tả đã được cập nhật'
    });
    console.log('✅ Voucher updated. New ImageUrl:', updated.ImageUrl);

    console.log('\n3. Re-fetching voucher by ID to simulate clicking "Sửa" in Admin...');
    const reFetched = await VoucherModel.getById(created.VoucherID);
    console.log('Fetched ImageUrl on Edit:', reFetched.ImageUrl);

    if (reFetched.ImageUrl !== newImageUrl) {
      throw new Error(`Expected ImageUrl to be "${newImageUrl}", but got "${reFetched.ImageUrl}"`);
    }

    console.log('\n4. Cleaning up test voucher...');
    await VoucherModel.hardDelete(created.VoucherID);
    console.log('✅ Test finished successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testEditImageFlow();
