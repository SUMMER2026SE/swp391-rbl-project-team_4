/* ══════════════════════════
   DASHBOARD FILTER STATE
══════════════════════════ */
let dashCinemaId = '';
let dashPeriod = '';
let filterCinemas = [];

/* ══════════════════════════
   FETCH DATA FROM BACKEND
══════════════════════════ */
async function apiFetch(url, options = {}) {
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch(e) {
        console.error('[apiFetch] Non-JSON response for', url, ':', text.substring(0, 200));
        return { success: false, message: 'Invalid response' };
    }
}

let chartInstance = null;

async function loadDashboardData() {
    try {
        // Build query params for filters
        const params = new URLSearchParams();
        if (dashCinemaId) params.set('cinemaId', dashCinemaId);
        if (dashPeriod) params.set('period', dashPeriod);
        const qs = params.toString() ? '?' + params.toString() : '';

        const statsRes = await apiFetch('/api/admin/stats/dashboard' + qs);
        if (statsRes.success) {
            const data = statsRes.data;
            const kpiVals = document.querySelectorAll('.kpi-value');
            if (kpiVals.length >= 4) {
                animateCounter(kpiVals[0], data.TotalRevenue || 0, '', ' đ', 0, true);
                animateCounter(kpiVals[1], data.TicketSales || 0, '', '', 0);
                animateCounter(kpiVals[2], data.FnBSales || 0, '', ' đ', 0, true);
                animateCounter(kpiVals[3], data.OccupancyRate || 0, '', '%', 1);
            }
        }

        const chartParams = new URLSearchParams();
        if (dashCinemaId) chartParams.set('cinemaId', dashCinemaId);
        if (dashPeriod) chartParams.set('period', dashPeriod);
        const mqStr = chartParams.toString() ? '?' + chartParams.toString() : '';

        const chartRes = await apiFetch('/api/admin/stats/revenue-chart' + mqStr);
        if (chartRes.success) {
            buildChart(chartRes.data);
        }

        const topMoviesRes = await apiFetch('/api/admin/stats/top-movies?limit=4');
        if (topMoviesRes.success) {
            renderTopMovies(topMoviesRes.data);
        }

        // Fetch Live Rooms Status
        fetchLiveRoomsStatus();
    } catch (err) {
        console.error('Error loading dashboard data:', err);
    }
}

async function exportPdf() {
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
    if (!token) return alert('Vui lòng đăng nhập!');

    const params = new URLSearchParams();
    if (dashCinemaId) params.set('cinemaId', dashCinemaId);
    if (dashPeriod) params.set('period', dashPeriod);
    const qs = params.toString() ? '?' + params.toString() : '';

    try {
        const res = await fetch('/api/admin/stats/export-pdf' + qs, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return alert(errData.message || 'Không thể xuất file PDF (Lỗi xác thực hoặc server).');
        }
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'D-Cinema-Report.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error downloading PDF:', err);
        alert('Lỗi kết nối khi xuất PDF!');
    }
}


async function fetchLiveRoomsStatus() {
    try {
        const params = new URLSearchParams();
        if (dashCinemaId) params.set('cinemaId', dashCinemaId);
        const qs = params.toString() ? '?' + params.toString() : '';

        const res = await apiFetch('/api/admin/stats/live-rooms' + qs);
        if (res.success) {
            renderLiveRooms(res.data);
        }
    } catch (err) {
        console.error('Failed to load live rooms:', err);
    }
}

let liveRoomsInterval = null;

function renderLiveRooms(rooms) {
    const grid = document.getElementById('liveRoomsGrid');
    if (!grid) return;

    if (!rooms || rooms.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--text3);">Không có phòng chiếu.</p>';
        return;
    }

    grid.innerHTML = rooms.map(r => {
        let status = 'empty'; // empty, playing, cleaning
        let statusClass = 'empty';
        let progressPercent = 0;
        let occStr = '0%';

        if (r.ShowtimeID && r.StartTime && r.EndTime) {
            const now = new Date();
            const start = new Date(r.StartTime);
            const end = new Date(r.EndTime);
            
            // "Cleaning" happens 15 mins before end, up to 15 mins after end
            const cleaningStart = new Date(end.getTime() - 15 * 60000);
            const cleaningEnd = new Date(end.getTime() + 15 * 60000);

            if (now >= cleaningStart && now <= cleaningEnd) {
                status = 'cleaning';
                statusClass = 'cleaning';
            } else if (now >= new Date(start.getTime() - 15 * 60000) && now < cleaningStart) {
                status = 'playing';
                statusClass = 'playing';
            }

            if (status !== 'empty') {
                const duration = end.getTime() - start.getTime();
                const elapsed = now.getTime() - start.getTime();
                progressPercent = Math.max(0, Math.min(100, (elapsed / duration) * 100));
                
                const occ = r.TotalSeats > 0 ? Math.round((r.TicketsSold / r.TotalSeats) * 100) : 0;
                occStr = occ + '%';
            }
        }

        return `
            <div class="lr-card">
                <div class="lr-header">
                    <div class="lr-name">${r.RoomName}</div>
                    <div class="lr-status-dot ${statusClass}"></div>
                </div>
                <div class="lr-movie">${status === 'empty' ? 'Chưa có lịch' : (r.MovieTitle || 'Unknown')}</div>
                ${status !== 'empty' ? `
                    <div class="lr-progress-bg">
                        <div class="lr-progress-fill ${statusClass}" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="lr-occ ${statusClass}">${occStr}</div>
                ` : `
                    <div class="lr-progress-bg"></div>
                    <div class="lr-occ empty">-</div>
                `}
            </div>
        `;
    }).join('');

    // Setup periodic refresh (every 1 minute)
    if (!liveRoomsInterval) {
        liveRoomsInterval = setInterval(fetchLiveRoomsStatus, 60000);
    }
}

/* ══════════════════════════
   CINEMA FILTER FUNCTIONS
══════════════════════════ */
async function loadCinemasForFilter() {
    try {
        const res = await apiFetch('/api/admin/cinemas');
        console.log('[CinemaFilter] API response:', res);
        if (res.success && res.data) {
            filterCinemas = res.data;
            console.log('[CinemaFilter] Loaded', filterCinemas.length, 'cinemas');
            renderCinemaList(filterCinemas);
        } else {
            console.warn('[CinemaFilter] No data:', res);
        }
    } catch (err) {
        console.error('Failed to load cinemas for filter:', err);
    }
}

function renderCinemaList(cinemas) {
    const list = document.getElementById('cinemaList');
    if (!list) return;

    // Build the "all" item + all cinema items as HTML
    const allActiveClass = (!dashCinemaId) ? ' active' : '';
    let html = `
        <div class="fdm-item${allActiveClass}" data-id="" onclick="selectCinema('', 'Tất cả cụm rạp', this)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Tất cả cụm rạp
        </div>
    `;

    cinemas.forEach(c => {
        const activeClass = (dashCinemaId == c.CinemaID) ? ' active' : '';
        html += `
            <div class="fdm-item${activeClass}" data-id="${c.CinemaID}" onclick="selectCinema('${c.CinemaID}', '${c.CinemaName.replace(/'/g, '&apos;')}', this)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>${c.CinemaName}</span>
            </div>
        `;
    });

    list.innerHTML = html;
}

function filterCinemaList(query) {
    const filtered = query
        ? filterCinemas.filter(c => c.CinemaName.toLowerCase().includes(query.toLowerCase()))
        : filterCinemas;
    renderCinemaList(filtered);
}

function toggleCinemaDropdown() {
    const btn = document.getElementById('cinemaDropdownBtn');
    const menu = document.getElementById('cinemaDropdownMenu');
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
        menu.classList.remove('open');
        btn.classList.remove('open');
    } else {
        menu.classList.add('open');
        btn.classList.add('open');
        // Lazy-load cinemas every time dropdown opens if not yet loaded
        if (filterCinemas.length === 0) {
            loadCinemasForFilter();
        }
        const searchEl = document.getElementById('cinemaSearch');
        if (searchEl) searchEl.focus();
    }
}

function selectCinema(id, label, el) {
    dashCinemaId = id;
    document.getElementById('cinemaDropdownLabel').textContent = label;
    // Update active state
    document.querySelectorAll('#cinemaList .fdm-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    // Close dropdown
    document.getElementById('cinemaDropdownMenu').classList.remove('open');
    document.getElementById('cinemaDropdownBtn').classList.remove('open');
    document.getElementById('cinemaSearch').value = '';
    renderCinemaList(filterCinemas);
    // Refresh data
    loadDashboardData();
}

function selectPeriod(period, btn) {
    dashPeriod = period;
    document.querySelectorAll('.period-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    loadDashboardData();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('cinemaDropdownWrap');
    if (wrap && !wrap.contains(e.target)) {
        const menu = document.getElementById('cinemaDropdownMenu');
        const btn = document.getElementById('cinemaDropdownBtn');
        if (menu) menu.classList.remove('open');
        if (btn) btn.classList.remove('open');
    }
});

function showDashboardFilters() {
    const f = document.getElementById('dashboardFilters');
    if (f) f.classList.remove('hidden');
}
function hideDashboardFilters() {
    const f = document.getElementById('dashboardFilters');
    if (f) f.classList.add('hidden');
}

function renderTopMovies(movies) {
    const container = document.querySelector('.rankings-list');
    if (!container) return;

    if (!movies || movies.length === 0) {
        container.innerHTML = '<p style="padding:20px; color:#9ca3af; text-align:center;">No data available.</p>';
        return;
    }

    container.innerHTML = movies.map(m => `
        <div class="rank-item">
            <img src="${m.PosterURL || 'https://via.placeholder.com/60x80/eef2ff/2563eb?text=NO+IMAGE'}" alt="${m.Title}" class="rank-poster">
            <div class="rank-info">
                <div class="rank-title">${m.Title}</div>
                <div class="rank-stars">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ${m.Rating ? m.Rating.toFixed(1) : 'N/A'}/5
                </div>
            </div>
            <div class="rank-revenue">
                <div class="rank-amount">${formatCurrency(m.TodayRevenue)} đ</div>
                <div class="rank-today">HÔM NAY</div>
            </div>
        </div>
    `).join('');
}

/* ══════════════════════════
   TRANSACTION DATA (Dynamic)
══════════════════════════ */
let TXN_DATA = [];
let currentPage = 1;
const ROWS_PER_PAGE = 5;
let filteredData = [];

async function loadRecentTransactions() {
    try {
        const res = await apiFetch('/api/admin/stats/recent-transactions?limit=20');
        if (res.success) {
            TXN_DATA = res.data;
            filteredData = [...TXN_DATA];
            renderTable();
        }
    } catch (err) {
        console.error('Failed to load recent transactions:', err);
    }
}

function renderTable() {
    const body = document.getElementById('txnBody');
    if(!body) return;
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const rows = filteredData.slice(start, start + ROWS_PER_PAGE);
    const totalPages = Math.max(1, Math.ceil(filteredData.length / ROWS_PER_PAGE));

    if (filteredData.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:20px;">Không có giao dịch nào</td></tr>';
    } else {
        body.innerHTML = rows.map(t => `
            <tr class="txn-row">
                <td class="txn-id">${t.id}</td>
                <td>${t.branch}</td>
                <td>${t.item}</td>
                <td>${t.date}</td>
                <td class="txn-amount">${t.amount}</td>
                <td><span class="status-badge ${t.status.toLowerCase()}">${t.status}</span></td>
            </tr>`).join('');
    }

    const pgInfo = document.getElementById('pgInfo');
    if(pgInfo) pgInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
    const pgPrev = document.getElementById('pgPrev');
    if(pgPrev) pgPrev.disabled = currentPage === 1;
    const pgNext = document.getElementById('pgNext');
    if(pgNext) pgNext.disabled = currentPage === totalPages;
}

function changePage(delta) {
    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    currentPage = Math.min(totalPages, Math.max(1, currentPage + delta));
    renderTable();
}

function toggleFilter() {
    const bar = document.getElementById('filterBar');
    bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
}

function applyFilter() {
    const statusF = document.getElementById('filterStatus').value;
    const branchF = document.getElementById('filterBranch').value;
    filteredData = TXN_DATA.filter(t =>
        (!statusF || t.status === statusF) &&
        (!branchF || t.branch === branchF)
    );
    currentPage = 1;
    renderTable();
}

function clearFilter() {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterBranch').value = '';
    filteredData = [...TXN_DATA];
    currentPage = 1;
    renderTable();
}

/* ══════════════════════════
   CHART
══════════════════════════ */
function buildChart(chartData) {
    const ctx = document.getElementById('revenueChart');
    if(!ctx) return;
    
    let labels = [];
    let ticketData = [];
    let fnbData = [];

    if (chartData) {
        labels = chartData.labels || [];
        ticketData = chartData.ticketData || [];
        fnbData = chartData.fnbData || [];
    }

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Ticket Revenue',
                    data: ticketData,
                    backgroundColor: 'rgba(232,25,44,0.85)',
                    borderRadius: 5,
                    borderSkipped: false,
                    barPercentage: 0.55,
                    categoryPercentage: 0.65,
                },
                {
                    label: 'F&B Revenue',
                    data: fnbData,
                    backgroundColor: 'rgba(245,158,11,0.75)',
                    borderRadius: 5,
                    borderSkipped: false,
                    barPercentage: 0.55,
                    categoryPercentage: 0.65,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1f2e',
                    titleColor: '#eef0f8',
                    bodyColor: '#8a90a8',
                    padding: 12,
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    callbacks: {
                        label: ctx => ` ${formatCurrency(ctx.raw)} đ`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af', font: { size: 11 } },
                    border: { display: false }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: {
                        color: '#9ca3af', font: { size: 11 },
                        callback: v => (v / 1000000) + ' Tr'
                    },
                    border: { display: false }
                }
            }
        }
    });
}

/* ══════════════════════════
   MOVIES DATA & FUNCTIONS (Mock)
══════════════════════════ */
let MOVIE_DATA = [];
let filteredMovies = [];

async function loadMovies() {
    try {
        const res = await fetch('/api/movies');
        const data = await res.json();
        if (data.success) {
            MOVIE_DATA = data.data.filter(m => m.Status !== 'deleted');
            filteredMovies = [...MOVIE_DATA];
            renderMovieTable();
            renderScheduleMovieLibrary();
            populateMovieSelect(); // Populate the showtime creation dropdown
        }
    } catch (err) {
        console.error('Failed to load movies:', err);
    }
}

function renderMovieTable() {
    const body = document.getElementById('movieBody');
    if (!body) return;
    const statusMap = {
        'Now Showing': 'Đang chiếu',
        'Coming Soon': 'Sắp chiếu',
        'deleted': 'Đã xóa'
    };
    body.innerHTML = filteredMovies.map(m => `
        <tr class="txn-row">
            <td>
                <div class="m-poster-wrap">
                    <img src="${m.PosterURL || 'images/default_poster.svg'}" alt="${m.Title}" onerror="this.onerror=null; this.src='images/default_poster.svg'">
                </div>
            </td>
            <td>
                <div class="m-title-block">
                    <div class="m-title">${m.Title}</div>
                    <div class="m-director">ĐD. ${m.Director || 'Đang cập nhật'}</div>
                </div>
            </td>
            <td>
                <span class="status-pill ${m.Status.toLowerCase().replace(' ', '-')}">${statusMap[m.Status] || m.Status}</span>
            </td>
            <td>
                <div class="m-genres">
                    <span class="genre-tag">${m.AgeRating || 'G'}</span>
                </div>
            </td>
            <td><div class="m-duration">${m.Duration} phút</div></td>
            <td>
                <div class="table-actions">
                    <button class="tb-icon-sm" title="Edit" onclick="editMovie(${m.MovieID})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="tb-icon-sm danger" title="Delete" onclick="deleteMovie(${m.MovieID})" style="color:var(--danger)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                </div>
            </td>
        </tr>
    `).join('');
    
    const moviePgInfo = document.getElementById('moviePgInfo');
    if (moviePgInfo) moviePgInfo.textContent = `Hiển thị 1-${filteredMovies.length} của ${MOVIE_DATA.length} phim`;
}

async function deleteMovie(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa bộ phim này không?')) return;
    try {
        const res = await apiFetch(`/api/admin/movies/${id}`, { method: 'DELETE' });
        if (res.success) {
            alert('Xóa phim thành công!');
            loadMovies();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        alert('Lỗi hệ thống khi xóa phim.');
    }
}

let editingMovieId = null;

function editMovie(id) {
    const movie = MOVIE_DATA.find(m => m.MovieID === id);
    if (!movie) return;
    editingMovieId = id;
    document.querySelector('#addMovieModal .panel-header h2').textContent = 'SỬA PHIM';
    document.getElementById('movieTitle').value = movie.Title || '';
    document.getElementById('movieDescription').value = movie.Description || '';
    document.getElementById('movieDirector').value = movie.Director || '';
    document.getElementById('movieStatus').value = movie.Status || 'Now Showing';
    document.getElementById('movieDuration').value = movie.Duration || '';
    document.getElementById('movieAgeRating').value = movie.AgeRating || '';
    document.getElementById('movieMainCast').value = movie.MainCast || '';
    const preview = document.getElementById('posterPreview');
    if (movie.PosterURL) {
        preview.src = movie.PosterURL;
        preview.style.display = 'block';
    }
    document.querySelector('.btn-panel-save').textContent = 'Cập nhật Phim';
    openAddMovieModal();
}

function openAddMovieModal() {
    if (!editingMovieId) {
        document.querySelector('#addMovieModal .panel-header h2').textContent = 'THÊM PHIM MỚI';
        document.querySelector('.btn-panel-save').textContent = 'Lưu Phim';
        document.getElementById('addMovieForm').reset();
        document.getElementById('posterPreview').style.display = 'none';
    }
    document.getElementById('addMovieModalOverlay').classList.add('show');
    document.getElementById('addMovieModal').classList.add('show');
}
function closeAddMovieModal() {
    editingMovieId = null;
    document.getElementById('addMovieForm').reset();
    document.getElementById('posterPreview').style.display = 'none';
    document.getElementById('addMovieModalOverlay').classList.remove('show');
    document.getElementById('addMovieModal').classList.remove('show');
}

function filterMovies(filter, btn) {
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    if (filter === 'Tất cả') {
        filteredMovies = [...MOVIE_DATA];
    } else {
        filteredMovies = MOVIE_DATA.filter(m => m.Status.toUpperCase() === filter.toUpperCase());
    }
    renderMovieTable();
}

function previewPoster(event) {
    const file = event.target.files[0];
    if (file) {
        const preview = document.getElementById('posterPreview');
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
    }
}

async function saveMovie() {
    const form = document.getElementById('addMovieForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.querySelector('.btn-panel-save');
    const origText = btn.textContent;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-9-9"/></svg> Đang lưu...`;
    btn.disabled = true;

    try {
        const formData = new FormData();
        const posterFile = document.getElementById('moviePoster').files[0];
        if (posterFile) formData.append('poster', posterFile);
        
        formData.append('title', document.getElementById('movieTitle').value);
        formData.append('description', document.getElementById('movieDescription').value);
        formData.append('director', document.getElementById('movieDirector').value);
        formData.append('status', document.getElementById('movieStatus').value);
        formData.append('duration', document.getElementById('movieDuration').value);
        formData.append('ageRating', document.getElementById('movieAgeRating').value);
        formData.append('mainCast', document.getElementById('movieMainCast').value);

        const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
        const url = editingMovieId ? `/api/admin/movies/${editingMovieId}` : '/api/admin/movies';
        const method = editingMovieId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            alert(editingMovieId ? 'Cập nhật phim thành công!' : 'Lưu phim thành công!');
            closeAddMovieModal();
            loadMovies();
        } else {
            alert('Lưu phim thất bại. ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('Lỗi khi lưu phim.');
    } finally {
        btn.textContent = origText;
        btn.disabled = false;
    }
}

/* ══════════════════════════
   NAVIGATION
══════════════════════════ */
function navigate(page, btn) {
    document.querySelectorAll('.sn, .sn-bottom').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else {
        document.querySelectorAll('.sn').forEach(b => {
            if(b.getAttribute('onclick') && b.getAttribute('onclick').includes(page)) {
                b.classList.add('active');
            }
        });
    }

    const topbarTitle = document.getElementById('topbarTitle');
    const ttabs = document.querySelector('.topbar-tabs');
    if (page === 'cinema') {
        topbarTitle.style.display = 'block';
        ttabs.style.display = 'flex';
        hideDashboardFilters();
    } else if (page === 'schedule') {
        topbarTitle.textContent = 'LỊCH CHIẾU';
        topbarTitle.style.display = 'block';
        ttabs.style.display = 'flex';
        hideDashboardFilters();
    } else if (page === 'dashboard') {
        topbarTitle.style.display = 'none';
        ttabs.style.display = 'flex';
        showDashboardFilters();
    } else {
        topbarTitle.style.display = 'none';
        ttabs.style.display = 'flex';
        hideDashboardFilters();
    }
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    if (page === 'schedule') {
        loadRooms();
        loadMovies();
        populateMovieSelect();
        renderScheduleMovieLibrary();
        const dateInput = document.getElementById('scheduleDateInput');
        if (dateInput) dateInput.value = scheduleDate;
        loadShowtimes();
    }

    if (page === 'promotions') {
        loadPromotions();
    }
    
    if (page === 'pricing' || page === 'settings') {
        loadSettings();
    }
}

function switchTab(tab, btn) {
    document.querySelectorAll('.ttab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

/* ══════════════════════════
   LOGOUT
══════════════════════════ */
function adminLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token'); sessionStorage.removeItem('token');
        localStorage.removeItem('user'); sessionStorage.removeItem('user');
        window.location.href = 'auth.html';
    }
}

/* ══════════════════════════
   F&B MANAGEMENT
══════════════════════════ */
let FNB_DATA = [];

async function loadFnB() {
    try {
        const res = await apiFetch('/api/admin/fnb');
        if (res.success) {
            FNB_DATA = res.data;
            renderFnB();
            loadFnBStats();
        }
    } catch (err) {
        console.error('Failed to load F&B:', err);
    }
}

function renderFnB() {
    const container = document.getElementById('fnbItemsContainer');
    if (!container) return;

    if (FNB_DATA.length === 0) {
        container.innerHTML = '<div style="padding:20px;color:#9ca3af;">Chưa có đồ ăn/nước uống nào.</div>';
        return;
    }

    // Render Master Combo (just using the first item for demo, or specifically finding a combo)
    const masterCombo = FNB_DATA.find(i => i.Category === 'Combos') || FNB_DATA[0];
    const otherItems = FNB_DATA.filter(i => i.FnBID !== masterCombo.FnBID);

    const getActionBtns = (item) => `
        <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px; background:rgba(0,0,0,0.6); padding:4px; border-radius:6px; z-index:10;">
            <button onclick='editFnB(${JSON.stringify(item).replace(/'/g, "&apos;")})' title="Sửa" style="background:none;border:none;color:#3b82f6;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button onclick="toggleFnBAvailability(${item.FnBID})" title="${item.IsAvailable ? 'Ẩn' : 'Hiện'}" style="background:none;border:none;color:${item.IsAvailable ? '#10b981' : '#6b7280'};cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button onclick="deleteFnB(${item.FnBID})" title="Xóa" style="background:none;border:none;color:#ef4444;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
    `;

    let html = `
        <div class="fnb-card-big" style="position:relative; opacity: ${masterCombo.IsAvailable ? 1 : 0.5};">
            ${getActionBtns(masterCombo)}
            <div class="fcb-img-wrap">
                <img src="${masterCombo.ImageURL || 'images/default_poster.svg'}" alt="${masterCombo.Name}" onerror="this.onerror=null; this.src='images/default_poster.svg'">
            </div>
            <div class="fcb-info">
                <span class="fcb-badge">NỔI BẬT</span>
                <h3>${masterCombo.Name}</h3>
                <div class="fcb-details">
                    <div class="fcb-price-block">
                        <span class="fcb-label">GIÁ</span>
                        <span class="fcb-price">${masterCombo.Price.toLocaleString()}đ</span>
                    </div>
                    <div class="fcb-stock-block">
                        <span class="fcb-label">TỒN KHO</span>
                        <div class="fcb-progress-wrap">
                            <span class="fcb-stock-val">${masterCombo.Stock}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="fnb-cards-grid">
    `;

    otherItems.forEach(item => {
        let stockClass = 'moderate';
        let stockLabel = 'Trung bình';
        if (item.Stock > 500) { stockClass = 'high'; stockLabel = 'Dồi dào'; }
        else if (item.Stock < 50) { stockClass = 'danger'; stockLabel = 'SẮP HẾT HÀNG'; }

        html += `
            <div class="fnb-card-sm" style="position:relative; opacity: ${item.IsAvailable ? 1 : 0.5};">
                ${getActionBtns(item)}
                <div class="fc-sm-img-wrap" style="margin-top:10px;">
                    <img src="${item.ImageURL || 'images/default_poster.svg'}" alt="${item.Name}" onerror="this.onerror=null; this.src='images/default_poster.svg'">
                </div>
                <div class="fc-sm-info-block">
                    <div class="fc-sm-top" style="padding-top:10px;">
                        <h4>${item.Name}</h4>
                        <span class="fc-sm-price text-red">${item.Price.toLocaleString()}đ</span>
                    </div>
                    <div class="fc-sm-bottom">
                        <div class="fc-sm-inv">
                            <span class="fc-sm-label">TỒN KHO</span>
                            <span class="fc-sm-val">${item.Stock} đơn vị</span>
                        </div>
                        <span class="inv-badge ${stockClass}">${stockLabel}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function editFnB(item) {
    document.getElementById('fnbFormTitle').textContent = 'SỬA ĐỒ ĂN';
    document.getElementById('fnbId').value = item.FnBID;
    document.getElementById('fnbName').value = item.Name;
    document.getElementById('fnbDesc').value = item.Description || '';
    document.getElementById('fnbPrice').value = item.Price;
    document.getElementById('fnbStock').value = item.Stock;
    document.getElementById('fnbCategory').value = item.Category;
    document.getElementById('fnbImageURL').value = item.ImageURL || '';
    
    document.getElementById('btnSaveFnb').querySelector('#fnbBtnText').textContent = 'Cập nhật mặt hàng';
    document.getElementById('btnCancelFnb').style.display = 'block';
    
    // Cuộn lên form
    document.querySelector('.fnb-form-side').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditFnB() {
    document.getElementById('fnbFormTitle').textContent = 'THÊM ĐỒ ĂN';
    document.getElementById('addFnbForm').reset();
    document.getElementById('fnbId').value = '';
    document.getElementById('btnSaveFnb').querySelector('#fnbBtnText').textContent = 'Thêm vào danh mục';
    document.getElementById('btnCancelFnb').style.display = 'none';
}

async function deleteFnB(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa mặt hàng này?')) return;
    try {
        const res = await apiFetch(`/api/admin/fnb/${id}`, { method: 'DELETE' });
        if (res.success) {
            alert('Đã xóa mặt hàng thành công.');
            loadFnB();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error('deleteFnB error:', err);
        alert('Lỗi kết nối.');
    }
}

async function toggleFnBAvailability(id) {
    try {
        const res = await apiFetch(`/api/admin/fnb/${id}/toggle`, { method: 'PATCH' });
        if (res.success) {
            loadFnB();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error('toggleFnB error:', err);
        alert('Lỗi kết nối.');
    }
}

async function loadFnBStats() {
    try {
        const res = await apiFetch('/api/admin/fnb/stats');
        if (res.success && res.data) {
            const data = res.data;
            document.getElementById('fnbKpiRevenue').textContent = data.TotalRevenue ? data.TotalRevenue.toLocaleString('vi-VN') + ' đ' : '0 đ';
            document.getElementById('fnbKpiVouchers').textContent = data.TotalVouchersUsed ? data.TotalVouchersUsed.toLocaleString() : '0';
            document.getElementById('fnbKpiLowStock').textContent = data.LowStockItems + ' Mặt hàng';
            document.getElementById('fnbKpiTotal').textContent = data.TotalItems;
        }
    } catch (err) {
        console.error('loadFnBStats error:', err);
    }
}

async function saveFnB() {
    const form = document.getElementById('addFnbForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById('btnSaveFnb');
    const oldText = document.getElementById('fnbBtnText').textContent;
    document.getElementById('fnbBtnText').textContent = 'Đang lưu...';
    btn.disabled = true;

    try {
        const fnbId = document.getElementById('fnbId').value;
        const payload = {
            name: document.getElementById('fnbName').value,
            description: document.getElementById('fnbDesc').value,
            price: parseFloat(document.getElementById('fnbPrice').value),
            stock: parseInt(document.getElementById('fnbStock').value),
            category: document.getElementById('fnbCategory').value,
            imageURL: document.getElementById('fnbImageURL').value,
            isAvailable: true
        };

        let res;
        if (fnbId) {
            // Update
            res = await apiFetch(`/api/admin/fnb/${fnbId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            // Create
            res = await apiFetch('/api/admin/fnb', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        if (res.success) {
            alert(fnbId ? 'Cập nhật thành công!' : 'Thêm mặt hàng thành công!');
            cancelEditFnB();
            loadFnB();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi kết nối.');
    } finally {
        document.getElementById('fnbBtnText').textContent = oldText;
        btn.disabled = false;
    }
}

/* ══════════════════════════
   VOUCHER & PROMOTIONS MANAGEMENT
   ══════════════════════════ */
let VOUCHER_DATA = [];

function switchFnbTab(tab, btn) {
    // 1. Switch active classes on buttons
    document.querySelectorAll('.fnb-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // 2. Toggle visibility of layouts
    const fnbSubpage = document.getElementById('fnbSubpage');
    const voucherSubpage = document.getElementById('voucherSubpage');
    
    if (tab === 'fnb') {
        if (fnbSubpage) fnbSubpage.style.display = 'flex';
        if (voucherSubpage) voucherSubpage.style.display = 'none';
        loadFnB();
    } else {
        if (fnbSubpage) fnbSubpage.style.display = 'none';
        if (voucherSubpage) voucherSubpage.style.display = 'flex';
        loadVouchers();
    }
}

function toggleVoucherFields() {
    const type = document.getElementById('voucherDiscountType').value;
    const maxDiscountInput = document.getElementById('voucherMaxDiscount');
    const lblMaxDiscount = document.getElementById('lblMaxDiscount');
    
    if (type === 'fixed') {
        maxDiscountInput.disabled = true;
        maxDiscountInput.placeholder = 'Không khả dụng';
        maxDiscountInput.value = '';
        if (lblMaxDiscount) lblMaxDiscount.style.opacity = '0.5';
    } else {
        maxDiscountInput.disabled = false;
        maxDiscountInput.placeholder = 'Không giới hạn';
        if (lblMaxDiscount) lblMaxDiscount.style.opacity = '1';
    }
}

async function loadVouchers() {
    try {
        const res = await apiFetch('/api/admin/vouchers');
        if (res.success && res.data) {
            VOUCHER_DATA = res.data;
            renderVouchers();
        }
    } catch (err) {
        console.error('Failed to load Vouchers:', err);
    }
}

function renderVouchers() {
    const container = document.getElementById('voucherItemsContainer');
    if (!container) return;

    if (VOUCHER_DATA.length === 0) {
        container.innerHTML = '<div style="padding:20px;color:#9ca3af;">Chưa có mã khuyến mãi nào.</div>';
        return;
    }

    let html = '<div class="fnb-cards-grid" style="grid-template-columns: repeat(2, 1fr);">';

    const getVoucherActionBtns = (item) => `
        <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px; background:rgba(0,0,0,0.6); padding:4px; border-radius:6px; z-index:10;">
            <button onclick='editVoucher(${JSON.stringify(item).replace(/'/g, "&apos;")})' title="Sửa" style="background:none;border:none;color:#3b82f6;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button onclick="toggleVoucherActive(${item.VoucherID})" title="${item.IsActive ? 'Ẩn/Tắt' : 'Hiện/Bật'}" style="background:none;border:none;color:${item.IsActive ? '#10b981' : '#6b7280'};cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button onclick="deleteVoucher(${item.VoucherID})" title="Xóa" style="background:none;border:none;color:#ef4444;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
    `;

    VOUCHER_DATA.forEach(item => {
        const discountStr = item.DiscountType === 'percent' 
            ? `${item.DiscountValue}%` 
            : `${item.DiscountValue.toLocaleString('vi-VN')} đ`;
        
        const minOrderStr = item.MinOrderValue > 0 
            ? `Đơn tối thiểu ${item.MinOrderValue.toLocaleString('vi-VN')}đ` 
            : 'Không yêu cầu đơn tối thiểu';

        const maxDiscStr = (item.DiscountType === 'percent' && item.MaxDiscount) 
            ? `Giảm tối đa ${item.MaxDiscount.toLocaleString('vi-VN')}đ` 
            : '';

        const usageLimitStr = item.UsageLimit 
            ? `Giới hạn: ${item.UsedCount}/${item.UsageLimit}` 
            : `Đã dùng: ${item.UsedCount}`;

        const formatDate = (isoString) => {
            if (!isoString) return '';
            const d = new Date(isoString);
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        };

        const activeClass = item.IsActive ? 'high' : 'danger';
        const activeLabel = item.IsActive ? 'HOẠT ĐỘNG' : 'TẠM KHÓA';

        const todayStr = new Date().toISOString().split('T')[0];
        const endStr = new Date(item.EndDate).toISOString().split('T')[0];
        const isExpired = endStr < todayStr;
        const expiredHtml = isExpired ? '<span class="inv-badge danger" style="margin-left:5px;">HẾT HẠN</span>' : '';

        html += `
            <div class="fnb-card-sm" style="position:relative; opacity: ${(item.IsActive && !isExpired) ? 1 : 0.6}; padding: 24px; border-color: ${item.IsActive ? 'rgba(16,185,129,0.3)' : 'var(--border)'}">
                ${getVoucherActionBtns(item)}
                
                <div class="fc-sm-info-block" style="gap: 8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-family:'Courier New',Courier,monospace; font-weight:900; font-size:1.2rem; background:rgba(232,25,44,0.1); color:var(--accent); padding:4px 12px; border-radius:6px; border:1px dashed var(--accent); letter-spacing:0.05em;">${item.Code}</span>
                        <span class="inv-badge ${activeClass}">${activeLabel}</span>
                        ${expiredHtml}
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: var(--text); margin-top: 6px;">Giảm ${discountStr}</div>
                    <div style="font-size: 0.85rem; color: var(--text2); line-height: 1.4;">
                        <div>• ${minOrderStr}</div>
                        ${maxDiscStr ? `<div>• ${maxDiscStr}</div>` : ''}
                        <div>• ${usageLimitStr}</div>
                        <div style="margin-top:6px; font-size:0.78rem; font-weight:600; color:var(--text3);">Thời hạn: ${formatDate(item.StartDate)} - ${formatDate(item.EndDate)}</div>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function editVoucher(item) {
    document.getElementById('voucherFormTitle').textContent = 'SỬA VOUCHER';
    document.getElementById('voucherId').value = item.VoucherID;
    document.getElementById('voucherCode').value = item.Code;
    document.getElementById('voucherDiscountType').value = item.DiscountType;
    document.getElementById('voucherDiscountValue').value = item.DiscountValue;
    document.getElementById('voucherMinOrderValue').value = item.MinOrderValue;
    document.getElementById('voucherMaxDiscount').value = item.MaxDiscount || '';
    document.getElementById('voucherUsageLimit').value = item.UsageLimit || '';
    
    const formatDateForInput = (isoString) => {
        if (!isoString) return '';
        return new Date(isoString).toISOString().split('T')[0];
    };
    document.getElementById('voucherStartDate').value = formatDateForInput(item.StartDate);
    document.getElementById('voucherEndDate').value = formatDateForInput(item.EndDate);

    toggleVoucherFields();

    document.getElementById('btnSaveVoucher').querySelector('#voucherBtnText').textContent = 'Cập nhật Voucher';
    document.getElementById('btnCancelVoucher').style.display = 'block';

    document.querySelector('#voucherSubpage .fnb-form-side').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditVoucher() {
    document.getElementById('voucherFormTitle').textContent = 'THÊM VOUCHER';
    document.getElementById('addVoucherForm').reset();
    document.getElementById('voucherId').value = '';
    document.getElementById('btnSaveVoucher').querySelector('#voucherBtnText').textContent = 'Tạo Voucher';
    document.getElementById('btnCancelVoucher').style.display = 'none';
    toggleVoucherFields();
}

async function deleteVoucher(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa voucher này?')) return;
    try {
        const res = await apiFetch(`/api/admin/vouchers/${id}`, { method: 'DELETE' });
        if (res.success) {
            alert('Đã xóa voucher thành công.');
            loadVouchers();
        } else {
            alert('Không thể xóa: ' + res.message);
        }
    } catch (err) {
        console.error('deleteVoucher error:', err);
        alert('Lỗi kết nối.');
    }
}

async function toggleVoucherActive(id) {
    try {
        const res = await apiFetch(`/api/admin/vouchers/${id}/toggle`, { method: 'PATCH' });
        if (res.success) {
            loadVouchers();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error('toggleVoucherActive error:', err);
        alert('Lỗi kết nối.');
    }
}

async function saveVoucher() {
    const form = document.getElementById('addVoucherForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById('btnSaveVoucher');
    const oldText = document.getElementById('voucherBtnText').textContent;
    document.getElementById('voucherBtnText').textContent = 'Đang lưu...';
    btn.disabled = true;

    try {
        const id = document.getElementById('voucherId').value;
        const type = document.getElementById('voucherDiscountType').value;
        
        const payload = {
            code: document.getElementById('voucherCode').value.trim().toUpperCase(),
            discountType: type,
            discountValue: parseFloat(document.getElementById('voucherDiscountValue').value),
            minOrderValue: parseFloat(document.getElementById('voucherMinOrderValue').value || 0),
            maxDiscount: type === 'fixed' ? null : (parseFloat(document.getElementById('voucherMaxDiscount').value) || null),
            usageLimit: parseInt(document.getElementById('voucherUsageLimit').value) || null,
            startDate: document.getElementById('voucherStartDate').value,
            endDate: document.getElementById('voucherEndDate').value
        };

        if (new Date(payload.endDate) < new Date(payload.startDate)) {
            alert('Ngày kết thúc không thể trước ngày bắt đầu.');
            btn.disabled = false;
            document.getElementById('voucherBtnText').textContent = oldText;
            return;
        }

        let res;
        if (id) {
            // Update
            res = await apiFetch(`/api/admin/vouchers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            // Create
            res = await apiFetch('/api/admin/vouchers', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        if (res.success) {
            alert(id ? 'Cập nhật voucher thành công!' : 'Tạo voucher thành công!');
            cancelEditVoucher();
            loadVouchers();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error('saveVoucher error:', err);
        alert('Lỗi kết nối khi lưu voucher.');
    } finally {
        btn.disabled = false;
        document.getElementById('voucherBtnText').textContent = oldText;
    }
}

/* ══════════════════════════
   STAFF MANAGEMENT
══════════════════════════ */
let STAFF_DATA = [];
let FILTERED_STAFF = [];
let currentStaffRoleFilter = 'Tất cả';
let currentStaffStatusFilter = 'Tất cả';

async function loadStaff() {
    try {
        const res = await apiFetch('/api/admin/users');
        if (res.success) {
            STAFF_DATA = res.data || [];
            updateStaffKPIs();
            applyStaffFilters();
        }
    } catch (err) {
        console.error('Failed to load staff:', err);
    }
}

function updateStaffKPIs() {
    const totalCount = STAFF_DATA.length;
    const activeCount = STAFF_DATA.filter(u => u.IsActive).length;
    const adminCount = STAFF_DATA.filter(u => u.RoleName === 'Admin').length;
    const managerCount = STAFF_DATA.filter(u => u.RoleName === 'Manager').length;
    const customerCount = STAFF_DATA.filter(u => u.RoleName === 'Customer').length;

    const valNodes = document.querySelectorAll('.sh-stat .shs-val');
    if (valNodes.length >= 2) {
        valNodes[0].textContent = totalCount;
        valNodes[1].textContent = activeCount;
    }

    const kpiCards = document.querySelectorAll('.staff-kpis .skpi-desc');
    if (kpiCards.length >= 4) {
        kpiCards[0].textContent = `${adminCount} người được ủy quyền`;
        kpiCards[1].textContent = `${managerCount} người được ủy quyền`;
        kpiCards[2].textContent = `0 người được ủy quyền`; 
        kpiCards[3].textContent = `${customerCount} khách hàng`; 
    }
}

function filterStaffByRole(role, btn) {
    if (btn) {
        document.querySelectorAll('.sf-pills .sf-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    currentStaffRoleFilter = role;
    applyStaffFilters();
}

function filterStaffByStatus(status) {
    currentStaffStatusFilter = status;
    applyStaffFilters();
}

function applyStaffFilters() {
    FILTERED_STAFF = STAFF_DATA.filter(u => {
        let roleMatch = true;
        if (currentStaffRoleFilter !== 'Tất cả') {
            if (currentStaffRoleFilter === 'Admin') roleMatch = (u.RoleName === 'Admin');
            if (currentStaffRoleFilter === 'Quản lý') roleMatch = (u.RoleName === 'Manager');
            if (currentStaffRoleFilter === 'Khách hàng') roleMatch = (u.RoleName === 'Customer');
            if (currentStaffRoleFilter === 'Nhân viên') roleMatch = (u.RoleName === 'Staff');
        }
        
        let statusMatch = true;
        if (currentStaffStatusFilter !== 'Tất cả') {
            if (currentStaffStatusFilter === 'Active') statusMatch = u.IsActive === 1;
            if (currentStaffStatusFilter === 'Banned' || currentStaffStatusFilter === 'Inactive') statusMatch = u.IsActive === 0;
        }
        return roleMatch && statusMatch;
    });
    renderStaffTable();
}

function renderStaffTable() {
    const body = document.getElementById('staffTableBody');
    if (!body) return;
    
    if (FILTERED_STAFF.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px;">Không có dữ liệu nhân sự</td></tr>';
        return;
    }

    body.innerHTML = FILTERED_STAFF.map(user => {
        let roleClass = user.RoleName.toLowerCase() === 'admin' ? 'admin' : (user.RoleName.toLowerCase() === 'manager' ? 'manager' : 'staff');
        
        return `
        <tr>
            <td>
                <div class="st-user">
                    <img src="images/default_poster.svg" alt="${user.FullName}" class="stu-avatar">
                    <div class="stu-info">
                        <span class="stu-name">${user.FullName}</span>
                        <span class="stu-email">${user.Email}</span>
                    </div>
                </div>
            </td>
            <td>
                <select class="st-role ${roleClass}" style="background:transparent; border:none; cursor:pointer;" onchange="changeStaffRole(${user.UserID}, this.value)">
                    <option value="Admin" ${user.RoleName === 'Admin' ? 'selected' : ''}>ADMIN</option>
                    <option value="Manager" ${user.RoleName === 'Manager' ? 'selected' : ''}>MANAGER</option>
                    <option value="Customer" ${user.RoleName === 'Customer' ? 'selected' : ''}>CUSTOMER</option>
                </select>
            </td>
            <td>
                <span class="st-status ${user.IsActive ? 'active' : 'blocked'}" style="cursor:pointer;" onclick="toggleStaffStatus(${user.UserID})">
                    <span class="ss-dot"></span> ${user.IsActive ? 'Hoạt động' : 'Bị khóa'}
                </span>
            </td>
            <td><span class="st-date">${new Date(user.CreatedAt).toLocaleDateString('vi-VN')}</span></td>
            <td>
                <div class="table-actions" style="opacity:0.6">
                    <button class="tb-icon-sm" title="Action"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                </div>
            </td>
        </tr>
    `}).join('');

    const pgInfo = document.getElementById('staffPgInfo');
    if (pgInfo) pgInfo.innerHTML = `Hiển thị <strong>${FILTERED_STAFF.length}</strong> nhân viên`;
}

async function changeStaffRole(userId, newRole) {
    if(!confirm(`Xác nhận đổi vai trò thành ${newRole}?`)) {
        loadStaff(); // reset select
        return;
    }
    try {
        const res = await apiFetch(`/api/admin/users/${userId}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ roleName: newRole })
        });
        if (res.success) {
            alert('Đổi vai trò thành công!');
            loadStaff();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi kết nối.');
    }
}

async function toggleStaffStatus(userId) {
    if(!confirm('Bạn có chắc muốn thay đổi trạng thái tài khoản này?')) return;
    try {
        const res = await apiFetch(`/api/admin/users/${userId}/toggle-status`, { method: 'PATCH' });
        if (res.success) {
            loadStaff();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi kết nối.');
    }
}

/* ══════════════════════════
   LIVE CLOCK
══════════════════════════ */
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    const el = document.getElementById('liveClock');
    if (el) el.textContent = `${h}:${m}:${s}`;
}

/* ══════════════════════════
   UTILITIES & ANIMATED COUNTERS
══════════════════════════ */
function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(val));
}

function animateCounter(el, target, prefix='', suffix='', decimals=0, isCurrency=false) {
    const duration = 1200;
    const start = performance.now();
    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = eased * target;
        
        let formattedVal;
        if (isCurrency) {
            formattedVal = formatCurrency(val);
        } else if (decimals > 0) {
            formattedVal = val.toFixed(decimals);
        } else {
            formattedVal = Math.round(val).toLocaleString('vi-VN');
        }
        
        el.textContent = prefix + formattedVal + suffix;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

/* ══════════════════════════
   SHOWTIME / SCHEDULE MANAGEMENT
══════════════════════════ */
let SHOWTIME_DATA = [];
let ROOM_DATA = [];
let scheduleDate = new Date().toISOString().split('T')[0];
let allCinemas = [];
let selectedCity = '';
let selectedCinemaId = null;

async function loadCinemas() {
    try {
        const res = await fetch('/api/movies/cinemas');
        const json = await res.json();
        if (json.success && json.data) {
            allCinemas = json.data;
            buildScheduleCityDropdown();
            populateMovieSelect();
        }
    } catch (err) {
        console.error('Failed to load cinemas:', err);
    }
}

function buildScheduleCityDropdown() {
    const citySel = document.getElementById('scheduleCitySelect');
    if (!citySel) return;
    const cities = [...new Set(allCinemas.map(c => c.City))].sort();
    citySel.innerHTML = '<option value="">-- Thành phố --</option>' +
        cities.map(city => `<option value="${city}">${city}</option>`).join('');
    
    if (cities.length > 0) {
        citySel.value = cities[0];
        filterScheduleCity(cities[0]);
    }
}

function filterScheduleCity(city) {
    selectedCity = city;
    const cinemaSel = document.getElementById('scheduleCinemaSelect');
    if (!cinemaSel) return;
    
    const filtered = allCinemas.filter(c => c.City === city);
    cinemaSel.innerHTML = '<option value="">-- Rạp/Chi nhánh --</option>' +
        filtered.map(c => `<option value="${c.CinemaID}">${c.CinemaName}</option>`).join('');
        
    if (filtered.length > 0) {
        cinemaSel.value = filtered[0].CinemaID;
        filterScheduleCinema(filtered[0].CinemaID);
    } else {
        filterScheduleCinema(null);
    }
}

window.filterScheduleCity = filterScheduleCity;

function filterScheduleCinema(cinemaId) {
    selectedCinemaId = cinemaId ? parseInt(cinemaId) : null;
    // Always populate stCitySelect from allCinemas
    const stCitySel = document.getElementById('stCitySelect');
    if (stCitySel && stCitySel.options.length <= 1 && allCinemas.length > 0) {
        const cities = [...new Set(allCinemas.map(c => c.City))].sort();
        stCitySel.innerHTML = '<option value="">-- Chọn thành phố --</option>' +
            cities.map(city => `<option value="${city}">${city}</option>`).join('');
    }
    
    loadShowtimes();
    
    // Update Cinema Page Builder Sidebar
    renderCinemaSidebar();
}

// ─── SHOWTIME CREATION FILTERS ───
window.filterStCity = function(city) {
    const cinemaSel = document.getElementById('stCinemaSelect');
    const roomSel = document.getElementById('stRoomSelect');
    if (!cinemaSel || !roomSel) return;
    
    roomSel.innerHTML = '<option value="">-- Chọn phòng --</option>';
    roomSel.disabled = true;
    
    if (!city) {
        cinemaSel.innerHTML = '<option value="">-- Chọn rạp --</option>';
        cinemaSel.disabled = true;
        return;
    }
    
    const filtered = allCinemas.filter(c => c.City === city);
    cinemaSel.innerHTML = '<option value="">-- Chọn rạp --</option>' +
        filtered.map(c => `<option value="${c.CinemaID}">${c.CinemaName}</option>`).join('');
    cinemaSel.disabled = false;
};

window.filterStCinema = function(cinemaId) {
    const roomSel = document.getElementById('stRoomSelect');
    if (!roomSel) return;
    
    if (!cinemaId) {
        roomSel.innerHTML = '<option value="">-- Chọn phòng --</option>';
        roomSel.disabled = true;
        return;
    }
    
    const cid = parseInt(cinemaId);
    const filteredRooms = ROOM_DATA.filter(r => r.CinemaID === cid);
    roomSel.innerHTML = '<option value="">-- Chọn phòng --</option>' +
        filteredRooms.map(r => `<option value="${r.RoomID}">${r.RoomName}</option>`).join('');
    roomSel.disabled = false;
};

// ─── END SHOWTIME CREATION FILTERS ───

window.filterScheduleCinema = filterScheduleCinema;

async function loadRooms() {
    try {
        const res = await apiFetch('/api/admin/rooms');
        if (res.success) {
            ROOM_DATA = res.data;
            renderCinemaSidebar();
        }
    } catch (err) {
        console.error('Failed to load rooms:', err);
    }
}

function populateRoomSelect() {
    // Room select in showtime form is handled by filterStCinema cascade
    // Just re-render sidebar if called elsewhere
    renderCinemaSidebar();
}

async function loadShowtimes() {
    try {
        let url = `/api/admin/showtimes?date=${scheduleDate}`;
        if (selectedCinemaId) {
            url += `&cinemaId=${selectedCinemaId}`;
        }
        const res = await apiFetch(url);
        if (res.success) {
            SHOWTIME_DATA = res.data;
            renderShowtimeTable();
            updateScheduleSummary();
        }
    } catch (err) {
        console.error('Failed to load showtimes:', err);
    }
}

function renderShowtimeTable() {
    const container = document.getElementById('showtimeListContainer');
    if (!container) return;

    if (!SHOWTIME_DATA.length) {
        container.innerHTML = '<p style="padding:24px;color:#9ca3af;text-align:center;">Chưa có suất chiếu nào trong ngày này.</p>';
        return;
    }

    container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
            <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.08);color:#9ca3af;text-align:left;">
                    <th style="padding:12px 16px;">Phim</th>
                    <th style="padding:12px 16px;">Rạp / Phòng</th>
                    <th style="padding:12px 16px;">Giờ chiếu</th>
                    <th style="padding:12px 16px;">Giá vé</th>
                    <th style="padding:12px 16px;">Đã bán</th>
                    <th style="padding:12px 16px;">Trạng thái</th>
                    <th style="padding:12px 16px;">Thao tác</th>
                </tr>
            </thead>
            <tbody>
                ${SHOWTIME_DATA.map(st => {
                    const start = new Date(st.StartTime);
                    const end = new Date(st.EndTime);
                    const timeStr = start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
                        ' - ' + end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    const soldPct = st.TotalSeats ? Math.round((st.TicketsSold / st.TotalSeats) * 100) : 0;
                    return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:12px 16px;font-weight:700;">${st.MovieTitle}</td>
                        <td style="padding:12px 16px;">${st.CinemaName}<br><span style="color:#9ca3af;font-size:0.78rem;">${st.RoomName}</span></td>
                        <td style="padding:12px 16px;">${timeStr}</td>
                        <td style="padding:12px 16px;">${Number(st.Price).toLocaleString('vi-VN')} đ</td>
                        <td style="padding:12px 16px;">${st.TicketsSold}/${st.TotalSeats} (${soldPct}%)</td>
                        <td style="padding:12px 16px;"><span class="status-badge ${st.Status}">${st.Status === 'active' ? 'Đang chiếu' : st.Status === 'cancelled' ? 'Đã hủy' : st.Status === 'finished' ? 'Đã kết thúc' : st.Status}</span></td>
                        <td style="padding:12px 16px;">
                            <div style="display:flex;gap:8px;">
                                <button onclick="openShowtimeModal(${st.ShowtimeID})" title="Sửa" style="background:none;border:none;color:#3b82f6;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                <button onclick="deleteShowtime(${st.ShowtimeID})" title="Hủy" style="background:none;border:none;color:#ef4444;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
}

function updateScheduleSummary() {
    const totalSold = SHOWTIME_DATA.reduce((s, st) => s + (st.TicketsSold || 0), 0);
    const totalSeats = SHOWTIME_DATA.reduce((s, st) => s + (st.TotalSeats || 0), 0);
    const revenue = SHOWTIME_DATA.reduce((s, st) => s + (st.TicketsSold || 0) * (st.Price || 0), 0);
    const occEl = document.getElementById('schOccupancy');
    const revEl = document.getElementById('schRevenue');
    const soldEl = document.getElementById('schSeatsSold');
    if (revEl) revEl.textContent = revenue.toLocaleString('vi-VN') + ' đ';
    if (occEl) occEl.textContent = totalSeats ? ((totalSold / totalSeats) * 100).toFixed(1) + '%' : '0%';
    if (soldEl) soldEl.textContent = totalSold + ' ghế';
    const dateLabel = document.getElementById('scheduleDateLabel');
    if (dateLabel) {
        const d = new Date(scheduleDate);
        dateLabel.textContent = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
}

function renderScheduleMovieLibrary() {
    const list = document.getElementById('scheduleMovieList');
    const badge = document.getElementById('scheduleMovieCount');
    if (!list) return;
    const showing = MOVIE_DATA.filter(m => m.Status === 'Now Showing' || m.Status === 'Coming Soon');
    if (badge) badge.textContent = showing.length + ' PHIM';
    list.innerHTML = showing.map(m => `
        <div class="lib-card" onclick="selectScheduleMovie(${m.MovieID})" style="cursor:pointer;">
            <img src="${m.PosterURL || 'images/default_poster.svg'}" onerror="this.src='images/default_poster.svg'" class="lc-poster">
            <div class="lc-info">
                <div class="lc-title">${m.Title}</div>
                <div class="lc-dur">Thời lượng: ${m.Duration} phút</div>
                <div class="lc-tags"><span class="lc-genre">${m.Status}</span></div>
            </div>
        </div>
    `).join('');
}

function selectScheduleMovie(movieId) {
    const sel = document.getElementById('stMovieSelect');
    if (sel) {
        sel.value = movieId;
        openShowtimeModal();
    }
}

function changeScheduleDate(delta) {
    const d = new Date(scheduleDate);
    d.setDate(d.getDate() + delta);
    scheduleDate = d.toISOString().split('T')[0];
    document.getElementById('scheduleDateInput').value = scheduleDate;
    loadShowtimes();
}

function openShowtimeModal(showtimeId = null) {
    const modal = document.getElementById('addShowtimeModal');
    const overlay = document.getElementById('addShowtimeModalOverlay');
    if (!modal || !overlay) return;

    // Reset form
    document.getElementById('addShowtimeForm').reset();
    document.getElementById('stId').value = '';
    document.getElementById('stEndTime').value = '';
    document.getElementById('showtimeModalTitle').textContent = 'THÊM SUẤT CHIẾU MỚI';
    document.getElementById('btnSaveShowtime').textContent = 'Lưu Suất Chiếu';

    // Always populate city dropdown from allCinemas
    const citySel = document.getElementById('stCitySelect');
    if (citySel && allCinemas.length > 0) {
        const cities = [...new Set(allCinemas.map(c => c.City))].sort();
        citySel.innerHTML = '<option value="">-- Chọn thành phố --</option>' +
            cities.map(city => `<option value="${city}">${city}</option>`).join('');
    }
    
    // Always populate movie dropdown
    const movieSel = document.getElementById('stMovieSelect');
    if (movieSel && MOVIE_DATA.length > 0) {
        movieSel.innerHTML = '<option value="">-- Chọn phim --</option>' +
            MOVIE_DATA.filter(m => m.Status !== 'deleted').map(m =>
                `<option value="${m.MovieID}">${m.Title} (${m.Duration} phút)</option>`
            ).join('');
    }

    // Reset room selects
    document.getElementById('stCinemaSelect').innerHTML = '<option value="">-- Chọn rạp --</option>';
    document.getElementById('stCinemaSelect').disabled = true;
    document.getElementById('stRoomSelect').innerHTML = '<option value="">-- Chọn phòng --</option>';
    document.getElementById('stRoomSelect').disabled = true;

    // Set default date to current scheduleDate
    document.getElementById('stDate').value = scheduleDate;

    // Auto pre-select city/cinema from filter if set
    if (selectedCity && citySel) {
        citySel.value = selectedCity;
        filterStCity(selectedCity);
        if (selectedCinemaId) {
            setTimeout(() => {
                const cinemaSel = document.getElementById('stCinemaSelect');
                if (cinemaSel) {
                    cinemaSel.value = selectedCinemaId;
                    filterStCinema(selectedCinemaId);
                }
            }, 50);
        }
    }

    // If edit mode
    let showtime = null;
    if (showtimeId && typeof showtimeId === 'number') {
        showtime = SHOWTIME_DATA.find(s => s.ShowtimeID === showtimeId);
    }

    if (showtime) {
        document.getElementById('showtimeModalTitle').textContent = 'SỬA SUẤT CHIẾU';
        document.getElementById('stId').value = showtime.ShowtimeID;

        // Find room to get cinema and city
        const r = ROOM_DATA.find(r =>
            showtime.RoomID ? r.RoomID === showtime.RoomID
            : (r.RoomName === showtime.RoomName)
        );
        if (r) {
            const c = allCinemas.find(c => c.CinemaID === r.CinemaID);
            if (c) {
                citySel.value = c.City;
                filterStCity(c.City);
                setTimeout(() => {
                    const cinemaSel = document.getElementById('stCinemaSelect');
                    if (cinemaSel) {
                        cinemaSel.value = c.CinemaID;
                        filterStCinema(c.CinemaID);
                        setTimeout(() => {
                            document.getElementById('stRoomSelect').value = r.RoomID;
                        }, 50);
                    }
                }, 50);
            }
        }

        // Movie
        const movieId = showtime.MovieID || MOVIE_DATA.find(m => m.Title === showtime.MovieTitle)?.MovieID || '';
        if (movieSel) movieSel.value = movieId;

        // Date and times
        const stDateObj = new Date(showtime.StartTime);
        const enDateObj = new Date(showtime.EndTime);
        document.getElementById('stDate').value = stDateObj.toISOString().split('T')[0];
        document.getElementById('stStartTime').value = String(stDateObj.getHours()).padStart(2,'0') + ':' + String(stDateObj.getMinutes()).padStart(2,'0');
        document.getElementById('stEndTime').value = String(enDateObj.getHours()).padStart(2,'0') + ':' + String(enDateObj.getMinutes()).padStart(2,'0');
        document.getElementById('stDuration').value = Math.round((enDateObj - stDateObj) / 60000);
        document.getElementById('stPrice').value = showtime.Price;
        document.getElementById('stStatus').value = showtime.Status || 'active';
    }

    // Use 'show' class (matches CSS)
    modal.classList.add('show');
    overlay.classList.add('show');
}

function closeShowtimeModal() {
    document.getElementById('addShowtimeModal').classList.remove('show');
    document.getElementById('addShowtimeModalOverlay').classList.remove('show');
}

// Attach showtime listeners - run after DOM ready
function attachShowtimeListeners() {
    const stMovie = document.getElementById('stMovieSelect');
    if (stMovie) {
        stMovie.addEventListener('change', () => {
            const movie = MOVIE_DATA.find(m => m.MovieID === parseInt(stMovie.value));
            if (movie && movie.Duration) {
                document.getElementById('stDuration').value = movie.Duration;
                recalcEndTime();
            }
        });
    }
    const stTime = document.getElementById('stStartTime');
    const stDur = document.getElementById('stDuration');
    if (stTime) stTime.addEventListener('change', recalcEndTime);
    if (stTime) stTime.addEventListener('input', recalcEndTime);
    if (stDur) stDur.addEventListener('input', recalcEndTime);
}

function recalcEndTime() {
    const stTime = document.getElementById('stStartTime');
    const stDur = document.getElementById('stDuration');
    const stEnd = document.getElementById('stEndTime');
    const timeVal = stTime?.value;
    const durVal = parseInt(stDur?.value) || 0;
    if (!timeVal || !durVal || !stEnd) return;
    const [h, m] = timeVal.split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m + durVal);
    stEnd.value = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

document.addEventListener('DOMContentLoaded', attachShowtimeListeners);

async function saveShowtime() {
    const stId = document.getElementById('stId').value;
    const movieId = parseInt(document.getElementById('stMovieSelect').value);
    const roomId = parseInt(document.getElementById('stRoomSelect').value);
    const dateStr = document.getElementById('stDate').value;
    const startTimeStr = document.getElementById('stStartTime').value;
    const priceRaw = document.getElementById('stPrice').value;
    const price = parseFloat(priceRaw);
    const duration = parseInt(document.getElementById('stDuration').value) || 120;
    const status = document.getElementById('stStatus').value;

    if (!movieId || isNaN(movieId)) return alert('Vui lòng chọn phim.');
    if (!roomId || isNaN(roomId)) return alert('Vui lòng chọn phòng chiếu.');
    if (!dateStr || !startTimeStr) return alert('Vui lòng chọn ngày và giờ chiếu.');
    if (!price || isNaN(price) || price <= 0) return alert('Vui lòng nhập giá vé hợp lệ.');

    const start = new Date(`${dateStr}T${startTimeStr}`);
    const end = new Date(start.getTime() + duration * 60000);

    const btn = document.getElementById('btnSaveShowtime');
    const oldText = btn.textContent;
    btn.textContent = 'Đang lưu...';
    btn.disabled = true;

    try {
        let res;
        if (stId) {
            // Update
            res = await apiFetch(`/api/admin/showtimes/${stId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    movieId, roomId,
                    startTime: start.toISOString(),
                    endTime: end.toISOString(),
                    price, status
                })
            });
        } else {
            // Create
            res = await apiFetch('/api/admin/showtimes', {
                method: 'POST',
                body: JSON.stringify({
                    movieId, roomId,
                    startTime: start.toISOString(),
                    endTime: end.toISOString(),
                    price
                })
            });
        }

        if (res.success) {
            alert(stId ? 'Cập nhật thành công!' : 'Tạo suất chiếu thành công!');
            closeShowtimeModal();
            loadShowtimes();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error('saveShowtime error:', err);
        alert('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
        btn.textContent = oldText;
        btn.disabled = false;
    }
}

async function deleteShowtime(showtimeId) {
    if (!confirm('Bạn có chắc chắn muốn hủy suất chiếu này?')) return;
    try {
        const res = await apiFetch(`/api/admin/showtimes/${showtimeId}`, { method: 'DELETE' });
        if (res.success) {
            alert('Đã hủy suất chiếu thành công.');
            loadShowtimes();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error('Failed to delete showtime:', err);
        alert('Lỗi kết nối.');
    }
}

function populateMovieSelect() {
    const sel = document.getElementById('stMovieSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Chọn phim --</option>' +
        MOVIE_DATA.filter(m => m.Status !== 'deleted').map(m =>
            `<option value="${m.MovieID}">${m.Title}</option>`
        ).join('');
}

function filterScheduleMovies(query) {
    const q = query.toLowerCase();
    const showing = MOVIE_DATA.filter(m =>
        (m.Status === 'Now Showing' || m.Status === 'Coming Soon') &&
        (!q || m.Title.toLowerCase().includes(q))
    );
    const list = document.getElementById('scheduleMovieList');
    if (!list) return;
    list.innerHTML = showing.map(m => `
        <div class="lib-card" onclick="selectScheduleMovie(${m.MovieID})" style="cursor:pointer;">
            <img src="${m.PosterURL || 'images/default_poster.svg'}" onerror="this.src='images/default_poster.svg'" class="lc-poster">
            <div class="lc-info">
                <div class="lc-title">${m.Title}</div>
                <div class="lc-dur">Thời lượng: ${m.Duration} phút</div>
            </div>
        </div>
    `).join('') || '<p style="padding:16px;color:#9ca3af;">Không tìm thấy phim.</p>';
}

/* ══════════════════════════
   SEAT MATRIX BUILDER
══════════════════════════ */
let currentBuilderRoomId = null;
let builderSeats = [];
let maxRow = 10;
let maxCol = 12;

function renderCinemaSidebar() {
    const list = document.getElementById('csList');
    if (!list) return;

    if (allCinemas.length === 0) {
        list.innerHTML = '<p style="padding:16px;color:#9ca3af;">Không có rạp nào.</p>';
        return;
    }

    list.innerHTML = allCinemas.map(c => {
        const roomsInCinema = ROOM_DATA.filter(r => r.CinemaID === c.CinemaID);
        const totalSeats = roomsInCinema.reduce((sum, r) => sum + r.TotalSeats, 0);
        return `
            <div class="cs-item" onclick="selectCinemaForBuilder(${c.CinemaID}, this)">
                <div class="cs-item-top">
                    <span class="cs-district">${c.City}</span>
                    <span class="cs-badge">HOẠT ĐỘNG</span>
                </div>
                <div class="cs-name">${c.CinemaName}</div>
                <div class="cs-meta">${roomsInCinema.length} Phòng | ${totalSeats} Ghế</div>
            </div>
        `;
    }).join('');
}

window.selectCinemaForBuilder = function(cinemaId, el) {
    document.querySelectorAll('#csList .cs-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    const rooms = ROOM_DATA.filter(r => r.CinemaID === cinemaId);
    const grid = document.getElementById('csRoomsGrid');
    if (!grid) return;

    if (rooms.length === 0) {
        grid.innerHTML = '<p style="color:#9ca3af;font-size:0.85rem;">Không có phòng</p>';
        return;
    }

    grid.innerHTML = rooms.map(r => 
        `<button class="room-btn" onclick="selectRoomForBuilder(${r.RoomID}, this)">${r.RoomName}</button>`
    ).join('') + `<button class="room-btn add-btn">+</button>`;
};

window.selectRoomForBuilder = async function(roomId, el) {
    document.querySelectorAll('#csRoomsGrid .room-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');

    currentBuilderRoomId = roomId;
    const matrix = document.getElementById('seatMatrix');
    matrix.innerHTML = '<p style="color:#9ca3af;padding:20px;">Đang tải sơ đồ ghế...</p>';

    try {
        const res = await apiFetch(`/api/admin/rooms/${roomId}/seats`);
        if (res.success) {
            builderSeats = res.data;
            if (builderSeats.length > 0) {
                // Determine max row and col
                const rows = builderSeats.map(s => s.SeatRow.charCodeAt(0) - 64);
                const cols = builderSeats.map(s => s.SeatNumber);
                maxRow = Math.max(10, Math.max(...rows));
                maxCol = Math.max(12, Math.max(...cols));
            } else {
                maxRow = 10;
                maxCol = 12;
            }
            renderSeatMatrix();
        }
    } catch (err) {
        console.error('Failed to load room seats:', err);
    }
};

function getSeatTypeClass(type) {
    switch (type) {
        case 'VIP': return 'vip';
        case 'Couple': return 'couple'; // Will map to style in HTML
        case 'None': return 'blocked hidden-seat';
        default: return 'standard';
    }
}

window.renderSeatMatrix = function() {
    const matrix = document.getElementById('seatMatrix');
    if (!matrix) return;
    
    let html = '';
    let totalSeats = 0;
    
    for (let r = 1; r <= maxRow; r++) {
        const rowChar = String.fromCharCode(64 + r);
        html += `<div class="seat-row"><span style="width:20px;display:inline-block;color:#6b7280;font-size:0.8rem;text-align:right;margin-right:10px;">${rowChar}</span>`;
        for (let c = 1; c <= maxCol; c++) {
            const seat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === c);
            let sClass = 'blocked hidden-seat';
            let bgStyle = '';
            
            if (seat && seat.SeatType !== 'None') {
                sClass = getSeatTypeClass(seat.SeatType);
                if (seat.SeatType === 'Couple') bgStyle = 'background:#ec4899;box-shadow:0 0 8px rgba(236,72,153,0.4);';
                totalSeats++;
            }
            
            html += `<button class="seat-btn ${sClass}" style="${bgStyle}" 
                        onclick="toggleSeat('${rowChar}', ${c}, this)" 
                        data-row="${rowChar}" data-col="${c}" title="${rowChar}${c}">
                     </button>`;
        }
        html += `<span style="width:20px;display:inline-block;color:#6b7280;font-size:0.8rem;text-align:left;margin-left:10px;">${rowChar}</span></div>`;
    }
    matrix.innerHTML = html;
    
    // Update footer stats
    const stats = document.querySelector('.cwf-stats');
    if (stats) stats.innerHTML = `Đã thiết lập: <strong>${totalSeats}</strong> Tổng ghế`;
};

window.toggleSeat = function(rowChar, colNum, btn) {
    if (!currentBuilderRoomId) return;
    
    const tool = document.querySelector('input[name="seat_tool"]:checked').value;
    
    let seat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === colNum);
    if (!seat) {
        seat = { SeatRow: rowChar, SeatNumber: colNum, SeatType: tool, PriceMultiplier: tool==='VIP'? 1.5 : (tool==='Couple'? 2.0 : 1.0) };
        builderSeats.push(seat);
    } else {
        seat.SeatType = tool;
        seat.PriceMultiplier = tool==='VIP'? 1.5 : (tool==='Couple'? 2.0 : 1.0);
    }
    
    // Update visually
    btn.className = `seat-btn ${getSeatTypeClass(tool)}`;
    if (tool === 'Couple') {
        btn.style.background = '#ec4899';
        btn.style.boxShadow = '0 0 8px rgba(236,72,153,0.4)';
    } else {
        btn.style.background = '';
        btn.style.boxShadow = '';
    }
    
    // Update count
    const totalSeats = builderSeats.filter(s => s.SeatType !== 'None').length;
    const stats = document.querySelector('.cwf-stats');
    if (stats) stats.innerHTML = `Đã thiết lập: <strong>${totalSeats}</strong> Tổng ghế`;
};

window.addSeatRow = function() { maxRow++; renderSeatMatrix(); };
window.addSeatCol = function() { maxCol++; renderSeatMatrix(); };

window.clearSeatMap = function() {
    if (!confirm('Bạn có chắc muốn làm mới toàn bộ sơ đồ (xóa trắng)?')) return;
    builderSeats = [];
    renderSeatMatrix();
};

window.saveSeatLayout = async function() {
    if (!currentBuilderRoomId) {
        alert('Vui lòng chọn một phòng trước khi lưu.');
        return;
    }
    
    // Filter out 'None' seats to save space, backend handles deletion of missing seats.
    const payload = builderSeats.filter(s => s.SeatType !== 'None');
    
    const btn = document.querySelector('.btn-solid-red');
    const oldText = btn.textContent;
    btn.textContent = 'Đang lưu...';
    btn.disabled = true;
    
    try {
        const res = await apiFetch(`/api/admin/rooms/${currentBuilderRoomId}/seats`, {
            method: 'PUT',
            body: JSON.stringify({ seats: payload })
        });
        if (res.success) {
            alert('Lưu sơ đồ ghế thành công!');
            // Refresh rooms to update total seats count
            await loadRooms();
            renderCinemaSidebar();
            // Reselect current cinema
            const cRoom = ROOM_DATA.find(r => r.RoomID === currentBuilderRoomId);
            if(cRoom) {
                const el = [...document.querySelectorAll('#csList .cs-item')].find(i => i.innerHTML.includes(cRoom.CinemaName));
                if (el) window.selectCinemaForBuilder(cRoom.CinemaID, el);
                
                // Then try to reselect room
                setTimeout(() => {
                    const rEl = [...document.querySelectorAll('#csRoomsGrid .room-btn')].find(b => b.textContent === cRoom.RoomName);
                    if (rEl) window.selectRoomForBuilder(currentBuilderRoomId, rEl);
                }, 100);
            }
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch(err) {
        console.error(err);
        alert('Lỗi kết nối khi lưu sơ đồ.');
    } finally {
        btn.textContent = oldText;
        btn.disabled = false;
    }
};

/* ══════════════════════════
   INIT
══════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    loadMovies();
    loadRecentTransactions();
    loadFnB();
    loadVouchers();
    loadStaff();
    loadRooms();
    loadCinemas();
    loadCinemasForFilter(); // load cinemas for topbar filter dropdown
    
    // Add event listener for search bar
    const searchInput = document.getElementById('adminSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            filteredMovies = MOVIE_DATA.filter(m => 
                m.Title.toLowerCase().includes(val) || 
                (m.Director && m.Director.toLowerCase().includes(val)) ||
                (m.MainCast && m.MainCast.toLowerCase().includes(val))
            );
            renderMovieTable();
        });
    }
    // Check auth
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
    const userStr = (localStorage.getItem('user') || sessionStorage.getItem('user'));
    
    if (!token || !userStr) {
        window.location.href = 'auth.html';
        return;
    }
    
    try {
        const user = JSON.parse(userStr);
        if (user.roleName !== 'Admin' && user.roleName !== 'Manager' && user.roleName !== 'Super Admin') {
            alert('Bạn không có quyền truy cập trang này.');
            window.location.href = 'index.html';
            return;
        }
        const initial = (user.fullName || 'A').charAt(0).toUpperCase();
        document.getElementById('adminAvatar').textContent = initial;
    } catch(e) {}

    renderTable();
    renderMovieTable();
    renderSeatMatrix();
    setInterval(updateClock, 1000);
    updateClock();

    // Fetch live dashboard data
    showDashboardFilters(); // dashboard is the default page
    loadDashboardData();
});


/* ══════════════════════════════════════
   NOTIFICATIONS (Socket.io)
══════════════════════════════════════ */
let notifs = [];

function toggleNotifDropdown() {
    const el = document.getElementById('notifDropdown');
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    if (el.style.display === 'flex') {
        document.getElementById('notifDot').style.display = 'none';
    }
}

function clearNotifs() {
    notifs = [];
    renderNotifs();
}

function renderNotifs() {
    const listEl = document.getElementById('notifList');
    if (notifs.length === 0) {
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 0.9rem;">Không có thông báo mới</div>';
        return;
    }
    
    let html = '';
    notifs.forEach(n => {
        const time = new Date(n.time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        html += `
            <div style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; background: #fff;">
                <div style="font-weight: 600; font-size: 0.9rem; color: #1f2937;">${n.title}</div>
                <div style="font-size: 0.8rem; color: #4b5563; margin-top: 4px;">${n.message}</div>
                <div style="font-size: 0.7rem; color: #9ca3af; margin-top: 6px;">${time}</div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

/* Bridge function: showAdminToast → showToast */
function showAdminToast(message, type = 'success') {
    const title = type === 'error' ? '❌ Lỗi' : '✅ Thành công';
    showToast(title, message);
}

function showToast(title, message) {
    const container = document.getElementById('adminToastContainer');
    const toast = document.createElement('div');
    toast.style.background = '#1f2937';
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontSize = '0.9rem';
    toast.style.minWidth = '250px';
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease';
    
    toast.innerHTML = `
        <div style="font-weight: bold; color: #10b981; margin-bottom: 4px;">${title}</div>
        <div>${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 10);
    
    // Auto remove
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Initialize Socket.io connection for admin
if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('adminNotification', (data) => {
        // Add to list
        notifs.unshift(data);
        if (notifs.length > 50) notifs.pop(); // Keep max 50
        
        // Show red dot if dropdown is closed
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown && dropdown.style.display !== 'flex') {
            document.getElementById('notifDot').style.display = 'block';
        }
        
        renderNotifs();
        showToast(data.title, data.message);
        
        // Optionally refresh dashboard if we are on dashboard page
        if (document.getElementById('page-dashboard').classList.contains('active')) {
            loadDashboardData();
        }
    });
}


/* ══════════════════════════════════════
   QUICK SELL MODAL (POS) LOGIC
══════════════════════════════════════ */

let qsState = {
    showtimes: [],
    selectedShowtimeId: null,
    seats: [],
    selectedSeatIds: [],
    fnbItems: [],
    selectedFnb: {}, // { fnbId: qty }
    voucher: null,   // { id, discountType, discountValue, maxDiscount }
    ticketPrice: 0
};

function openQuickSellModal() {
    document.getElementById('quickSellModal').classList.add('show');
    document.getElementById('quickSellModalOverlay').classList.add('show');
    resetQsState();
    loadQsShowtimes();
    loadQsFnb();
}

function closeQuickSellModal() {
    document.getElementById('quickSellModal').classList.remove('show');
    document.getElementById('quickSellModalOverlay').classList.remove('show');
}

function resetQsState() {
    qsState.selectedShowtimeId = null;
    qsState.seats = [];
    qsState.selectedSeatIds = [];
    qsState.selectedFnb = {};
    qsState.voucher = null;
    qsState.ticketPrice = 0;
    
    document.getElementById('qsSeatMapContainer').innerHTML = '<p style="color: #9ca3af;">Vui lòng chọn suất chiếu trước</p>';
    document.getElementById('qsSelectedSeats').textContent = 'Chưa chọn ghế';
    document.getElementById('qsCustomerPhone').value = '';
    document.getElementById('qsVoucherCode').value = '';
    document.getElementById('qsVoucherMessage').textContent = '';
    document.getElementById('btnSubmitQuickSell').disabled = true;
    updateQsTotals();
}

async function loadQsShowtimes() {
    const listEl = document.getElementById('qsShowtimesList');
    listEl.innerHTML = '<p style="color: #6b7280; font-size: 0.9rem;">Đang tải suất chiếu...</p>';
    try {
        const res = await apiFetch('/api/staff/showtimes/today');
        if (res.success) {
            qsState.showtimes = res.data;
            if (res.data.length === 0) {
                listEl.innerHTML = '<p style="color: #6b7280; font-size: 0.9rem;">Không có suất chiếu nào trong ngày hôm nay.</p>';
                return;
            }
            let html = '';
            res.data.forEach(st => {
                const start = new Date(st.StartTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                const end = new Date(st.EndTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                html += `
                    <div class="qs-showtime-card" id="qs-st-${st.ShowtimeID}" onclick="selectQsShowtime(${st.ShowtimeID}, ${st.Price})">
                        <div class="qs-movie-title">${st.MovieTitle}</div>
                        <div class="qs-room-time">${st.CinemaName} - ${st.RoomName}</div>
                        <div class="qs-room-time" style="color: var(--accent); margin-top: 5px; font-weight: bold;">
                            🕒 ${start} - ${end} &nbsp;|&nbsp; 💰 ${formatCurrency(st.Price)}đ
                        </div>
                    </div>
                `;
            });
            listEl.innerHTML = html;
        }
    } catch (err) {
        listEl.innerHTML = '<p style="color: red;">Lỗi tải suất chiếu</p>';
    }
}

async function selectQsShowtime(showtimeId, price) {
    qsState.selectedShowtimeId = showtimeId;
    qsState.ticketPrice = price;
    qsState.selectedSeatIds = [];
    qsState.voucher = null;
    
    // UI selection
    document.querySelectorAll('.qs-showtime-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`qs-st-${showtimeId}`).classList.add('selected');
    
    document.getElementById('qsSeatMapContainer').innerHTML = '<p style="color: #9ca3af;">Đang tải sơ đồ ghế...</p>';
    
    try {
        const res = await apiFetch(`/api/staff/showtimes/${showtimeId}/seats`);
        if (res.success) {
            qsState.seats = res.data;
            renderQsSeatMap();
        }
    } catch (err) {
        document.getElementById('qsSeatMapContainer').innerHTML = '<p style="color: red;">Lỗi tải sơ đồ ghế</p>';
    }
    updateQsTotals();
}

function renderQsSeatMap() {
    const container = document.getElementById('qsSeatMapContainer');
    if (!qsState.seats || qsState.seats.length === 0) {
        container.innerHTML = '<p style="color: #9ca3af;">Không có dữ liệu ghế.</p>';
        return;
    }

    // Nhóm ghế theo dòng (A, B, C...)
    const rows = {};
    qsState.seats.forEach(s => {
        if (!rows[s.SeatRow]) rows[s.SeatRow] = [];
        rows[s.SeatRow].push(s);
    });

    let html = '<div style="margin-bottom:20px; font-weight:bold; color:#6b7280; letter-spacing:5px;">MÀN HÌNH</div>';
    
    const rowKeys = Object.keys(rows).sort();
    rowKeys.forEach(rk => {
        rows[rk].sort((a,b) => a.SeatNumber - b.SeatNumber);
        html += `<div class="qs-seat-row">`;
        html += `<div style="width: 20px; text-align: center; font-weight: bold; color: #9ca3af; line-height: 28px;">${rk}</div>`;
        rows[rk].forEach(seat => {
            let sClass = 'qs-seat';
            if (seat.Status !== 'available') sClass += ' sold';
            if (seat.SeatType === 'VIP') sClass += ' vip';
            if (qsState.selectedSeatIds.includes(seat.SeatID)) sClass += ' selected';
            
            const onclick = seat.Status === 'available' ? `onclick="toggleQsSeat(${seat.SeatID}, '${seat.SeatRow}${seat.SeatNumber}')"` : '';
            html += `<div class="${sClass}" ${onclick}>${seat.SeatNumber}</div>`;
        });
        html += `<div style="width: 20px;"></div>`;
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

function toggleQsSeat(seatId, seatName) {
    const idx = qsState.selectedSeatIds.indexOf(seatId);
    if (idx > -1) {
        qsState.selectedSeatIds.splice(idx, 1);
    } else {
        if (qsState.selectedSeatIds.length >= 8) {
            return alert('Chỉ được đặt tối đa 8 ghế một lần!');
        }
        qsState.selectedSeatIds.push(seatId);
    }
    renderQsSeatMap();
    updateQsTotals();
}

async function loadQsFnb() {
    try {
        const res = await apiFetch('/api/admin/fnb'); // Hoặc dùng public route /api/bookings/food-beverages
        if (res.success) {
            qsState.fnbItems = res.data.filter(f => f.IsAvailable);
            renderQsFnb();
        }
    } catch (e) {}
}

function renderQsFnb() {
    const listEl = document.getElementById('qsFnbList');
    let html = '';
    qsState.fnbItems.forEach(f => {
        const qty = qsState.selectedFnb[f.FnBID] || 0;
        html += `
            <div class="qs-fnb-item">
                <div class="qs-fnb-info">
                    <div class="qs-fnb-name">${f.Name} <span style="font-size:0.75rem;color:#6b7280;">(Còn ${f.Stock})</span></div>
                    <div class="qs-fnb-price">${formatCurrency(f.Price)}đ</div>
                </div>
                <div class="qs-fnb-qty">
                    <button class="qs-btn-qty" onclick="updateQsFnb(${f.FnBID}, -1, ${f.Stock})">-</button>
                    <span style="width:20px;text-align:center;font-weight:600;">${qty}</span>
                    <button class="qs-btn-qty" onclick="updateQsFnb(${f.FnBID}, 1, ${f.Stock})">+</button>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

function updateQsFnb(fnbId, delta, stock) {
    let curr = qsState.selectedFnb[fnbId] || 0;
    curr += delta;
    if (curr < 0) curr = 0;
    if (curr > 10) curr = 10;
    if (curr > stock) curr = stock;
    
    if (curr === 0) delete qsState.selectedFnb[fnbId];
    else qsState.selectedFnb[fnbId] = curr;
    
    renderQsFnb();
    updateQsTotals();
}

function getSelectedSeatNames() {
    return qsState.selectedSeatIds.map(id => {
        const s = qsState.seats.find(x => x.SeatID === id);
        return s ? `${s.SeatRow}${s.SeatNumber}` : '';
    }).join(', ');
}

function updateQsTotals() {
    const seatNames = getSelectedSeatNames();
    document.getElementById('qsSelectedSeats').textContent = seatNames || 'Chưa chọn ghế';
    
    let ticketTotal = 0;
    qsState.selectedSeatIds.forEach(id => {
        const s = qsState.seats.find(x => x.SeatID === id);
        const mult = s && s.PriceMultiplier ? s.PriceMultiplier : 1;
        ticketTotal += qsState.ticketPrice * mult;
    });
    
    let fnbTotal = 0;
    Object.keys(qsState.selectedFnb).forEach(id => {
        const item = qsState.fnbItems.find(x => x.FnBID == id);
        if (item) fnbTotal += item.Price * qsState.selectedFnb[id];
    });
    
    let subTotal = ticketTotal + fnbTotal;
    let discount = 0;
    
    if (qsState.voucher) {
        if (subTotal >= qsState.voucher.MinOrderValue) {
            if (qsState.voucher.DiscountType === 'percent') {
                discount = subTotal * qsState.voucher.DiscountValue / 100;
                if (qsState.voucher.MaxDiscount) discount = Math.min(discount, qsState.voucher.MaxDiscount);
            } else {
                discount = Math.min(subTotal, qsState.voucher.DiscountValue);
            }
        }
    }
    
    let finalTotal = subTotal - discount;
    if (finalTotal < 0) finalTotal = 0;
    
    document.getElementById('qsTicketTotal').textContent = formatCurrency(ticketTotal) + ' đ';
    document.getElementById('qsFnbTotal').textContent = formatCurrency(fnbTotal) + ' đ';
    document.getElementById('qsDiscountTotal').textContent = '- ' + formatCurrency(discount) + ' đ';
    document.getElementById('qsFinalTotal').textContent = formatCurrency(finalTotal) + ' đ';
    
    document.getElementById('btnSubmitQuickSell').disabled = qsState.selectedSeatIds.length === 0;
}

async function applyQsVoucher() {
    const code = document.getElementById('qsVoucherCode').value.trim();
    const msgEl = document.getElementById('qsVoucherMessage');
    
    if (!code) {
        qsState.voucher = null;
        msgEl.textContent = '';
        updateQsTotals();
        return;
    }
    
    msgEl.textContent = 'Đang kiểm tra...';
    msgEl.style.color = '#6b7280';
    
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch('/api/bookings/validate-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        
        if (data.success) {
            qsState.voucher = data.data;
            msgEl.textContent = 'Mã hợp lệ!';
            msgEl.style.color = '#10b981';
            updateQsTotals();
        } else {
            qsState.voucher = null;
            msgEl.textContent = data.message || 'Mã không hợp lệ';
            msgEl.style.color = '#e8192c';
            updateQsTotals();
        }
    } catch (e) {
        msgEl.textContent = 'Lỗi kết nối';
    }
}

async function submitQuickSell() {
    if (qsState.selectedSeatIds.length === 0) return alert('Vui lòng chọn ghế!');
    
    const btn = document.getElementById('btnSubmitQuickSell');
    btn.disabled = true;
    btn.textContent = 'Đang xử lý...';
    
    const foodItems = Object.keys(qsState.selectedFnb).map(id => ({
        fnbId: id,
        quantity: qsState.selectedFnb[id]
    }));
    
    const payload = {
        showtimeId: qsState.selectedShowtimeId,
        seatIds: qsState.selectedSeatIds,
        foodItems: foodItems,
        customerPhone: document.getElementById('qsCustomerPhone').value.trim(),
        voucherCode: qsState.voucher ? document.getElementById('qsVoucherCode').value.trim() : null,
        paymentMethod: 'cash'
    };
    
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch('/api/staff/sell-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            alert('Thanh toán thành công!\nMã vé: ' + data.data.ticketIds.map(t => 'TKT-'+t).join(', '));
            closeQuickSellModal();
            loadDashboardData(); // Cập nhật lại biểu đồ/KPIs
        } else {
            alert('Lỗi: ' + data.message);
        }
    } catch (e) {
        alert('Lỗi kết nối');
    }
    
    btn.textContent = 'Thanh Toán & In Vé';
    btn.disabled = false;
}


/* ════════════════════════════════════════════════
   PROMOTIONS MANAGEMENT
════════════════════════════════════════════════ */
let PROMO_DATA = [];

async function loadPromotions() {
    try {
        const res = await apiFetch('/api/admin/promotions');
        if (res.success) {
            PROMO_DATA = res.data;
            renderPromoTable();
        } else {
            console.error('[Admin] loadPromotions:', res.message);
        }
    } catch (err) {
        console.error('[Admin] loadPromotions error:', err);
    }
}

function renderPromoTable() {
    const body = document.getElementById('promoBody');
    if (!body) return;

    if (PROMO_DATA.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">Chưa có khuyến mãi nào. Nhấn <b>Thêm mới</b> để bắt đầu.</td></tr>';
        return;
    }

    // Update KPI counters
    const totalEl = document.getElementById('promoKpiTotal');
    const activeEl = document.getElementById('promoKpiActive');
    const featuredEl = document.getElementById('promoKpiFeatured');
    if (totalEl) totalEl.textContent = PROMO_DATA.length;
    if (activeEl) activeEl.textContent = PROMO_DATA.filter(p => p.IsActive).length;
    if (featuredEl) featuredEl.textContent = PROMO_DATA.filter(p => p.IsFeatured).length;

    body.innerHTML = PROMO_DATA.map(p => `
        <tr class="txn-row">
            <td>
                <img src="${p.ImageURL || 'images/default_poster.svg'}"
                     alt="${p.Title}"
                     onerror="this.onerror=null;this.src='images/default_poster.svg'"
                     style="width:70px;height:48px;object-fit:cover;border-radius:6px;box-shadow:var(--shadow-xs);border:1px solid var(--border);">
            </td>
            <td>
                <div style="font-weight:700;color:var(--text);font-size:0.88rem;">${p.Title}</div>
                <div style="font-size:0.78rem;color:var(--text2);margin-top:4px;line-height:1.4;">${(p.Description || '').substring(0, 75)}${p.Description && p.Description.length > 75 ? '…' : ''}</div>
            </td>
            <td>${p.BadgeLabel ? `<span class="status-badge" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.18);font-weight:700;font-size:0.68rem;padding:3px 9px;">${p.BadgeLabel}</span>` : '<span style="color:var(--text3); font-style:italic;">—</span>'}</td>
            <td>
                ${p.IsFeatured
                    ? '<span class="status-badge active" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.22);color:#d97706;font-weight:700;">★ Nổi bật</span>'
                    : '<span class="status-badge finished" style="background:rgba(107,114,128,0.06);border:1px solid rgba(107,114,128,0.12);color:#6b7280;">Thường</span>'}
            </td>
            <td>
                ${p.IsActive 
                    ? '<span class="status-badge active">Đang hiện</span>' 
                    : '<span class="status-badge finished">Đã ẩn</span>'}
            </td>
            <td style="color:var(--text);font-weight:700;font-size:0.88rem;text-align:center;">${p.SortOrder}</td>
            <td>
                <div class="table-actions">
                    <button class="tb-icon-sm" title="Sửa" onclick="openPromoModal(${p.PromotionID})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="tb-icon-sm" title="${p.IsActive ? 'Ẩn' : 'Hiện'}" onclick="togglePromo(${p.PromotionID})" style="color:${p.IsActive ? '#6b7280' : '#10b981'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="tb-icon-sm danger" title="Xóa" onclick="deletePromo(${p.PromotionID})" style="color:var(--danger)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openPromoModal(id) {
    document.getElementById('promoForm').reset();
    document.getElementById('promoCurrentImg').innerHTML = '';

    if (id) {
        const p = PROMO_DATA.find(x => x.PromotionID === id);
        if (!p) return;
        document.getElementById('promoModalTitle').textContent = 'SỬA KHUYẾN MÃI';
        document.getElementById('promoId').value = p.PromotionID;
        document.getElementById('promoTitle').value = p.Title || '';
        document.getElementById('promoDesc').value = p.Description || '';
        document.getElementById('promoBadge').value = p.BadgeLabel || '';
        document.getElementById('promoLink').value = p.LinkURL || '';
        document.getElementById('promoSort').value = p.SortOrder || 0;
        document.getElementById('promoFeatured').checked = !!p.IsFeatured;
        document.getElementById('promoActive').checked = !!p.IsActive;
        if (p.ImageURL) {
            document.getElementById('promoCurrentImg').innerHTML = `Ảnh hiện tại: <a href="${p.ImageURL}" target="_blank" style="color:var(--accent);">${p.ImageURL}</a>`;
        }
    } else {
        document.getElementById('promoModalTitle').textContent = 'THÊM KHUYẾN MÃI';
        document.getElementById('promoId').value = '';
        document.getElementById('promoActive').checked = true;
    }

    document.getElementById('promoModalOverlay').style.display = 'block';
    document.getElementById('promoModal').style.display = 'block';
}

function closePromoModal() {
    document.getElementById('promoModalOverlay').style.display = 'none';
    document.getElementById('promoModal').style.display = 'none';
}

async function savePromo(event) {
    event.preventDefault();
    const id = document.getElementById('promoId').value;
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));

    const formData = new FormData();
    formData.append('title',       document.getElementById('promoTitle').value);
    formData.append('description', document.getElementById('promoDesc').value);
    formData.append('badgeLabel',  document.getElementById('promoBadge').value);
    formData.append('linkURL',     document.getElementById('promoLink').value);
    formData.append('sortOrder',   document.getElementById('promoSort').value);
    formData.append('isFeatured',  document.getElementById('promoFeatured').checked ? 'true' : 'false');
    formData.append('isActive',    document.getElementById('promoActive').checked ? 'true' : 'false');

    const imageFile = document.getElementById('promoImage').files[0];
    if (imageFile) formData.append('image', imageFile);

    const url    = id ? `/api/admin/promotions/${id}` : '/api/admin/promotions';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            showAdminToast(data.message, 'success');
            closePromoModal();
            loadPromotions();
        } else {
            showAdminToast('Lỗi: ' + data.message, 'error');
        }
    } catch (err) {
        console.error('[Admin] savePromo:', err);
        showAdminToast('Lỗi kết nối server.', 'error');
    }
}

async function deletePromo(id) {
    if (!confirm('Bạn có chắc muốn xóa khuyến mãi này không?')) return;
    try {
        const res = await apiFetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
        if (res.success) {
            showAdminToast(res.message, 'success');
            loadPromotions();
        } else {
            showAdminToast('Lỗi: ' + res.message, 'error');
        }
    } catch (err) {
        showAdminToast('Lỗi kết nối server.', 'error');
    }
}

async function togglePromo(id) {
    try {
        const res = await apiFetch(`/api/admin/promotions/${id}/toggle`, { method: 'PATCH' });
        if (res.success) {
            showAdminToast(res.message, 'success');
            loadPromotions();
        } else {
            showAdminToast('Lỗi: ' + res.message, 'error');
        }
    } catch (err) {
        showAdminToast('Lỗi kết nối server.', 'error');
    }
}




/* ══════════════════════════
   SETTINGS & PRICING
══════════════════════════ */
async function loadSettings() {
    try {
        const res = await apiFetch('/api/admin/settings');
        if (res.success) {
            const data = res.data;
            if(document.getElementById('cfg_BASE_TICKET_PRICE')) document.getElementById('cfg_BASE_TICKET_PRICE').value = data.BASE_TICKET_PRICE || '';
            if(document.getElementById('cfg_VIP_MULTIPLIER')) document.getElementById('cfg_VIP_MULTIPLIER').value = data.VIP_MULTIPLIER || '';
            if(document.getElementById('cfg_COUPLE_MULTIPLIER')) document.getElementById('cfg_COUPLE_MULTIPLIER').value = data.COUPLE_MULTIPLIER || '';
            
            if(document.getElementById('cfg_HOTLINE')) document.getElementById('cfg_HOTLINE').value = data.HOTLINE || '';
            if(document.getElementById('cfg_SUPPORT_EMAIL')) document.getElementById('cfg_SUPPORT_EMAIL').value = data.SUPPORT_EMAIL || '';
            if(document.getElementById('cfg_MAINTENANCE_MODE')) document.getElementById('cfg_MAINTENANCE_MODE').checked = (data.MAINTENANCE_MODE === 'true');
        }
    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

async function savePricingSettings() {
    const basePrice = document.getElementById('cfg_BASE_TICKET_PRICE').value;
    const vipM = document.getElementById('cfg_VIP_MULTIPLIER').value;
    const coupleM = document.getElementById('cfg_COUPLE_MULTIPLIER').value;
    
    if(!basePrice || !vipM || !coupleM) return showToast('Lỗi', 'Vui lòng điền đủ thông tin');
    
    const payload = [
        { key: 'BASE_TICKET_PRICE', value: basePrice },
        { key: 'VIP_MULTIPLIER', value: vipM },
        { key: 'COUPLE_MULTIPLIER', value: coupleM }
    ];
    
    await updateSettingsApi(payload);
}

async function saveSystemSettings() {
    const hotline = document.getElementById('cfg_HOTLINE').value;
    const email = document.getElementById('cfg_SUPPORT_EMAIL').value;
    const maint = document.getElementById('cfg_MAINTENANCE_MODE').checked;
    
    const payload = [
        { key: 'HOTLINE', value: hotline },
        { key: 'SUPPORT_EMAIL', value: email },
        { key: 'MAINTENANCE_MODE', value: maint ? 'true' : 'false' }
    ];
    
    await updateSettingsApi(payload);
}

async function updateSettingsApi(settingsArray) {
    try {
        const res = await apiFetch('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({ settings: settingsArray })
        });
        if (res.success) {
            showToast('Thành công', res.message);
            loadSettings();
        } else {
            showToast('Lỗi', res.message);
        }
    } catch (e) {
        console.error('Failed to save settings', e);
        showToast('Lỗi', 'Lỗi kết nối server');
    }
}
