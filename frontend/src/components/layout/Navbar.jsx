import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/css/shared-layout.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState('');
  const [lang, setLang] = useState(localStorage.getItem('dcinema_lang') || 'vi');
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSearch(e) {
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate(`/movies?search=${encodeURIComponent(searchValue.trim())}`);
    }
  }

  function handleLangChange(e) {
    const newLang = e.target.value;
    setLang(newLang);
    localStorage.setItem('dcinema_lang', newLang);
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar">
      <div className="nav-container">
        <Link to="/" className="logo">
          <span className="logo-d">D</span>
          <span className="logo-text">D-CINEMA</span>
        </Link>

        <nav className="nav-links">
          <div className="dropdown">
            <Link to="/movies" className={isActive('/movies') ? 'active' : ''}>
              Phim <span className="nav-arrow">▾</span>
            </Link>
            <div className="dropdown-menu">
              <Link to="/movies?status=showing" className="dropdown-item">Đang chiếu</Link>
              <Link to="/movies?status=coming" className="dropdown-item">Sắp chiếu</Link>
            </div>
          </div>
          <Link to="/booking" className={isActive('/booking') ? 'active' : ''}>Rạp</Link>
          <Link to="/promotions" className={isActive('/promotions') ? 'active' : ''}>Promotions</Link>
          <Link to="/news" className={isActive('/news') ? 'active' : ''}>Tin Tức &amp; Sự Kiện</Link>
          <Link to="/ticket-prices" className={isActive('/ticket-prices') ? 'active' : ''}>Giá Vé</Link>
        </nav>

        <div className="nav-actions">
          <div className="search-box">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Tìm kiếm phim..."
              className="search-input"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>

          <select
            value={lang}
            onChange={handleLangChange}
            className="lang-switcher"
            style={{ marginRight: 15, marginLeft: 15, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', outline: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 14, backdropFilter: 'blur(5px)' }}
          >
            <option value="vi" style={{ color: 'black' }}>VI</option>
            <option value="en" style={{ color: 'black' }}>EN</option>
          </select>

          <Link to="/profile" className="nav-user-icon" title="Hồ sơ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>

          {user ? (
            <div className="dropdown">
              <button className="btn-login" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer' }}>
                {user.fullName || user.FullName || 'Tài khoản'} <span className="nav-arrow">▾</span>
              </button>
              <div className="dropdown-menu" style={{ right: 0, left: 'auto', transform: 'translateY(5px)' }}>
                <Link to="/profile" className="dropdown-item">Hồ sơ</Link>
                {(user.Role === 'Admin' || user.role === 'Admin') && (
                  <Link to="/admin" className="dropdown-item">Quản trị</Link>
                )}
                <button
                  onClick={handleLogout}
                  className="dropdown-item"
                  style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: '#e50914' }}
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          ) : (
            <Link to="/auth" className="btn-login">Đăng Nhập</Link>
          )}
        </div>
      </div>
    </header>
  );
}
