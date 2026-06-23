const SettingsModel = require('../models/settingsModel');

exports.getAllSettings = async (req, res) => {
    try {
        const settings = await SettingsModel.getAllSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error in getAllSettings:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy cấu hình.' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { settings } = req.body; // Expecting [{key: 'VIP_MULTIPLIER', value: '1.5'}, ...]
        
        if (!settings || !Array.isArray(settings)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
        }

        await SettingsModel.updateSettings(settings);
        res.json({ success: true, message: 'Cập nhật cấu hình thành công!' });
    } catch (error) {
        console.error('Error in updateSettings:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật cấu hình.' });
    }
};
