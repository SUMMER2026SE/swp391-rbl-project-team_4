// Khởi tạo bookingSessionId theo tài khoản để Account B không kế thừa ghế đang giữ của Account A.
function getBookingOwnerKey() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
        return String(user.UserID || user.userId || user.id || user.Email || user.email || 'guest');
    } catch (e) {
        return 'guest';
    }
}

const bookingOwnerKey = getBookingOwnerKey();
const storedBookingOwnerKey = sessionStorage.getItem('bookingSessionOwnerKey');
const perUserSessionKey = `bookingSessionId:${bookingOwnerKey}`;
let existingBookingSessionId = sessionStorage.getItem('bookingSessionId');

if (storedBookingOwnerKey && storedBookingOwnerKey !== bookingOwnerKey) {
    sessionStorage.removeItem('bookingSessionId');
    sessionStorage.removeItem('booking');
    localStorage.removeItem('booking');
    existingBookingSessionId = null;
}

if (bookingOwnerKey !== 'guest') {
    const savedUserSessionId = localStorage.getItem(perUserSessionKey);
    if (savedUserSessionId) {
        existingBookingSessionId = savedUserSessionId;
        sessionStorage.setItem('bookingSessionId', savedUserSessionId);
    }
}
sessionStorage.setItem('bookingSessionOwnerKey', bookingOwnerKey);

let bookingSessionId = sessionStorage.getItem('bookingSessionId');
if (!bookingSessionId) {
    bookingSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    sessionStorage.setItem('bookingSessionId', bookingSessionId);
}
const socket = typeof io !== 'undefined' ? io({ query: { bookingSessionId } }) : { on: () => { }, emit: () => { } };
const API_BASE = (window.location.protocol === 'file:' || window.location.hostname === '') ? 'http://localhost:9999' : '';

const mockMovies = [
    { id: 1, title: 'LẬT MẶT 7: MỘT ĐIỀU ƯỚC', rating: 'T16', image: 'images/poster.png', genre: 'Hành động', duration: 120, trailer: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: 2, title: 'Doraemon Movie 45 (2026): Nobita Và Lâu Đài Dưới Đáy Biển', rating: 'P', image: 'images/doraemon_sea.png', genre: 'Hoạt hình', duration: 101, trailer: 'https://www.youtube.com/embed/u3JgYkmuK78' },
    { id: 3, title: 'HÀNH TINH KHỈ: VƯƠNG QUỐC MỚI', rating: 'T13', image: 'images/poster.png', genre: 'Viễn tưởng', duration: 145, trailer: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }
];

const mockFB = [
    { id: 'fb1', name: 'Combo Solo (1 Bắp + 1 Nước)', price: 89000, img: 'images/poster.png' },
    { id: 'fb2', name: 'Combo Couple (1 Bắp lớn + 2 Nước)', price: 129000, img: 'images/poster.png' },
    { id: 'fb3', name: 'Snack Khoai Tây', price: 45000, img: 'images/poster.png' }
];

const app = {
    currentShowtimeId: null,
    currentCity: 'Toàn quốc',
    bookingData: {
        step: 1,
        movieId: null,
        seats: new Set(),
        fb: {}, // { fbId: quantity }
        priceSeat: 85000,
        priceVIP: 105000
    },

    // --- City Modal ---
    openCityModal() {
        const modal = document.getElementById('cityModal');
        if (modal) modal.classList.remove('hidden');
    },
    closeCityModal() {
        const modal = document.getElementById('cityModal');
        if (modal) modal.classList.add('hidden');
    },
    selectCity(city) {
        this.currentCity = city;
        const textEl = document.getElementById('currentCityText');
        if (textEl) textEl.innerText = city;
        this.closeCityModal();
        this.loadDynamicMovies();
    },

    // --- Navigation & Views ---
    goHome() {
        this.switchView('home-view');
        this.resetBooking();
    },
    goAuth() {
        this.switchView('auth-view');
        this.resetBooking();
    },
    goProfile() {
        this.switchView('profile-view');
        this.resetBooking();
    },
    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.remove('hidden');
        document.getElementById(viewId).classList.add('active');
        window.scrollTo(0, 0);
    },
    switchAuthTab(tab) {
        const tabs = document.querySelectorAll('.auth-tab');
        const forms = document.querySelectorAll('.auth-form');
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));
        if (tab === 'login') {
            tabs[0].classList.add('active');
            document.getElementById('login-form').classList.add('active');
        } else {
            tabs[1].classList.add('active');
            document.getElementById('register-form').classList.add('active');
        }
    },

    // --- Home Logic ---
    renderMovies() {
        const container = document.getElementById('moviesList');
        container.innerHTML = mockMovies.map(m => `
            <div class="movie-card">
                <div class="movie-poster-wrap">
                    <span class="age-badge ${m.rating}">${m.rating}</span>
                    <img src="${m.image}" alt="${m.title}">
                    <div class="poster-overlay">
                        <button class="btn-trailer" onclick="app.openTrailer('${m.trailer}')">▶ Xem Trailer</button>
                        <button class="btn-primary" onclick="app.startBooking(${m.id})">ĐẶT VÉ</button>
                    </div>
                </div>
                <div class="movie-info">
                    <h3>${m.title}</h3>
                    <p>${m.genre} | ${m.duration} phút</p>
                </div>
            </div>
        `).join('');
    },
    openTrailer(url) {
        if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
            alert('Trailer chưa có sẵn cho phim này.');
            return;
        }

        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('//')) {
            cleanUrl = 'https://' + cleanUrl;
        }

        let modal = document.getElementById('trailerModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'trailerModal';
            modal.className = 'modal-overlay hidden';
            modal.innerHTML = `
                <div class="modal-content">
                    <button class="btn-close-modal" onclick="app.closeTrailer()">×</button>
                    <div class="video-container">
                        <iframe id="trailerIframe" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        let embedUrl = cleanUrl;
        if (cleanUrl.includes('youtube.com/embed/')) {
            embedUrl = cleanUrl;
        } else {
            try {
                let videoId = '';
                if (cleanUrl.includes('youtube.com/watch')) {
                    const urlObj = new URL(cleanUrl);
                    videoId = urlObj.searchParams.get('v');
                    if (!videoId) {
                        const match = cleanUrl.match(/[?&]v=([^&]+)/);
                        if (match) videoId = match[1];
                    }
                } else if (cleanUrl.includes('youtu.be/')) {
                    videoId = cleanUrl.split('youtu.be/')[1].split('?')[0];
                } else if (cleanUrl.includes('youtube.com/v/')) {
                    videoId = cleanUrl.split('youtube.com/v/')[1].split('?')[0];
                } else if (cleanUrl.includes('youtube.com/shorts/')) {
                    videoId = cleanUrl.split('youtube.com/shorts/')[1].split('?')[0];
                }
                if (videoId) {
                    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                }
            } catch (e) {
                console.error("Error parsing YouTube URL:", e);
                if (cleanUrl.includes('youtube.com/watch?v=')) {
                    embedUrl = cleanUrl.replace('watch?v=', 'embed/');
                    const ampersandPos = embedUrl.indexOf('&');
                    if (ampersandPos !== -1) {
                        embedUrl = embedUrl.substring(0, ampersandPos);
                    }
                }
            }
        }
        console.log("Original URL:", url, "-> Embed URL:", embedUrl);

        const iframe = document.getElementById('trailerIframe');
        iframe.src = embedUrl;
        modal.classList.remove('hidden');
    },
    closeTrailer() {
        const modal = document.getElementById('trailerModal');
        if (modal) {
            const iframe = document.getElementById('trailerIframe');
            iframe.src = '';
            modal.classList.add('hidden');
        }
    },
    switchMovieTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        // Logic filter movies would go here
    },

    // --- Booking Flow ---
    resetBooking() {
        if (this.currentShowtimeId && this.bookingData.seats.size > 0) {
            this.bookingData.seats.forEach(seatId => {
                socket.emit('releaseSeat', { showtimeId: this.currentShowtimeId, seatId });
            });
        }
        this.bookingData = { step: 1, movieId: null, seats: new Set(), fb: {}, priceSeat: 85000, priceVIP: 105000 };
        this.currentShowtimeId = null;
    },
    startBooking(movieId) {
        this.bookingData.movieId = movieId;
        const movie = mockMovies.find(m => m.id === movieId);
        document.getElementById('summaryMovieName').innerText = movie ? movie.title : 'Phim Đang Chọn';

        this.switchView('booking-view');
        this.renderTimeSlots();
        this.updateBookingStep(1);
    },
    renderTimeSlots() {
        const grid = document.getElementById('timeGrid');
        const times = ['09:45', '11:20', '14:00', '16:15', '19:30', '21:00'];
        grid.innerHTML = times.map((t, idx) => `
            <button class="time-slot" onclick="app.selectTime('${t}', ${idx + 100})">${t}</button>
        `).join('');
    },
    selectTime(time, showtimeId) {
        this.currentShowtimeId = showtimeId;
        document.getElementById('summaryTime').innerText = `${time} - Hôm nay`;
        socket.emit('joinShowtime', showtimeId);
        this.nextStep();
    },
    nextStep() {
        if (this.bookingData.step === 2 && this.bookingData.seats.size === 0) {
            alert("Vui lòng chọn ít nhất 1 ghế!");
            return;
        }
        if (this.bookingData.step < 4) {
            this.updateBookingStep(this.bookingData.step + 1);
        }
    },
    prevStep() {
        if (this.bookingData.step > 1) {
            this.updateBookingStep(this.bookingData.step - 1);
        } else {
            this.goHome(); // Hủy
        }
    },
    updateBookingStep(step) {
        this.bookingData.step = step;

        // Hide all steps
        document.querySelectorAll('.booking-step').forEach(s => s.classList.add('hidden'));
        document.getElementById(`step-${step}-${['filter', 'seat', 'fb', 'checkout'][step - 1]}`).classList.remove('hidden');

        // Update Progress Bar
        document.querySelectorAll('.booking-progress .step').forEach((s, idx) => {
            if (idx + 1 <= step) s.classList.add('active');
            else s.classList.remove('active');
        });

        // Step Specifics
        if (step === 1) {
            document.getElementById('btnPrevStep').innerText = 'Hủy';
            document.getElementById('btnNextStep').classList.add('hidden'); // Only next via selecting time
        } else {
            document.getElementById('btnPrevStep').innerText = 'Quay lại';
            document.getElementById('btnNextStep').classList.remove('hidden');
        }

        if (step === 2) {
            this.renderSeatGrid();
        }
        if (step === 3) {
            this.renderFBGrid();
        }
        if (step === 4) {
            document.getElementById('btnNextStep').innerText = 'THANH TOÁN';
        } else {
            document.getElementById('btnNextStep').innerText = 'Tiếp Tục';
        }

        this.updateSummarySidebar();
    },

    // --- Seats ---
    renderSeatGrid() {
        const grid = document.getElementById('seatGrid');
        grid.innerHTML = '';
        const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
        const cols = 10;
        const soldMock = ['C4', 'C5', 'F10'];

        for (let r of rows) {
            for (let c = 1; c <= cols; c++) {
                const seatId = `${r}${c}`;
                const div = document.createElement('div');
                div.id = `seat-${seatId}`;
                let type = 'empty';
                if (soldMock.includes(seatId)) type = 'sold';
                else if (r === 'E' || r === 'F') type = 'vip';

                div.className = `seat ${type}`;
                div.innerText = seatId;
                div.dataset.type = type; // store type

                if (this.bookingData.seats.has(seatId)) {
                    div.className = 'seat holding';
                }

                div.onclick = () => this.handleSeatClick(seatId, type);
                grid.appendChild(div);
            }
        }
    },
    handleSeatClick(seatId, type) {
        const seatEl = document.getElementById(`seat-${seatId}`);
        if (seatEl.classList.contains('sold')) return;

        if (this.bookingData.seats.has(seatId)) {
            socket.emit('releaseSeat', { showtimeId: this.currentShowtimeId, seatId });
            this.bookingData.seats.delete(seatId);
            seatEl.className = `seat ${type}`;
        } else {
            if (this.bookingData.seats.size >= 8) {
                alert("Bạn chỉ được chọn tối đa 8 ghế!"); return;
            }
            if (seatEl.classList.contains('holding')) return;
            socket.emit('holdSeat', { showtimeId: this.currentShowtimeId, seatId });
            this.bookingData.seats.add(seatId);
            seatEl.className = 'seat holding';
        }
        this.updateSummarySidebar();
    },

    // --- F&B ---
    renderFBGrid() {
        const grid = document.getElementById('fbGrid');
        grid.innerHTML = mockFB.map(fb => `
            <div class="fb-item">
                <img src="${fb.img}" alt="${fb.name}" class="fb-img">
                <div class="fb-info">
                    <div class="fb-name">${fb.name}</div>
                    <div class="fb-price">${fb.price.toLocaleString('vi-VN')} đ</div>
                    <div class="fb-controls">
                        <button class="btn-qty" onclick="app.updateFB('${fb.id}', -1)">-</button>
                        <span id="qty-${fb.id}">${this.bookingData.fb[fb.id] || 0}</span>
                        <button class="btn-qty" onclick="app.updateFB('${fb.id}', 1)">+</button>
                    </div>
                </div>
            </div>
        `).join('');
    },
    updateFB(id, change) {
        let current = this.bookingData.fb[id] || 0;
        current += change;
        if (current < 0) current = 0;
        this.bookingData.fb[id] = current;
        document.getElementById(`qty-${id}`).innerText = current;
        this.updateSummarySidebar();
    },

    // --- Summary & Total ---
    updateSummarySidebar() {
        const seatsArr = Array.from(this.bookingData.seats);
        document.getElementById('summarySeats').innerText = seatsArr.length > 0 ? seatsArr.join(', ') : '...';

        let fbText = [];
        let fbTotal = 0;
        for (let id in this.bookingData.fb) {
            let qty = this.bookingData.fb[id];
            if (qty > 0) {
                let item = mockFB.find(f => f.id === id);
                fbText.push(`${qty}x ${item.name}`);
                fbTotal += qty * item.price;
            }
        }
        document.getElementById('summaryFB').innerText = fbText.length > 0 ? fbText.join(', ') : '...';

        let seatTotal = 0;
        seatsArr.forEach(s => {
            if (s.startsWith('E') || s.startsWith('F')) seatTotal += this.bookingData.priceVIP;
            else seatTotal += this.bookingData.priceSeat;
        });

        const total = seatTotal + fbTotal;
        document.getElementById('summaryTotal').innerText = `${total.toLocaleString('vi-VN')} đ`;
    },

    // --- Socket Listeners ---
    initSocket() {
        socket.on('connect', () => console.log('Connected Socket'));
        socket.on('seatStatusUpdated', (data) => {
            const { showtimeId, seatId, status } = data;
            if (this.currentShowtimeId != showtimeId) return;
            const seatEl = document.getElementById(`seat-${seatId}`);
            if (!seatEl) return;
            const type = seatEl.dataset.type; // vip, empty

            if (status === 'Đang chọn' && !this.bookingData.seats.has(seatId)) {
                seatEl.className = 'seat holding';
            } else if (status === 'Trống') {
                seatEl.className = `seat ${type}`;
                this.bookingData.seats.delete(seatId);
            } else if (status === 'Đã bán') {
                seatEl.className = 'seat sold';
                this.bookingData.seats.delete(seatId);
            }
            this.updateSummarySidebar();
        });
    },

    handleBookingClick(movieId) {
        const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
        if (!token) {
            alert('Vui lòng đăng nhập để tiếp tục đặt vé!');
            window.location.href = 'auth.html';
        } else {
            window.location.href = `booking.html?movieId=${movieId}`;
        }
    },

    // --- Dynamic Movie Fetching for Guest Pages ---
    allMovies: [],
    filterState: {
        status: 'Now Showing',
        search: '',
        genres: [],
        formats: []
    },

    renderGenres(genresString) {
        if (!genresString) return '<span data-i18n="genre_drama">Chính kịch</span>';

        const genreMap = {
            'Hành động': 'genre_action',
            'Hài hước': 'genre_comedy',
            'Hài': 'genre_comedy',
            'Kinh dị': 'genre_horror',
            'Tình cảm': 'genre_romance',
            'Tâm lý': 'genre_psychological',
            'Khoa học viễn tưởng': 'genre_scifi',
            'Viễn tưởng': 'genre_scifi_short',
            'Phiêu lưu': 'genre_adventure',
            'Chính kịch': 'genre_drama',
            'Gia đình': 'genre_family',
            'Hoạt hình': 'genre_animation',
            'Ca Nhạc': 'genre_musical',
            'Ly Kì': 'genre_thriller',
            'Giật Gân': 'genre_suspense'
        };

        const genres = genresString.split(',').map(g => g.trim());
        return genres.map(g => {
            const key = genreMap[g];
            return key ? `<span data-i18n="${key}">${g}</span>` : g;
        }).join(', ');
    },

    async loadDynamicMovies() {
        // 1. For index.html (Now Showing) -> #now-showing .movie-grid
        const nowShowingGrid = document.querySelector('#now-showing .movie-grid');
        const imaxGrid = document.querySelector('#imax .movie-grid');
        if (nowShowingGrid) {
            try {
                const res = await fetch(`${API_BASE}/api/movies/now-showing`);
                const json = await res.json();
                if (json.success && json.data) {
                    nowShowingGrid.innerHTML = json.data.map(movie => `
                        <div class="movie-card">
                            <div class="movie-poster">
                                <span class="age-badge age-${movie.AgeRating || 'ALL'}">${movie.AgeRating || 'ALL'}</span>
                                <img src="${movie.PosterURL || 'images/default_poster.svg'}" alt="${movie.Title}" onerror="this.onerror=null; this.src='images/default_poster.svg'">
                                <div class="poster-overlay">
                                    <button class="btn-secondary" onclick="window.location.href='movie-detail.html?id=${movie.MovieID}'" data-i18n="btn_detail_short">Chi Tiết</button>
                                    <button class="btn-trailer" onclick="event.stopPropagation(); app.openTrailer('${movie.TrailerURL}')" data-i18n="btn_trailer">▶ Trailer</button>
                                    <button class="btn-primary" onclick="app.handleBookingClick(${movie.MovieID})" data-i18n="btn_book">ĐẶT VÉ</button>
                                </div>
                            </div>
                            <div class="movie-info">
                                <h3 class="movie-title">${movie.Title}</h3>
                                <div class="movie-genre">${app.renderGenres(movie.Genres)} | ${movie.Duration} <span data-i18n="movie_minutes">phút</span></div>
                                <div class="movie-rating">★ 8.5</div>
                            </div>
                        </div>
                    `).join('');
                    if (typeof changeLanguage === 'function') changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');

                    if (imaxGrid) {
                        const imaxMovies = json.data.filter(movie => movie.Formats && movie.Formats.includes('IMAX'));
                        if (imaxMovies.length > 0) {
                            imaxGrid.innerHTML = imaxMovies.map(movie => `
                                <div class="movie-card">
                                    <div class="movie-poster">
                                        <span class="age-badge age-${movie.AgeRating || 'ALL'}">${movie.AgeRating || 'ALL'}</span>
                                        <img src="${movie.PosterURL || 'images/default_poster.svg'}" alt="${movie.Title}" onerror="this.onerror=null; this.src='images/default_poster.svg'">
                                        <div class="poster-overlay">
                                            <button class="btn-secondary" onclick="window.location.href='movie-detail.html?id=${movie.MovieID}'" data-i18n="btn_detail_short">Chi Tiết</button>
                                            <button class="btn-trailer" onclick="event.stopPropagation(); app.openTrailer('${movie.TrailerURL}')" data-i18n="btn_trailer">▶ Trailer</button>
                                            <button class="btn-primary" onclick="app.handleBookingClick(${movie.MovieID})" data-i18n="btn_book">ĐẶT VÉ</button>
                                        </div>
                                    </div>
                                    <div class="movie-info">
                                        <h3 class="movie-title">${movie.Title}</h3>
                                        <div class="movie-genre">${app.renderGenres(movie.Genres)} | ${movie.Duration} <span data-i18n="movie_minutes">phút</span></div>
                                        <div class="movie-rating">★ 8.5</div>
                                    </div>
                                </div>
                            `).join('');
                            if (typeof changeLanguage === 'function') changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
                        } else {
                            imaxGrid.innerHTML = '<p style="color:#9ca3af;padding:20px;grid-column: 1/-1;text-align:center;">Hiện tại không có phim chiếu định dạng IMAX.</p>';
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load now showing movies:', err);
            }
        }

        // 2. For index.html (Coming Soon) -> .movie-grid
        const comingSoonGrid = document.querySelector('#coming-soon .movie-grid');
        if (comingSoonGrid) {
            try {
                const res = await fetch(`${API_BASE}/api/movies/coming-soon`);
                const json = await res.json();
                if (json.success && json.data) {
                    comingSoonGrid.innerHTML = json.data.map(movie => `
                        <div class="movie-card">
                            <div class="movie-poster">
                                <span class="coming-badge" data-i18n="movie_coming_soon">SẮP CHIẾU</span>
                                <img src="${movie.PosterURL || 'images/default_poster.svg'}" alt="${movie.Title}" onerror="this.onerror=null; this.src='images/default_poster.svg'">
                                <div class="poster-overlay">
                                    <button class="btn-secondary" onclick="window.location.href='movie-detail.html?id=${movie.MovieID}'" data-i18n="btn_detail_short">Chi Tiết</button>
                                    <button class="btn-trailer" onclick="event.stopPropagation(); app.openTrailer('${movie.TrailerURL}')" data-i18n="btn_trailer">▶ Trailer</button>
                                </div>
                            </div>
                            <div class="movie-info">
                                <h3 class="movie-title">${movie.Title}</h3>
                                <div class="movie-genre">${movie.Genres ? app.renderGenres(movie.Genres) : '<span data-i18n="genre_scifi">Khoa học viễn tưởng</span>'} | ${movie.Duration} <span data-i18n="movie_minutes">phút</span></div>
                                <div class="movie-rating" style="color:var(--primary); font-size:0.9rem;" data-i18n="movie_coming_soon">Sắp chiếu</div>
                            </div>
                        </div>
                    `).join('');
                    if (typeof changeLanguage === 'function') changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
                }
            } catch (err) {
                console.error('Failed to load coming soon movies:', err);
            }
        }

        // 3. For movies.html -> .movies-grid
        const allMoviesGrid = document.querySelector('.movies-grid');
        if (allMoviesGrid) {
            try {
                const res = await fetch(`${API_BASE}/api/movies`);
                const json = await res.json();
                if (json.success && json.data) {
                    window.allMoviesData = json.data;
                    app.allMovies = json.data;

                    // Parse query parameters to pre-fill filters
                    const urlParams = new URLSearchParams(window.location.search);
                    const statusParam = urlParams.get('status');
                    const searchParam = urlParams.get('search');

                    if (statusParam === 'showing' || statusParam === 'Now Showing') {
                        app.filterState.status = 'Now Showing';
                    } else if (statusParam === 'coming' || statusParam === 'Coming Soon') {
                        app.filterState.status = 'Coming Soon';
                    } else {
                        app.filterState.status = 'Now Showing'; // Default view
                    }

                    if (searchParam) {
                        app.filterState.search = searchParam;
                        const searchInput = document.getElementById('searchInput');
                        if (searchInput) searchInput.value = searchParam;
                    }

                    // Render filtered movies and update tab UI
                    app.updateTabUI();
                    app.filterAndRenderMovies();
                    // NOTE: Event listeners for filters are set up in the DOMContentLoaded block below
                    // to avoid duplicate listeners that could override status-tab filtering.
                }
            } catch (err) {
                console.error('Failed to load all movies:', err);
            }
        }
    },

    renderMoviesGrid(movies) {
        const allMoviesGrid = document.querySelector('.movies-grid');
        if (!allMoviesGrid) return;

        if (!movies || movies.length === 0) {
            allMoviesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Không tìm thấy phim phù hợp.</div>';
            return;
        }

        allMoviesGrid.innerHTML = movies.map(movie => `
            <div class="movie-card">
                <div class="movie-poster">
                    <span class="rating-badge age-${movie.AgeRating || 'ALL'}">${movie.AgeRating || 'ALL'}</span>
                    <img src="${movie.PosterURL || 'images/default_poster.svg'}" alt="${movie.Title}" onerror="this.onerror=null; this.src='images/default_poster.svg'">
                    <div class="movie-overlay">
                        <button class="btn-tickets" onclick="window.location.href='movie-detail.html?id=${movie.MovieID}'" data-i18n="btn_detail_short">Chi Tiết</button>
                        <button class="btn-trailer" onclick="event.stopPropagation(); app.openTrailer('${movie.TrailerURL}')" data-i18n="btn_trailer">▶ Trailer</button>
                    </div>
                </div>
                <div class="movie-info">
                    <h3 class="movie-title" title="${movie.Title}">${movie.Title}</h3>
                    <div class="movie-rating">
                        <span class="stars">★ 8.5</span>
                        <span class="genres">${app.renderGenres(movie.Genres)} | ${movie.Duration} <span data-i18n="movie_minutes">phút</span></span>
                    </div>
                </div>
            </div>
        `).join('');
        if (typeof changeLanguage === 'function') changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
    },

    switchMovieStatusTab(status) {
        app.filterState.status = status;
        app.updateTabUI();
        app.filterAndRenderMovies();
    },

    updateTabUI() {
        const tabNowShowing = document.getElementById('tab-now-showing');
        const tabComingSoon = document.getElementById('tab-coming-soon');
        if (tabNowShowing && tabComingSoon) {
            if (app.filterState.status === 'Now Showing') {
                tabNowShowing.classList.add('active');
                tabComingSoon.classList.remove('active');
            } else {
                tabNowShowing.classList.remove('active');
                tabComingSoon.classList.add('active');
            }
        }
    },

    filterAndRenderMovies() {
        const allMoviesGrid = document.querySelector('.movies-grid');
        if (!allMoviesGrid || !app.allMovies) return;

        // Collect checked genre & format filter values
        const selectedGenres = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => cb.value);
        const selectedFormats = Array.from(document.querySelectorAll('input[name="format"]:checked')).map(cb => cb.value);
        const searchQuery = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

        const filtered = app.allMovies.filter(movie => {
            // 1. Status Tab filter
            if (movie.Status !== app.filterState.status) {
                return false;
            }

            // 2. Text Search filter
            if (searchQuery) {
                const titleMatch = movie.Title.toLowerCase().includes(searchQuery);
                const descMatch = movie.Description && movie.Description.toLowerCase().includes(searchQuery);
                const directorMatch = movie.Director && movie.Director.toLowerCase().includes(searchQuery);
                const castMatch = movie.MainCast && movie.MainCast.toLowerCase().includes(searchQuery);
                if (!titleMatch && !descMatch && !directorMatch && !castMatch) {
                    return false;
                }
            }

            // 3. Genre checkbox filter (logical OR within genres)
            if (selectedGenres.length > 0) {
                const movieGenres = movie.Genres ? movie.Genres.split(',').map(g => g.trim()) : [];
                const matchesGenre = selectedGenres.some(g => movieGenres.includes(g));
                if (!matchesGenre) return false;
            }

            // 4. Format checkbox filter (logical OR within formats)
            if (selectedFormats.length > 0) {
                const movieFormats = movie.Formats ? movie.Formats.split(',').map(f => f.trim()) : ['Standard'];
                const matchesFormat = selectedFormats.some(f => movieFormats.includes(f));
                if (!matchesFormat) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            allMoviesGrid.innerHTML = `
                <div class="no-movies-found" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted-light);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5; display: inline-block;">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 12h8" />
                    </svg>
                    <p style="font-size: 1.1rem; font-weight: 500;">Không tìm thấy phim phù hợp với bộ lọc.</p>
                </div>
            `;
            return;
        }

        allMoviesGrid.innerHTML = filtered.map(movie => `
            <div class="movie-card">
                <div class="movie-poster">
                    <span class="rating-badge age-${movie.AgeRating || 'ALL'}">${movie.AgeRating || 'ALL'}</span>
                    <img src="${movie.PosterURL || 'images/default_poster.svg'}" alt="${movie.Title}" onerror="this.onerror=null; this.src='images/default_poster.svg'">
                    <div class="movie-overlay">
                        <button class="btn-tickets" onclick="window.location.href='movie-detail.html?id=${movie.MovieID}'" data-i18n="btn_detail_short">Chi Tiết</button>
                        <button class="btn-trailer" onclick="event.stopPropagation(); app.openTrailer('${movie.TrailerURL}')" data-i18n="btn_trailer">▶ Trailer</button>
                    </div>
                </div>
                <div class="movie-info">
                    <h3 class="movie-title" title="${movie.Title}">${movie.Title}</h3>
                    <div class="movie-rating">
                        <span class="stars">★ 8.5</span>
                        <span class="genres">${app.renderGenres(movie.Genres)} | ${movie.Duration} <span data-i18n="movie_minutes">phút</span></span>
                    </div>
                </div>
            </div>
        `).join('');
        if (typeof changeLanguage === 'function') changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
    },

    initMovieFilters() {
        const checkboxes = document.querySelectorAll('.filter-item input[type="checkbox"]');
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');

        const applyFilters = () => {
            if (!window.allMoviesData) return;

            let filtered = [...window.allMoviesData];

            // 1. Filter by Search
            if (searchInput && searchInput.value) {
                const q = searchInput.value.toLowerCase();
                filtered = filtered.filter(m => m.Title.toLowerCase().includes(q));
            }

            // 2. Filter by Genres
            const selectedGenres = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => cb.value);
            if (selectedGenres.length > 0) {
                filtered = filtered.filter(m => {
                    const genreStr = m.Genres || m.MainCast || "";
                    if (!genreStr) return false;

                    const mGenres = genreStr.split(',').map(g => g.trim().toLowerCase());

                    return selectedGenres.some(selected => {
                        const s = selected.toLowerCase();
                        // Either exact match in array, or substring match in the full string
                        return mGenres.includes(s) || genreStr.toLowerCase().includes(s);
                    });
                });
            }

            // 3. Filter by Formats
            const selectedFormats = Array.from(document.querySelectorAll('input[name="format"]:checked')).map(cb => cb.value);
            if (selectedFormats.length > 0) {
                filtered = filtered.filter(m => {
                    if (!m.Formats) return false;
                    const mFormats = m.Formats.split(',').map(f => f.trim());
                    return selectedFormats.some(f => mFormats.includes(f));
                });
            }

            // 4. Sort
            if (sortSelect) {
                const sortMode = sortSelect.value;
                if (sortMode === 'title') {
                    filtered.sort((a, b) => a.Title.localeCompare(b.Title));
                } else if (sortMode === 'newest') {
                    filtered.sort((a, b) => b.MovieID - a.MovieID);
                }
                // popular, rating could be added if data supports it
            }

            app.renderMoviesGrid(filtered);
        };

        checkboxes.forEach(cb => cb.addEventListener('change', applyFilters));
        if (searchInput) searchInput.addEventListener('input', applyFilters);
        if (sortSelect) sortSelect.addEventListener('change', applyFilters);
    },

    // --- Load Cinemas for Navbar ---
    async loadCinemasNavbar() {
        const dropdown = document.getElementById('cinemaDropdown');
        if (!dropdown) return;
        try {
            const res = await fetch(`${API_BASE}/api/movies/cinemas`);
            const json = await res.json();
            if (json.success && json.data) {
                dropdown.innerHTML = json.data.map(c => `
                    <a href="booking.html?cinemaId=${c.CinemaID}">${c.CinemaName}</a>
                `).join('');
            }
        } catch (e) {
            console.error("Error loading cinemas navbar:", e);
        }
    },
    // --- Promotions (Tin tức & Khuyến mãi) ---
    async loadPromotions() {
        const grid = document.getElementById('promotionsGrid');
        if (!grid) return;

        try {
            // Lấy cả Khuyến mãi và Tin tức
            const [promoRes, newsRes] = await Promise.all([
                fetch(`${API_BASE}/api/movies/promotions`),
                fetch(`${API_BASE}/api/news`)
            ]);
            const promoJson = await promoRes.json();
            const newsJson = await newsRes.json();

            let combined = [];

            if (promoJson.success && promoJson.data) {
                combined = combined.concat(promoJson.data.map(p => ({
                    id: p.PromotionID,
                    type: 'promo',
                    title: p.Title,
                    description: p.Description,
                    badge: p.BadgeLabel,
                    img: p.ImageURL,
                    link: p.LinkURL || '#',
                    isFeatured: p.IsFeatured,
                    sortOrder: p.SortOrder,
                    date: p.CreatedAt
                })));
            }

            if (newsJson.success && newsJson.data) {
                combined = combined.concat(newsJson.data.map(n => ({
                    id: n.ArticleID,
                    type: 'news',
                    title: n.Title,
                    description: n.Summary,
                    badge: n.BadgeLabel || (n.Type === 'events' ? '<span data-i18n="badge_event">Sự kiện</span>' : '<span data-i18n="badge_news">Tin tức</span>'),
                    img: n.ImageURL,
                    link: 'news-events.html',
                    isFeatured: n.IsFeatured,
                    sortOrder: n.SortOrder,
                    date: n.PublishedAt
                })));
            }

            if (combined.length === 0) {
                grid.innerHTML = '<p style="color:#999;padding:20px;text-align:center;" data-i18n="empty_news_promo">Chưa có tin tức & khuyến mãi nào.</p>';
                return;
            }

            // Ưu tiên Nổi bật, sau đó đến Thứ tự hiển thị, sau đó mới đến ngày mới nhất
            combined.sort((a, b) => {
                if (a.isFeatured && !b.isFeatured) return -1;
                if (!a.isFeatured && b.isFeatured) return 1;
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                return new Date(b.date) - new Date(a.date);
            });

            const featured = combined.find(p => p.isFeatured) || combined[0];
            const normals = combined.filter(p => p !== featured).slice(0, 4); // Hiển thị thêm 4 thẻ phụ

            let html = '';

            // Featured card
            html += `
                <div class="promo-card promo-featured">
                    <div class="promo-image">
                        ${featured.badge ? `<div class="promo-badge">${featured.badge}</div>` : ''}
                        <img src="${featured.img || 'images/default_poster.svg'}"
                             alt="${featured.title}"
                             onerror="this.onerror=null;this.src='images/default_poster.svg'">
                    </div>
                    <div class="promo-content">
                        <h3>${featured.title}</h3>
                        <p>${featured.description || ''}</p>
                        <a href="${featured.link}" class="btn-promo" data-i18n="btn_learn_more">Tìm Hiểu Thêm</a>
                    </div>
                </div>`;

            // Normal cards
            normals.forEach(p => {
                html += `
                <div class="promo-card promo-normal">
                    ${p.badge ? `<div class="promo-badge-overlay">${p.badge}</div>` : ''}
                    <img src="${p.img || 'images/default_poster.svg'}"
                         alt="${p.title}"
                         onerror="this.onerror=null;this.src='images/default_poster.svg'">
                    <div class="promo-overlay-content">
                        <h3>${p.title}</h3>
                        <p>${p.description || ''}</p>
                    </div>
                </div>`;
            });

            grid.innerHTML = html;
            if (typeof changeLanguage === 'function') changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
        } catch (err) {
            console.warn('[app] loadPromotions failed, showing fallback:', err.message);
            // Fallback to static cards if API not available
            grid.innerHTML = `
                <div class="promo-card promo-featured">
                    <div class="promo-image">
                        <div class="promo-badge">MEMBER EXCLUSIVE</div>
                        <img src="images/combo_popcorn.png" alt="Unlimited Popcorn Thursdays">
                    </div>
                    <div class="promo-content">
                        <h3>Unlimited Popcorn Thursdays</h3>
                        <p>Tham gia chương trình Star Rewards ngay hôm nay và nhận bỏng ngô không giới hạn mỗi thứ năm với mọi lần mua vé.</p>
                        <a href="#" class="btn-promo" data-i18n="btn_learn_more">Tìm Hiểu Thêm</a>
                    </div>
                </div>
                <div class="promo-card promo-normal">
                    <div class="promo-badge-overlay">GROUP DISCOUNTS</div>
                    <img src="images/promo_student.png" alt="Group Discounts">
                    <div class="promo-overlay-content">
                        <h3>Group Discounts</h3>
                        <p>Tiết kiệm 20% cho đặt chỗ 10 vé trở lên</p>
                    </div>
                </div>
                <div class="promo-card promo-normal">
                    <div class="promo-badge-overlay">EXPERIENCE</div>
                    <img src="images/promo_imax_weekend.png" alt="IMAX Weekend">
                    <div class="promo-overlay-content">
                        <h3>IMAX Weekend</h3>
                        <p>Trải nghiệm phim ở định dạng lớn nhất có thể</p>
                    </div>
                </div>`;
            if (typeof changeLanguage === 'function') changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
        }
    }
};


document.addEventListener('DOMContentLoaded', () => {
    app.initSocket();
    app.loadDynamicMovies();
    app.loadPromotions();
    app.loadCinemasNavbar();

    const searchInput = document.getElementById('searchInput');
    const isMoviesPage = !!document.querySelector('.movies-grid');

    if (searchInput) {
        if (isMoviesPage) {
            searchInput.addEventListener('input', () => app.filterAndRenderMovies());
        } else {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    window.location.href = `movies.html?search=${encodeURIComponent(searchInput.value)}`;
                }
            });
        }
    }

    // Bind change listeners to genre and format checkboxes on movies page
    if (isMoviesPage) {
        document.querySelectorAll('input[name="genre"], input[name="format"]').forEach(cb => {
            cb.addEventListener('change', () => app.filterAndRenderMovies());
        });
    }
});

