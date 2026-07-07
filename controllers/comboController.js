const ComboModel = require('../models/comboModel');

exports.getAllCombos = async (req, res) => {
    try {
        const { search } = req.query;
        const combos = await ComboModel.getAll({ search });
        res.json({ success: true, data: combos });
    } catch (err) {
        console.error('[comboController] getAllCombos:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách combo.' });
    }
};

exports.getComboById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
        }
        const combo = await ComboModel.getById(id);
        if (!combo) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy combo.' });
        }
        res.json({ success: true, data: combo });
    } catch (err) {
        console.error('[comboController] getComboById:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thông tin combo.' });
    }
};

exports.createCombo = async (req, res) => {
    try {
        const { comboName, description, price, status, stock } = req.body;

        // Validation
        if (!comboName || comboName.trim() === '') {
            return res.status(400).json({ success: false, message: 'Tên combo không được để trống.' });
        }

        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ success: false, message: 'Giá combo phải là số lớn hơn hoặc bằng 0.' });
        }

        const parsedStock = parseInt(stock);
        if (isNaN(parsedStock) || parsedStock < 0) {
            return res.status(400).json({ success: false, message: 'Tồn kho combo phải là số lớn hơn hoặc bằng 0.' });
        }

        let imageURL = 'images/default_fnb.png';
        if (req.file) {
            imageURL = 'images/' + req.file.filename;
        }

        const combo = await ComboModel.create({
            comboName: comboName.trim(),
            description: description ? description.trim() : null,
            price: parsedPrice,
            imageURL,
            status: status || 'Active',
            stock: parsedStock
        });

        res.status(201).json({ success: true, message: 'Thêm combo thành công!', data: combo });
    } catch (err) {
        console.error('[comboController] createCombo:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo combo mới.' });
    }
};

exports.updateCombo = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
        }

        const currentCombo = await ComboModel.getById(id);
        if (!currentCombo) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy combo cần sửa.' });
        }

        const { comboName, description, price, status, stock } = req.body;
        const updateData = {};

        // Validation
        if (comboName !== undefined) {
            if (!comboName || comboName.trim() === '') {
                return res.status(400).json({ success: false, message: 'Tên combo không được để trống.' });
            }
            updateData.comboName = comboName.trim();
        }

        if (description !== undefined) {
            updateData.description = description ? description.trim() : null;
        }

        if (price !== undefined) {
            const parsedPrice = parseFloat(price);
            if (isNaN(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ success: false, message: 'Giá combo phải là số lớn hơn hoặc bằng 0.' });
            }
            updateData.price = parsedPrice;
        }

        if (stock !== undefined) {
            const parsedStock = parseInt(stock);
            if (isNaN(parsedStock) || parsedStock < 0) {
                return res.status(400).json({ success: false, message: 'Tồn kho combo phải là số lớn hơn hoặc bằng 0.' });
            }
            updateData.stock = parsedStock;
        }

        if (status !== undefined) {
            if (status !== 'Active' && status !== 'Inactive') {
                return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
            }
            updateData.status = status;
        }

        if (req.file) {
            updateData.imageURL = 'images/' + req.file.filename;
        }

        const updated = await ComboModel.update(id, updateData);
        res.json({ success: true, message: 'Cập nhật combo thành công!', data: updated });
    } catch (err) {
        console.error('[comboController] updateCombo:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật combo.' });
    }
};

exports.deleteCombo = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
        }

        const currentCombo = await ComboModel.getById(id);
        if (!currentCombo) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy combo cần xóa.' });
        }

        await ComboModel.softDelete(id);
        res.json({ success: true, message: 'Xóa combo thành công!' });
    } catch (err) {
        console.error('[comboController] deleteCombo:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa combo.' });
    }
};

exports.toggleComboStatus = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
        }

        const currentCombo = await ComboModel.getById(id);
        if (!currentCombo) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy combo.' });
        }

        const newStatus = currentCombo.Status === 'Active' ? 'Inactive' : 'Active';
        const updated = await ComboModel.update(id, { status: newStatus });
        
        res.json({ 
            success: true, 
            message: `Đã đổi trạng thái sang ${newStatus === 'Active' ? 'Hoạt động' : 'Tạm ẩn'}`, 
            data: updated 
        });
    } catch (err) {
        console.error('[comboController] toggleComboStatus:', err.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thay đổi trạng thái combo.' });
    }
};
