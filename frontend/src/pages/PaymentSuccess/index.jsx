import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../../assets/css/payment-success.css';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookingInfo, setBookingInfo] = useState(null);

  const urlBookingId = searchParams.get('bookingId') || searchParams.get('ticketId');

  useEffect(() => {
    const savedState = sessionStorage.getItem('bookingState');
    if (savedState) {
      setBookingInfo(JSON.parse(savedState));
      sessionStorage.removeItem('bookingState');
    }
  }, []);

  const bookingId = urlBookingId || (bookingInfo && 'BKG-' + Date.now().toString().slice(-6));

  if (!bookingId) {
    return (
      <div className="payment-success-page error-state">
        <h2>Không tìm thấy thông tin đặt vé</h2>
        <button onClick={() => navigate(-1)}>Quay lại</button>
      </div>
    );
  }

  return (
    <div className="payment-success-page">
      <div className="success-animation">
        <div className="checkmark-circle">
          <div className="checkmark-stem"></div>
          <div className="checkmark-kick"></div>
        </div>
        <h1>ĐẶT VÉ THÀNH CÔNG!</h1>
      </div>

      <div className="ticket-summary-card">
        <h2>Thông tin vé</h2>
        <div className="ticket-details">
          <div className="detail-row">
            <span className="label">Phim:</span>
            <span className="value">{bookingInfo?.movieName || 'Phim đã chọn'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Rạp:</span>
            <span className="value">{bookingInfo?.cinemaName || 'Rạp chiếu'} - Phòng {bookingInfo?.hallName || '1'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Suất chiếu:</span>
            <span className="value">{bookingInfo?.showtimeTime || 'Thời gian chiếu'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Ghế:</span>
            <span className="value">{bookingInfo?.selectedSeats?.map(s => s.seatName || s).join(', ') || 'Danh sách ghế'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Tổng tiền:</span>
            <span className="value">{bookingInfo?.finalTotal?.toLocaleString() || '0'}đ</span>
          </div>
          <div className="detail-row">
            <span className="label">Mã đặt chỗ:</span>
            <span className="value booking-code">{bookingId}</span>
          </div>
        </div>
      </div>

      <div className="qr-code-section">
        <p>Mã QR để quét tại quầy:</p>
        <div className="qr-placeholder">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${bookingId}`} alt="QR Code" />
        </div>
        <p className="prominent-code">{bookingId}</p>
      </div>

      <div className="action-buttons">
        <button className="btn-primary" onClick={() => navigate('/profile')}>Xem Lịch Sử Đặt Vé</button>
        <button className="btn-secondary" onClick={() => navigate('/')}>Về Trang Chủ</button>
        <button className="btn-print" onClick={() => window.print()}>In Vé</button>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
