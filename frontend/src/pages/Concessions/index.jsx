import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import bookingApi from '../../services/api';
import '../../assets/css/concessions.css';

const fallbackConcessions = [
  { ItemID: 1, Name: 'Combo Solo', Price: 89000, ImageURL: 'https://via.placeholder.com/150', Category: 'Combo' },
  { ItemID: 2, Name: 'Combo Đôi', Price: 129000, ImageURL: 'https://via.placeholder.com/150', Category: 'Combo' },
  { ItemID: 3, Name: 'Khoai Tây Chiên', Price: 45000, ImageURL: 'https://via.placeholder.com/150', Category: 'Snack' },
  { ItemID: 4, Name: 'Nước Ngọt', Price: 35000, ImageURL: 'https://via.placeholder.com/150', Category: 'Nước uống' }
];

const ConcessionsPage = () => {
  const navigate = useNavigate();
  const [bookingState, setBookingState] = useState(null);
  const [concessions, setConcessions] = useState([]);
  const [cart, setCart] = useState({});

  useEffect(() => {
    const savedState = sessionStorage.getItem('bookingState');
    if (!savedState) {
      navigate('/booking');
    } else {
      setBookingState(JSON.parse(savedState));
    }

    const fetchConcessions = async () => {
      try {
        const response = await bookingApi.getConcessions();
        if (response.data && response.data.length > 0) {
          setConcessions(response.data);
        } else {
          setConcessions(fallbackConcessions);
        }
      } catch (error) {
        setConcessions(fallbackConcessions);
      }
    };
    fetchConcessions();
  }, [navigate]);

  if (!bookingState) return null;

  const updateQuantity = (itemId, delta) => {
    setCart(prev => {
      const currentQty = prev[itemId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      const newCart = { ...prev };
      if (newQty > 0) {
        newCart[itemId] = newQty;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const getConcessionTotal = () => {
    let total = 0;
    Object.entries(cart).forEach(([itemId, qty]) => {
      const item = concessions.find(c => c.ItemID.toString() === itemId);
      if (item) {
        total += item.Price * qty;
      }
    });
    return total;
  };

  const handleContinue = () => {
    const concessionsInCart = Object.entries(cart).map(([itemId, qty]) => {
      const item = concessions.find(c => c.ItemID.toString() === itemId);
      return { ...item, quantity: qty };
    });
    
    const newState = {
      ...bookingState,
      concessions: concessionsInCart,
      concessionTotal: getConcessionTotal(),
      finalTotal: bookingState.totalAmount + getConcessionTotal()
    };
    sessionStorage.setItem('bookingState', JSON.stringify(newState));
    navigate('/booking/checkout');
  };

  const handleSkip = () => {
    const newState = {
      ...bookingState,
      concessions: [],
      concessionTotal: 0,
      finalTotal: bookingState.totalAmount
    };
    sessionStorage.setItem('bookingState', JSON.stringify(newState));
    navigate('/booking/checkout');
  };

  const groupedConcessions = concessions.reduce((acc, curr) => {
    if (!acc[curr.Category]) acc[curr.Category] = [];
    acc[curr.Category].push(curr);
    return acc;
  }, {});

  return (
    <div className="concessions-page">
      <div className="steps-bar">
        <div className="step done">1. Chọn Phim & Suất Chiếu</div>
        <div className="step done">2. Chọn Ghế</div>
        <div className="step active">3. Bắp & Nước</div>
        <div className="step">4. Thanh Toán</div>
      </div>

      <div className="concessions-layout">
        <div className="main-content">
          <h2>Chọn Bắp & Nước</h2>
          {Object.entries(groupedConcessions).map(([category, items]) => (
            <div key={category} className="category-section">
              <h3>{category}</h3>
              <div className="concessions-grid">
                {items.map(item => (
                  <div key={item.ItemID} className="concession-card">
                    <img src={item.ImageURL} alt={item.Name} className="concession-img" />
                    <div className="concession-info">
                      <div className="concession-name">{item.Name}</div>
                      <div className="concession-price">{item.Price.toLocaleString()}đ</div>
                    </div>
                    <div className="qty-controls">
                      <button onClick={() => updateQuantity(item.ItemID.toString(), -1)}>-</button>
                      <span>{cart[item.ItemID] || 0}</span>
                      <button onClick={() => updateQuantity(item.ItemID.toString(), 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="order-summary sidebar">
          <h3>Thông tin đơn hàng</h3>
          <div className="summary-item">Phim: {bookingState.movieName || 'Unknown'}</div>
          <div className="summary-item">Rạp: {bookingState.cinemaName || 'Unknown'}</div>
          <div className="summary-item">Ghế: {bookingState.selectedSeats?.map(s => s.seatName || s).join(', ')}</div>
          
          <div className="summary-divider"></div>
          
          <h4>Bắp & Nước đã chọn</h4>
          {Object.entries(cart).map(([itemId, qty]) => {
            const item = concessions.find(c => c.ItemID.toString() === itemId);
            if (!item) return null;
            return (
              <div key={itemId} className="cart-item">
                <span>{item.Name} x{qty}</span>
                <span>{(item.Price * qty).toLocaleString()}đ</span>
              </div>
            );
          })}
          
          <div className="summary-divider"></div>
          
          <div className="summary-total">
            <span>Tổng tiền ghế:</span>
            <span>{bookingState.totalAmount?.toLocaleString()}đ</span>
          </div>
          <div className="summary-total">
            <span>Tổng tiền bắp nước:</span>
            <span>{getConcessionTotal().toLocaleString()}đ</span>
          </div>
          <div className="summary-grand-total">
            <span>Tổng cộng:</span>
            <span>{(bookingState.totalAmount + getConcessionTotal()).toLocaleString()}đ</span>
          </div>

          <div className="action-buttons">
            <button className="btn-continue" onClick={handleContinue}>Tiếp tục Đặt Vé</button>
            <button className="btn-skip" onClick={handleSkip}>Bỏ qua</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConcessionsPage;
