import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import bookingApi from '../../services/api';
import '../../assets/css/checkout.css';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookingState, setBookingState] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [voucherError, setVoucherError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('VNPay');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const savedState = sessionStorage.getItem('bookingState');
    if (!savedState) {
      navigate('/booking');
    } else {
      setBookingState(JSON.parse(savedState));
    }
  }, [navigate]);

  if (!bookingState) return null;

  const handleApplyVoucher = async () => {
    if (!voucherCode) return;
    try {
      setVoucherError('');
      const response = await bookingApi.applyVoucher({ 
        code: voucherCode, 
        amount: bookingState.finalTotal 
      });
      if (response.data && response.data.discount) {
        setDiscount(response.data.discount);
      } else {
        setVoucherError('Mã giảm giá không hợp lệ');
        setDiscount(0);
      }
    } catch (err) {
      setVoucherError('Mã giảm giá không hợp lệ');
      setDiscount(0);
    }
  };

  const finalAmountToPay = Math.max(0, (bookingState.finalTotal || 0) - discount);

  const handleConfirmBooking = async () => {
    if (!termsAccepted) {
      alert('Vui lòng đồng ý với điều khoản!');
      return;
    }
    setIsProcessing(true);
    try {
      const payload = {
        showtimeId: bookingState.showtimeId,
        seats: bookingState.selectedSeats,
        concessions: bookingState.concessions || [],
        voucherCode: discount > 0 ? voucherCode : null,
        paymentMethod,
        totalAmount: finalAmountToPay
      };
      
      const response = await bookingApi.create(payload);
      
      if (paymentMethod === 'VNPay' || paymentMethod === 'MOMO') {
        if (response.data && response.data.paymentUrl) {
          window.location.href = response.data.paymentUrl;
        } else {
          navigate(`/booking/success?bookingId=${response.data?.bookingId || 'MOCK123'}`);
        }
      } else {
        navigate(`/booking/success?bookingId=${response.data?.bookingId || 'MOCK123'}`);
      }
    } catch (err) {
      alert('Có lỗi xảy ra khi tạo đơn hàng');
      setIsProcessing(false);
    }
  };

  return (
    <div className="checkout-page">
      <div className="steps-bar">
        <div className="step done">1. Chọn Phim & Suất Chiếu</div>
        <div className="step done">2. Chọn Ghế</div>
        <div className="step done">3. Bắp & Nước</div>
        <div className="step active">4. Thanh Toán</div>
      </div>

      <div className="checkout-layout">
        <div className="checkout-section">
          <h2>Thông tin thanh toán</h2>
          
          <div className="payment-card checkout-section">
            <h3>Phương thức thanh toán</h3>
            <div className="payment-methods">
              <label>
                <input type="radio" name="payment" value="VNPay" checked={paymentMethod === 'VNPay'} onChange={(e) => setPaymentMethod(e.target.value)} />
                VN Pay
              </label>
              <label>
                <input type="radio" name="payment" value="MOMO" checked={paymentMethod === 'MOMO'} onChange={(e) => setPaymentMethod(e.target.value)} />
                MOMO
              </label>
              <label>
                <input type="radio" name="payment" value="Cash" checked={paymentMethod === 'Cash'} onChange={(e) => setPaymentMethod(e.target.value)} />
                Thanh toán tại quầy
              </label>
            </div>
          </div>

          <div className="payment-card voucher-section checkout-section">
            <h3>Mã khuyến mãi</h3>
            <div className="voucher-input">
              <input type="text" placeholder="Nhập mã voucher" value={voucherCode} onChange={e => setVoucherCode(e.target.value)} />
              <button onClick={handleApplyVoucher}>Áp dụng</button>
            </div>
            {voucherError && <div className="error-text">{voucherError}</div>}
            {discount > 0 && <div className="success-text">Giảm: {discount.toLocaleString()}đ</div>}
          </div>

          <div className="payment-card terms-section checkout-section">
            <label>
              <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
              Tôi đồng ý với các điều khoản và quy định của D-Cinema
            </label>
          </div>
        </div>

        <div className="checkout-section sidebar">
          <h3>Tóm tắt đơn hàng</h3>
          <div className="summary-item">Phim: {bookingState.movieName}</div>
          <div className="summary-item">Rạp: {bookingState.cinemaName}</div>
          <div className="summary-item">Suất chiếu: {bookingState.showtimeTime}</div>
          <div className="summary-item">Ghế: {bookingState.selectedSeats?.map(s => s.seatName || s).join(', ')}</div>
          
          {bookingState.concessions && bookingState.concessions.length > 0 && (
            <>
              <div className="summary-divider"></div>
              <h4>Bắp & Nước</h4>
              {bookingState.concessions.map(c => (
                <div key={c.ItemID} className="cart-item">
                  <span>{c.Name} x{c.quantity}</span>
                  <span>{(c.Price * c.quantity).toLocaleString()}đ</span>
                </div>
              ))}
            </>
          )}

          <div className="summary-divider"></div>
          
          <div className="summary-totals">
            <div className="flex-row">
              <span>Tiền vé:</span>
              <span>{bookingState.totalAmount?.toLocaleString()}đ</span>
            </div>
            {bookingState.concessionTotal > 0 && (
              <div className="flex-row">
                <span>Tiền bắp nước:</span>
                <span>{bookingState.concessionTotal?.toLocaleString()}đ</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex-row discount">
                <span>Giảm giá:</span>
                <span>-{discount.toLocaleString()}đ</span>
              </div>
            )}
            <div className="flex-row grand-total">
              <span>Tổng thanh toán:</span>
              <span>{finalAmountToPay.toLocaleString()}đ</span>
            </div>
          </div>

          <button 
            className="btn-confirm" 
            onClick={handleConfirmBooking}
            disabled={isProcessing}
          >
            {isProcessing ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
