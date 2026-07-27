import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import bookingApi from '../../services/api'; // Adjust if exact methods differ
import '../../assets/css/seats.css';
import { io } from 'socket.io-client';

const SEAT_PRICES = {
  Normal: 85000,
  VIP: 105000,
  Couple: 200000,
};

const MAX_SEATS = 8;

const SeatsPage = () => {
  const [searchParams] = useSearchParams();
  const showtimeId = searchParams.get('showtimeId');
  const movieId = searchParams.get('movieId');
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [seats, setSeats] = useState([]);
  const [movie, setMovie] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cinemaInfo, setCinemaInfo] = useState({ cinemaName: '', showtime: '' });

  const socketRef = useRef(null);
  const bookingSessionIdRef = useRef(sessionStorage.getItem('bookingSessionId') || crypto.randomUUID());

  useEffect(() => {
    sessionStorage.setItem('bookingSessionId', bookingSessionIdRef.current);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Assuming bookingApi has methods, or replace with direct fetch/axios
        // const seatRes = await bookingApi.get(`/bookings/showtimes/${showtimeId}/seats`);
        // const movieRes = await bookingApi.get(`/movies/${movieId}`);
        // Mocking structure based on standard api instances if methods are generic
        const seatRes = await bookingApi.get(`/api/bookings/showtimes/${showtimeId}/seats`);
        const movieRes = await bookingApi.get(`/api/movies/${movieId}`);
        
        // Use generic get if specific methods aren't guaranteed, or assume fetch
        setSeats(seatRes.data || seatRes);
        setMovie(movieRes.data || movieRes);
        
        // Mocking extra showtime info for display if not fully returned
        setCinemaInfo({
          cinemaName: 'D-Cinema', // Example fallback
          showtime: '20:00, Hôm nay',
        });
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Không thể tải dữ liệu ghế. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    if (showtimeId && movieId) {
      fetchData();
    } else {
      setError('Thiếu thông tin suất chiếu hoặc phim.');
      setLoading(false);
    }
  }, [showtimeId, movieId]);

  useEffect(() => {
    if (!showtimeId) return;

    // Connect to Socket.IO Server (assume backend runs at standard origin/env var)
    const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    socketRef.current = io(socketUrl, {
      query: { bookingSessionId: bookingSessionIdRef.current },
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('joinShowtime', showtimeId);
    });

    socketRef.current.on('seatStatusUpdated', (data) => {
      // data format: { seatId: number/string, status: 'locked' | 'available' | 'booked' }
      setSeats((prevSeats) =>
        prevSeats.map((seat) =>
          seat.SeatID === data.seatId
            ? { ...seat, Status: data.status }
            : seat
        )
      );
    });

    return () => {
      if (socketRef.current) {
        selectedSeats.forEach((seat) => {
          socketRef.current.emit('releaseSeat', {
            showtimeId,
            seatId: seat.SeatID,
            bookingSessionId: bookingSessionIdRef.current,
          });
        });
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showtimeId]);

  const handleSeatClick = useCallback((seat) => {
    if (seat.Status === 'booked' || seat.Status === 'locked') {
      return;
    }

    const isSelected = selectedSeats.find((s) => s.SeatID === seat.SeatID);

    if (isSelected) {
      // Release
      setSelectedSeats((prev) => prev.filter((s) => s.SeatID !== seat.SeatID));
      socketRef.current?.emit('releaseSeat', {
        showtimeId,
        seatId: seat.SeatID,
        bookingSessionId: bookingSessionIdRef.current,
      });
    } else {
      // Hold
      if (selectedSeats.length >= MAX_SEATS) {
        alert(`Bạn chỉ có thể chọn tối đa ${MAX_SEATS} ghế.`);
        return;
      }
      setSelectedSeats((prev) => [...prev, seat]);
      socketRef.current?.emit('holdSeat', {
        showtimeId,
        seatId: seat.SeatID,
        bookingSessionId: bookingSessionIdRef.current,
      });
    }
  }, [selectedSeats, showtimeId]);

  const handleContinue = () => {
    if (selectedSeats.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ghế.');
      return;
    }

    const totalAmount = selectedSeats.reduce((total, seat) => {
      return total + (SEAT_PRICES[seat.SeatType] || SEAT_PRICES.Normal);
    }, 0);

    const bookingState = {
      showtimeId,
      movieId,
      selectedSeats,
      totalAmount,
      movieTitle: movie?.Title || movie?.title || 'Unknown Movie',
      showtime: cinemaInfo.showtime,
      cinemaName: cinemaInfo.cinemaName,
    };

    sessionStorage.setItem('bookingState', JSON.stringify(bookingState));
    navigate('/booking/concessions');
  };

  if (loading) return <div className="seats-loading">Đang tải danh sách ghế...</div>;
  if (error) return <div className="seats-error">{error}</div>;

  // Group seats by RowLabel
  const rows = seats.reduce((acc, seat) => {
    const row = seat.RowLabel;
    if (!acc[row]) acc[row] = [];
    acc[row].push(seat);
    return acc;
  }, {});

  const totalAmount = selectedSeats.reduce((total, seat) => {
    return total + (SEAT_PRICES[seat.SeatType] || SEAT_PRICES.Normal);
  }, 0);

  return (
    <div className="seats-page-container">
      {/* Steps Bar */}
      <div className="steps-bar">
        <div className="step done">1. Rạp & Suất</div>
        <div className="step active">2. Chọn Ghế</div>
        <div className="step">3. Bắp Nước</div>
        <div className="step">4. Thanh Toán</div>
      </div>

      <div className="seats-main-content">
        {/* Left: Seat Map */}
        <div className="seats-map-section">
          <div className="screen-container">
            <div className="screen-bar"></div>
            <div className="screen-glow"></div>
            <div className="screen-text">MÀN HÌNH</div>
          </div>

          <div className="seats-grid">
            {Object.keys(rows).sort().map((rowLabel) => (
              <div key={rowLabel} className="seat-row">
                <div className="row-label">{rowLabel}</div>
                <div className="row-seats">
                  {rows[rowLabel].sort((a, b) => a.SeatNumber - b.SeatNumber).map((seat) => {
                    const isSelected = selectedSeats.some((s) => s.SeatID === seat.SeatID);
                    const statusClass = isSelected ? 'selected' : seat.Status;
                    const typeClass = seat.SeatType.toLowerCase();
                    
                    return (
                      <div
                        key={seat.SeatID}
                        className={`seat ${typeClass} ${statusClass}`}
                        onClick={() => handleSeatClick(seat)}
                        title={`${seat.RowLabel}${seat.SeatNumber} - ${seat.SeatType}`}
                      >
                        {seat.SeatNumber}
                      </div>
                    );
                  })}
                </div>
                <div className="row-label">{rowLabel}</div>
              </div>
            ))}
          </div>

          <div className="seat-legend">
            <div className="legend-item"><div className="seat normal"></div> Thường</div>
            <div className="legend-item"><div className="seat vip"></div> VIP</div>
            <div className="legend-item"><div className="seat couple"></div> Couple</div>
            <div className="legend-item"><div className="seat selected"></div> Đang chọn</div>
            <div className="legend-item"><div className="seat booked"></div> Đã đặt</div>
            <div className="legend-item"><div className="seat locked"></div> Đang giữ</div>
          </div>
        </div>

        {/* Right: Booking Summary Sidebar */}
        <div className="booking-sidebar">
          {movie && (
            <div className="movie-summary">
              <img 
                src={movie.PosterURL || movie.poster || '/placeholder-poster.png'} 
                alt={movie.Title || movie.title} 
                className="summary-poster" 
              />
              <div className="summary-info">
                <h3>{movie.Title || movie.title}</h3>
                <p><strong>Rạp:</strong> {cinemaInfo.cinemaName}</p>
                <p><strong>Suất chiếu:</strong> {cinemaInfo.showtime}</p>
              </div>
            </div>
          )}

          <div className="selected-seats-summary">
            <h4>Ghế đã chọn ({selectedSeats.length}/{MAX_SEATS}):</h4>
            {selectedSeats.length === 0 ? (
              <p className="no-seats-msg">Chưa chọn ghế nào.</p>
            ) : (
              <ul className="selected-seats-list">
                {selectedSeats.map(seat => (
                  <li key={seat.SeatID}>
                    <span>{seat.RowLabel}{seat.SeatNumber} ({seat.SeatType})</span>
                    <span>{(SEAT_PRICES[seat.SeatType] || SEAT_PRICES.Normal).toLocaleString()}đ</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="booking-total">
            <span>Tổng cộng:</span>
            <span className="total-amount">{totalAmount.toLocaleString()}đ</span>
          </div>

          <button 
            className="continue-btn" 
            onClick={handleContinue}
            disabled={selectedSeats.length === 0}
          >
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeatsPage;
