import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { movieApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../../assets/css/movie-detail.css';
import '../../assets/css/shared-layout.css';

const MovieDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [movie, setMovie] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        const res = await movieApi.getMovieById(id);
        setMovie(res.data || res);
        
        const reviewRes = await movieApi.getMovieReviews(id);
        setReviews(reviewRes.data?.reviews || reviewRes.reviews || []);

        if (user) {
          try {
            const authRes = await movieApi.checkReviewEligibility(id);
            setCanReview(authRes.data?.canReview || authRes.canReview);
          } catch (e) {
            console.error("User not eligible to review or error", e);
          }
        }
      } catch (err) {
        console.error("Error fetching movie details", err);
      }
    };
    fetchMovieData();
  }, [id, user]);

  const handleBooking = () => {
    if (!user) {
      navigate('/auth');
    } else {
      navigate(`/booking?movieId=${id}`);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (reviewForm.rating === 0) return alert('Vui lòng chọn số sao');
    try {
      await movieApi.submitReview(id, reviewForm);
      alert('Đã gửi đánh giá thành công!');
      setReviewForm({ rating: 0, comment: '' });
      const reviewRes = await movieApi.getMovieReviews(id);
      setReviews(reviewRes.data?.reviews || reviewRes.reviews || []);
    } catch (err) {
      console.error(err);
      alert('Lỗi khi gửi đánh giá');
    }
  };

  const renderStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  if (!movie) return <div>Loading...</div>;

  const averageRating = reviews.length ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1) : 0;

  return (
    <div className="movie-detail-page">
      <div className="hero-section" style={{ backgroundImage: `url(${movie.posterUrl})` }}>
        <div className="hero-bg"></div>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="hero-layout">
            <div className="hero-poster">
              <img src={movie.posterUrl} alt={movie.title} />
              <div className="poster-rating-badge">{movie.ageRating}</div>
            </div>
            <div className="hero-info">
              <span className="movie-badge">{movie.ageRating}</span>
              <h1>{movie.title}</h1>
              <div className="movie-meta">
                <span>{averageRating} ★</span>
                <span>{movie.duration} phút</span>
                <span>{new Date(movie.releaseDate).toLocaleDateString()}</span>
              </div>
              <p className="description">{movie.description}</p>
              <div className="hero-buttons">
                <button className="btn-buy" onClick={handleBooking}>Mua vé</button>
                <button className="btn-trailer" onClick={() => setShowTrailer(true)}>Xem Trailer</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="synopsis">
            <h2>Nội dung phim</h2>
            <p>{movie.synopsis}</p>
          </section>

          <section className="director-cast">
            <h2>Đạo diễn & Diễn viên</h2>
            <div className="cast-grid">
              {movie.cast?.map((member, index) => (
                <div key={index} className="cast-card">
                  <img src={member.avatar || '/images/default-avatar.png'} alt={member.name} />
                  <p>{member.name}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="stills">
            <h2>Hình ảnh</h2>
            <div className="still-container">
              {movie.stills?.slice(0, 2).map((img, idx) => (
                <img key={idx} src={img} alt={`Still ${idx}`} className="still-card" />
              ))}
            </div>
          </section>

          <section className="reviews-section">
            <h2>Đánh giá ({reviews.length})</h2>
            <div className="review-summary">
              <h3>{averageRating}/5</h3>
              <div className="stars">{renderStars(Math.round(averageRating))}</div>
            </div>

            {canReview && (
              <form className="review-form" onSubmit={handleReviewSubmit}>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      type="button" 
                      key={star} 
                      onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                      style={{ color: reviewForm.rating >= star ? 'gold' : 'gray' }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea 
                  value={reviewForm.comment} 
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} 
                  placeholder="Chia sẻ cảm nhận của bạn..."
                  required
                />
                <button type="submit">Gửi đánh giá</button>
              </form>
            )}

            <div className="reviews-list">
              {reviews.map((r, i) => (
                <div key={i} className="review-card">
                  <div className="review-header">
                    <strong>{r.userName || r.user?.fullName || 'Anonymous'}</strong>
                    <span>{renderStars(r.rating)}</span>
                  </div>
                  <p>{r.comment}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="detail-sidebar">
          <div className="info-card">
            <h3>Thông tin chi tiết</h3>
            <p><strong>Thời lượng:</strong> {movie.duration} phút</p>
            <p><strong>Ngày khởi chiếu:</strong> {new Date(movie.releaseDate).toLocaleDateString()}</p>
            <p><strong>Ngôn ngữ:</strong> {movie.language}</p>
            <p><strong>Thể loại:</strong> {movie.genre}</p>
          </div>
          <div className="share-buttons">
            <button onClick={() => alert('Đã chia sẻ')}>Chia sẻ</button>
          </div>
        </div>
      </div>

      {showTrailer && (
        <div className="modal-overlay" onClick={() => setShowTrailer(false)}>
          <div className="trailer-modal" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowTrailer(false)}>X</button>
            <iframe 
              width="100%" 
              height="400" 
              src={`https://www.youtube.com/embed/${movie.trailerId}`} 
              title="Trailer" 
              frameBorder="0" 
              allowFullScreen>
            </iframe>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieDetailPage;
