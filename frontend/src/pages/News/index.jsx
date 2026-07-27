import React, { useState, useEffect } from 'react';
import '../../assets/css/news-events.css';

const NewsEventsPage = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Tất cả');
  const [page, setPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('/api/news');
        if (response.ok) {
          const data = await response.json();
          setNews(data);
        }
      } catch (error) {
        console.error('Failed to fetch news', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const categories = ['Tất cả', 'Phim mới', 'Sự kiện', 'Khuyến mãi'];
  
  const filteredNews = filter === 'Tất cả' 
    ? news 
    : news.filter(item => item.category === filter);

  const totalPages = Math.ceil(filteredNews.length / itemsPerPage);
  const paginatedNews = filteredNews.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="news-page">
      <div className="news-hero">
        <h1>TIN TỨC & SỰ KIẬN</h1>
      </div>

      <div className="news-container">
        <div className="filter-tabs">
          {categories.map(cat => (
            <button 
              key={cat}
              className={`filter-tab ${filter === cat ? 'active' : ''}`}
              onClick={() => { setFilter(cat); setPage(1); }}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="news-grid skeleton-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="news-card skeleton-card"></div>
            ))}
          </div>
        ) : (
          <>
            <div className="news-grid">
              {paginatedNews.map(item => (
                <div key={item._id || item.id} className="news-card">
                  <div className="news-image">
                    <img src={item.image || 'https://via.placeholder.com/400x250'} alt={item.title} />
                  </div>
                  <div className="news-content">
                    <span className="news-category">{item.category || 'Tin tức'}</span>
                    <h3 className="news-title">{item.title}</h3>
                    <p className="news-excerpt">{item.excerpt}</p>
                    <span className="news-date">{item.date || new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button 
                    key={i + 1} 
                    className={`page-btn ${page === i + 1 ? 'active' : ''}`}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NewsEventsPage;
