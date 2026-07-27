import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import userApi from '../../services/api';
import '../../assets/css/profile.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, token, updateAuthUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  
  // Profile state
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: ''
  });
  const fileInputRef = useRef(null);

  // Booking history state
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Refund requests state
  const [refundRequests, setRefundRequests] = useState([]);

  useEffect(() => {
    if (!token) {
      navigate('/auth');
      return;
    }

    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.substring(0, 10) : ''
      });
    }
  }, [token, user, navigate]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchBookingHistory();
    } else if (activeTab === 'refunds') {
      fetchRefundRequests();
    }
  }, [activeTab]);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchBookingHistory = async () => {
    setIsLoadingBookings(true);
    try {
      const response = await userApi.getBookingHistory();
      if (response.data && response.data.success) {
        setBookings(response.data.bookings || []);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      showToast('Không thể tải lịch sử đặt vé.', 'error');
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const fetchRefundRequests = async () => {
    try {
      // Assuming a method exists to get refund requests
      // const response = await userApi.getRefundRequests();
      // setRefundRequests(response.data.requests || []);
      setRefundRequests([]); // Mock empty for now
    } catch (error) {
      console.error("Error fetching refund requests:", error);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const submitProfileUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await userApi.updateProfile({
        fullName: profileData.fullName,
        phone: profileData.phone,
        dateOfBirth: profileData.dateOfBirth
      });
      if (response.data && response.data.success) {
        showToast('Cập nhật hồ sơ thành công!');
        if (updateAuthUser) updateAuthUser(response.data.user);
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp.', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await userApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      if (response.data && response.data.success) {
        showToast('Đổi mật khẩu thành công!');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Có lỗi xảy ra khi đổi mật khẩu.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await userApi.uploadAvatar(formData);
      if (response.data && response.data.success) {
        showToast('Cập nhật ảnh đại diện thành công!');
        if (updateAuthUser) updateAuthUser(response.data.user);
      }
    } catch (error) {
      showToast('Lỗi khi tải ảnh lên.', 'error');
    }
  };

  const cancelBooking = async (bookingId) => {
    if (window.confirm('Bạn có chắc chắn muốn hủy vé này?')) {
      try {
        const response = await userApi.cancelBooking(bookingId);
        if (response.data && response.data.success) {
          showToast('Đã hủy vé thành công!');
          fetchBookingHistory();
        }
      } catch (error) {
        showToast(error.response?.data?.message || 'Không thể hủy vé.', 'error');
      }
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const renderStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'confirmed':
        return <span className="status-badge confirmed">Đã xác nhận</span>;
      case 'pending':
        return <span className="status-badge pending">Đang chờ</span>;
      case 'cancelled':
        return <span className="status-badge cancelled">Đã hủy</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const isCancelable = (showtimeStr) => {
    if (!showtimeStr) return false;
    const showtime = new Date(showtimeStr);
    const now = new Date();
    const diffHours = (showtime - now) / (1000 * 60 * 60);
    return diffHours > 2;
  };

  if (!user) return <div className="profile-loading">Đang tải...</div>;

  return (
    <div className="profile-page-container">
      {toastMessage && (
        <div className={`toast-message toast-${toastMessage.type}`}>
          {toastMessage.message}
        </div>
      )}

      {/* User Info Card on Top */}
      <div className="profile-header-card">
        <div className="profile-avatar-container" onClick={handleAvatarClick}>
          {user.avatar ? (
            <img 
              src={user.avatar.startsWith('http') ? user.avatar : `/uploads/avatars/${user.avatar}`} 
              alt="User avatar" 
              className="profile-avatar-img"
            />
          ) : (
            <div className="profile-avatar-placeholder">
              {getInitials(user.fullName)}
            </div>
          )}
          <div className="avatar-upload-overlay">
            <i className="fas fa-camera"></i>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleAvatarChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
        </div>
        <div className="profile-header-info">
          <h2>{user.fullName || 'Người dùng'}</h2>
          <p>{user.email}</p>
          <div className="profile-badges">
            <span className="role-badge">{user.role === 'admin' ? 'Quản trị viên' : 'Thành viên D-Cinema'}</span>
            {user.createdAt && (
              <span className="member-since">Thành viên từ: {new Date(user.createdAt).toLocaleDateString('vi-VN')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="profile-content-wrapper">
        {/* Sidebar Navigation */}
        <div className="profile-sidebar">
          <button 
            className={`sidebar-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <i className="fas fa-user profile-icon"></i>
            <span>Hồ Sơ Cá Nhân</span>
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <i className="fas fa-ticket-alt profile-icon"></i>
            <span>Lịch Sử Đặt Vé</span>
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            <i className="fas fa-lock profile-icon"></i>
            <span>Đổi Mật Khẩu</span>
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'refunds' ? 'active' : ''}`}
            onClick={() => setActiveTab('refunds')}
          >
            <i className="fas fa-undo-alt profile-icon"></i>
            <span>Yêu Cầu Hoàn Vé</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="profile-main-content">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="tab-pane active fade-in">
              <h3 className="pane-title">Hồ Sơ Cá Nhân</h3>
              <form onSubmit={submitProfileUpdate} className="profile-form">
                <div className="form-group">
                  <label>Họ và tên</label>
                  <input 
                    type="text" 
                    name="fullName" 
                    value={profileData.fullName} 
                    onChange={handleProfileChange}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input 
                    type="email" 
                    value={profileData.email} 
                    readOnly 
                    className="readonly-input"
                  />
                  <small>Email không thể thay đổi</small>
                </div>
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input 
                    type="tel" 
                    name="phone" 
                    value={profileData.phone} 
                    onChange={handleProfileChange} 
                  />
                </div>
                <div className="form-group">
                  <label>Ngày sinh</label>
                  <input 
                    type="date" 
                    name="dateOfBirth" 
                    value={profileData.dateOfBirth} 
                    onChange={handleProfileChange} 
                  />
                </div>
                <button type="submit" className="btn-save-profile" disabled={isLoading}>
                  {isLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </form>
            </div>
          )}

          {/* BOOKING HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="tab-pane active fade-in">
              <h3 className="pane-title">Lịch Sử Đặt Vé</h3>
              
              {isLoadingBookings ? (
                <div className="loading-spinner">Đang tải lịch sử...</div>
              ) : bookings.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-ticket-alt empty-icon"></i>
                  <p>Bạn chưa có lịch sử đặt vé nào.</p>
                  <button className="btn-book-now" onClick={() => navigate('/')}>
                    Đặt vé ngay
                  </button>
                </div>
              ) : (
                <div className="bookings-list">
                  {bookings.map(booking => (
                    <div className="booking-history-card" key={booking._id || booking.id}>
                      <div className="booking-poster">
                        <img 
                          src={booking.movie?.posterUrl || '/placeholder-movie.jpg'} 
                          alt={booking.movie?.title || 'Movie'} 
                        />
                      </div>
                      <div className="booking-details">
                        <h4>{booking.movie?.title || 'Tên phim không có'}</h4>
                        <p className="cinema-info">
                          <i className="fas fa-map-marker-alt"></i> {booking.cinema?.name || 'Rạp D-Cinema'}
                        </p>
                        <p className="showtime-info">
                          <i className="far fa-clock"></i> {new Date(booking.showtime).toLocaleString('vi-VN')}
                        </p>
                        <p className="seats-info">
                          <i className="fas fa-chair"></i> Ghế: {booking.seats?.join(', ') || ''}
                        </p>
                        <div className="booking-bottom-row">
                          <span className="total-amount">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(booking.totalAmount || 0)}
                          </span>
                          {renderStatusBadge(booking.status)}
                        </div>
                      </div>
                      <div className="booking-actions">
                        {booking.status?.toLowerCase() === 'confirmed' && (
                          <button className="btn-view-ticket" onClick={() => navigate(`/ticket/${booking._id || booking.id}`)}>
                            Xem vé
                          </button>
                        )}
                        {booking.status?.toLowerCase() === 'pending' && isCancelable(booking.showtime) && (
                          <button className="btn-cancel-ticket" onClick={() => cancelBooking(booking._id || booking.id)}>
                            Hủy vé
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CHANGE PASSWORD TAB */}
          {activeTab === 'password' && (
            <div className="tab-pane active fade-in">
              <h3 className="pane-title">Đổi Mật Khẩu</h3>
              <form onSubmit={submitPasswordChange} className="password-form">
                <div className="form-group">
                  <label>Mật khẩu hiện tại</label>
                  <input 
                    type="password" 
                    name="currentPassword" 
                    value={passwordData.currentPassword} 
                    onChange={handlePasswordChange}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <input 
                    type="password" 
                    name="newPassword" 
                    value={passwordData.newPassword} 
                    onChange={handlePasswordChange}
                    required 
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label>Xác nhận mật khẩu mới</label>
                  <input 
                    type="password" 
                    name="confirmPassword" 
                    value={passwordData.confirmPassword} 
                    onChange={handlePasswordChange}
                    required 
                    minLength={6}
                  />
                </div>
                <button type="submit" className="btn-save-password" disabled={isLoading}>
                  {isLoading ? 'Đang cập nhật...' : 'Đổi Mật Khẩu'}
                </button>
              </form>
            </div>
          )}

          {/* REFUND REQUESTS TAB */}
          {activeTab === 'refunds' && (
            <div className="tab-pane active fade-in">
              <div className="refunds-header">
                <h3 className="pane-title">Yêu Cầu Hoàn Vé</h3>
                <button className="btn-request-refund" onClick={() => navigate('/refund-request')}>
                  + Tạo Yêu Cầu Mới
                </button>
              </div>
              
              {refundRequests.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-undo-alt empty-icon"></i>
                  <p>Bạn không có yêu cầu hoàn vé nào.</p>
                </div>
              ) : (
                <div className="refunds-list">
                  {refundRequests.map(request => (
                    <div className="refund-card" key={request.id}>
                      <div className="refund-info">
                        <h5>Mã vé: {request.bookingId}</h5>
                        <p>Ngày yêu cầu: {new Date(request.createdAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                      <div className="refund-status">
                        {renderStatusBadge(request.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
