import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userApi } from '../../services/api';
import '../../assets/css/shared-layout.css';

const RefundRequestPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    const fetchBookings = async () => {
      try {
        const response = await userApi.getBookingHistory();
        // Filter eligible bookings: confirmed and future showtime
        const now = new Date();
        const eligibleBookings = response.data.filter(booking => 
          booking.status === 'confirmed' && new Date(booking.showtime) > now
        );
        setBookings(eligibleBookings);
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBooking) {
      setMessage({ type: 'error', text: 'Vui lòng chọn vé cần hoàn.' });
      return;
    }
    if (!reason.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập lý do hoàn vé.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await userApi.requestRefund(selectedBooking, { reason });
      setMessage({ type: 'success', text: 'Yêu cầu hoàn vé đã được gửi thành công. Chúng tôi sẽ xử lý sớm nhất.' });
      setReason('');
      setSelectedBooking('');
      // Refresh list to remove the requested booking
      setBookings(bookings.filter(b => b.id !== selectedBooking));
    } catch (error) {
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại sau.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: 'white' }}>Đang tải...</div>;

  return (
    <div className="refund-page" style={{ padding: '40px 20px', minHeight: '80vh', color: 'white' }}>
      <div className="refund-container" style={{ maxWidth: '800px', margin: '0 auto', background: '#1a1d20', padding: '30px', borderRadius: '10px' }}>
        <h2 style={{ color: '#e50914', marginBottom: '20px', textAlign: 'center' }}>Yêu Cầu Hoàn Vé</h2>
        
        {message.text && (
          <div style={{ 
            padding: '15px', 
            marginBottom: '20px', 
            borderRadius: '5px', 
            background: message.type === 'success' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(229, 9, 20, 0.1)',
            color: message.type === 'success' ? '#28a745' : '#e50914',
            border: `1px solid ${message.type === 'success' ? '#28a745' : '#e50914'}`
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="refund-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="booking-select">
            <label style={{ display: 'block', marginBottom: '10px' }}>Chọn vé cần hoàn:</label>
            <select 
              value={selectedBooking} 
              onChange={(e) => setSelectedBooking(e.target.value)}
              style={{ width: '100%', padding: '12px', background: '#222', color: 'white', border: '1px solid #333', borderRadius: '5px' }}
            >
              <option value="">-- Chọn vé --</option>
              {bookings.map(booking => (
                <option key={booking.id} value={booking.id}>
                  {booking.movieName} - {new Date(booking.showtime).toLocaleString()} - Ghế: {booking.seats.join(', ')}
                </option>
              ))}
            </select>
          </div>

          <div className="refund-reason">
            <label style={{ display: 'block', marginBottom: '10px' }}>Lý do hoàn vé:</label>
            <textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              placeholder="Nhập lý do của bạn..."
              style={{ width: '100%', padding: '12px', background: '#222', color: 'white', border: '1px solid #333', borderRadius: '5px' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={submitting || bookings.length === 0}
            style={{ 
              padding: '15px', 
              background: submitting || bookings.length === 0 ? '#555' : '#e50914', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px', 
              fontWeight: 'bold', 
              cursor: submitting || bookings.length === 0 ? 'not-allowed' : 'pointer' 
            }}
          >
            {submitting ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
          </button>
        </form>

        {bookings.length === 0 && !loading && (
          <p style={{ textAlign: 'center', marginTop: '20px', color: '#999' }}>
            Bạn không có vé nào đủ điều kiện hoàn trả hiện tại.
          </p>
        )}
      </div>
    </div>
  );
};

export default RefundRequestPage;
