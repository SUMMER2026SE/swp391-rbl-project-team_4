import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api';
import '../../assets/css/auth.css';

const AuthPage = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [loginData, setLoginData] = useState({ identifier: '', password: '', remember: false });
  const [registerData, setRegisterData] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });

  const [passwordStrength, setPasswordStrength] = useState({ width: '0%', color: 'transparent' });

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  useEffect(() => {
    const loadGoogleScript = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: 'YOUR_GOOGLE_CLIENT_ID',
            callback: handleGoogleResponse
          });
        }
      };
    };
    loadGoogleScript();
  }, []);

  const handleGoogleResponse = async (response) => {
    try {
      const result = await authApi.googleLogin({ token: response.credential });
      login(result.userData, result.token, false);
      showToast('Đăng nhập Google thành công!', 'success');
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error) {
      showToast('Đăng nhập Google thất bại!', 'error');
    }
  };

  const handleGoogleClick = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLoginData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({ ...prev, [name]: value }));
    if (name === 'password') {
      evaluatePasswordStrength(value);
    }
  };

  const evaluatePasswordStrength = (pwd) => {
    if (!pwd) {
      setPasswordStrength({ width: '0%', color: 'transparent' });
      return;
    }
    let strength = 0;
    if (pwd.length >= 6) strength += 33;
    if (/[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd)) strength += 33;
    if (pwd.length >= 8 && /[!@#$%^&*(),.?":{}|<>]/.test(pwd)) strength += 34;

    if (strength <= 33) setPasswordStrength({ width: '33%', color: 'red' });
    else if (strength <= 66) setPasswordStrength({ width: '66%', color: 'orange' });
    else setPasswordStrength({ width: '100%', color: 'green' });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await authApi.login({
        identifier: loginData.identifier,
        password: loginData.password
      });
      login(response.userData, response.token, loginData.remember);
      showToast('Đăng nhập thành công!', 'success');
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error) {
      showToast(error.response?.data?.message || 'Đăng nhập thất bại.', 'error');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      showToast('Mật khẩu không khớp!', 'error');
      return;
    }
    try {
      await authApi.register({
        fullName: registerData.fullName,
        email: registerData.email,
        phone: registerData.phone,
        password: registerData.password
      });
      showToast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
      setActiveTab('login');
    } catch (error) {
      showToast(error.response?.data?.message || 'Đăng ký thất bại.', 'error');
    }
  };

  return (
    <div className="auth-page">
      {toast.show && (
        <div id="toast" className={`toast show ${toast.type}`}>
          {toast.message}
        </div>
      )}
      
      <div className="auth-hero">
        <div className="hero-overlay"></div>
        <div className="hero-particles"></div>
        <div className="auth-header">
          <div className="hero-brand">
            <Link to="/">
                <img src="/images/logo.png" alt="D-Cinema" />
            </Link>
          </div>
          <nav>
            <Link to="/">Trang chủ</Link>
          </nav>
        </div>
        <div className="hero-visual">
          <img src="/images/hero_banner.png" alt="Cinema" className="cinema-img" />
        </div>
        <h2 className="hero-tagline">Trải nghiệm điện ảnh đỉnh cao cùng D-Cinema</h2>
      </div>

      <div className="auth-form-panel">
        <div className="auth-content">
          <h2 className="welcome-title">
            {activeTab === 'login' ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}
          </h2>
          <p className="welcome-sub">
            {activeTab === 'login' ? 'Đăng nhập để tiếp tục' : 'Tham gia cùng chúng tôi để nhận nhiều ưu đãi'}
          </p>

          <div className="tab-switcher">
            <button 
              className={activeTab === 'login' ? 'active' : ''} 
              onClick={() => setActiveTab('login')}
            >
              ĐĂNG NHẬP
            </button>
            <button 
              className={activeTab === 'register' ? 'active' : ''} 
              onClick={() => setActiveTab('register')}
            >
              ĐĂNG KÝ
            </button>
            <div 
              className="tab-indicator" 
              style={{ transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(100%)' }}
            ></div>
          </div>

          {activeTab === 'login' ? (
            <form id="loginForm" onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <input 
                  type="text" 
                  name="identifier" 
                  placeholder="Email hoặc Số điện thoại" 
                  value={loginData.identifier}
                  onChange={handleLoginChange}
                  required 
                />
              </div>
              <div className="form-group password-group">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  name="password" 
                  placeholder="Mật khẩu" 
                  value={loginData.password}
                  onChange={handleLoginChange}
                  required 
                />
                <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
              <div className="form-options">
                <label>
                  <input 
                    type="checkbox" 
                    name="remember"
                    checked={loginData.remember}
                    onChange={handleLoginChange}
                  /> Ghi nhớ đăng nhập
                </label>
                <Link to="/forgot-password">Quên mật khẩu?</Link>
              </div>
              <button type="submit" className="btn-submit">Đăng nhập</button>
              
              <div className="divider"><span>hoặc đăng nhập với</span></div>
              
              <button type="button" className="btn-social google-btn" onClick={handleGoogleClick}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
            </form>
          ) : (
            <form id="registerForm" onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <input type="text" name="fullName" placeholder="Họ và tên" value={registerData.fullName} onChange={handleRegisterChange} required />
              </div>
              <div className="form-group">
                <input type="email" name="email" placeholder="Email" value={registerData.email} onChange={handleRegisterChange} required />
              </div>
              <div className="form-group">
                <input type="tel" name="phone" placeholder="Số điện thoại" value={registerData.phone} onChange={handleRegisterChange} required />
              </div>
              <div className="form-group password-group">
                <input type={showPassword ? 'text' : 'password'} name="password" placeholder="Mật khẩu" value={registerData.password} onChange={handleRegisterChange} required />
                <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
              <div className="password-strength">
                <div className="strength-fill" style={{ width: passwordStrength.width, backgroundColor: passwordStrength.color, height: '4px', transition: 'width 0.3s' }}></div>
              </div>
              <div className="form-group password-group">
                <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" placeholder="Xác nhận mật khẩu" value={registerData.confirmPassword} onChange={handleRegisterChange} required />
                <button type="button" className="toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
              <button type="submit" className="btn-submit">Đăng ký</button>
            </form>
          )}

          <div className="toggle-prompt">
            {activeTab === 'login' ? (
              <p>Chưa có tài khoản? <span onClick={() => setActiveTab('register')} style={{ cursor: 'pointer', color: 'blue' }}>Đăng ký ngay</span></p>
            ) : (
              <p>Đã có tài khoản? <span onClick={() => setActiveTab('login')} style={{ cursor: 'pointer', color: 'blue' }}>Đăng nhập</span></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
