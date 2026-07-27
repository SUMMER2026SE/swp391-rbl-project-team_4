import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import movieApi from '../../services/api';
import '../../assets/css/index.css';

const HERO_SLIDES = [
  {
    id: 7,
    title: 'SIÊU QUẬY MARSUPILAMI',
    image: '/assets/images/bannerSiêuQuậyMarsupilami.png',
    rating: 'C13',
    year: '2024',
    duration: '105 phút',
    genre: 'Hài hước, Gia đình',
    desc: 'Theo chân chú vượn đốm Marsupilami trong cuộc phiêu lưu rừng xanh đầy tiếng cười và cảm động.',
  },
  {
    id: 4,
    title: 'ỐC MƯỢN HỒN',
    image: '/assets/images/bannerốcmượnhồn.png',
    rating: 'C18',
    year: '2024',
    duration: '120 phút',
    genre: 'Kinh dị',
    desc: 'Một câu chuyện kinh dị về sự đánh đổi sinh mạng và những bí ẩn rùng rợn trong ngôi làng.',
  },
  {
    id: 5,
    title: 'MA XÓ',
    image: '/assets/images/banneMaXo.png',
    rating: 'C18',
    year: '2024',
    duration: '110 phút',
    genre: 'Kinh dị, Hồi hộp',
    desc: 'Lời nguyền ma xó đeo bám những con người vô tội, họ phải tìm cách thoát khỏi bóng tối.',
  }
];

const STATIC_NOW_SHOWING = [
  { id: 1, title: 'Lật Mặt 7', image: '/assets/images/latmat7.jpg', age: 'C16' },
  { id: 2, title: 'Mai', image: '/assets/images/mai.jpg', age: 'C18' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [currentCity, setCurrentCity] = useState('Toàn quốc');
  
  const [nowShowing, setNowShowing] = useState(STATIC_NOW_SHOWING);
  const [comingSoon, setComingSoon] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [activeTab, setActiveTab] = useState('dang-chieu');

  useEffect(() => {
    let timer;
    if (!isHovered) {
      timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [isHovered]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const nowShowingData = await movieApi.getNowShowing();
        if (nowShowingData && nowShowingData.length > 0) setNowShowing(nowShowingData);
        
        const comingSoonData = await movieApi.getComingSoon();
        if (comingSoonData) setComingSoon(comingSoonData);

        // Simulated fetch for promotions
        const res = await fetch('http://localhost:9999/api/news').catch(() => null);
        if (res && res.ok) {
          const promoData = await res.json();
          setPromotions(promoData);
        } else {
          setPromotions([
            { id: 1, title: 'Khuyến mãi thành viên mới', image: '/assets/images/promo1.jpg' }
          ]);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, []);

  const handleBook = (movieId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Vui lòng đăng nhập để đặt vé');
      navigate('/auth');
    } else {
      navigate(`/booking?movieId=${movieId}`);
    }
  };

  const handleDetail = (movieId) => {
    navigate(`/movies/${movieId}`);
  };

  const switchMovieTab = (tabId) => {
    setActiveTab(tabId);
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);

  const CITIES = ['Toàn quốc', 'Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Vũng Tàu'];

  return (
    <div className="home-page">
      {/* Hero Carousel */}
      <section 
        className="hero-carousel"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {HERO_SLIDES.map((slide, index) => (
          <div 
            key={slide.id} 
            className={`hero-slide ${index === currentSlide ? 'active' : 'hidden'}`}
          >
            <div className="hero-background" style={{ backgroundImage: `url(${slide.image})` }}></div>
            <div className="hero-overlay"></div>
            <div className="hero-content">
              <span className="badge">{slide.rating}</span>
              <h1>{slide.title}</h1>
              <div className="hero-meta">
                <span>{slide.year}</span>
                <span>{slide.duration}</span>
                <span>{slide.genre}</span>
              </div>
              <p className="hero-desc">{slide.desc}</p>
              <div className="hero-actions">
                <button className="btn-primary" onClick={() => handleDetail(slide.id)}>Chi Tiết</button>
                <button className="btn-secondary" onClick={() => handleBook(slide.id)}>ĐẶT VÉ</button>
              </div>
            </div>
          </div>
        ))}
        
        <button className="carousel-btn prev" onClick={prevSlide}>&lt;</button>
        <button className="carousel-btn next" onClick={nextSlide}>&gt;</button>
        
        <div className="carousel-dots">
          {HERO_SLIDES.map((_, index) => (
            <span 
              key={index} 
              className={`dot ${index === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
            ></span>
          ))}
        </div>
      </section>

      {/* Movies Section */}
      <section className="section-dark">
        <div className="container">
          <div className="section-header">
            <div className="tabs">
              <button 
                className={`tab-btn ${activeTab === 'dang-chieu' ? 'active' : ''}`} 
                onClick={() => switchMovieTab('dang-chieu')}
              >
                Đang chiếu
              </button>
              <button 
                className={`tab-btn ${activeTab === 'sap-chieu' ? 'active' : ''}`} 
                onClick={() => switchMovieTab('sap-chieu')}
              >
                Sắp chiếu
              </button>
              <button 
                className={`tab-btn ${activeTab === 'imax' ? 'active' : ''}`} 
                onClick={() => switchMovieTab('imax')}
              >
                Phim IMAX
              </button>
            </div>
            <div className="location-filter" onClick={() => setIsCityModalOpen(true)}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span className="currentCityText">{currentCity}</span>
            </div>
          </div>

          <div className="movie-tabs">
            {/* Đang chiếu */}
            {activeTab === 'dang-chieu' && (
              <div className="movie-tab-content active">
                <div className="movie-grid">
                  {nowShowing.map(movie => (
                    <div key={movie.id} className="movie-card">
                      <div className="movie-poster">
                        <span className="age-badge">{movie.age || 'C13'}</span>
                        <img src={movie.image || movie.poster} alt={movie.title} />
                        <div className="poster-overlay">
                          <button className="btn-primary" onClick={() => handleDetail(movie.id)}>Chi Tiết</button>
                          <button className="btn-secondary" onClick={() => handleBook(movie.id)}>ĐẶT VÉ</button>
                        </div>
                      </div>
                      <h3>{movie.title}</h3>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sắp chiếu */}
            {activeTab === 'sap-chieu' && (
              <div className="movie-tab-content active">
                <div className="movie-grid">
                  {comingSoon.map(movie => (
                    <div key={movie.id} className="movie-card">
                      <div className="movie-poster">
                        <span className="age-badge">{movie.age || 'C13'}</span>
                        <img src={movie.image || movie.poster} alt={movie.title} />
                        <div className="poster-overlay">
                          <button className="btn-primary" onClick={() => handleDetail(movie.id)}>Chi Tiết</button>
                        </div>
                      </div>
                      <h3>{movie.title}</h3>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* IMAX */}
            {activeTab === 'imax' && (
              <div className="movie-tab-content active">
                <p>Chưa có phim IMAX nào được xếp lịch.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Promotions Section */}
      <section className="section-promotions">
        <h2>Khuyến Mãi</h2>
        <div className="promo-grid">
          {promotions.map(promo => (
            <div key={promo.id} className="promo-card">
              <img src={promo.image} alt={promo.title} />
              <h4>{promo.title}</h4>
            </div>
          ))}
        </div>
      </section>

      {/* AI Recommendation Section */}
      <section className="section-ai">
        <h2>Dành Riêng Cho Bạn (AI Đề Xuất)</h2>
        <div className="ai-grid">
          <div className="ai-card">
            <h3>Gợi ý 1</h3>
            <p>Dựa trên sở thích của bạn, chúng tôi đề xuất bộ phim này.</p>
          </div>
        </div>
      </section>

      {/* City Modal */}
      {isCityModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCityModalOpen(false)}>
          <div className="cityModal" onClick={e => e.stopPropagation()}>
            <h3>Chọn Thành Phố</h3>
            <ul className="city-list">
              {CITIES.map(city => (
                <li 
                  key={city} 
                  onClick={() => { setCurrentCity(city); setIsCityModalOpen(false); }}
                  className={city === currentCity ? 'active' : ''}
                >
                  {city}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
