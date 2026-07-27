import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/css/booking-new.css';

const CITIES = ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Vũng Tàu'];
const GENRES = ['Tất cả', 'Hành động', 'Kinh dị', 'Hoạt hình', 'Tình cảm', 'Hài'];

const getNext7Days = () => {
  const days = [];
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      dayOfWeek: dayNames[d.getDay()],
      dayNumber: d.getDate(),
      month: d.getMonth() + 1,
    });
  }
  return days;
};

const BookingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth() || {};

  const movieIdParam = searchParams.get('movieId');

  const [cinemas, setCinemas] = useState([]);
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [selectedCinema, setSelectedCinema] = useState(null);
  
  const [dates] = useState(getNext7Days());
  const [selectedDate, setSelectedDate] = useState(dates[0].date);
  
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [showtimes, setShowtimes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCinemas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/movies/cinemas');
      if (res.ok) {
        const data = await res.json();
        setCinemas(data || []);
      }
    } catch (error) {
      console.error('Error fetching cinemas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShowtimes = useCallback(async (cinemaId, date) => {
    if (!cinemaId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/movies/showtimes?cinemaId=${cinemaId}&date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setShowtimes(data || []);
      }
    } catch (error) {
      console.error('Error fetching showtimes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCinemas();
  }, [fetchCinemas]);

  useEffect(() => {
    if (selectedCinema) {
      fetchShowtimes(selectedCinema.CinemaID, selectedDate);
    }
  }, [selectedCinema, selectedDate, fetchShowtimes]);

  if (token === null || token === undefined) {
    return (
      <div className="booking-auth-prompt" style={{ textAlign: 'center', padding: '100px 20px', color: '#fff' }}>
        <h2>Vui lòng đăng nhập để đặt vé</h2>
        <p>Bạn cần đăng nhập vào tài khoản D-Cinema để tiếp tục</p>
        <button 
          onClick={() => navigate('/auth')} 
          style={{ padding: '10px 20px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px' }}
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  const filteredCinemas = cinemas.filter(c => c.City === selectedCity);
  
  const filteredShowtimes = showtimes.filter(st => {
    if (movieIdParam && st.MovieID.toString() !== movieIdParam) return false;
    if (selectedGenre !== 'Tất cả' && !st.Genre?.includes(selectedGenre)) return false;
    return true;
  });

  return (
    <div className="booking-page-container" style={{ backgroundColor: '#090a0f', color: '#fff', minHeight: '100vh', paddingBottom: '50px' }}>
      <div className="booking-hero" style={{ background: 'linear-gradient(to right, rgba(9, 10, 15, 0.9), rgba(9, 10, 15, 0.5)), url("/images/booking-bg.jpg") center/cover', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', color: '#fff' }}>CHỌN RẠP & SUẤT CHIẾU</h1>
        
        <div className="booking-steps" style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div className="step active" style={{ color: '#e50914', fontWeight: 'bold' }}>1. Rạp & Suất</div>
          <div className="step-arrow">→</div>
          <div className="step" style={{ color: '#666' }}>2. Chọn Ghế</div>
          <div className="step-arrow" style={{ color: '#666' }}>→</div>
          <div className="step" style={{ color: '#666' }}>3. Bắp & Nước</div>
          <div className="step-arrow" style={{ color: '#666' }}>→</div>
          <div className="step" style={{ color: '#666' }}>4. Thanh Toán</div>
        </div>
      </div>

      <div className="booking-main-layout" style={{ display: 'flex', flexWrap: 'wrap', maxWidth: '1200px', margin: '0 auto', gap: '30px', padding: '30px 20px' }}>
        
        {/* LEFT PANEL */}
        <div className="filter-panel" style={{ flex: '1 1 300px', position: 'sticky', top: '20px', height: 'fit-content' }}>
          
          <div className="filter-section" style={{ background: '#1c1e26', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '15px', color: '#fff' }}>Khu vực</h3>
            <div className="city-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {CITIES.map(city => (
                <button
                  key={city}
                  onClick={() => { setSelectedCity(city); setSelectedCinema(null); }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #333',
                    background: selectedCity === city ? '#e50914' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section" style={{ background: '#1c1e26', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '15px', color: '#fff' }}>Chọn Rạp</h3>
            <select 
              className="cinema-select"
              style={{ width: '100%', padding: '10px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #444' }}
              value={selectedCinema?.CinemaID || ''}
              onChange={(e) => {
                const cinema = filteredCinemas.find(c => c.CinemaID.toString() === e.target.value);
                setSelectedCinema(cinema || null);
              }}
            >
              <option value="">-- Chọn rạp --</option>
              {filteredCinemas.map(c => (
                <option key={c.CinemaID} value={c.CinemaID}>{c.CinemaName}</option>
              ))}
            </select>
            
            {selectedCinema && (
              <div className="cinema-info-card" style={{ marginTop: '15px', padding: '15px', background: '#333', borderRadius: '4px' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#e50914' }}>{selectedCinema.CinemaName}</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#aaa' }}>{selectedCinema.Address}</p>
              </div>
            )}
          </div>

          <div className="filter-section" style={{ background: '#1c1e26', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '15px', color: '#fff' }}>Ngày chiếu</h3>
            <div className="date-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {dates.map(d => (
                <button
                  key={d.date}
                  className="date-pill"
                  onClick={() => setSelectedDate(d.date)}
                  style={{
                    padding: '10px 5px',
                    borderRadius: '4px',
                    border: '1px solid #333',
                    background: selectedDate === d.date ? '#e50914' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '0.8rem' }}>{d.dayOfWeek}</span>
                  <strong style={{ fontSize: '1.2rem', margin: '3px 0' }}>{d.dayNumber}</strong>
                  <span style={{ fontSize: '0.8rem' }}>Th {d.month}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section" style={{ background: '#1c1e26', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '15px', color: '#fff' }}>Thể loại</h3>
            <div className="genre-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {GENRES.map(genre => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    border: '1px solid #555',
                    background: selectedGenre === genre ? '#fff' : 'transparent',
                    color: selectedGenre === genre ? '#000' : '#ccc',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT PANEL */}
        <div className="showtimes-content" style={{ flex: '1 1 600px' }}>
          
          {!selectedCinema ? (
            <div className="cinemas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {loading ? <p>Đang tải danh sách rạp...</p> : filteredCinemas.length === 0 ? <p>Không có rạp nào tại khu vực này.</p> : null}
              {filteredCinemas.map(cinema => (
                <div 
                  key={cinema.CinemaID} 
                  className="cinema-card"
                  onClick={() => setSelectedCinema(cinema)}
                  style={{ background: '#1c1e26', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #333', transition: 'transform 0.2s' }}
                >
                  <img src={cinema.ImageURL || 'https://via.placeholder.com/300x150?text=Cinema'} alt={cinema.CinemaName} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                  <div style={{ padding: '15px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{cinema.CinemaName}</h3>
                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem' }}>{cinema.Address}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="movies-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {loading ? <p>Đang tải lịch chiếu...</p> : filteredShowtimes.length === 0 ? <p>Không có suất chiếu nào phù hợp.</p> : null}
              
              {filteredShowtimes.map(movie => (
                <div key={movie.MovieID} className="showtime-row" style={{ display: 'flex', background: '#1c1e26', borderRadius: '8px', padding: '15px', gap: '20px', alignItems: 'flex-start' }}>
                  <img src={movie.PosterURL || 'https://via.placeholder.com/100x150?text=Poster'} alt={movie.Title} style={{ width: '100px', height: '150px', objectFit: 'cover', borderRadius: '4px' }} />
                  
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem' }}>{movie.Title}</h2>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                      <span style={{ padding: '3px 8px', background: '#333', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>2D Phụ Đề</span>
                      <span style={{ padding: '3px 8px', background: '#e50914', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{movie.AgeRating || 'T18'}</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {(movie.Times || []).map(timeObj => (
                        <button
                          key={timeObj.ShowtimeID}
                          onClick={() => navigate(`/booking/seats?showtimeId=${timeObj.ShowtimeID}&movieId=${movie.MovieID}`)}
                          style={{
                            padding: '8px 15px',
                            background: 'transparent',
                            border: '1px solid #e50914',
                            color: '#fff',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#e50914'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          {timeObj.StartTime}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BookingPage;
