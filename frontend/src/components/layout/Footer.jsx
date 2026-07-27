import { Link } from 'react-router-dom';
import { useState } from 'react';
import '../../assets/css/shared-layout.css';

export default function Footer() {
  const [email, setEmail] = useState('');

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-col footer-brand">
          <Link to="/" className="logo">
            <span className="logo-d">D</span>
            <span className="logo-text">D-CINEMA</span>
          </Link>
          <p>Hệ thống rạp chiếu phim hiện đại, âm thanh sống động, trải nghiệm điện ảnh đỉnh cao.</p>
          <div className="footer-socials">
            <a href="#" aria-label="Share">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            </a>
            <a href="#" aria-label="Email">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h4>DỊCH VỤ</h4>
          <a href="#">Về chúng tôi</a>
          <a href="#">Tuyển dụng</a>
          <a href="#">Liên hệ</a>
        </div>

        <div className="footer-col">
          <h4>PHÁP LÝ</h4>
          <a href="#">Điều khoản sử dụng</a>
          <a href="#">Chính sách bảo mật</a>
          <a href="#">Chính sách thanh toán</a>
        </div>

        <div className="footer-col">
          <h4>ĐĂNG KÝ NHẬN TIN</h4>
          <p style={{ marginBottom: 5, fontSize: '0.8rem' }}>Nhận thông tin về phim mới và khuyến mãi.</p>
          <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Email của bạn"
              className="newsletter-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="newsletter-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2024 D-CINEMA STUDIOS. ALL RIGHTS RESERVED.</p>
      </div>
    </footer>
  );
}
