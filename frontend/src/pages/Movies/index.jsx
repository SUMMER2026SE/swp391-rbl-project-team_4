import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import movieApi from '../../services/api';
import '../../assets/css/movies.css';

const GENRES = [
  'Hành động', 'Hài hước', 'Kinh dị', 'Tình cảm', 'Tâm lý', 
  'Khoa học viễn tưởng', 'Phiêu lưu', 'Chính kịch', 'Gia đình', 'Hoạt hình'
];

const FORMATS = ['Standard', 'IMAX', '3D', '4DX'];

export default function MoviesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || 'dang-chieu';
  const searchParam = searchParams.get('search') || '';

  const [movies, setMovies] = useState([]);
  const [filteredMovies, setFilteredMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [sortOption, setSortOption] = useState('phobien');
  const [trailerModal, setTrailerModal] = useState({ isOpen: false, url: '' });

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const data = await movieApi.getAll();
        setMovies(data || []);
      } catch (error) {
        console.error('Failed to fetch movies:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, []);

  const filterAndSortMovies = useCallback(() => {
    let result = [...movies];

    // Filter by status (simulated by some arbitrary field if needed, assuming status is known)
    // For demo, we might just assume 'dang-chieu' shows all or specific ones
    // In a real app, movie.status would be checked.
    if (statusParam === 'dang-chieu') {
      result = result.filter(m => m.status !== 'coming_soon');
    } else if (statusParam === 'sap-chieu') {
      result = result.filter(m => m.status === 'coming_soon');
    }

    // Search filter
    if (searchParam) {
      result = result.filter(m => 
        m.title?.toLowerCase().includes(searchParam.toLowerCase())
      );
    }

    // Genre filter
    if (selectedGenres.length > 0) {
      result = result.filter(m => 
        m.genre && selectedGenres.some(g => m.genre.includes(g))
      );
    }

    // Format filter
    if (selectedFormats.length > 0) {
      result = result.filter(m => 
        m.format && selectedFormats.some(f => m.format.includes(f))
      );
    }

    // Sorting
    if (sortOption === 'moinhat') {
      result.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
    } else if (sortOption === 'theoten') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // phobien
      result.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }

    setFilteredMovies(result);
  }, [movies, statusParam, searchParam, selectedGenres, selectedFormats, sortOption]);

  useEffect(() => {
    filterAndSortMovies();
  }, [filterAndSortMovies]);

  const handleTabChange = (status) => {
    searchParams.set('status', status);
    setSearchParams(searchParams);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    if (val) {
      searchParams.set('search', val);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const toggleGenre = (genre) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleFormat = (format) => {
    setSelectedFormats(prev => 
      prev.includes(format) ? prev.filter(f => f !== format) : [...prev, format]
    );
  };

  const openTrailer = (url) => {
    setTrailerModal({ isOpen: true, url });
  };

  const closeTrailer = () => {
    setTrailerModal({ isOpen: false, url: '' });
  };

  const getEmbedUrl = (url) => {
    if (!url) return '';
    const videoId = url.split('v=')[1]?.split('&')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  };

  return (
    <div className="movies-page">
      <div className="page-header">
        <h1>Danh Sách Phim</h1>
        <div className="search-bar">
          <input 
            type="text" 
            placeholder="Tìm kiếm phim..." 
            value={searchParam}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="movies-layout">
        {/* Filters Sidebar */}
        <aside className="filters-sidebar">
          <div className="filter-group">
            <h3>Trạng thái</h3>
            <div className="tabs">
              <button 
                className={statusParam === 'dang-chieu' ? 'active' : ''}
                onClick={() => handleTabChange('dang-chieu')}
              >Đang chiếu</button>
              <button 
                className={statusParam === 'sap-chieu' ? 'active' : ''}
                onClick={() => handleTabChange('sap-chieu')}
              >Sắp chiếu</button>
            </div>
          </div>

          <div className="filter-group">
            <h3>Thể loại</h3>
            {GENRES.map(g => (
              <label key={g}>
                <input 
                  type="checkbox" 
                  checked={selectedGenres.includes(g)}
                  onChange={() => toggleGenre(g)}
                /> {g}
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Định dạng</h3>
            {FORMATS.map(f => (
              <label key={f}>
                <input 
                  type="checkbox" 
                  checked={selectedFormats.includes(f)}
                  onChange={() => toggleFormat(f)}
                /> {f}
              </label>
            ))}
          </div>
        </aside>

        {/* Movies List */}
        <main className="movies-main">
          <div className="sort-bar">
            <span>Sắp xếp theo: </span>
            <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
              <option value="phobien">Phổ biến</option>
              <option value="moinhat">Mới nhất</option>
              <option value="theoten">Theo tên</option>
            </select>
          </div>

          {loading ? (
            <p>Đang tải dữ liệu phim...</p>
          ) : filteredMovies.length === 0 ? (
            <p className="no-movies-found">Không tìm thấy bộ phim nào phù hợp.</p>
          ) : (
            <div className="movie-grid">
              {filteredMovies.map(movie => (
                <div key={movie.id} className="movie-card">
                  <div className="movie-poster">
                    <span className="rating-badge">{movie.rating || 'C13'}</span>
                    <img src={movie.poster || movie.image} alt={movie.title} />
                    <div className="movie-overlay">
                      <button 
                        className="btn-tickets" 
                        onClick={() => navigate(`/movies/${movie.id}`)}
                      >
                        Chi Tiết
                      </button>
                      <button 
                        className="btn-trailer" 
                        onClick={() => openTrailer(movie.trailerUrl)}
                      >
                        Xem Trailer
                      </button>
                    </div>
                  </div>
                  <h3>{movie.title}</h3>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Trailer Modal */}
      {trailerModal.isOpen && (
        <div className="trailer-modal" onClick={closeTrailer}>
          <div className="trailer-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={closeTrailer}>&times;</button>
            <iframe 
              width="100%" 
              height="400" 
              src={getEmbedUrl(trailerModal.url)} 
              title="YouTube video player" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
}
