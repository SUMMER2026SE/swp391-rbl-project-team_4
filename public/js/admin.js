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
            MOVIE_DATA = data.data;
            filteredMovies = [...MOVIE_DATA];
            renderMovieTable();
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

function editMovie(id) {
    alert('Tính năng sửa phim đang được hoàn thiện!');
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

function openAddMovieModal() {
    document.getElementById('addMovieModalOverlay').classList.add('show');
    document.getElementById('addMovieModal').classList.add('show');
}
function closeAddMovieModal() {
    document.getElementById('addMovieModalOverlay').classList.remove('show');
    document.getElementById('addMovieModal').classList.remove('show');
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
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-9-9"/></svg> Saving...`;
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
        const res = await fetch('/api/admin/movies', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            alert('Lưu phim thành công!');
            closeAddMovieModal();
            loadMovies();
        } else {
            alert('Lưu phim thất bại. ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('An error occurred while saving.');
    } finally {
        btn.innerHTML = `Save Movie`;
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

    let html = `
        <div class="fnb-card-big">
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
            <div class="fnb-card-sm">
                <div class="fc-sm-top">
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

async function saveFnB() {
    const form = document.getElementById('addFnbForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById('btnSaveFnb');
    btn.innerHTML = 'Đang lưu...';
    btn.disabled = true;

    try {
        const payload = {
            name: document.getElementById('fnbName').value,
            price: parseFloat(document.getElementById('fnbPrice').value),
            stock: parseInt(document.getElementById('fnbStock').value),
            category: document.getElementById('fnbCategory').value,
            isAvailable: true
        };

        const res = await apiFetch('/api/admin/fnb', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (res.success) {
            alert('Thêm mặt hàng thành công!');
            form.reset();
            loadFnB();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi kết nối.');
    } finally {
        btn.innerHTML = `Thêm vào danh mục`;
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
   SEAT MATRIX BUILDER
══════════════════════════ */
function renderSeatMatrix() {
    const rows = ['A','B','C','D','E','F','G','H','I','J'];
    let html = '';
    rows.forEach(r => {
        html += `<div class="seat-row">`;
        for(let c = 1; c <= 12; c++) {
            let sClass = 'standard';
            if (r === 'A' && (c === 1 || c === 12)) sClass = 'blocked';
            else if (['E','F','G','H'].includes(r) && c >= 4 && c <= 9) sClass = 'vip';
            
            html += `<button class="seat-btn ${sClass}">${r}${c}</button>`;
        }
        html += `</div>`;
    });
    const matrix = document.getElementById('seatMatrix');
    if (matrix) matrix.innerHTML = html;
}

/* ══════════════════════════
   INIT
══════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    loadMovies();
    loadRecentTransactions();
    loadFnB();
    loadStaff();
    
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
