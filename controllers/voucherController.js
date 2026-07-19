const VoucherModel = require('../models/voucherModel');

exports.getAllVouchers = async (req, res) => {
    try {
        const { search, status } = req.query;
        const vouchers = await VoucherModel.getAll({ search, status });
        res.json({ success: true, data: vouchers });
    } catch (err) {
        console.error('[voucherController] getAllVouchers:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy danh sách voucher.' });
    }
};

exports.getVoucherById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
        }
        const voucher = await VoucherModel.getById(id);
        if (!voucher) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
        }
        res.json({ success: true, data: voucher });
    } catch (err) {
        console.error('[voucherController] getVoucherById:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy thông tin voucher.' });
    }
};

exports.createVoucher = async (req, res) => {
    try {
        const { 
            voucherCode, 
            voucherType, 
            voucherName, 
            discountType, 
            discountValue, 
            minimumOrder, 
            maximumDiscount, 
            usageLimit, 
            startDate, 
            endDate, 
            status, 
            description 
        } = req.body;

        // Validations
        if (!voucherCode || voucherCode.trim() === '') {
            return res.status(400).json({ success: false, message: 'Mã voucher không được để trống.' });
        }

        const cleanCode = voucherCode.trim().toUpperCase();

        if (!voucherName || voucherName.trim() === '') {
            return res.status(400).json({ success: false, message: 'Tên chương trình không được để trống.' });
        }

        const valDiscount = parseFloat(discountValue);
        if (isNaN(valDiscount) || valDiscount <= 0) {
            return res.status(400).json({ success: false, message: 'Giá trị giảm phải lớn hơn 0.' });
        }

        if (discountType === 'Percentage' && valDiscount > 100) {
            return res.status(400).json({ success: false, message: 'Giá trị phần trăm giảm không được vượt quá 100%.' });
        }

        const limit = parseInt(usageLimit);
        if (isNaN(limit) || limit < 1) {
            return res.status(400).json({ success: false, message: 'Giới hạn sử dụng phải lớn hơn hoặc bằng 1.' });
        }

        const minOrder = parseFloat(minimumOrder || 0);
        if (isNaN(minOrder) || minOrder < 0) {
            return res.status(400).json({ success: false, message: 'Giá trị đơn hàng tối thiểu phải lớn hơn hoặc bằng 0.' });
        }

        const maxDiscount = parseFloat(maximumDiscount || 0);
        if (isNaN(maxDiscount) || maxDiscount < 0) {
            return res.status(400).json({ success: false, message: 'Giá trị giảm tối đa phải lớn hơn hoặc bằng 0.' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.' });
        }

        if (start >= end) {
            return res.status(400).json({ success: false, message: 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc.' });
        }

        // Check duplicate code
        const existing = await VoucherModel.getByCode(cleanCode);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Mã voucher này đã tồn tại.' });
        }

        let actualStatus = status || 'Active';
        if (end < new Date()) {
            actualStatus = 'Expired';
        }

        const newVoucher = await VoucherModel.create({
            voucherCode: cleanCode,
            voucherType: voucherType || 'Mã Khuyến Mãi',
            voucherName: voucherName.trim(),
            discountType,
            discountValue: valDiscount,
            minimumOrder: minOrder,
            maximumDiscount: maxDiscount,
            usageLimit: limit,
            startDate: start,
            endDate: end,
            status: actualStatus,
            description: description ? description.trim() : null
        });

        res.status(201).json({ success: true, message: 'Thêm mã khuyến mãi thành công!', data: newVoucher });
    } catch (err) {
        console.error('[voucherController] createVoucher:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tạo voucher.' });
    }
};

exports.updateVoucher = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
        }

        const current = await VoucherModel.getById(id);
        if (!current) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy voucher cần cập nhật.' });
        }

        // Rule: Không cho chỉnh sửa Voucher đã hết hạn nếu Status = Expired
        if (current.Status === 'Expired' || new Date(current.EndDate) < new Date()) {
            return res.status(400).json({ success: false, message: 'Không thể chỉnh sửa voucher đã hết hạn.' });
        }

        const { 
            voucherCode, 
            voucherType, 
            voucherName, 
            discountType, 
            discountValue, 
            minimumOrder, 
            maximumDiscount, 
            usageLimit, 
            startDate, 
            endDate, 
            status, 
            description 
        } = req.body;

        const updateData = {};

        if (voucherCode !== undefined) {
            if (!voucherCode || voucherCode.trim() === '') {
                return res.status(400).json({ success: false, message: 'Mã voucher không được để trống.' });
            }
            const cleanCode = voucherCode.trim().toUpperCase();
            if (cleanCode !== current.VoucherCode) {
                const existing = await VoucherModel.getByCode(cleanCode);
                if (existing) {
                    return res.status(400).json({ success: false, message: 'Mã voucher này đã tồn tại.' });
                }
            }
            updateData.voucherCode = cleanCode;
        }

        if (voucherType !== undefined) {
            updateData.voucherType = voucherType;
        }

        if (voucherName !== undefined) {
            if (!voucherName || voucherName.trim() === '') {
                return res.status(400).json({ success: false, message: 'Tên chương trình không được để trống.' });
            }
            updateData.voucherName = voucherName.trim();
        }

        if (discountType !== undefined) {
            updateData.discountType = discountType;
        }

        if (discountValue !== undefined) {
            const valDiscount = parseFloat(discountValue);
            if (isNaN(valDiscount) || valDiscount <= 0) {
                return res.status(400).json({ success: false, message: 'Giá trị giảm phải lớn hơn 0.' });
            }
            const activeType = discountType || current.DiscountType;
            if (activeType === 'Percentage' && valDiscount > 100) {
                return res.status(400).json({ success: false, message: 'Giá trị phần trăm giảm không được vượt quá 100%.' });
            }
            updateData.discountValue = valDiscount;
        }

        if (minimumOrder !== undefined) {
            const minOrder = parseFloat(minimumOrder);
            if (isNaN(minOrder) || minOrder < 0) {
                return res.status(400).json({ success: false, message: 'Giá trị đơn hàng tối thiểu phải lớn hơn hoặc bằng 0.' });
            }
            updateData.minimumOrder = minOrder;
        }

        if (maximumDiscount !== undefined) {
            const maxDiscount = parseFloat(maximumDiscount);
            if (isNaN(maxDiscount) || maxDiscount < 0) {
                return res.status(400).json({ success: false, message: 'Giá trị giảm tối đa phải lớn hơn hoặc bằng 0.' });
            }
            updateData.maximumDiscount = maxDiscount;
        }

        if (usageLimit !== undefined) {
            const limit = parseInt(usageLimit);
            if (isNaN(limit) || limit < 1) {
                return res.status(400).json({ success: false, message: 'Giới hạn sử dụng phải lớn hơn hoặc bằng 1.' });
            }
            updateData.usageLimit = limit;
        }

        const activeStart = startDate ? new Date(startDate) : new Date(current.StartDate);
        const activeEnd = endDate ? new Date(endDate) : new Date(current.EndDate);
        
        if (startDate !== undefined || endDate !== undefined) {
            if (isNaN(activeStart.getTime()) || isNaN(activeEnd.getTime())) {
                return res.status(400).json({ success: false, message: 'Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.' });
            }
            if (activeStart >= activeEnd) {
                return res.status(400).json({ success: false, message: 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc.' });
            }
            if (startDate !== undefined) updateData.startDate = activeStart;
            if (endDate !== undefined) updateData.endDate = activeEnd;
        }

        if (status !== undefined) {
            updateData.status = status;
        }

        if (description !== undefined) {
            updateData.description = description ? description.trim() : null;
        }

        if (activeEnd < new Date()) {
            updateData.status = 'Expired';
        }

        const updated = await VoucherModel.update(id, updateData);
        res.json({ success: true, message: 'Cập nhật mã khuyến mãi thành công!', data: updated });
    } catch (err) {
        console.error('[voucherController] updateVoucher:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật voucher.' });
    }
};

exports.deleteVoucher = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
        }

        const current = await VoucherModel.getById(id);
        if (!current) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy voucher cần xóa.' });
        }

        try {
            const deleted = await VoucherModel.hardDelete(id);
            if (deleted) {
                return res.json({ success: true, message: 'Đã xóa voucher thành công khỏi hệ thống!' });
            }
        } catch (dbErr) {
            console.log(`[deleteVoucher] Hard delete failed, falling back to soft delete:`, dbErr.message);
            // Fallback to soft delete if voucher is linked to other records
            const softDeleted = await VoucherModel.softDelete(id);
            if (softDeleted) {
                return res.json({ success: true, message: 'Voucher đã được ẩn khỏi danh sách do đã được sử dụng trước đó.' });
            }
        }
        
        res.status(400).json({ success: false, message: 'Không thể xóa hoặc ẩn voucher này.' });
    } catch (err) {
        console.error('[voucherController] deleteVoucher:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xóa voucher.' });
    }
};
