// ============================================================
//  services/emailService.js  –  Gửi OTP qua Email (Nodemailer + Gmail)
// ============================================================
const nodemailer = require('nodemailer');

// ─── Cấu hình Gmail SMTP ───
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_APP_PASSWORD, // Gmail App Password (không phải password thường)
  },
});

/**
 * Gửi email chứa mã OTP theo phong cách D-Cinema
 * @param {string} toEmail - Email người nhận
 * @param {string} otpCode - Mã OTP 6 chữ số
 * @returns {Promise<object>} - Kết quả gửi email
 */
async function sendOTPEmail(toEmail, otpCode) {
  const mailOptions = {
    from: `"D-Cinema" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: '🔐 Mã xác nhận đặt lại mật khẩu — D-Cinema',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#06060a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#06060a;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background-color:#0d0d14;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:3px;">
                      <span style="font-size:32px;">D</span>-CINEMA
                    </h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:2px;">
                      KHÔI PHỤC MẬT KHẨU
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="margin:0 0 16px;color:#f1f1f4;font-size:20px;font-weight:700;">
                      Xin chào,
                    </h2>
                    <p style="margin:0 0 24px;color:#8b8b9e;font-size:15px;line-height:1.6;">
                      Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản D-Cinema. Vui lòng sử dụng mã OTP bên dưới để xác nhận:
                    </p>

                    <!-- OTP Code -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding:24px 0;">
                          <div style="display:inline-block;background:linear-gradient(135deg,rgba(220,38,38,0.1),rgba(220,38,38,0.05));border:2px solid rgba(220,38,38,0.3);border-radius:12px;padding:20px 48px;">
                            <span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#dc2626;font-family:'Courier New',monospace;">
                              ${otpCode}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:24px 0 0;color:#8b8b9e;font-size:14px;line-height:1.6;">
                      ⏱ Mã OTP có hiệu lực trong <strong style="color:#f1f1f4;">5 phút</strong>.
                    </p>
                    <p style="margin:12px 0 0;color:#8b8b9e;font-size:14px;line-height:1.6;">
                      Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
                    <p style="margin:0;color:#55556a;font-size:12px;">
                      © 2024 D-CINEMA STUDIOS. ALL RIGHTS RESERVED.
                    </p>
                    <p style="margin:8px 0 0;color:#55556a;font-size:11px;">
                      Email này được gửi tự động, vui lòng không trả lời.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[EmailService] ✅ OTP email sent to:', toEmail, '| MessageID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[EmailService] ❌ Failed to send OTP email:', err.message);
    throw err;
  }
}

/**
 * Gửi email xác nhận đặt vé thành công kèm mã vé
 * @param {string} toEmail - Email người nhận
 * @param {object} bookingInfo - Thông tin đặt vé
 */
async function sendBookingEmail(toEmail, bookingInfo) {
  const mailOptions = {
    from: `"D-Cinema" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: '🎟️ Xác nhận đặt vé thành công — D-Cinema',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="margin:0;padding:0;background-color:#06060a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#06060a;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color:#0d0d14;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:3px;">
                      <span style="font-size:32px;">D</span>-CINEMA
                    </h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:2px;">
                      VÉ ĐIỆN TỬ (E-TICKET)
                    </p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="margin:0 0 16px;color:#f1f1f4;font-size:20px;font-weight:700;">
                      Xin chào ${bookingInfo.customerName},
                    </h2>
                    <p style="margin:0 0 24px;color:#8b8b9e;font-size:15px;line-height:1.6;">
                      Cảm ơn bạn đã đặt vé tại D-Cinema. Dưới đây là thông tin vé điện tử của bạn. Vui lòng đưa mã vé này cho nhân viên tại rạp để quét.
                    </p>
                    
                    <div style="background:#1a1a24; padding:20px; border-radius:12px; margin-bottom:20px;">
                      <h3 style="color:#dc2626; margin-top:0;">🎥 ${bookingInfo.movieTitle}</h3>
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Rạp:</strong> ${bookingInfo.cinemaName} - ${bookingInfo.roomName}</p>
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Thời gian chiếu:</strong> ${bookingInfo.showtime}</p>
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Ghế:</strong> <span style="color:#ffd700; font-size:18px; font-weight:bold;">${bookingInfo.seats}</span></p>
                      ${bookingInfo.food ? `<p style="color:#f1f1f4; margin:5px 0;"><strong>Combo/Bắp nước:</strong> ${bookingInfo.food}</p>` : ''}
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Tổng tiền:</strong> ${bookingInfo.totalAmount}</p>
                    </div>

                    <div style="text-align:center; padding:20px; border:2px dashed #dc2626; border-radius:12px;">
                      <p style="color:#8b8b9e; margin:0 0 10px 0;">MÃ VÉ CỦA BẠN</p>
                      <img src="${bookingInfo.qrCodeUrl}" alt="QR Code" style="width:150px; height:150px; background:white; padding:10px; border-radius:8px;" />
                      <h2 style="color:#dc2626; letter-spacing:4px; margin:15px 0 0 0;">${bookingInfo.ticketCode}</h2>
                    </div>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
                    <p style="margin:0;color:#55556a;font-size:12px;">
                      © 2024 D-CINEMA STUDIOS. ALL RIGHTS RESERVED.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[EmailService] ✅ Booking email sent to:', toEmail);
    return { success: true };
  } catch (err) {
    console.error('[EmailService] ❌ Failed to send booking email:', err.message);
  }
}

module.exports = { sendOTPEmail, sendBookingEmail };
