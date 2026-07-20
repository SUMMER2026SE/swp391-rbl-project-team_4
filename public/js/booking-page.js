(function () {
    const POSTER_FALLBACK = 'images/poster.png';
    const API_TIMEOUT_MS = 10000;

    let allCinemas = [];
    let rawData = [];
    let selectedCity = '';
    let selectedCinemaId = null;
    let selectedDate = toDateInputValue(new Date());
    let selectedGenre = 'all';
    let searchQuery = '';
    let sortMode = 'time';
    let movieIdFilter = null;
    let selectedMovie = null;

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    function toDateInputValue(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function fmtDate(str) {
        if (!str) return '';
        const [y, m, d] = String(str).split('-');
        return `${d}/${m}/${y}`;
    }

    async function fetchJson(url, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeout || API_TIMEOUT_MS);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch (err) {
                throw new Error(`API ${url} không trả JSON hợp lệ`);
            }
            if (!res.ok) {
                throw new Error(json.message || `API ${url} lỗi ${res.status}`);
            }
            return json;
        } finally {
            clearTimeout(timer);
        }
    }

    window.showToast = function (msg, type = 'green') {
        const el = $('toastEl');
        if (!el) return;
        el.textContent = msg;
        el.className = 'toast ' + type;
        el.style.display = 'block';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.display = 'none'; }, 3000);
    };

    document.addEventListener('DOMContentLoaded', initBookingPage);

    async function initBookingPage() {
        const params = new URLSearchParams(window.location.search);
        movieIdFilter = params.get('movieId') || null;
        selectedCity = params.get('city') || '';
        selectedCinemaId = params.get('cinemaId') ? Number(params.get('cinemaId')) : null;

        initAuth();
        buildDatePills();
        bindFilters();
        initBannerCarousel();
        showSkeleton();

        try {
            await loadCinemas();
            if (movieIdFilter) await loadMovieInfo(movieIdFilter);
        } catch (err) {
            console.error('[Booking] init:', err);
            showCinemaLoadError(err);
        }
    }

    function initAuth() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
            const btn = $('btnLogin');
            if (user.fullName && btn) {
                btn.textContent = user.fullName;
                btn.href = 'profile.html';
            }
        } catch (err) {}
    }

    function initBannerCarousel() {
        const slides = document.querySelectorAll('.ctb-slide');
        if (!slides.length || window.__bookingBannerStarted) return;
        window.__bookingBannerStarted = true;
        let currentIndex = 0;
        setInterval(() => {
            slides[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % slides.length;
            slides[currentIndex].classList.add('active');
        }, 10000);
    }

    function bindFilters() {
        document.querySelectorAll('.genre-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                selectedGenre = chip.dataset.genre || 'all';
                renderFiltered();
            });
        });

        const searchEl = $('searchInput');
        if (searchEl) {
            searchEl.addEventListener('input', () => {
                searchQuery = searchEl.value.toLowerCase().trim();
                renderFiltered();
            });
        }

        const select = $('cinemaSelect');
        if (select) {
            select.addEventListener('change', () => {
                selectedCinemaId = Number(select.value);
                updateCinemaCard(selectedCinemaId);
                loadShowtimes();
            });
        }
    }

    function buildDatePills() {
        const container = $('datePillsContainer');
        if (!container) return;
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const months = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
        const today = new Date();
        container.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateStr = toDateInputValue(d);
            const pill = document.createElement('div');
            pill.className = 'date-pill' + (i === 0 ? ' active' : '');
            pill.dataset.date = dateStr;
            pill.innerHTML = `
                <div class="pill-dow">${i === 0 ? 'HN' : days[d.getDay()]}</div>
                <div class="pill-d">${d.getDate()}</div>
                <div class="pill-m">${months[d.getMonth()]}</div>`;
            pill.addEventListener('click', () => {
                document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                selectedDate = dateStr;
                loadShowtimes();
            });
            container.appendChild(pill);
        }
    }

    async function loadCinemas() {
        setCinemaSelectLoading('Đang tải danh sách rạp...');
        const json = await fetchJson('/api/movies/cinemas');
        if (!json.success || !Array.isArray(json.data)) {
            throw new Error(json.message || 'Không tải được danh sách rạp');
        }

        allCinemas = json.data;
        if (!allCinemas.length) {
            setCinemaSelectLoading('Chưa có rạp');
            showEmpty('Không có rạp nào trong hệ thống.');
            return;
        }

        if (selectedCinemaId) {
            const target = allCinemas.find(c => Number(c.CinemaID) === selectedCinemaId);
            if (target) selectedCity = target.City;
        }

        buildCityTabs();
    }

    function buildCityTabs() {
        const container = $('cityTabsContainer');
        if (!container) return;
        const cities = [...new Set(allCinemas.map(c => c.City).filter(Boolean))].sort();
        container.innerHTML = '';

        if (!cities.length) {
            showEmpty('Không có thành phố nào trong hệ thống.');
            return;
        }

        if (!selectedCity || !cities.includes(selectedCity)) {
            selectedCity = cities.includes('Hồ Chí Minh') ? 'Hồ Chí Minh' : cities[0];
        }

        cities.forEach(city => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'city-btn' + (city === selectedCity ? ' active' : '');
            btn.dataset.city = city;
            btn.textContent = city;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedCity = city;
                selectedCinemaId = null;
                populateBranches();
            });
            container.appendChild(btn);
        });

        populateBranches();
    }

    function populateBranches() {
        const select = $('cinemaSelect');
        if (!select) return;
        const filtered = allCinemas.filter(c => c.City === selectedCity);
        select.innerHTML = '';

        if (!filtered.length) {
            setCinemaSelectLoading('Không có rạp ở thành phố này');
            showEmpty('Không có rạp nào ở thành phố đang chọn.');
            return;
        }

        filtered.forEach(cinema => {
            const option = document.createElement('option');
            option.value = cinema.CinemaID;
            option.textContent = cinema.CinemaName;
            select.appendChild(option);
        });

        if (!selectedCinemaId || !filtered.some(c => Number(c.CinemaID) === Number(selectedCinemaId))) {
            selectedCinemaId = Number(filtered[0].CinemaID);
        }
        select.value = String(selectedCinemaId);
        updateCinemaCard(selectedCinemaId);
        loadShowtimes();
    }

    function setCinemaSelectLoading(text) {
        const select = $('cinemaSelect');
        if (!select) return;
        select.innerHTML = `<option>${escapeHtml(text)}</option>`;
    }

    function updateCinemaCard(id) {
        const cinema = allCinemas.find(c => Number(c.CinemaID) === Number(id));
        if (!cinema) return;

        const address = (cinema.Address || '') + (cinema.City ? ', ' + cinema.City : '');
        if ($('ccName')) $('ccName').textContent = cinema.CinemaName;
        if ($('ccAddr')) $('ccAddr').textContent = cinema.Address || 'Địa chỉ đang cập nhật...';
        if ($('cinemaCard')) $('cinemaCard').classList.add('show');
        if ($('branchName')) $('branchName').textContent = cinema.CinemaName;
        if ($('branchAddr')) $('branchAddr').textContent = address;

        const bannerWrapper = $('cinemaTopBannerWrapper');
        if (bannerWrapper) bannerWrapper.classList.add('show');
        const hero = document.querySelector('.booking-hero');
        if (hero) hero.style.display = 'none';
        if ($('ctbName')) $('ctbName').textContent = cinema.CinemaName;
        if ($('ctbAddressText')) $('ctbAddressText').textContent = address;
    }

    async function loadMovieInfo(movieId) {
        try {
            const json = await fetchJson(`/api/movies/${movieId}`);
            if (json.success && json.data) {
                selectedMovie = json.data;
                updateTitle();
            }
        } catch (err) {
            console.warn('[Booking] loadMovieInfo:', err.message);
        }
    }

    async function loadShowtimes() {
        if (!selectedCinemaId || !selectedDate) return;
        showSkeleton();
        updateTitle();

        try {
            let url = `/api/movies/showtimes?cinemaId=${encodeURIComponent(selectedCinemaId)}&date=${encodeURIComponent(selectedDate)}`;
            if (movieIdFilter) url += `&movieId=${encodeURIComponent(movieIdFilter)}`;
            const json = await fetchJson(url);
            rawData = json.success && Array.isArray(json.data) ? json.data : [];

            if (!rawData.length) {
                updateStats(0, 0, 0);
                showEmpty(`Không có suất chiếu nào vào ngày ${fmtDate(selectedDate)} tại rạp đã chọn.`);
                return;
            }

            renderFiltered();
        } catch (err) {
            console.error('[Booking] loadShowtimes:', err);
            showError('Không thể tải lịch chiếu. Kiểm tra server/API rồi thử lại.');
        }
    }

    function updateTitle() {
        const el = $('showtimesTitle');
        if (!el) return;
        if (selectedMovie && movieIdFilter) {
            el.textContent = `Lịch chiếu: ${selectedMovie.Title}`;
        } else {
            el.textContent = `Lịch chiếu ngày ${fmtDate(selectedDate)}`;
        }
    }

    function renderFiltered() {
        let data = [...rawData];

        if (selectedGenre !== 'all') {
            const target = selectedGenre.toLowerCase();
            data = data.filter(row => String(row.Genre || '').toLowerCase().split(',').map(g => g.trim()).includes(target));
        }

        if (searchQuery) {
            data = data.filter(row =>
                String(row.Title || '').toLowerCase().includes(searchQuery) ||
                String(row.MainCast || '').toLowerCase().includes(searchQuery)
            );
        }

        if (!data.length) {
            updateStats(0, 0, 0);
            showEmpty(searchQuery ? `Không tìm thấy phim "${escapeHtml(searchQuery)}" trong lịch chiếu.` : 'Không có phim nào phù hợp với bộ lọc.');
            return;
        }

        const grouped = {};
        data.forEach(row => {
            if (!grouped[row.MovieID]) {
                grouped[row.MovieID] = {
                    MovieID: row.MovieID,
                    Title: row.Title,
                    Duration: row.Duration,
                    AgeRating: row.AgeRating,
                    PosterURL: row.PosterURL,
                    MainCast: row.MainCast,
                    Genre: row.Genre,
                    Description: row.Description,
                    showtimes: []
                };
            }
            grouped[row.MovieID].showtimes.push(row);
        });

        const movies = Object.values(grouped);
        sortMovies(movies);
        updateStats(movies.length, data.length, Math.min(...data.map(d => d.Price || 0)));
        renderMovies(movies, data.length);
    }

    function sortMovies(movies) {
        if (sortMode === 'name') {
            movies.sort((a, b) => String(a.Title || '').localeCompare(String(b.Title || '')));
        } else if (sortMode === 'price-asc') {
            movies.sort((a, b) => Math.min(...a.showtimes.map(s => s.Price || 0)) - Math.min(...b.showtimes.map(s => s.Price || 0)));
        } else if (sortMode === 'price-desc') {
            movies.sort((a, b) => Math.min(...b.showtimes.map(s => s.Price || 0)) - Math.min(...a.showtimes.map(s => s.Price || 0)));
        } else {
            movies.sort((a, b) => Math.min(...a.showtimes.map(s => new Date(s.StartTime).getTime())) - Math.min(...b.showtimes.map(s => new Date(s.StartTime).getTime())));
        }
    }

    function renderMovies(movies, totalShowtimes) {
        const container = $('showtimesContainer');
        if (!container) return;
        if ($('showtimesCount')) $('showtimesCount').textContent = `${totalShowtimes} suất`;
        updateTitle();
        container.innerHTML = '';

        movies.forEach((movie, idx) => {
            const sortedShowtimes = [...movie.showtimes].sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.style.animationDelay = `${idx * 0.05}s`;

            const tags = [
                `<span class="tag tag-pg">${escapeHtml(movie.AgeRating || 'ALL')}</span>`,
                '<span class="tag tag-now">Đang chiếu</span>',
                movie.Duration ? `<span class="tag tag-dur">⏱ ${escapeHtml(movie.Duration)} phút</span>` : '',
                movie.Genre ? `<span class="tag tag-genre">${escapeHtml(String(movie.Genre).split(',')[0].trim())}</span>` : ''
            ].filter(Boolean).join('');

            card.innerHTML = `
                <div class="card-body">
                    <div class="poster-col" onclick="openMovieModal(${Number(movie.MovieID)})">
                        <img src="${escapeHtml(movie.PosterURL || POSTER_FALLBACK)}" alt="${escapeHtml(movie.Title)}" loading="lazy" onerror="this.src='${POSTER_FALLBACK}'">
                        <div class="age-badge ${getAgeClass(movie.AgeRating)}">${escapeHtml(movie.AgeRating || 'ALL')}</div>
                        <div class="poster-play">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="movie-tags">${tags}</div>
                        <div class="movie-title" onclick="openMovieModal(${Number(movie.MovieID)})">${escapeHtml(movie.Title)}</div>
                        ${movie.MainCast ? `<div class="movie-cast">Diễn viên: ${escapeHtml(movie.MainCast)}</div>` : ''}
                        <div class="shows-section-label">🕐 Các suất chiếu <span>${sortedShowtimes.length} suất</span></div>
                        <div class="time-slots">${sortedShowtimes.map(renderSlot).join('')}</div>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    }

    function renderSlot(st) {
        const start = new Date(st.StartTime);
        const end = new Date(st.EndTime);
        const time = start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTime = end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        const price = (st.Price || 0).toLocaleString('vi-VN');
        const roomType = String(st.RoomType || 'Standard').trim();
        const available = st.AvailableSeats != null ? st.AvailableSeats : Math.max(0, (st.TotalSeats || 0) - (st.TicketsSold || 0));
        const badgeClass = roomType === 'IMAX Laser' ? 'badge-imax' : roomType === '3D' ? 'badge-3d' : roomType === '2D' ? 'badge-2d' : 'badge-standard';
        const slotClass = ['slot', roomType === 'IMAX Laser' ? 'imax-slot' : '', roomType === '3D' ? 'd3-slot' : '', available > 0 && available <= 15 ? 'few-seats' : ''].filter(Boolean).join(' ');
        return `
            <button class="${slotClass}" onclick="goToSeats(${Number(st.ShowtimeID)})" title="Phòng ${escapeHtml(st.RoomName || 'Cinema')} • ${time}-${endTime} • ${price}đ • Còn ${available} ghế">
                <div class="slot-time">${time}</div>
                <div class="slot-meta">
                    <span class="slot-price">${price}đ</span>
                    <span class="slot-room">${escapeHtml(st.RoomName || 'Cinema')}</span>
                    <span class="slot-type-badge ${badgeClass}">${escapeHtml(roomType)}</span>
                </div>
            </button>`;
    }

    window.applySort = function () {
        const select = $('sortSelect');
        sortMode = select ? select.value : 'time';
        renderFiltered();
    };

    window.openMovieModal = function (movieId) {
        const modal = $('movieModal');
        if (!modal) return;
        const movie = rawData.find(r => Number(r.MovieID) === Number(movieId)) || {};
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';

        if ($('modalTitle')) $('modalTitle').textContent = movie.Title || '—';
        if ($('modalDesc')) $('modalDesc').textContent = movie.Description || 'Chưa có mô tả cho phim này.';
        if ($('modalPoster')) $('modalPoster').src = movie.PosterURL || POSTER_FALLBACK;
        if ($('modalMeta')) {
            $('modalMeta').innerHTML = `
                <span class="tag tag-pg">${escapeHtml(movie.AgeRating || 'ALL')}</span>
                ${movie.Duration ? `<span class="tag tag-dur">⏱ ${escapeHtml(movie.Duration)} phút</span>` : ''}
                <span class="tag tag-now">Đang chiếu</span>
                ${movie.Genre ? `<span class="tag tag-genre">${escapeHtml(movie.Genre)}</span>` : ''}`;
        }

        const slots = rawData.filter(r => Number(r.MovieID) === Number(movieId)).sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));
        if ($('modalSlots')) {
            $('modalSlots').innerHTML = slots.map(renderSlot).join('') || '<span style="color:var(--muted);font-size:0.85rem;">Không có suất chiếu.</span>';
        }
    };

    window.closeMovieModal = function () {
        if ($('movieModal')) $('movieModal').classList.remove('open');
        document.body.style.overflow = '';
    };

    window.closeModal = function (e) {
        if (e.target && e.target.id === 'movieModal') window.closeMovieModal();
    };

    window.goToSeats = function (showtimeId) {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!userStr || !token) {
            const target = `seats.html?showtimeId=${showtimeId}`;
            sessionStorage.setItem('redirectAfterLogin', target);
            window.location.href = `auth.html?redirect=${encodeURIComponent(target)}`;
            return;
        }
        window.location.href = `seats.html?showtimeId=${showtimeId}`;
    };

    window.loadShowtimes = loadShowtimes;

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') window.closeMovieModal();
    });

    function getAgeClass(rating) {
        const value = String(rating || '').toUpperCase();
        if (value.includes('18')) return 'age-18';
        if (value.includes('16')) return 'age-16';
        if (value.includes('13')) return 'age-13';
        return 'age-all';
    }

    function updateStats(movies, shows, minPrice) {
        if ($('statsMovies')) $('statsMovies').textContent = movies || '—';
        if ($('statsShowtimes')) $('statsShowtimes').textContent = shows || '—';
        if ($('statsMin')) $('statsMin').textContent = minPrice > 0 ? Math.floor(minPrice / 1000) + 'k' : '—k';
        if ($('showtimesCount')) $('showtimesCount').textContent = shows ? `${shows} suất` : '0 suất';
    }

    function showSkeleton() {
        const container = $('showtimesContainer');
        if (!container) return;
        if ($('showtimesCount')) $('showtimesCount').textContent = '— suất';
        container.innerHTML = `
            <div class="sk-wrap">
                ${[1, 2, 3].map(() => `<div class="sk-card">
                    <div class="sk-poster"></div>
                    <div class="sk-body">
                        <div class="sk-line" style="width:72%"></div>
                        <div class="sk-line" style="width:52%"></div>
                        <div class="sk-line" style="width:38%"></div>
                        <div class="sk-line" style="width:85%"></div>
                    </div>
                </div>`).join('')}
            </div>`;
    }

    function showEmpty(message) {
        const container = $('showtimesContainer');
        if (!container) return;
        if ($('showtimesTitle')) $('showtimesTitle').textContent = 'Chưa có suất chiếu';
        if ($('showtimesCount')) $('showtimesCount').textContent = '0 suất';
        container.innerHTML = `
            <div class="empty-box">
                <div class="empty-icon">🎬</div>
                <div class="empty-title">Không có suất chiếu</div>
                <div class="empty-desc">${message}</div>
                <button class="empty-btn" onclick="loadShowtimes()">Thử lại</button>
            </div>`;
    }

    function showError(message) {
        const container = $('showtimesContainer');
        if (!container) return;
        if ($('showtimesCount')) $('showtimesCount').textContent = '0 suất';
        container.innerHTML = `
            <div class="empty-box">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Lỗi kết nối</div>
                <div class="empty-desc">${escapeHtml(message || 'Không thể tải lịch chiếu.')}</div>
                <button class="empty-btn" onclick="loadShowtimes()">Thử lại</button>
            </div>`;
    }

    function showCinemaLoadError(err) {
        console.error('[Booking] loadCinemas:', err);
        setCinemaSelectLoading('Không tải được danh sách rạp');
        showError(err.name === 'AbortError' ? 'API danh sách rạp phản hồi quá lâu.' : 'Không thể tải danh sách rạp. Kiểm tra server/API rồi thử lại.');
    }
})();
