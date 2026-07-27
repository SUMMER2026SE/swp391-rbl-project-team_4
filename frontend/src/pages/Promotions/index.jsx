import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/css/promotions.css';

const PromotionsPage = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const response = await fetch('/api/news?type=promotion');
        if (response.ok) {
          const data = await response.json();
          setPromotions(data);
        }
      } catch (error) {
        console.error('Failed to fetch promotions', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPromotions();
  }, []);

  return (
    <div className="promotions-page">
      <div className="promotions-hero">
        <h1>KHUYẾN MÃI & ƯU ĐÃI</h1>
      </div>
      
      <div className="promotions-container">
        {loading ? (
          <div className="promotions-grid skeleton-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="promotion-card skeleton-card"></div>
            ))}
          </div>
        ) : promotions.length === 0 ? (
          <div className="empty-state">
            <p>Hiện tại không có khuyến mãi nào. Vui lòng quay lại sau!</p>
          </div>
        ) : (
          <div className="promotions-grid">
            {promotions.map(promo => (
              <div 
                key={promo._id || promo.id} 
                className="promotion-card" 
                onClick={() => navigate(`/promotions/${promo._id || promo.id}`)}
              >
                <div className="promo-image">
                  <img src={promo.image || 'https://via.placeholder.com/400x200'} alt={promo.title} />
                  <span className="promo-tag">Khuyến mãi</span>
                </div>
                <div className="promo-content">
                  <h3 className="promo-title">{promo.title}</h3>
                  <p className="promo-desc">{promo.description || promo.excerpt}</p>
                  <p className="promo-date">{promo.date || 'Có giá trị trong tháng'}</p>
                  <button className="promo-cta">Chi tiết</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotionsPage;
