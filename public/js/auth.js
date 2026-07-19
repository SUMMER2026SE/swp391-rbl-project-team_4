// ============================================================
//  public/js/auth.js  –  Authentication Logic
//  Handles Login, Register, Role-based Redirect, UI interactions, Google Login
// ============================================================

(function () {
  'use strict';

  // ─── API Base URL ───
  const API_BASE = '/api/auth';

  // ─── Role → Page Mapping ───
  const ROLE_REDIRECTS = {
    'Customer': 'index.html',
    'Admin': 'admin.html',
    'Manager': 'admin.html',
    'Super Admin': 'admin.html',
  };

  function getPostAuthRedirect(role) {
    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get('redirect');
    const storedRedirect = sessionStorage.getItem('redirectAfterLogin');
    const target = redirectParam || storedRedirect;

    if (target) {
      sessionStorage.removeItem('redirectAfterLogin');
      // Chỉ cho phép redirect nội bộ
      if (!target.startsWith('http') && !target.startsWith('//')) {
        return target;
      }
    }

    return ROLE_REDIRECTS[role] || 'index.html';
  }

  // ─── DOM References ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Tabs
    tabLogin: $('#tabLogin'),
    tabRegister: $('#tabRegister'),
    tabIndicator: $('#tabIndicator'),

    // Forms
    loginForm: $('#loginForm'),
    registerForm: $('#registerForm'),

    // Login fields
    loginEmail: $('#loginEmail'),
    loginPassword: $('#loginPassword'),

    // Register fields
    regFullName: $('#regFullName'),
    regEmail: $('#regEmail'),
    regPhone: $('#regPhone'),
    regPassword: $('#regPassword'),
    regConfirmPassword: $('#regConfirmPassword'),

    // Buttons
    btnLogin: $('#btnLogin'),
    btnRegister: $('#btnRegister'),
    btnGoogle: $('#btnGoogle'), // Thêm DOM cho nút Google

    // Header text
    welcomeTitle: $('#welcomeTitle'),
    welcomeSub: $('#welcomeSub'),

    // Toggle prompt
    promptText: $('#promptText'),
    promptLink: $('#promptLink'),

    // Password strength
    passwordStrength: $('#passwordStrength'),
    strengthFill: $('#strengthFill'),
    strengthLabel: $('#strengthLabel'),

    // Toast
    toast: $('#toast'),

    // Particles
    heroParticles: $('#heroParticles'),
  };

  // ═══════════════════════════════════════════════════════════
  //  TAB SWITCHING
  // ═══════════════════════════════════════════════════════════
  let currentTab = 'login';

  function switchTab(tab) {
    if (tab === currentTab) return;
    currentTab = tab;

    // Tab buttons
    dom.tabLogin.classList.toggle('active', tab === 'login');
    dom.tabRegister.classList.toggle('active', tab === 'register');

    // Indicator slide
    dom.tabIndicator.classList.toggle('right', tab === 'register');

    // Forms
    dom.loginForm.classList.toggle('active', tab === 'login');
    dom.registerForm.classList.toggle('active', tab === 'register');

    // Re-trigger animation
    const activeForm = tab === 'login' ? dom.loginForm : dom.registerForm;
    activeForm.style.animation = 'none';
    activeForm.offsetHeight; // force reflow
    activeForm.style.animation = '';

    // Update header text
    if (tab === 'login') {
      dom.welcomeTitle.textContent = 'Chào mừng trở lại';
      dom.welcomeSub.textContent = 'Đăng nhập để tiếp tục hành trình điện ảnh của bạn.';
      dom.promptText.textContent = 'Chưa có tài khoản?';
      dom.promptLink.textContent = 'Đăng ký ngay';
    } else {
      dom.welcomeTitle.textContent = 'Tạo tài khoản mới';
      dom.welcomeSub.textContent = 'Đăng ký để đặt vé, tích điểm và nhận ưu đãi hấp dẫn.';
      dom.promptText.textContent = 'Đã có tài khoản?';
      dom.promptLink.textContent = 'Đăng nhập';
    }

    // Clear errors
    clearAllErrors();
  }

  // Tab click handlers
  dom.tabLogin.addEventListener('click', () => switchTab('login'));
  dom.tabRegister.addEventListener('click', () => switchTab('register'));
  dom.promptLink.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(currentTab === 'login' ? 'register' : 'login');
  });

  // ═══════════════════════════════════════════════════════════
  //  PASSWORD VISIBILITY TOGGLE
  // ═══════════════════════════════════════════════════════════
  $$('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');

      if (input.type === 'password') {
        input.type = 'text';
        eyeOpen.style.display = 'none';
        eyeClosed.style.display = 'block';
      } else {
        input.type = 'password';
        eyeOpen.style.display = 'block';
        eyeClosed.style.display = 'none';
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  PASSWORD STRENGTH METER
  // ═══════════════════════════════════════════════════════════
  dom.regPassword.addEventListener('input', () => {
    const val = dom.regPassword.value;

    if (val.length === 0) {
      dom.passwordStrength.classList.remove('visible');
      return;
    }

    dom.passwordStrength.classList.add('visible');

    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const fill = dom.strengthFill;
    const label = dom.strengthLabel;

    // Clear classes
    fill.className = 'strength-fill';
    label.className = 'strength-label';

    if (score <= 2) {
      fill.classList.add('weak');
      label.classList.add('weak');
      label.textContent = 'Yếu';
    } else if (score <= 3) {
      fill.classList.add('medium');
      label.classList.add('medium');
      label.textContent = 'Trung bình';
    } else {
      fill.classList.add('strong');
      label.classList.add('strong');
      label.textContent = 'Mạnh';
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  TOAST NOTIFICATION
  // ═══════════════════════════════════════════════════════════
  let toastTimeout = null;

  function showToast(message, type = 'info') {
    clearTimeout(toastTimeout);

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
    };

    dom.toast.className = `toast ${type}`;
    dom.toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;
    dom.toast.classList.add('show');

    toastTimeout = setTimeout(() => {
      dom.toast.classList.remove('show');
    }, 4000);
  }

  // ═══════════════════════════════════════════════════════════
  //  VALIDATION HELPERS
  // ═══════════════════════════════════════════════════════════
  function setError(input, msg) {
    input.classList.add('error');
    input.classList.remove('success');

    // Remove existing error msg if any
    const existing = input.closest('.input-group').querySelector('.field-error');
    if (existing) existing.remove();

    const errorEl = document.createElement('p');
    errorEl.className = 'field-error';
    errorEl.style.cssText = 'color: #ef4444; font-size: 0.75rem; margin-top: 6px; font-weight: 500;';
    errorEl.textContent = msg;
    input.closest('.input-wrapper').insertAdjacentElement('afterend', errorEl);
  }

  function clearError(input) {
    input.classList.remove('error');
    const existing = input.closest('.input-group').querySelector('.field-error');
    if (existing) existing.remove();
  }

  function clearAllErrors() {
    $$('.input-wrapper input').forEach((inp) => {
      inp.classList.remove('error', 'success');
    });
    $$('.field-error').forEach((el) => el.remove());
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function validateLoginIdentifier(value) {
    const input = value.trim();
    if (input.includes('@')) return validateEmail(input);
    const phone = normalizePhone(input);
    return /^0\d{9}$/.test(phone) || /^84\d{9}$/.test(phone);
  }

  function validateVietnamPhone(value) {
    if (!value) return true;
    const phone = normalizePhone(value);
    return /^0\d{9}$/.test(phone) || /^84\d{9}$/.test(phone);
  }

  // ═══════════════════════════════════════════════════════════
  //  BUTTON LOADING STATE
  // ═══════════════════════════════════════════════════════════
  function setLoading(btn, loading) {
    if (!btn) return;
    // Xử lý riêng cho nút Google vì nút này không có cấu trúc span btn-text
    if (btn.id === 'btnGoogle') {
      btn.disabled = loading;
      btn.style.opacity = loading ? '0.7' : '1';
      return;
    }

    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');

    if (loading) {
      btn.disabled = true;
      if (text) text.style.display = 'none';
      if (loader) loader.style.display = 'flex';
    } else {
      btn.disabled = false;
      if (text) text.style.display = 'inline';
      if (loader) loader.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  LOGIN HANDLER (Tài khoản thường)
  // ═══════════════════════════════════════════════════════════
  dom.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const identifier = dom.loginEmail.value.trim();
    const password = dom.loginPassword.value;

    // Client validation
    let hasError = false;

    if (!identifier) {
      setError(dom.loginEmail, 'Vui lòng nhập email hoặc số điện thoại.');
      hasError = true;
    } else if (!validateLoginIdentifier(identifier)) {
      setError(dom.loginEmail, 'Email hoặc số điện thoại không hợp lệ.');
      hasError = true;
    }

    if (!password) {
      setError(dom.loginPassword, 'Vui lòng nhập mật khẩu.');
      hasError = true;
    }

    if (hasError) {
      dom.loginForm.classList.add('shake');
      setTimeout(() => dom.loginForm.classList.remove('shake'), 500);
      return;
    }

    // Call API
    setLoading(dom.btnLogin, true);

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, email: identifier, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || 'Đăng nhập thất bại.', 'error');
        setLoading(dom.btnLogin, false);
        return;
      }

      const remember = document.getElementById('rememberMe') && document.getElementById('rememberMe').checked;
      if (remember) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('user', JSON.stringify(data.user));
      }

      showToast(data.message || 'Đăng nhập thành công!', 'success');

      const role = data.user.roleName || 'Customer';
      const redirectPage = getPostAuthRedirect(role);

      setTimeout(() => {
        window.location.href = redirectPage;
      }, 1000);

    } catch (err) {
      console.error('[Auth] Login error:', err);
      showToast('Không thể kết nối tới server. Vui lòng thử lại.', 'error');
      setLoading(dom.btnLogin, false);
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  GOOGLE LOGIN HANDLER
  // ═══════════════════════════════════════════════════════════
  const GOOGLE_CLIENT_ID = '680237511336-g14sn1oitjn8atqlgi9316g82avcjaqo.apps.googleusercontent.com'; // THAY MÃ CLIENT ID CỦA BẠN VÀO ĐÂY

  async function handleGoogleCredentialResponse(response) {
    setLoading(dom.btnGoogle, true);

    try {
      const res = await fetch(`${API_BASE}/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || 'Đăng nhập Google thất bại.', 'error');
        setLoading(dom.btnGoogle, false);
        return;
      }

      const remember = document.getElementById('rememberMe') && document.getElementById('rememberMe').checked;
      if (remember) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('user', JSON.stringify(data.user));
      }

      showToast('Đăng nhập Google thành công!', 'success');

      const role = data.user.roleName || 'Customer';
      const redirectPage = getPostAuthRedirect(role);

      setTimeout(() => {
        window.location.href = redirectPage;
      }, 1000);

    } catch (error) {
      console.error('Google Login Error:', error);
      showToast('Không thể kết nối máy chủ.', 'error');
      setLoading(dom.btnGoogle, false);
    }
  }

  // Khởi tạo Google Identity SDK
  function initGoogleLogin() {
    if (typeof google === 'undefined' || !google.accounts) {
      console.warn("Google SDK chưa được tải. Vui lòng kiểm tra thẻ <script> trong HTML.");
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse
    });

    // Lấy phần tử nút Google của bạn
    const btnGoogleContainer = document.getElementById('btnGoogle');

    if (btnGoogleContainer) {
      // Xóa icon và chữ cũ đi để nhường chỗ cho nút của Google
      btnGoogleContainer.innerHTML = '';
      btnGoogleContainer.style.padding = '0';
      btnGoogleContainer.style.border = 'none';
      btnGoogleContainer.style.background = 'transparent';

      // Yêu cầu Google render (vẽ) nút chuẩn của họ vào vị trí này
      google.accounts.id.renderButton(
        btnGoogleContainer,
        {
          theme: "filled_black", // Dùng Dark Theme của Google cho tông xuyệt tông với D-Cinema
          size: "large",
          shape: "rectangular",
          text: "signin_with", // Hiển thị chữ "Sign in with Google"
          logo_alignment: "left"
        }
      );
    }
  }


  // ═══════════════════════════════════════════════════════════
  //  REGISTER HANDLER
  // ═══════════════════════════════════════════════════════════
  dom.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const fullName = dom.regFullName.value.trim();
    const email = dom.regEmail.value.trim();
    const phone = dom.regPhone.value.trim();
    const password = dom.regPassword.value;
    const confirmPassword = dom.regConfirmPassword.value;

    // Client validation
    let hasError = false;

    if (!fullName) {
      setError(dom.regFullName, 'Vui lòng nhập họ tên.');
      hasError = true;
    }

    if (!email) {
      setError(dom.regEmail, 'Vui lòng nhập email.');
      hasError = true;
    } else if (!validateEmail(email)) {
      setError(dom.regEmail, 'Email không hợp lệ.');
      hasError = true;
    }

    if (phone && !validateVietnamPhone(phone)) {
      setError(dom.regPhone, 'Số điện thoại không hợp lệ.');
      hasError = true;
    }

    if (!password) {
      setError(dom.regPassword, 'Vui lòng nhập mật khẩu.');
      hasError = true;
    } else if (password.length < 6) {
      setError(dom.regPassword, 'Mật khẩu phải có ít nhất 6 ký tự.');
      hasError = true;
    } else if (!/^[A-Z]/.test(password)) {
      setError(dom.regPassword, 'Chữ cái đầu tiên phải viết hoa.');
      hasError = true;
    } else if (!/\d/.test(password)) {
      setError(dom.regPassword, 'Mật khẩu phải chứa ít nhất 1 chữ số.');
      hasError = true;
    } else if (!/[.\_!@#$%^&*()\-+=<>?]/.test(password)) {
      setError(dom.regPassword, 'Mật khẩu phải chứa ký tự đặc biệt (VD: ., _, @).');
      hasError = true;
    }

    if (!confirmPassword) {
      setError(dom.regConfirmPassword, 'Vui lòng xác nhận mật khẩu.');
      hasError = true;
    } else if (password !== confirmPassword) {
      setError(dom.regConfirmPassword, 'Mật khẩu xác nhận không khớp.');
      hasError = true;
    }

    if (hasError) {
      dom.registerForm.classList.add('shake');
      setTimeout(() => dom.registerForm.classList.remove('shake'), 500);
      return;
    }

    // Call API
    setLoading(dom.btnRegister, true);

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, phone: phone || null }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || 'Đăng ký thất bại.', 'error');
        setLoading(dom.btnRegister, false);
        return;
      }

      // ─── Đăng ký thành công ───
      showToast(data.message || 'Đăng ký thành công! Vui lòng đăng nhập.', 'success');

      setTimeout(() => {
        dom.registerForm.reset();
        switchTab('login');
        dom.loginEmail.value = email; // Điền sẵn email vào form đăng nhập
        setLoading(dom.btnRegister, false);
      }, 1200);

    } catch (err) {
      console.error('[Auth] Register error:', err);
      showToast('Không thể kết nối tới server. Vui lòng thử lại.', 'error');
      setLoading(dom.btnRegister, false);
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  FLOATING PARTICLES (Decorative)
  // ═══════════════════════════════════════════════════════════
  function createParticles() {
    if (!dom.heroParticles) return;

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${30 + Math.random() * 60}%`;
      particle.style.width = particle.style.height = `${2 + Math.random() * 3}px`;
      particle.style.animationDelay = `${Math.random() * 8}s`;
      particle.style.animationDuration = `${6 + Math.random() * 6}s`;
      dom.heroParticles.appendChild(particle);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  INPUT MICRO-INTERACTIONS
  // ═══════════════════════════════════════════════════════════
  $$('.input-wrapper input').forEach((input) => {
    input.addEventListener('blur', () => {
      if (input.value.trim() && !input.classList.contains('error')) {
        input.classList.add('success');
      }
    });

    input.addEventListener('focus', () => {
      clearError(input);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  CHECK AUTH ON LOAD (redirect if already logged in)
  // ═══════════════════════════════════════════════════════════
  function checkExistingAuth() {
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
    const user = (localStorage.getItem('user') || sessionStorage.getItem('user'));

    if (token && user) {
      try {
        const parsed = JSON.parse(user);
        const role = parsed.roleName || 'Customer';
        const redirect = getPostAuthRedirect(role);
        window.location.href = redirect;
      } catch (e) {
        localStorage.removeItem('token'); sessionStorage.removeItem('token');
        localStorage.removeItem('user'); sessionStorage.removeItem('user');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  URL PARAMS (for deep linking: ?tab=register)
  // ═══════════════════════════════════════════════════════════
  function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'register') {
      switchTab('register');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════
  function init() {
    checkExistingAuth();
    createParticles();
    handleURLParams();

    // Đợi Google SDK được tải xong từ thẻ script trong HTML
    const checkGoogleInterval = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(checkGoogleInterval);
        initGoogleLogin();
      }
    }, 100);
    // Hủy kiểm tra sau 10 giây nếu mạng lỗi
    setTimeout(() => clearInterval(checkGoogleInterval), 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
