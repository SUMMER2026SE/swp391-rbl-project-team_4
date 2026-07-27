import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../../services/api';
import '../../assets/css/forgot-password.css';

const ForgotPasswordPage = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();
  const inputRefs = useRef([]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await authApi.forgotPassword(email);
      setMessage('Mã OTP đã được gửi đến email của bạn.');
      setStep(2);
    } catch (err) {
      setError('Không thể gửi mã OTP. Vui lòng kiểm tra lại email.');
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setError('Vui lòng nhập đầy đủ mã OTP 6 số.');
      return;
    }
    try {
      const response = await authApi.verifyOTP({ email, otp: otpCode });
      setResetToken(response.data?.resetToken || response.resetToken);
      setStep(3);
    } catch (err) {
      setError('Mã OTP không hợp lệ hoặc đã hết hạn.');
    }
  };

  const handleResendOtp = async () => {
    setError('');
    try {
      await authApi.forgotPassword(email);
      setMessage('Mã OTP mới đã được gửi.');
    } catch (err) {
      setError('Lỗi khi gửi lại mã OTP.');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    try {
      await authApi.resetPassword({ resetToken, newPassword });
      setMessage('Đổi mật khẩu thành công. Đang chuyển hướng...');
      setTimeout(() => navigate('/auth'), 2000);
    } catch (err) {
      setError('Lỗi khi đổi mật khẩu.');
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-container">
        <div className="forgot-card">
          <div className="step-header">
            <h2 className="logo" onClick={() => navigate('/')}>D-Cinema</h2>
            <div className="step-indicator">
              <span className={`step-dot ${step >= 1 ? 'active' : ''}`}></span>
              <span className={`step-dot ${step >= 2 ? 'active' : ''}`}></span>
              <span className={`step-dot ${step >= 3 ? 'active' : ''}`}></span>
            </div>
          </div>
          
          {error && <div className="error-toast">{error}</div>}
          {message && <div className="success-toast">{message}</div>}

          {step === 1 && (
            <form onSubmit={handleEmailSubmit}>
              <h3>Quên mật khẩu</h3>
              <p>Nhập email của bạn để nhận mã khôi phục.</p>
              <div className="input-group">
                <input 
                  type="email" 
                  placeholder="Nhập email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              <button type="submit" className="btn-submit">Tiếp tục</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleOtpSubmit}>
              <h3>Nhập mã OTP</h3>
              <p>Mã đã được gửi đến {email}</p>
              <div className="otp-inputs">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength="1"
                    className="otp-input"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    ref={(el) => (inputRefs.current[index] = el)}
                  />
                ))}
              </div>
              <button type="submit" className="btn-submit">Xác nhận OTP</button>
              <p className="resend-link" onClick={handleResendOtp}>Gửi lại mã</p>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handlePasswordSubmit}>
              <h3>Mật khẩu mới</h3>
              <div className="input-group">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu mới"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              <div className="input-group">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Xác nhận mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-submit">Cập nhật mật khẩu</button>
            </form>
          )}
          <p className="back-link" onClick={() => navigate('/auth')}>Quay lại đăng nhập</p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
