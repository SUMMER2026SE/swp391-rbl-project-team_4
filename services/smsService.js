// ============================================================
//  services/smsService.js  –  Gửi OTP qua SMS (Twilio)
// ============================================================

const twilio = require('twilio');

// ─── Khởi tạo Twilio client ───
let twilioClient = null;

function getClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('[SMSService] ⚠️  TWILIO_ACCOUNT_SID hoặc TWILIO_AUTH_TOKEN chưa được cấu hình.');
      return null;
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

/**
 * Chuyển đổi số điện thoại VN sang định dạng quốc tế E.164
 * 0901234567 → +84901234567
 * +84901234567 → +84901234567
 * @param {string} phone - Số điện thoại
 * @returns {string} - Số điện thoại định dạng E.164
 */
function formatPhoneVN(phone) {
  // Xóa khoảng trắng và dấu gạch
  let cleaned = phone.replace(/[\s\-\.]/g, '');

  // Nếu bắt đầu bằng 0 → thay bằng +84
  if (cleaned.startsWith('0')) {
    cleaned = '+84' + cleaned.substring(1);
  }

  // Nếu bắt đầu bằng 84 (không có +) → thêm +
  if (cleaned.startsWith('84') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Gửi SMS chứa mã OTP
 * @param {string} toPhone - Số điện thoại người nhận
 * @param {string} otpCode - Mã OTP 6 chữ số
 * @returns {Promise<object>} - Kết quả gửi SMS
 */
async function sendOTPSms(toPhone, otpCode) {
  const client = getClient();

  if (!client) {
    throw new Error('Twilio chưa được cấu hình. Kiểm tra biến TWILIO_ACCOUNT_SID và TWILIO_AUTH_TOKEN.');
  }

  const fromPhone = process.env.TWILIO_PHONE_NUMBER;
  if (!fromPhone) {
    throw new Error('TWILIO_PHONE_NUMBER chưa được cấu hình trong .env');
  }

  const formattedPhone = formatPhoneVN(toPhone);

  try {
    const message = await client.messages.create({
      body: `[D-Cinema] Mã OTP của bạn là: ${otpCode}. Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.`,
      from: fromPhone,
      to: formattedPhone,
    });

    console.log('[SMSService] ✅ OTP SMS sent to:', formattedPhone, '| SID:', message.sid);
    return { success: true, messageSid: message.sid };
  } catch (err) {
    console.error('[SMSService] ❌ Failed to send OTP SMS:', err.message);
    throw err;
  }
}

module.exports = { sendOTPSms, formatPhoneVN };
