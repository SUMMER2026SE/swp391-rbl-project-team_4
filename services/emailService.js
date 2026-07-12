// ============================================================
//  services/emailService.js  –  Gửi OTP qua Email (Nodemailer + Gmail)
// ============================================================
const nodemailer = require('nodemailer');

let etherealTransporter = null;

// ─── Cấu hình Gmail SMTP động / Tự động dùng Ethereal Email khi dev ───
async function getTransporter() {
  const email = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_APP_PASSWORD;

  if (email && pass && !email.includes('your-gmail') && !pass.includes('your-gmail-app-password')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: email,
        pass: pass,
      },
    });
  }

  if (etherealTransporter) return etherealTransporter;

  try {
    console.log('[EmailService] ℹ️ Đang tự động khởi tạo tài khoản giả lập Ethereal Email...');
    const testAccount = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[EmailService] ✅ Khởi tạo tài khoản giả lập Ethereal thành công: User=${testAccount.user}`);
    return etherealTransporter;
  } catch (err) {
    console.error('[EmailService] ❌ Không thể khởi tạo tài khoản giả lập Ethereal Email:', err.message);
    return null;
  }
}

/**
 * Gửi email chứa mã OTP theo phong cách D-Cinema
 * @param {string} toEmail - Email người nhận
 * @param {string} otpCode - Mã OTP 6 chữ số
 * @returns {Promise<object>} - Kết quả gửi email
 */
async function sendOTPEmail(toEmail, otpCode) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.log(`[EmailService] Bỏ qua gửi mã OTP đến ${toEmail} (Chưa cấu hình SMTP)`);
    return { success: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const mailOptions = {
    from: `"D-Cinema" <${process.env.SMTP_EMAIL || 'no-reply@dcinema.vn'}>`,
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
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('\x1b[32m%s\x1b[0m', `[EmailService] 🔗 Xem trước OTP email tại: ${previewUrl}`);
    }
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
  const transporter = await getTransporter();
  if (!transporter) {
    console.log(`[EmailService] Bỏ qua gửi email vé đến ${toEmail} (Chưa cấu hình SMTP)`);
    return { success: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const mailOptions = {
    from: `"D-Cinema" <${process.env.SMTP_EMAIL || 'no-reply@dcinema.vn'}>`,
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
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('\x1b[32m%s\x1b[0m', `[EmailService] 🔗 Xem trước booking email tại: ${previewUrl}`);
    }
    return { success: true };
  } catch (err) {
    console.error('[EmailService] ❌ Failed to send booking email:', err.message);
  }
}

async function sendShowtimeReminderEmail(toEmail, reminderInfo) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.log(`[EmailService] Bỏ qua gửi nhắc lịch chiếu đến ${toEmail} (Chưa cấu hình SMTP)`);
    return { success: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const mailOptions = {
    from: `"D-Cinema" <${process.env.SMTP_EMAIL || 'no-reply@dcinema.vn'}>`,
    to: toEmail,
    subject: `Nhắc lịch chiếu: ${reminderInfo.movieTitle} - D-Cinema`,
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
                <tr>
                  <td style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:3px;">
                      <span style="font-size:32px;">D</span>-CINEMA
                    </h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:2px;">
                      NHẮC LỊCH CHIẾU
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px;">
                    <h2 style="margin:0 0 16px;color:#f1f1f4;font-size:20px;font-weight:700;">
                      Xin chào ${reminderInfo.customerName},
                    </h2>
                    <p style="margin:0 0 24px;color:#b7b7c8;font-size:15px;line-height:1.6;">
                      Suất chiếu của bạn sắp bắt đầu. Vui lòng đến rạp sớm hơn 15-20 phút để check-in và nhận bắp nước nếu có.
                    </p>

                    <div style="background:#1a1a24;padding:22px;border-radius:12px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.06);">
                      <h3 style="color:#f87171;margin:0 0 14px;font-size:19px;">${reminderInfo.movieTitle}</h3>
                      <p style="color:#f1f1f4;margin:8px 0;"><strong>Rạp:</strong> ${reminderInfo.cinemaName}</p>
                      <p style="color:#f1f1f4;margin:8px 0;"><strong>Phòng:</strong> ${reminderInfo.roomName}</p>
                      <p style="color:#f1f1f4;margin:8px 0;"><strong>Thời gian:</strong> ${reminderInfo.showtime}</p>
                      <p style="color:#f1f1f4;margin:8px 0;"><strong>Ghế:</strong> <span style="color:#fbbf24;font-size:18px;font-weight:800;">${reminderInfo.seats}</span></p>
                      <p style="color:#f1f1f4;margin:8px 0;"><strong>Mã vé:</strong> ${reminderInfo.ticketCodes}</p>
                    </div>

                    <p style="margin:0;color:#8b8b9e;font-size:13px;line-height:1.6;">
                      Email này được gửi tự động để nhắc lịch chiếu. Nếu bạn đã hủy vé hoặc cần hỗ trợ, vui lòng liên hệ quầy dịch vụ D-Cinema.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
                    <p style="margin:0;color:#55556a;font-size:12px;">
                      D-CINEMA STUDIOS. ALL RIGHTS RESERVED.
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
    console.log('[EmailService] Showtime reminder email sent to:', toEmail, '| MessageID:', info.messageId);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('\x1b[32m%s\x1b[0m', `[EmailService] 🔗 Xem trước reminder email tại: ${previewUrl}`);
    }
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[EmailService] Failed to send showtime reminder email:', err.message);
    throw err;
  }
}

/**
 * Gửi email thông báo check-in/xác thực vé thành công
 * @param {string} toEmail - Email người nhận
 * @param {object} checkInInfo - Thông tin check-in
 */
async function sendTicketCheckInEmail(toEmail, checkInInfo) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.log(`[EmailService] Bỏ qua gửi thông báo check-in đến ${toEmail} (Chưa cấu hình SMTP)`);
    return { success: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const mailOptions = {
    from: `"D-Cinema" <${process.env.SMTP_EMAIL || 'no-reply@dcinema.vn'}>`,
    to: toEmail,
    subject: '✅ Xác thực vé thành công (Checked-in) — D-Cinema',
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
                  <td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:3px;">
                      <span style="font-size:32px;">D</span>-CINEMA
                    </h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:2px;">
                      XÁC NHẬN VÀO PHÒNG CHIẾU
                    </p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="margin:0 0 16px;color:#f1f1f4;font-size:20px;font-weight:700;">
                      Xin chào ${checkInInfo.customerName},
                    </h2>
                    <p style="margin:0 0 24px;color:#b7b7c8;font-size:15px;line-height:1.6;">
                      Vé của bạn đã được xác thực thành công tại rạp. Chúc bạn có những giây phút xem phim tuyệt vời!
                    </p>
                    
                    <div style="background:#1a1a24; padding:20px; border-radius:12px; margin-bottom:20px; border:1px solid rgba(255,255,255,0.06);">
                      <h3 style="color:#10b981; margin-top:0;">🎥 ${checkInInfo.movieTitle}</h3>
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Rạp:</strong> ${checkInInfo.cinemaName} - ${checkInInfo.roomName}</p>
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Thời gian chiếu:</strong> ${checkInInfo.showtime}</p>
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Ghế:</strong> <span style="color:#fbbf24; font-size:18px; font-weight:bold;">${checkInInfo.seats}</span></p>
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Thời gian quét vé:</strong> ${checkInInfo.checkedAt}</p>
                      <p style="color:#f1f1f4; margin:5px 0;"><strong>Mã đặt vé:</strong> ${checkInInfo.bookingId}</p>
                    </div>

                    <div style="text-align:center; padding:15px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); border-radius:8px;">
                      <span style="color:#10b981; font-weight:bold; font-size:16px;">Vé hợp lệ và đã qua cổng kiểm soát.</span>
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
    console.log('[EmailService] ✅ Ticket check-in email sent to:', toEmail);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('\x1b[32m%s\x1b[0m', `[EmailService] 🔗 Xem trước check-in email tại: ${previewUrl}`);
    }
    return { success: true };
  } catch (err) {
    console.error('[EmailService] ❌ Failed to send check-in email:', err.message);
  }
}

module.exports = { sendOTPEmail, sendBookingEmail, sendShowtimeReminderEmail, sendTicketCheckInEmail };
