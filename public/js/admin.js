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
    return res.json();
}

let chartInstance = null;

async function loadDashboardData() {
    try {
        const statsRes = await apiFetch('/api/admin/stats/dashboard');
        if (statsRes.success) {
            const data = statsRes.data;
            const kpiVals = document.querySelectorAll('.kpi-value');
            if (kpiVals.length >= 4) {
                animateCounter(kpiVals[0], data.TotalRevenue || 0, '$', '', 0);
                animateCounter(kpiVals[1], data.TicketSales || 0, '', '', 0);
                animateCounter(kpiVals[2], data.FnBSales || 0, '$', '', 0);
                animateCounter(kpiVals[3], data.OccupancyRate || 0, '', '%', 1);
            }
        }

        const monthlyRes = await apiFetch('/api/admin/stats/monthly-revenue');
        if (monthlyRes.success) {
            buildChart(monthlyRes.data);
        }

        const topMoviesRes = await apiFetch('/api/admin/stats/top-movies?limit=4');
        if (topMoviesRes.success) {
            renderTopMovies(topMoviesRes.data);
        }
    } catch (err) {
        console.error('Error loading dashboard data:', err);
    }
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
                <div class="rank-amount">$${(m.TodayRevenue / 1000).toFixed(1)}K</div>
                <div class="rank-today">TODAY</div>
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
function buildChart(monthlyData) {
    const ctx = document.getElementById('revenueChart');
    if(!ctx) return;
    
    const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    
    // Fill missing months with 0
    const ticketData = new Array(12).fill(0);
    const fnbData = new Array(12).fill(0);
    
    if (monthlyData) {
        monthlyData.forEach(row => {
            const mIndex = row.MonthNumber - 1;
            ticketData[mIndex] = row.TicketRevenue;
            fnbData[mIndex] = row.FnBRevenue;
        });
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
                        label: ctx => ` $${(ctx.raw/1000).toFixed(1)}K`
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
                        callback: v => '$' + (v/1000) + 'K'
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
    
    if (filter === 'All') {
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
    } else if (page === 'schedule') {
        topbarTitle.textContent = 'LỊCH CHIẾU';
        topbarTitle.style.display = 'block';
        ttabs.style.display = 'flex';
    } else {
        topbarTitle.style.display = 'none';
        ttabs.style.display = 'flex';
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
                <div class="fc-sm-top" style="padding-top:20px;">
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
   STAFF MANAGEMENT
══════════════════════════ */
let STAFF_DATA = [];

async function loadStaff() {
    try {
        const res = await apiFetch('/api/admin/users');
        if (res.success) {
            STAFF_DATA = res.data;
            renderStaffTable();
        }
    } catch (err) {
        console.error('Failed to load staff:', err);
    }
}

function renderStaffTable() {
    const body = document.getElementById('staffTableBody');
    if (!body) return;
    
    if (STAFF_DATA.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px;">Không có dữ liệu nhân sự</td></tr>';
        return;
    }

    body.innerHTML = STAFF_DATA.map(user => {
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
    if (pgInfo) pgInfo.innerHTML = `Hiển thị <strong>${STAFF_DATA.length}</strong> nhân viên`;
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
   ANIMATED COUNTERS
══════════════════════════ */
function animateCounter(el, target, prefix='', suffix='', decimals=0) {
    const duration = 1200;
    const start = performance.now();
    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = eased * target;
        el.textContent = prefix + (decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
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
    loadStaff();
    loadRooms();
    loadCinemas();
    
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
    loadDashboardData();
});
