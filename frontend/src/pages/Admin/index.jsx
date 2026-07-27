import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminApi, voucherApi } from '../../services/api';
import '../../assets/css/admin.css';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`admin-toast admin-toast-${type}`}>
      {message}
      <button onClick={onClose} className="toast-close">&times;</button>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

const AdminPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState(null);
  
  // States for Tabs
  const [dashboardData, setDashboardData] = useState(null);
  const [movies, setMovies] = useState([]);
  const [users, setUsers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [movieModal, setMovieModal] = useState({ isOpen: false, data: null });
  const [voucherModal, setVoucherModal] = useState({ isOpen: false, data: null });
  const [newsModal, setNewsModal] = useState({ isOpen: false, data: null });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!token || (user?.role !== 'Admin' && user?.role !== 'Staff')) {
      navigate('/');
    }
  }, [user, token, navigate]);

  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab]);

  const loadTabContent = async (tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'dashboard':
          const dbData = await adminApi.getDashboard();
          setDashboardData(dbData);
          break;
        case 'movies':
          const mvData = await adminApi.getMovies();
          setMovies(mvData);
          break;
        case 'users':
          const usrData = await adminApi.getUsers();
          setUsers(usrData);
          break;
        case 'vouchers':
          const vcData = await voucherApi.getVouchers();
          setVouchers(vcData);
          break;
        case 'refunds':
          const rfData = await adminApi.getRefunds?.() || []; // Fallback if not implemented in api
          setRefunds(rfData);
          break;
        case 'news':
          const nwData = await adminApi.getNews?.() || [];
          setNews(nwData);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMovieSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    setLoading(true);
    try {
      if (movieModal.data) {
        await adminApi.updateMovie(movieModal.data.id, data);
        showToast('Cập nhật phim thành công');
      } else {
        await adminApi.createMovie(data);
        showToast('Thêm phim thành công');
      }
      setMovieModal({ isOpen: false, data: null });
      loadTabContent('movies');
    } catch (error) {
      showToast('Lỗi khi lưu phim', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMovie = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá phim này?')) {
      setLoading(true);
      try {
        await adminApi.deleteMovie(id);
        showToast('Xoá phim thành công');
        loadTabContent('movies');
      } catch (error) {
        showToast('Lỗi khi xoá phim', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    setLoading(true);
    try {
      const newStatus = currentStatus === 'Active' ? 'Banned' : 'Active';
      await adminApi.updateUserStatus?.(userId, newStatus);
      showToast('Cập nhật trạng thái người dùng thành công');
      loadTabContent('users');
    } catch (error) {
      showToast('Lỗi khi cập nhật trạng thái', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVoucherSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    setLoading(true);
    try {
      if (voucherModal.data) {
        await voucherApi.updateVoucher(voucherModal.data.id, data);
        showToast('Cập nhật voucher thành công');
      } else {
        await voucherApi.createVoucher(data);
        showToast('Thêm voucher thành công');
      }
      setVoucherModal({ isOpen: false, data: null });
      loadTabContent('vouchers');
    } catch (error) {
      showToast('Lỗi khi lưu voucher', 'error');
    } finally {
      setLoading(false);
    }
  };

  const processRefund = async (id, status) => {
    setLoading(true);
    try {
      await adminApi.processRefund?.(id, status);
      showToast(`Đã ${status === 'Approved' ? 'duyệt' : 'từ chối'} yêu cầu hoàn vé`);
      loadTabContent('refunds');
    } catch (error) {
      showToast('Lỗi khi xử lý hoàn vé', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderDashboard = () => (
    <div className="tab-pane">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Tổng Doanh Thu</h3>
          <p>{dashboardData?.totalRevenue?.toLocaleString('vi-VN')} đ</p>
        </div>
        <div className="stat-card">
          <h3>Tổng Lượt Đặt</h3>
          <p>{dashboardData?.totalBookings}</p>
        </div>
        <div className="stat-card">
          <h3>Phim Đang Chiếu</h3>
          <p>{dashboardData?.activeMovies}</p>
        </div>
        <div className="stat-card">
          <h3>Tổng Người Dùng</h3>
          <p>{dashboardData?.totalUsers}</p>
        </div>
      </div>
      <div className="dashboard-section mt-4">
        <h3>Lượt đặt vé gần đây</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Người dùng</th>
              <th>Phim</th>
              <th>Tổng tiền</th>
              <th>Ngày đặt</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(dashboardData?.recentBookings || []).map(b => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.userName}</td>
                <td>{b.movieTitle}</td>
                <td>{b.totalAmount}</td>
                <td>{b.bookingDate}</td>
                <td>{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dashboard-section mt-4">
        <h3>Biểu Đồ Doanh Thu (Giả lập)</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tuần</th>
              <th>Doanh Thu</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Tuần 1</td><td>15,000,000 đ</td></tr>
            <tr><td>Tuần 2</td><td>22,000,000 đ</td></tr>
            <tr><td>Tuần 3</td><td>18,500,000 đ</td></tr>
            <tr><td>Tuần 4</td><td>30,000,000 đ</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMovies = () => (
    <div className="tab-pane">
      <div className="action-bar mb-3">
        <button className="action-btn" onClick={() => setMovieModal({ isOpen: true, data: null })}>+ Thêm Phim</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tên Phim</th>
            <th>Thể Loại</th>
            <th>Trạng Thái</th>
            <th>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {movies.map(m => (
            <tr key={m.id}>
              <td>{m.id}</td>
              <td>{m.title}</td>
              <td>{m.genre}</td>
              <td>{m.status}</td>
              <td>
                <button className="action-btn edit-btn" onClick={() => setMovieModal({ isOpen: true, data: m })}>Sửa</button>
                <button className="action-btn delete-btn" onClick={() => handleDeleteMovie(m.id)}>Xoá</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderUsers = () => (
    <div className="tab-pane">
      <table className="data-table">
        <thead>
          <tr>
            <th>User ID</th>
            <th>Họ Tên</th>
            <th>Email</th>
            <th>Vai Trò</th>
            <th>Ngày Tạo</th>
            <th>Trạng Thái</th>
            <th>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.fullName}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.createdAt}</td>
              <td>{u.status}</td>
              <td>
                <button 
                  className={`action-btn ${u.status === 'Active' ? 'ban-btn' : 'unban-btn'}`}
                  onClick={() => toggleUserStatus(u.id, u.status)}
                >
                  {u.status === 'Active' ? 'Ban' : 'Unban'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderVouchers = () => (
    <div className="tab-pane">
      <div className="action-bar mb-3">
        <button className="action-btn" onClick={() => setVoucherModal({ isOpen: true, data: null })}>+ Thêm Voucher</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Loại</th>
            <th>Giá Trị</th>
            <th>Đơn Tối Thiểu</th>
            <th>Hạn Sử Dụng</th>
            <th>Lượt dùng</th>
            <th>Trạng Thái</th>
            <th>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map(v => (
            <tr key={v.id}>
              <td>{v.voucherCode}</td>
              <td>{v.discountType}</td>
              <td>{v.discountValue}</td>
              <td>{v.minOrder}</td>
              <td>{v.expiry}</td>
              <td>{v.usageLimit}</td>
              <td>{v.status}</td>
              <td>
                <button className="action-btn edit-btn" onClick={() => setVoucherModal({ isOpen: true, data: v })}>Sửa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRefunds = () => (
    <div className="tab-pane">
      <table className="data-table">
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>Người Dùng</th>
            <th>Phim</th>
            <th>Số Tiền</th>
            <th>Lý Do</th>
            <th>Trạng Thái</th>
            <th>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {refunds.map(r => (
            <tr key={r.id}>
              <td>{r.bookingId}</td>
              <td>{r.user}</td>
              <td>{r.movie}</td>
              <td>{r.amount}</td>
              <td>{r.reason}</td>
              <td>{r.status}</td>
              <td>
                {r.status === 'Pending' && (
                  <>
                    <button className="action-btn success-btn mr-2" onClick={() => processRefund(r.id, 'Approved')}>Duyệt</button>
                    <button className="action-btn danger-btn" onClick={() => processRefund(r.id, 'Rejected')}>Từ Chối</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderNews = () => (
    <div className="tab-pane">
      <div className="action-bar mb-3">
        <button className="action-btn" onClick={() => setNewsModal({ isOpen: true, data: null })}>+ Thêm Tin Tức</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Tiêu đề</th>
            <th>Danh Mục</th>
            <th>Ngày Đăng</th>
            <th>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {news.map(n => (
            <tr key={n.id}>
              <td>{n.title}</td>
              <td>{n.category}</td>
              <td>{n.publishDate}</td>
              <td>
                <button className="action-btn edit-btn" onClick={() => setNewsModal({ isOpen: true, data: n })}>Sửa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPlaceholder = (title) => (
    <div className="tab-pane">
      <h2>{title} - Đang phát triển</h2>
    </div>
  );

  const renderContent = () => {
    if (loading) return <div className="loading-spinner">Đang tải...</div>;
    
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'movies': return renderMovies();
      case 'users': return renderUsers();
      case 'vouchers': return renderVouchers();
      case 'refunds': return renderRefunds();
      case 'news': return renderNews();
      case 'cinemas': return renderPlaceholder('Quản Lý Rạp');
      case 'showtimes': return renderPlaceholder('Quản Lý Suất Chiếu');
      case 'bookings': return renderPlaceholder('Quản Lý Đặt Vé');
      case 'settings': return renderPlaceholder('Cài Đặt');
      default: return null;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Tổng Quan' },
    { id: 'movies', label: 'Quản Lý Phim' },
    { id: 'cinemas', label: 'Quản Lý Rạp' },
    { id: 'showtimes', label: 'Quản Lý Suất Chiếu' },
    { id: 'bookings', label: 'Quản Lý Đặt Vé' },
    { id: 'users', label: 'Quản Lý Người Dùng' },
    { id: 'vouchers', label: 'Quản Lý Voucher' },
    { id: 'refunds', label: 'Yêu Cầu Hoàn Vé' },
    { id: 'news', label: 'Tin Tức' },
    { id: 'settings', label: 'Cài Đặt' }
  ];

  return (
    <div className="admin-layout">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className={`admin-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>D-Cinema Admin</h2>
          <button className="toggle-sidebar-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="admin-content">
        <header className="admin-header">
          <h1>{navItems.find(i => i.id === activeTab)?.label}</h1>
          <div className="user-profile">
            <span>Chào, {user?.fullName || 'Admin'}</span>
          </div>
        </header>

        <main className="admin-main">
          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      <Modal 
        isOpen={movieModal.isOpen} 
        onClose={() => setMovieModal({ isOpen: false, data: null })}
        title={movieModal.data ? 'Sửa Phim' : 'Thêm Phim'}
      >
        <form onSubmit={handleMovieSubmit} className="admin-form">
          <div className="form-group">
            <label>Tên Phim</label>
            <input type="text" name="title" defaultValue={movieModal.data?.title || ''} required />
          </div>
          <div className="form-group">
            <label>Mô tả</label>
            <textarea name="description" defaultValue={movieModal.data?.description || ''}></textarea>
          </div>
          <div className="form-group">
            <label>Thời lượng (phút)</label>
            <input type="number" name="duration" defaultValue={movieModal.data?.duration || ''} required />
          </div>
          <div className="form-group">
            <label>Thể loại</label>
            <input type="text" name="genre" defaultValue={movieModal.data?.genre || ''} />
          </div>
          <div className="form-group">
            <label>Độ tuổi</label>
            <input type="text" name="ageRating" defaultValue={movieModal.data?.ageRating || ''} />
          </div>
          <div className="form-group">
            <label>Trạng thái</label>
            <select name="status" defaultValue={movieModal.data?.status || 'Active'}>
              <option value="Active">Đang chiếu</option>
              <option value="Coming">Sắp chiếu</option>
              <option value="Ended">Đã kết thúc</option>
            </select>
          </div>
          <div className="form-group">
            <label>Poster URL</label>
            <input type="text" name="posterURL" defaultValue={movieModal.data?.posterURL || ''} />
          </div>
          <div className="form-group">
            <label>Trailer URL</label>
            <input type="text" name="trailerURL" defaultValue={movieModal.data?.trailerURL || ''} />
          </div>
          <div className="form-group">
            <label>Đạo diễn</label>
            <input type="text" name="director" defaultValue={movieModal.data?.director || ''} />
          </div>
          <div className="form-group">
            <label>Diễn viên chính</label>
            <input type="text" name="mainCast" defaultValue={movieModal.data?.mainCast || ''} />
          </div>
          <div className="form-group">
            <label>Định dạng (2D, 3D...)</label>
            <input type="text" name="formats" defaultValue={movieModal.data?.formats || ''} />
          </div>
          <div className="form-actions">
            <button type="submit" className="action-btn success-btn">Lưu</button>
            <button type="button" className="action-btn" onClick={() => setMovieModal({ isOpen: false, data: null })}>Huỷ</button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={voucherModal.isOpen} 
        onClose={() => setVoucherModal({ isOpen: false, data: null })}
        title={voucherModal.data ? 'Sửa Voucher' : 'Thêm Voucher'}
      >
        <form onSubmit={handleVoucherSubmit} className="admin-form">
          <div className="form-group">
            <label>Mã Voucher</label>
            <input type="text" name="voucherCode" defaultValue={voucherModal.data?.voucherCode || ''} required />
          </div>
          <div className="form-group">
            <label>Loại giảm giá (Percentage, Fixed)</label>
            <select name="discountType" defaultValue={voucherModal.data?.discountType || 'Percentage'}>
              <option value="Percentage">Phần trăm</option>
              <option value="Fixed">Số tiền cố định</option>
            </select>
          </div>
          <div className="form-group">
            <label>Giá trị giảm</label>
            <input type="number" name="discountValue" defaultValue={voucherModal.data?.discountValue || ''} required />
          </div>
          <div className="form-group">
            <label>Đơn tối thiểu</label>
            <input type="number" name="minOrder" defaultValue={voucherModal.data?.minOrder || 0} />
          </div>
          <div className="form-group">
            <label>Hạn sử dụng</label>
            <input type="date" name="expiry" defaultValue={voucherModal.data?.expiry || ''} />
          </div>
          <div className="form-group">
            <label>Lượt sử dụng tối đa</label>
            <input type="number" name="usageLimit" defaultValue={voucherModal.data?.usageLimit || ''} />
          </div>
          <div className="form-group">
            <label>Trạng thái</label>
            <select name="status" defaultValue={voucherModal.data?.status || 'Active'}>
              <option value="Active">Hoạt động</option>
              <option value="Inactive">Không hoạt động</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" className="action-btn success-btn">Lưu</button>
            <button type="button" className="action-btn" onClick={() => setVoucherModal({ isOpen: false, data: null })}>Huỷ</button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={newsModal.isOpen} 
        onClose={() => setNewsModal({ isOpen: false, data: null })}
        title={newsModal.data ? 'Sửa Tin Tức' : 'Thêm Tin Tức'}
      >
        <form className="admin-form" onSubmit={(e) => { e.preventDefault(); /* TBD Submit News */ }}>
          <div className="form-group">
            <label>Tiêu đề</label>
            <input type="text" name="title" defaultValue={newsModal.data?.title || ''} required />
          </div>
          <div className="form-group">
            <label>Danh mục</label>
            <input type="text" name="category" defaultValue={newsModal.data?.category || ''} />
          </div>
          <div className="form-group">
            <label>Nội dung</label>
            <textarea name="content" defaultValue={newsModal.data?.content || ''}></textarea>
          </div>
          <div className="form-group">
            <label>URL Hình ảnh</label>
            <input type="text" name="imageURL" defaultValue={newsModal.data?.imageURL || ''} />
          </div>
          <div className="form-group">
            <label>Ngày xuất bản</label>
            <input type="date" name="publishDate" defaultValue={newsModal.data?.publishDate || ''} />
          </div>
          <div className="form-actions">
            <button type="submit" className="action-btn success-btn">Lưu</button>
            <button type="button" className="action-btn" onClick={() => setNewsModal({ isOpen: false, data: null })}>Huỷ</button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default AdminPage;
