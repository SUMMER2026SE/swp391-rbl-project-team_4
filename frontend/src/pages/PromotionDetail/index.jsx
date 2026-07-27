import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../assets/css/promotions.css';

const PromotionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [promotion, setPromotion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, you would fetch from /api/news/:id
    const fetchPromotion = async () => {
      try {
        const response = await fetch(`/api/news/${id}`);
        if (!response.ok) throw new Error('Promotion not found');
        const data = await response.json();
        setPromotion(data);
      } catch (error) {
        console.error('Error fetching promotion:', error);
        // Mock data for fallback
        setPromotion({
          id,
          title: 'Khuyến mãi đặc biệt dịp Lễ',
          imageUrl: 'https://via.placeholder.com/1200x500/1a1d20/e50914?text=Promotion+Banner',
          startDate: '2026-07-22',
          endDate: '2026-08-22',
          content: 'Nội dung chi tiết chương trình khuyến mãi... Đang được cập nhật.',
          related: [
            { id: 1, title: 'Giảm 50% vé sinh viên', imageUrl: 'https://via.placeholder.com/300x200' },
            { id: 2, title: 'Combo bắp nước 99k', imageUrl: 'https://via.placeholder.com/300x200' }
          ]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPromotion();
  }, [id]);

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', padding: '50px' }}>Đang tải...</div>;
  }

  if (!promotion) {
    return <div style={{ color: 'white', textAlign: 'center', padding: '50px' }}>Không tìm thấy khuyến mãi.</div>;
  }

  return (
    <div className="promo-detail-page">
      <div className="promo-detail-hero" style={{ 
        backgroundImage: `url(${promotion.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: '400px',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '40px'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0f1113 0%, rgba(15,17,19,0) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ color: 'white', fontSize: '40px', marginBottom: '10px' }}>{promotion.title}</h1>
          <p style={{ color: '#ccc' }}>Áp dụng từ: {new Date(promotion.startDate).toLocaleDateString()} đến {new Date(promotion.endDate).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="promo-detail-content" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px', color: 'white' }}>
        <button 
          onClick={() => navigate('/promotions')}
          style={{ background: 'transparent', color: '#e50914', border: '1px solid #e50914', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', marginBottom: '30px' }}
        >
          &larr; Trở về
        </button>

        <div style={{ lineHeight: '1.8', fontSize: '18px', marginBottom: '50px' }} dangerouslySetInnerHTML={{ __html: promotion.content }} />

        {promotion.related && promotion.related.length > 0 && (
          <div className="related-promotions">
            <h3 style={{ fontSize: '24px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Khuyến mãi khác</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {promotion.related.map(item => (
                <div key={item.id} onClick={() => navigate(`/promotions/${item.id}`)} style={{ cursor: 'pointer', background: '#1a1d20', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                  <div style={{ padding: '15px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px' }}>{item.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotionDetailPage;
