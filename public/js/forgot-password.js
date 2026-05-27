// ============================================================
//  public/js/forgot-password.js  –  Forgot Password Logic
//  4-step flow: Email/Phone → OTP → New Password → Success
// ============================================================

(function () {
  'use strict';

  const API_BASE = '/api/auth';

  // ─── DOM References ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Steps
    step1: $('#step1'),
    step2: $('#step2'),
    step3: $('#step3'),
    step4: $('#step4'),

    // Step 1 — Forgot Form
    forgotForm: $('#forgotForm'),
    forgotEmail: $('#forgotEmail'),
    captchaInput: $('#captchaInput'),
    captchaCanvas: $('#captchaCanvas'),
    captchaRefresh: $('#captchaRefresh'),
    btnSubmitStep1: $('#btnSubmitStep1'),

    // Step 2 — OTP
    otpForm: $('#otpForm'),
    otpBoxes: $$('.otp-box'),
    otpMethodMsg: $('#otpMethodMsg'),
    otpCountdown: $('#otpCountdown'),
    btnResendOtp: $('#btnResendOtp'),
    btnSubmitOtp: $('#btnSubmitOtp'),
    backToStep1: $('#backToStep1'),

    // Step 3 — Reset Password
    resetForm: $('#resetForm'),
    newPassword: $('#newPassword'),
    confirmPassword: $('#confirmPassword'),
    passwordStrength: $('#passwordStrength'),
    strengthFill: $('#strengthFill'),
    strengthLabel: $('#strengthLabel'),
    btnResetPassword: $('#btnResetPassword'),

    // Toast
    toast: $('#toast'),

    // Particles
    heroParticles: $('#heroParticles'),
  };

  // ─── State ───
  let captchaCode = '';
  let lastSubmittedInput = '';
  let resetToken = '';
  let otpTimerInterval = null;

  // ═══════════════════════════════════════════════════════════
  //  CAPTCHA GENERATOR
  // ═══════════════════════════════════════════════════════════
  function generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    captchaCode = '';
    for (let i = 0; i < 5; i++) {
      captchaCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    drawCaptcha();
  }

  function drawCaptcha() {
    const canvas = dom.captchaCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#13131e';
    ctx.fillRect(0, 0, W, H);

    // Noise lines
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.lineTo(Math.random() * W, Math.random() * H);
      ctx.strokeStyle = `rgba(220, 38, 38, ${0.15 + Math.random() * 0.15})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Noise dots
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.random() * 0.15})`;
      ctx.fill();
    }

    // Text
    ctx.textBaseline = 'middle';
    const charWidth = W / (captchaCode.length + 1);
    for (let i = 0; i < captchaCode.length; i++) {
      const fontSize = 20 + Math.random() * 6;
      ctx.font = `${Math.random() > 0.5 ? 'bold ' : ''}${fontSize}px 'Inter', monospace`;
      const lightness = 55 + Math.random() * 25;
      ctx.fillStyle = `hsl(0, 70%, ${lightness}%)`;
      const x = charWidth * (i + 0.5) + (Math.random() - 0.5) * 6;
      const y = H / 2 + (Math.random() - 0.5) * 10;
      const angle = (Math.random() - 0.5) * 0.4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(captchaCode[i], 0, 0);
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TOAST
  // ═══════════════════════════════════════════════════════════
  let toastTimeout = null;

  function showToast(message, type = 'info') {
    clearTimeout(toastTimeout);
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    dom.toast.className = `toast ${type}`;
    dom.toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;
    dom.toast.classList.add('show');
    toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 4000);
  }

  // ═══════════════════════════════════════════════════════════
  //  VALIDATION HELPERS
  // ═══════════════════════════════════════════════════════════
  function setError(input, msg) {
    input.classList.add('error');
    input.classList.remove('success');
    const existing = input.closest('.input-group, .otp-input-group')?.querySelector('.field-error');
    if (existing) existing.remove();
    const errorEl = document.createElement('p');
    errorEl.className = 'field-error';
    errorEl.style.cssText = 'color: #ef4444; font-size: 0.75rem; margin-top: 6px; font-weight: 500;';
    errorEl.textContent = msg;
    const insertTarget = input.closest('.captcha-row') || input.closest('.input-wrapper') || input.closest('.otp-boxes');
    if (insertTarget) insertTarget.insertAdjacentElement('afterend', errorEl);
  }

  function clearError(input) {
    input.classList.remove('error');
    const existing = input.closest('.input-group, .otp-input-group')?.querySelector('.field-error');
    if (existing) existing.remove();
  }

  function clearAllErrors() {
    $$('.input-wrapper input, .otp-box').forEach(inp => inp.classList.remove('error', 'success'));
    $$('.field-error').forEach(el => el.remove());
  }

  function validateEmail(value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  // ═══════════════════════════════════════════════════════════
  //  BUTTON LOADING STATE
  // ═══════════════════════════════════════════════════════════
  function setLoading(btn, loading) {
    if (!btn) return;
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
  //  STEP NAVIGATION
  // ═══════════════════════════════════════════════════════════
  function goToStep(stepNum) {
    [dom.step1, dom.step2, dom.step3, dom.step4].forEach(s => s.classList.remove('active'));
    const targets = { 1: dom.step1, 2: dom.step2, 3: dom.step3, 4: dom.step4 };
    const target = targets[stepNum];
    if (target) {
      target.classList.add('active');
      target.style.animation = 'none';
      target.offsetHeight;
      target.style.animation = '';
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  OTP COUNTDOWN TIMER (5 minutes)
  // ═══════════════════════════════════════════════════════════
  function startOtpCountdown() {
    let remaining = 5 * 60; // 5 phút
    dom.btnResendOtp.disabled = true;

    clearInterval(otpTimerInterval);
    otpTimerInterval = setInterval(() => {
      remaining--;
      const min = String(Math.floor(remaining / 60)).padStart(2, '0');
      const sec = String(remaining % 60).padStart(2, '0');
      dom.otpCountdown.textContent = `${min}:${sec}`;

      if (remaining <= 0) {
        clearInterval(otpTimerInterval);
        dom.otpCountdown.textContent = '00:00';
        dom.btnResendOtp.disabled = false;
      }
    }, 1000);
  }

  // ═══════════════════════════════════════════════════════════
  //  OTP INPUT BOXES — Auto-focus, auto-advance, paste support
  // ═══════════════════════════════════════════════════════════
  function setupOtpBoxes() {
    dom.otpBoxes.forEach((box, idx) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value;
        // Only allow digits
        e.target.value = val.replace(/[^0-9]/g, '');

        if (e.target.value && idx < dom.otpBoxes.length - 1) {
          dom.otpBoxes[idx + 1].focus();
        }

        // Add filled class
        box.classList.toggle('filled', !!e.target.value);
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          dom.otpBoxes[idx - 1].focus();
          dom.otpBoxes[idx - 1].value = '';
          dom.otpBoxes[idx - 1].classList.remove('filled');
        }
      });

      box.addEventListener('focus', () => {
        box.select();
        clearError(box);
      });
    });

    // Paste support
    dom.otpBoxes[0]?.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      pasted.split('').forEach((char, i) => {
        if (dom.otpBoxes[i]) {
          dom.otpBoxes[i].value = char;
          dom.otpBoxes[i].classList.add('filled');
        }
      });
      // Focus last filled or next empty
      const nextIdx = Math.min(pasted.length, dom.otpBoxes.length - 1);
      dom.otpBoxes[nextIdx].focus();
    });
  }

  function getOtpValue() {
    return Array.from(dom.otpBoxes).map(b => b.value).join('');
  }

  function clearOtpBoxes() {
    dom.otpBoxes.forEach(b => {
      b.value = '';
      b.classList.remove('filled', 'error', 'success');
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  PASSWORD STRENGTH METER
  // ═══════════════════════════════════════════════════════════
  function setupPasswordStrength() {
    if (!dom.newPassword) return;
    dom.newPassword.addEventListener('input', () => {
      const val = dom.newPassword.value;
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
      fill.className = 'strength-fill';
      label.className = 'strength-label';

      if (score <= 2) {
        fill.classList.add('weak'); label.classList.add('weak'); label.textContent = 'Yếu';
      } else if (score <= 3) {
        fill.classList.add('medium'); label.classList.add('medium'); label.textContent = 'Trung bình';
      } else {
        fill.classList.add('strong'); label.classList.add('strong'); label.textContent = 'Mạnh';
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  PASSWORD TOGGLE
  // ═══════════════════════════════════════════════════════════
  function setupPasswordToggle() {
    $$('.toggle-password').forEach(btn => {
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
  }

  // ═══════════════════════════════════════════════════════════
  //  STEP 1: SUBMIT — Forgot Password (Send OTP)
  // ═══════════════════════════════════════════════════════════
  dom.forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email = dom.forgotEmail.value.trim();
    const captcha = dom.captchaInput.value.trim();
    let hasError = false;

    if (!email) {
      setError(dom.forgotEmail, 'Vui lòng nhập địa chỉ email.');
      hasError = true;
    } else if (!validateEmail(email)) {
      setError(dom.forgotEmail, 'Email không hợp lệ.');
      hasError = true;
    }

    if (!captcha) {
      setError(dom.captchaInput, 'Vui lòng nhập mã captcha.');
      hasError = true;
    } else if (captcha.toLowerCase() !== captchaCode.toLowerCase()) {
      setError(dom.captchaInput, 'Mã captcha không đúng.');
      generateCaptcha();
      dom.captchaInput.value = '';
      hasError = true;
    }

    if (hasError) {
      dom.forgotForm.classList.add('shake');
      setTimeout(() => dom.forgotForm.classList.remove('shake'), 500);
      return;
    }

    setLoading(dom.btnSubmitStep1, true);
    lastSubmittedInput = email;

    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || 'Có lỗi xảy ra.', 'error');
        setLoading(dom.btnSubmitStep1, false);
        generateCaptcha();
        dom.captchaInput.value = '';
        return;
      }

      // Success → go to Step 2 (OTP)
      showToast(data.message, 'success');

      // Update method message
      dom.otpMethodMsg.textContent = `Mã OTP 6 chữ số đã được gửi đến email ${maskValue(email)}.`;

      goToStep(2);
      clearOtpBoxes();
      dom.otpBoxes[0]?.focus();
      startOtpCountdown();

    } catch (err) {
      console.error('[ForgotPassword] Error:', err);
      showToast('Không thể kết nối tới server.', 'error');
    } finally {
      setLoading(dom.btnSubmitStep1, false);
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  STEP 2: SUBMIT — Verify OTP
  // ═══════════════════════════════════════════════════════════
  dom.otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const otp = getOtpValue();

    if (otp.length < 6) {
      dom.otpBoxes.forEach(b => b.classList.add('error'));
      showToast('Vui lòng nhập đủ 6 chữ số OTP.', 'error');
      return;
    }

    setLoading(dom.btnSubmitOtp, true);

    try {
      const res = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lastSubmittedInput, otp }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || 'Mã OTP không đúng.', 'error');
        dom.otpBoxes.forEach(b => b.classList.add('error'));
        setLoading(dom.btnSubmitOtp, false);
        return;
      }

      // Success → store resetToken → go to Step 3
      showToast('Xác minh thành công!', 'success');
      dom.otpBoxes.forEach(b => b.classList.add('success'));
      resetToken = data.resetToken;

      clearInterval(otpTimerInterval);

      setTimeout(() => goToStep(3), 600);

    } catch (err) {
      console.error('[VerifyOTP] Error:', err);
      showToast('Không thể kết nối tới server.', 'error');
    } finally {
      setLoading(dom.btnSubmitOtp, false);
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  STEP 2: RESEND OTP
  // ═══════════════════════════════════════════════════════════
  dom.btnResendOtp?.addEventListener('click', async () => {
    if (!lastSubmittedInput) return;

    dom.btnResendOtp.disabled = true;
    dom.btnResendOtp.textContent = 'Đang gửi...';

    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lastSubmittedInput }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Đã gửi lại mã OTP!', 'success');
        clearOtpBoxes();
        dom.otpBoxes[0]?.focus();
        startOtpCountdown();
      } else {
        showToast(data.message || 'Gửi lại thất bại.', 'error');
        dom.btnResendOtp.disabled = false;
      }
    } catch (err) {
      showToast('Không thể kết nối tới server.', 'error');
      dom.btnResendOtp.disabled = false;
    }

    dom.btnResendOtp.textContent = 'Gửi lại mã';
  });

  // ═══════════════════════════════════════════════════════════
  //  STEP 2: BACK BUTTON
  // ═══════════════════════════════════════════════════════════
  dom.backToStep1?.addEventListener('click', () => {
    clearInterval(otpTimerInterval);
    goToStep(1);
    generateCaptcha();
    dom.captchaInput.value = '';
  });

  // ═══════════════════════════════════════════════════════════
  //  STEP 3: SUBMIT — Reset Password
  // ═══════════════════════════════════════════════════════════
  dom.resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const newPass = dom.newPassword.value;
    const confirmPass = dom.confirmPassword.value;
    let hasError = false;

    if (!newPass) {
      setError(dom.newPassword, 'Vui lòng nhập mật khẩu mới.');
      hasError = true;
    } else if (newPass.length < 6) {
      setError(dom.newPassword, 'Mật khẩu phải có ít nhất 6 ký tự.');
      hasError = true;
    }

    if (!confirmPass) {
      setError(dom.confirmPassword, 'Vui lòng xác nhận mật khẩu.');
      hasError = true;
    } else if (newPass !== confirmPass) {
      setError(dom.confirmPassword, 'Mật khẩu xác nhận không khớp.');
      hasError = true;
    }

    if (hasError) {
      dom.resetForm.classList.add('shake');
      setTimeout(() => dom.resetForm.classList.remove('shake'), 500);
      return;
    }

    setLoading(dom.btnResetPassword, true);

    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: newPass }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || 'Đổi mật khẩu thất bại.', 'error');
        setLoading(dom.btnResetPassword, false);
        return;
      }

      // Success → go to Step 4
      showToast('Đổi mật khẩu thành công!', 'success');
      goToStep(4);

    } catch (err) {
      console.error('[ResetPassword] Error:', err);
      showToast('Không thể kết nối tới server.', 'error');
    } finally {
      setLoading(dom.btnResetPassword, false);
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  HELPER: Mask email/phone for display
  // ═══════════════════════════════════════════════════════════
  function maskValue(value) {
    if (value.includes('@')) {
      // Email: na***@example.com
      const [local, domain] = value.split('@');
      return local.slice(0, 2) + '***@' + domain;
    } else {
      // Phone: 090***4567
      return value.slice(0, 3) + '***' + value.slice(-4);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  FLOATING PARTICLES
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
  $$('.input-wrapper input').forEach(input => {
    input.addEventListener('blur', () => {
      if (input.value.trim() && !input.classList.contains('error')) {
        input.classList.add('success');
      }
    });
    input.addEventListener('focus', () => clearError(input));
  });

  // ═══════════════════════════════════════════════════════════
  //  CAPTCHA REFRESH
  // ═══════════════════════════════════════════════════════════
  dom.captchaRefresh?.addEventListener('click', () => {
    generateCaptcha();
    dom.captchaInput.value = '';
    clearError(dom.captchaInput);
  });

  // ═══════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════
  function init() {
    createParticles();
    generateCaptcha();
    setupOtpBoxes();
    setupPasswordStrength();
    setupPasswordToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
