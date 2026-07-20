/* ══════════════════════════
   DASHBOARD FILTER STATE
══════════════════════════ */
let dashCinemaId = '';
let dashPeriod = '';
let filterCinemas = [];

/* ══════════════════════════
   FETCH DATA FROM BACKEND
══════════════════════════ */
const ADMIN_JS_VERSION = '25-floating-ai-query';
if (typeof window !== 'undefined') {
    window.ADMIN_JS_VERSION = ADMIN_JS_VERSION;
}

function getRouteRetryUrl(url, payload) {
    const message = String(payload?.message || '');
    if (!message.includes('không tồn tại')) return null;
    if (url.startsWith('/admin/')) return '/api' + url;
    if (url.startsWith('/api/admin/')) return url.replace('/api/admin/', '/admin/');
    return null;
}

async function parseApiResponse(url, res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('[apiFetch] Non-JSON response for', url, ':', text.substring(0, 200));
        return { success: false, message: 'Invalid response' };
    }
}

async function apiFetch(url, options = {}) {
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    let res;
    try {
        res = await fetch(url, { ...options, headers });
    } catch (err) {
        console.error('[apiFetch] Network error for', url, err);
        return { success: false, message: `Không thể gọi API ${url}: ${err.message || 'lỗi kết nối'}` };
    }
    const payload = await parseApiResponse(url, res);
    if (!payload.success && res.status) {
        payload.status = res.status;
    }
    const retryUrl = getRouteRetryUrl(url, payload);
    if (retryUrl && retryUrl !== url) {
        console.warn('[apiFetch] Retrying admin route with alternate prefix:', retryUrl);
        try {
            const retryRes = await fetch(retryUrl, { ...options, headers });
            const retryPayload = await parseApiResponse(retryUrl, retryRes);
            if (!retryPayload.success && retryRes.status) {
                retryPayload.status = retryRes.status;
            }
            return retryPayload;
        } catch (err) {
            console.error('[apiFetch] Network error for retry', retryUrl, err);
            return { success: false, message: `Không thể gọi API ${retryUrl}: ${err.message || 'lỗi kết nối'}` };
        }
    }
    return payload;
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function toLocalDateInputValue(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return toLocalDateInputValue(new Date());
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toLocalTimeInputValue(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function dateInputToLocalDate(value) {
    const [year, month, day] = String(value || '').split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
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

async function loadAiRevenueInsight() {
    const box = document.getElementById('aiRevenueInsight');
    const providerEl = document.getElementById('aiInsightProvider');
    if (!box) return;

    box.classList.add('ai-insight-loading');
    box.textContent = 'Đang phân tích dữ liệu doanh thu...';
    if (providerEl) providerEl.textContent = 'Đang chạy';

    try {
        const res = await apiFetch('/api/admin/ai/revenue-insight', {
            method: 'POST',
            body: JSON.stringify({
                cinemaId: dashCinemaId || null,
                period: dashPeriod || 'all',
                year: new Date().getFullYear()
            })
        });

        box.classList.remove('ai-insight-loading');

        if (res.success && res.data) {
            if (providerEl) {
                providerEl.textContent = res.data.provider === 'gemini' ? 'Gemini' : 'Dự phòng';
            }
            box.textContent = res.data.warning
                ? `${res.data.warning}\n\n${res.data.insight || ''}`
                : (res.data.insight || 'AI chưa trả về nội dung phân tích.');
        } else {
            if (providerEl) providerEl.textContent = 'Lỗi';
            box.textContent = res.message || 'Không thể tạo phân tích doanh thu.';
        }
    } catch (err) {
        box.classList.remove('ai-insight-loading');
        if (providerEl) providerEl.textContent = 'Lỗi';
        box.textContent = 'Không thể kết nối tới dịch vụ phân tích AI.';
        console.error('AI revenue insight failed:', err);
    }
}

function escapeAdminHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAdminMoney(value) {
    return Number(value || 0).toLocaleString('vi-VN') + ' đ';
}

function formatAdminDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderAdminQueryTable(intent, rows) {
    const table = document.getElementById('aiAdminQueryTable');
    if (!table) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        table.innerHTML = '';
        return;
    }

    const limitedRows = rows.slice(0, 6);
    let headers = [];
    let cells = [];

    if (intent === 'top_cinema_revenue_today') {
        headers = ['Rạp', 'Thành phố', 'Vé', 'Doanh thu'];
        cells = limitedRows.map(row => [
            row.CinemaName,
            row.City,
            row.TicketsSold || 0,
            formatAdminMoney(row.TotalRevenue)
        ]);
    } else if (intent === 'least_sold_movie_this_week' || intent === 'top_movie_today') {
        headers = ['Phim', 'Vé', 'Doanh thu', 'Trạng thái'];
        cells = limitedRows.map(row => [
            row.Title,
            row.TicketsSold || 0,
            formatAdminMoney(row.TotalRevenue),
            row.Status || ''
        ]);
    } else {
        headers = ['Phim', 'Rạp / Phòng', 'Giờ chiếu', 'Đã bán', 'Ghế trống'];
        cells = limitedRows.map(row => [
            row.MovieTitle,
            `${row.CinemaName || ''} - ${row.RoomName || ''}`,
            formatAdminDateTime(row.StartTime),
            `${row.TicketsSold || 0}/${row.TotalSeats || 0}`,
            row.EmptySeats || 0
        ]);
    }

    table.innerHTML = `
        <table>
            <thead>
                <tr>${headers.map(header => `<th>${escapeAdminHtml(header)}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${cells.map(row => `
                    <tr>${row.map(cell => `<td>${escapeAdminHtml(cell)}</td>`).join('')}</tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function toggleAdminAiQuery(forceOpen) {
    const card = document.getElementById('aiAdminQueryCard');
    const toggle = document.getElementById('aiAdminQueryToggle');
    if (!card) return;

    const shouldOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : card.classList.contains('is-collapsed');

    card.classList.toggle('is-collapsed', !shouldOpen);
    if (toggle) {
        toggle.setAttribute('aria-expanded', String(shouldOpen));
        toggle.setAttribute('title', shouldOpen ? 'Thu gọn trợ lý truy vấn dữ liệu' : 'Mở trợ lý truy vấn dữ liệu');
    }

    if (shouldOpen) {
        setTimeout(() => document.getElementById('aiAdminQuestion')?.focus(), 0);
    }
}

async function askAdminAi(event, presetQuestion) {
    if (event) event.preventDefault();
    toggleAdminAiQuery(true);
    const input = document.getElementById('aiAdminQuestion');
    const answerBox = document.getElementById('aiAdminQueryAnswer');
    const providerEl = document.getElementById('aiAdminQueryProvider');
    const table = document.getElementById('aiAdminQueryTable');
    if (!input || !answerBox) return;

    const question = String(presetQuestion || input.value || '').trim();
    if (!question) {
        answerBox.textContent = 'Vui lòng nhập câu hỏi.';
        return;
    }

    input.value = question;
    answerBox.classList.add('ai-insight-loading');
    answerBox.textContent = 'Đang truy vấn dữ liệu admin...';
    if (providerEl) providerEl.textContent = 'Đang chạy';
    if (table) table.innerHTML = '';

    try {
        const res = await apiFetch('/api/admin/ai/query', {
            method: 'POST',
            body: JSON.stringify({ question })
        });

        answerBox.classList.remove('ai-insight-loading');

        if (res.success && res.data) {
            if (providerEl) providerEl.textContent = res.data.provider === 'gemini' ? 'Gemini' : 'Dự phòng';
            answerBox.textContent = res.data.warning
                ? `${res.data.warning}\n\n${res.data.answer || ''}`
                : (res.data.answer || 'Chưa có câu trả lời.');
            renderAdminQueryTable(res.data.intent, res.data.rows || []);
        } else {
            if (providerEl) providerEl.textContent = 'Lỗi';
            answerBox.textContent = res.message || 'Không thể truy vấn dữ liệu admin.';
        }
    } catch (err) {
        answerBox.classList.remove('ai-insight-loading');
        if (providerEl) providerEl.textContent = 'Lỗi';
        answerBox.textContent = 'Không thể kết nối tới trợ lý dữ liệu admin.';
        console.error('Admin AI query failed:', err);
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

async function exportCsv() {
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
    if (!token) return alert('Vui lòng đăng nhập!');

    const params = new URLSearchParams();
    if (dashCinemaId) params.set('cinemaId', dashCinemaId);
    if (dashPeriod) params.set('period', dashPeriod);
    const qs = params.toString() ? '?' + params.toString() : '';

    try {
        const res = await fetch('/api/admin/stats/export-csv' + qs, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return alert(errData.message || 'Không thể xuất file CSV.');
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'D-Cinema-Report.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error downloading CSV:', err);
        alert('Lỗi kết nối khi xuất CSV!');
    }
}

async function exportExcel() {
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
    if (!token) return alert('Vui lòng đăng nhập!');

    const params = new URLSearchParams();
    if (dashCinemaId) params.set('cinemaId', dashCinemaId);
    if (dashPeriod) params.set('period', dashPeriod);
    const qs = params.toString() ? '?' + params.toString() : '';

    try {
        const res = await fetch('/api/admin/stats/export-excel' + qs, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return alert(errData.message || 'Không thể xuất file Excel.');
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'D-Cinema-Report.xls';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error downloading Excel:', err);
        alert('Lỗi kết nối khi xuất Excel!');
    }
}

function ensureReportExportButtons() {
    const actions = document.querySelector('.heading-actions');
    if (!actions || document.getElementById('btnExportCsv')) return;

    const csvBtn = document.createElement('button');
    csvBtn.className = 'btn-export';
    csvBtn.id = 'btnExportCsv';
    csvBtn.type = 'button';
    csvBtn.onclick = exportCsv;
    csvBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV';

    const excelBtn = document.createElement('button');
    excelBtn.className = 'btn-export';
    excelBtn.id = 'btnExportExcel';
    excelBtn.type = 'button';
    excelBtn.onclick = exportExcel;
    excelBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Excel';

    actions.appendChild(csvBtn);
    actions.appendChild(excelBtn);
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
        grid.innerHTML = '<p style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--text3);" data-i18n="admin_live_no_rooms">Không có phòng chiếu.</p>';
        if (window.changeLanguage) changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
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
                <div class="lr-movie">${status === 'empty' ? '<span data-i18n="admin_live_no_schedule">Chưa có lịch</span>' : (r.MovieTitle || 'Unknown')}</div>
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

    if (window.changeLanguage) changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
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
    if (btn) {
        document.querySelectorAll('.period-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
    }
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
        container.innerHTML = '<p style="padding:20px; color:#9ca3af; text-align:center;" data-i18n="admin_rank_no_data">Không có dữ liệu.</p>';
        if (window.changeLanguage) changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
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
                <div class="rank-today" data-i18n="admin_rank_today">HÔM NAY</div>
            </div>
        </div>
    `).join('');

    if (window.changeLanguage) changeLanguage(localStorage.getItem('dcinema_lang') || 'vi');
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
    if (!body) return;
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
    if (pgInfo) pgInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
    const pgPrev = document.getElementById('pgPrev');
    if (pgPrev) pgPrev.disabled = currentPage === 1;
    const pgNext = document.getElementById('pgNext');
    if (pgNext) pgNext.disabled = currentPage === totalPages;
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
    if (!ctx) return;

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

    const allValues = [...ticketData, ...fnbData].map(v => Number(v || 0));
    const maxValue = Math.max(0, ...allValues);
    const suggestedMax = maxValue > 0 ? Math.ceil(maxValue * 1.2) : 100000;

    function formatChartMoney(value) {
        const amount = Number(value || 0);
        if (amount === 0) return '0đ';
        if (Math.abs(amount) >= 1000000000) {
            const val = amount / 1000000000;
            return `${Number.isInteger(val) ? val : val.toFixed(1)} Tỷ`;
        }
        if (Math.abs(amount) >= 1000000) {
            const val = amount / 1000000;
            return `${Number.isInteger(val) ? val : val.toFixed(1)} Tr`;
        }
        if (Math.abs(amount) >= 1000) {
            const val = amount / 1000;
            return `${Number.isInteger(val) ? val : val.toFixed(0)}K`;
        }
        return `${amount.toLocaleString('vi-VN')}đ`;
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
                        label: ctx => ` ${formatChartMoney(ctx.raw)}`
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
                    beginAtZero: true,
                    suggestedMax,
                    grid: { color: 'rgba(148,163,184,0.18)', drawBorder: false },
                    ticks: {
                        color: '#9ca3af', font: { size: 11 },
                        maxTicksLimit: 6,
                        callback: v => formatChartMoney(v)
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
let GENRE_DATA = [];

async function loadGenres() {
    try {
        const res = await apiFetch('/api/admin/genres');
        if (res.success) {
            GENRE_DATA = res.data || [];
            renderGenreAdminList();
            renderMovieGenreCheckboxes();
        }
    } catch (err) {
        console.error('[Admin] loadGenres:', err);
    }
}

function renderGenreAdminList() {
    const wrap = document.getElementById('genreAdminList');
    if (!wrap) return;
    if (!GENRE_DATA.length) {
        wrap.innerHTML = '<span style="color:var(--text2);font-size:0.85rem;">Chưa có thể loại nào.</span>';
        return;
    }
    wrap.innerHTML = GENRE_DATA.map(g => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:${g.IsActive ? 'var(--surface)' : '#f3f4f6'};">
            <span style="font-weight:700;color:${g.IsActive ? 'var(--text)' : 'var(--text3)'};">${g.GenreName}</span>
            <span style="font-size:0.75rem;color:var(--text2);">${g.MovieCount || 0} phim</span>
            <button class="tb-icon-sm" title="Sửa" onclick="editGenre(${g.GenreID})">✎</button>
            <button class="tb-icon-sm" title="${g.IsActive ? 'Ẩn' : 'Hiện'}" onclick="toggleGenre(${g.GenreID})">${g.IsActive ? 'Ẩn' : 'Hiện'}</button>
            <button class="tb-icon-sm danger" title="Xóa" onclick="deleteGenre(${g.GenreID})">×</button>
        </div>
    `).join('');
}

function renderMovieGenreCheckboxes(selectedIds = []) {
    const wrap = document.getElementById('movieGenreCheckboxes');
    if (!wrap) return;
    const activeGenres = GENRE_DATA.filter(g => g.IsActive);
    if (!activeGenres.length) {
        wrap.innerHTML = '<span style="color:var(--text2);font-size:0.85rem;">Chưa có thể loại. Hãy thêm ở trang Phim.</span>';
        return;
    }
    const selectedSet = new Set(selectedIds.map(id => parseInt(id, 10)));
    wrap.innerHTML = activeGenres.map(g => `
        <label style="display:flex;align-items:center;gap:8px;color:var(--text);font-size:0.9rem;cursor:pointer;">
            <input type="checkbox" class="movie-genre-checkbox" value="${g.GenreID}" ${selectedSet.has(g.GenreID) ? 'checked' : ''} style="accent-color:var(--accent);">
            ${g.GenreName}
        </label>
    `).join('');
}

function getSelectedMovieGenreIds() {
    return Array.from(document.querySelectorAll('.movie-genre-checkbox:checked')).map(input => input.value);
}

async function saveGenre() {
    const input = document.getElementById('genreNameInput');
    const name = input ? input.value.trim() : '';
    if (!name) return alert('Vui lòng nhập tên thể loại.');
    try {
        const res = await apiFetch('/api/admin/genres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ genreName: name })
        });
        if (res.success) {
            input.value = '';
            await loadGenres();
            await loadMovies();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        alert('Lỗi khi lưu thể loại.');
    }
}

async function editGenre(id) {
    const genre = GENRE_DATA.find(g => g.GenreID === id);
    if (!genre) return;
    const name = prompt('Nhập tên thể loại mới:', genre.GenreName);
    if (!name || !name.trim()) return;
    try {
        const res = await apiFetch(`/api/admin/genres/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ genreName: name.trim() })
        });
        if (res.success) {
            await loadGenres();
            await loadMovies();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        alert('Lỗi khi cập nhật thể loại.');
    }
}

async function toggleGenre(id) {
    try {
        const res = await apiFetch(`/api/admin/genres/${id}/toggle`, { method: 'PATCH' });
        if (res.success) {
            await loadGenres();
            await loadMovies();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        alert('Lỗi khi đổi trạng thái thể loại.');
    }
}

async function deleteGenre(id) {
    if (!confirm('Bạn có chắc muốn xóa thể loại này không? Nếu đang được dùng, hệ thống sẽ chuyển sang ẩn.')) return;
    try {
        const res = await apiFetch(`/api/admin/genres/${id}`, { method: 'DELETE' });
        if (res.success) {
            await loadGenres();
            await loadMovies();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        alert('Lỗi khi xóa thể loại.');
    }
}

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
            populateReviewMovieFilter();
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
                    ${(m.Genres || 'Chưa gán').split(',').map(g => `<span class="genre-tag">${g.trim()}</span>`).join('')}
                </div>
            </td>
            <td><span class="genre-tag">${m.AgeRating || 'Chưa gán'}</span></td>
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
    document.getElementById('movieTrailerURL').value = movie.TrailerURL || '';
    const selectedGenres = String(movie.GenreIDs || '').split(',').map(id => parseInt(id, 10)).filter(Boolean);
    renderMovieGenreCheckboxes(selectedGenres);
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
        renderMovieGenreCheckboxes();
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
        formData.append('trailerURL', document.getElementById('movieTrailerURL').value);
        formData.append('genreIds', getSelectedMovieGenreIds().join(','));

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
            if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(page)) {
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

    if (page === 'movies') {
        loadGenres();
        loadMovies();
    }

    if (page === 'reviews') {
        populateReviewMovieFilter();
        loadAdminReviews();
    }

    if (page === 'promotions') {
        loadPromotions();
        loadNewsArticles();
    }

    if (page === 'pricing' || page === 'settings') {
        loadSettings();
    }

    if (page === 'fnb') {
        loadFnB();
    }

    if (page === 'combos') {
        loadCombos();
    }

    if (page === 'refunds') {
        ensureRefundActionModal();
        loadAdminRefunds();
    }

    if (page === 'voucher') {
        if (typeof loadVouchers === 'function') {
            loadVouchers();
        }
        if (typeof initVoucherForm === 'function') {
            initVoucherForm();
        }
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
let currentFnbFilter = 'Tất cả';

function filterFnB(filter, btn) {
    document.querySelectorAll('.fnb-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    currentFnbFilter = filter;
    renderFnB();
}

async function loadFnB(search = '') {
    try {
        const res = await apiFetch('/api/admin/fnb');
        if (res.success) {
            FNB_DATA = res.data;
            if (search) {
                const term = search.toLowerCase();
                FNB_DATA = FNB_DATA.filter(item =>
                    item.Name.toLowerCase().includes(term) ||
                    (item.Description && item.Description.toLowerCase().includes(term))
                );
            }
            renderFnB();
            loadFnBStats();
            initDragAndDrop();
        }
    } catch (err) {
        console.error('Failed to load F&B:', err);
    }
}

function renderFnB() {
    const container = document.getElementById('fnbTableBody');
    if (!container) return;

    let itemsToRender = FNB_DATA;
    if (currentFnbFilter !== 'Tất cả') {
        itemsToRender = FNB_DATA.filter(item => item.Category === currentFnbFilter);
    }

    if (itemsToRender.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="padding:24px;color:#9ca3af;text-align:center;">Chưa có mặt hàng nào thuộc danh mục này.</td></tr>';
        return;
    }

    let html = '';
    itemsToRender.forEach(item => {
        html += `
            <tr style="border-bottom: 1px solid var(--border); opacity: ${item.IsAvailable ? 1 : 0.5};">
                <td style="padding: 12px 16px;">
                    <div style="width: 50px; height: 50px; overflow: hidden; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: var(--bg);">
                        <img src="${item.ImageURL || 'images/default_fnb.png'}" alt="${item.Name}" onerror="this.onerror=null; this.src='images/default_fnb.png'" style="max-height: 100%; max-width: 100%; object-fit: cover;">
                    </div>
                </td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 700; color: var(--text);">${item.Name}</div>
                    <div style="font-size: 0.8rem; color: var(--text2); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.Description || ''}</div>
                </td>
                <td style="padding: 12px 16px;">
                    <span style="font-size: 0.8rem; padding: 4px 8px; background: var(--bg); border-radius: 4px; color: var(--text2); font-weight: 500;">
                        ${item.Category === 'Combos' ? 'Combo' : item.Category}
                    </span>
                </td>
                <td style="padding: 12px 16px; font-weight: 700; color: var(--accent);">
                    ${parseFloat(item.Price).toLocaleString('vi-VN')}đ
                </td>
                <td style="padding: 12px 16px; font-weight: 600;">
                    ${item.Stock}
                </td>
                <td style="padding: 12px 16px;">
                    <span class="inv-badge ${item.IsAvailable ? 'high' : 'danger'}" style="font-size:0.75rem; padding: 2px 6px; border-radius: 4px;">
                        ${item.IsAvailable ? 'Hoạt động' : 'Tạm ẩn'}
                    </span>
                </td>
                <td style="padding: 12px 16px; text-align: right;">
                    <div style="display: inline-flex; gap: 8px;">
                        <button type="button" onclick='editFnB(${item.FnBID})' title="Sửa" style="background:none;border:none;color:#3b82f6;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button type="button" onclick="toggleFnBAvailability(${item.FnBID})" title="${item.IsAvailable ? 'Ẩn' : 'Hiện'}" style="background:none;border:none;color:${item.IsAvailable ? '#10b981' : '#6b7280'};cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                        <button type="button" onclick="deleteFnB(${item.FnBID})" title="Xóa" style="background:none;border:none;color:#ef4444;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                </td>
            </tr>
        `;
    });

    container.innerHTML = html;
}

function editFnB(id) {
    const item = FNB_DATA.find(x => x.FnBID === id);
    if (!item) return;
    document.getElementById('fnbFormTitle').textContent = 'SỬA MẶT HÀNG';
    document.getElementById('fnbId').value = item.FnBID;
    document.getElementById('fnbName').value = item.Name;
    document.getElementById('fnbDesc').value = item.Description || '';
    document.getElementById('fnbPrice').value = item.Price;
    document.getElementById('fnbStock').value = item.Stock;
    document.getElementById('fnbCategory').value = item.Category;
    document.getElementById('fnbImageUrl').value = item.ImageURL || '';
    document.getElementById('fnbStatus').value = item.IsAvailable ? 'Active' : 'Inactive';

    document.getElementById('fnbBtnText').textContent = 'Cập nhật mặt hàng';
    document.getElementById('btnCancelFnb').style.display = 'block';

    const dropZoneText = document.getElementById('fnbDropZoneText');
    const previewImg = document.getElementById('fnbPreviewImg');
    const uploadIcon = document.getElementById('fnbUploadIcon');
    if (item.ImageURL) {
        if (previewImg) {
            previewImg.src = item.ImageURL;
            previewImg.style.display = 'block';
        }
        if (uploadIcon) uploadIcon.style.display = 'none';
        if (dropZoneText) dropZoneText.textContent = 'Thay đổi ảnh (click hoặc kéo thả file khác)';
    } else {
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
        if (uploadIcon) uploadIcon.style.display = 'block';
        if (dropZoneText) dropZoneText.textContent = 'Chọn file hoặc kéo thả vào đây';
    }

    document.querySelector('.fnb-form-side').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditFnB() {
    document.getElementById('fnbFormTitle').textContent = 'THÊM MẶT HÀNG MỚI';
    document.getElementById('addFnbForm').reset();
    document.getElementById('fnbId').value = '';
    document.getElementById('fnbImageUrl').value = '';
    document.getElementById('fnbStatus').value = 'Active';
    document.getElementById('fnbBtnText').textContent = 'Thêm mặt hàng';
    document.getElementById('btnCancelFnb').style.display = 'none';
    const dropZoneText = document.getElementById('fnbDropZoneText');
    if (dropZoneText) dropZoneText.textContent = 'Chọn file hoặc kéo thả vào đây';

    const previewImg = document.getElementById('fnbPreviewImg');
    const uploadIcon = document.getElementById('fnbUploadIcon');
    if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
    }
    if (uploadIcon) uploadIcon.style.display = 'block';
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
    document.getElementById('fnbBtnText').textContent = 'Đang xử lý...';
    btn.disabled = true;

    try {
        const fnbId = document.getElementById('fnbId').value;
        const formData = new FormData();
        formData.append('name', document.getElementById('fnbName').value.trim());
        formData.append('description', document.getElementById('fnbDesc').value.trim());
        formData.append('price', document.getElementById('fnbPrice').value);
        formData.append('stock', document.getElementById('fnbStock').value);
        formData.append('category', document.getElementById('fnbCategory').value);
        formData.append('isAvailable', document.getElementById('fnbStatus').value === 'Active');

        const imageFile = document.getElementById('fnbImage').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
        const url = fnbId ? `/api/admin/fnb/${fnbId}` : '/api/admin/fnb';
        const method = fnbId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            alert(fnbId ? 'Cập nhật mặt hàng thành công!' : 'Thêm mặt hàng mới thành công!');
            cancelEditFnB();
            loadFnB();
        } else {
            alert('Lỗi: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi kết nối máy chủ.');
    } finally {
        document.getElementById('fnbBtnText').textContent = oldText;
        btn.disabled = false;
    }
}

/* ══════════════════════════
   COMBO MANAGEMENT
   ══════════════════════════ */
let COMBO_DATA = [];

async function loadCombos(search = '') {
    try {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await apiFetch('/api/admin/combos' + query);
        if (res.success) {
            COMBO_DATA = res.data;
            renderCombos();
            initDragAndDrop();
        }
    } catch (err) {
        console.error('Failed to load Combos:', err);
    }
}

function renderCombos() {
    const container = document.getElementById('comboTableBody');
    if (!container) return;

    if (COMBO_DATA.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="padding:24px;color:#9ca3af;text-align:center;">Chưa có combo bắp nước nào.</td></tr>';
        return;
    }

    let html = '';
    COMBO_DATA.forEach(item => {
        html += `
            <tr style="border-bottom: 1px solid var(--border); opacity: ${item.Status === 'Active' ? 1 : 0.5};">
                <td style="padding: 12px 16px;">
                    <div style="width: 50px; height: 50px; overflow: hidden; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: var(--bg);">
                        <img src="${item.ImageURL || 'images/default_fnb.png'}" alt="${item.ComboName}" onerror="this.onerror=null; this.src='images/default_fnb.png'" style="max-height: 100%; max-width: 100%; object-fit: cover;">
                    </div>
                </td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 700; color: var(--text);">${item.ComboName}</div>
                </td>
                <td style="padding: 12px 16px; font-size: 0.8rem; color: var(--text2); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${item.Description || ''}
                </td>
                <td style="padding: 12px 16px; font-weight: 700; color: var(--accent);">
                    ${parseFloat(item.Price).toLocaleString('vi-VN')}đ
                </td>
                <td style="padding: 12px 16px; font-weight: 600;">
                    ${item.Stock !== undefined ? item.Stock : 100}
                </td>
                <td style="padding: 12px 16px;">
                    <span class="inv-badge ${item.Status === 'Active' ? 'high' : 'danger'}" style="font-size:0.75rem; padding: 2px 6px; border-radius: 4px;">
                        ${item.Status === 'Active' ? 'Hoạt động' : 'Tạm ẩn'}
                    </span>
                </td>
                <td style="padding: 12px 16px; text-align: right;">
                    <div style="display: inline-flex; gap: 8px;">
                        <button type="button" onclick='editCombo(${item.ComboID})' title="Sửa" style="background:none;border:none;color:#3b82f6;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button type="button" onclick="toggleComboStatus(${item.ComboID})" title="${item.Status === 'Active' ? 'Ẩn' : 'Hiện'}" style="background:none;border:none;color:${item.Status === 'Active' ? '#10b981' : '#6b7280'};cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                        <button type="button" onclick="deleteCombo(${item.ComboID})" title="Xóa" style="background:none;border:none;color:#ef4444;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                </td>
            </tr>
        `;
    });

    container.innerHTML = html;
}

function editCombo(id) {
    const item = COMBO_DATA.find(x => x.ComboID === id);
    if (!item) return;
    document.getElementById('comboFormTitle').textContent = 'SỬA COMBO';
    document.getElementById('comboId').value = item.ComboID;
    document.getElementById('comboName').value = item.ComboName;
    document.getElementById('comboDesc').value = item.Description || '';
    document.getElementById('comboPrice').value = item.Price;
    document.getElementById('comboStock').value = item.Stock !== undefined ? item.Stock : 100;
    document.getElementById('comboImageUrl').value = item.ImageURL || '';
    document.getElementById('comboStatus').value = item.Status;

    document.getElementById('comboBtnText').textContent = 'Cập nhật Combo';
    document.getElementById('btnCancelCombo').style.display = 'block';

    const dropZoneText = document.getElementById('comboDropZoneText');
    const previewImg = document.getElementById('comboPreviewImg');
    const uploadIcon = document.getElementById('comboUploadIcon');
    if (item.ImageURL) {
        if (previewImg) {
            previewImg.src = item.ImageURL;
            previewImg.style.display = 'block';
        }
        if (uploadIcon) uploadIcon.style.display = 'none';
        if (dropZoneText) dropZoneText.textContent = 'Thay đổi ảnh (click hoặc kéo thả file khác)';
    } else {
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
        if (uploadIcon) uploadIcon.style.display = 'block';
        if (dropZoneText) dropZoneText.textContent = 'Chọn file hoặc kéo thả vào đây';
    }

    document.querySelector('#page-combos .fnb-form-side').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditCombo() {
    document.getElementById('comboFormTitle').textContent = 'THÊM COMBO MỚI';
    document.getElementById('addComboForm').reset();
    document.getElementById('comboId').value = '';
    document.getElementById('comboStock').value = '100';
    document.getElementById('comboImageUrl').value = '';
    document.getElementById('comboStatus').value = 'Active';
    document.getElementById('comboBtnText').textContent = 'Thêm Combo mới';
    document.getElementById('btnCancelCombo').style.display = 'none';
    const dropZoneText = document.getElementById('comboDropZoneText');
    if (dropZoneText) dropZoneText.textContent = 'Chọn file hoặc kéo thả vào đây';

    const previewImg = document.getElementById('comboPreviewImg');
    const uploadIcon = document.getElementById('comboUploadIcon');
    if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
    }
    if (uploadIcon) uploadIcon.style.display = 'block';
}

async function saveCombo() {
    const form = document.getElementById('addComboForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById('btnSaveCombo');
    const oldText = document.getElementById('comboBtnText').textContent;
    document.getElementById('comboBtnText').textContent = 'Đang xử lý...';
    btn.disabled = true;

    try {
        const comboId = document.getElementById('comboId').value;
        const formData = new FormData();
        formData.append('comboName', document.getElementById('comboName').value.trim());
        formData.append('description', document.getElementById('comboDesc').value.trim());
        formData.append('price', document.getElementById('comboPrice').value);
        formData.append('stock', document.getElementById('comboStock').value);
        formData.append('status', document.getElementById('comboStatus').value);

        const imageFile = document.getElementById('comboImage').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
        const url = comboId ? `/api/admin/combos/${comboId}` : '/api/admin/combos';
        const method = comboId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            alert(comboId ? 'Cập nhật combo thành công!' : 'Tạo combo mới thành công!');
            cancelEditCombo();
            loadCombos();
        } else {
            alert('Lỗi: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi kết nối máy chủ.');
    } finally {
        document.getElementById('comboBtnText').textContent = oldText;
        btn.disabled = false;
    }
}

async function deleteCombo(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa combo này?')) return;
    try {
        const res = await apiFetch(`/api/admin/combos/${id}`, { method: 'DELETE' });
        if (res.success) {
            alert('Xóa combo thành công!');
            loadCombos();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error('deleteCombo error:', err);
        alert('Lỗi kết nối máy chủ.');
    }
}

async function toggleComboStatus(id) {
    try {
        const res = await apiFetch(`/api/admin/combos/${id}/toggle`, { method: 'PATCH' });
        if (res.success) {
            loadCombos();
        } else {
            alert('Lỗi: ' + res.message);
        }
    } catch (err) {
        console.error('toggleComboStatus error:', err);
        alert('Lỗi kết nối máy chủ.');
    }
}

function showImagePreview(file, previewImgId, iconId, textId, defaultText = 'Chọn file hoặc kéo thả vào đây') {
    const previewImg = document.getElementById(previewImgId);
    const uploadIcon = iconId ? document.getElementById(iconId) : null;
    const textEl = textId ? document.getElementById(textId) : null;

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (previewImg) {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
            }
            if (uploadIcon) uploadIcon.style.display = 'none';
            if (textEl) {
                if (textId && textId.includes('DropZone')) {
                    textEl.textContent = 'Thay đổi ảnh (click hoặc kéo thả file khác)';
                } else {
                    textEl.textContent = file.name;
                }
            }
        };
        reader.readAsDataURL(file);
    } else {
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
        if (uploadIcon) uploadIcon.style.display = 'block';
        if (textEl) textEl.textContent = defaultText;
    }
}

function handleFnbFileSelect(input) {
    const file = input.files[0];
    showImagePreview(file, 'fnbPreviewImg', 'fnbUploadIcon', 'fnbDropZoneText');
}

function handleComboFileSelect(input) {
    const file = input.files[0];
    showImagePreview(file, 'comboPreviewImg', 'comboUploadIcon', 'comboDropZoneText');
}

function handleNewsFileSelect(input) {
    const file = input.files[0];
    showImagePreview(file, 'newsPreviewImg', null, 'newsFileName', 'Chưa chọn file');
}

function handlePromoFileSelect(input) {
    const file = input.files[0];
    showImagePreview(file, 'promoPreviewImg', null, 'promoFileName', 'Chưa chọn file');
}

let dragDropInitialized = false;
function initDragAndDrop() {
    if (dragDropInitialized) return;
    dragDropInitialized = true;

    ['fnb', 'combo'].forEach(prefix => {
        const dropZone = document.getElementById(`${prefix}DropZone`);
        const fileInput = document.getElementById(`${prefix}Image`);
        const textVal = document.getElementById(`${prefix}DropZoneText`);
        if (!dropZone || !fileInput) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--accent)';
                dropZone.style.background = 'rgba(232,25,44,0.05)';
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--border)';
                dropZone.style.background = 'var(--bg-white)';
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length) {
                fileInput.files = files;
                showImagePreview(files[0], `${prefix}PreviewImg`, `${prefix}UploadIcon`, `${prefix}DropZoneText`);
            }
        }, false);
    });
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
    const comboSubpage = document.getElementById('comboSubpage');

    if (tab === 'fnb') {
        if (fnbSubpage) fnbSubpage.style.display = 'flex';
        if (comboSubpage) comboSubpage.style.display = 'none';
        loadFnB();
    } else if (tab === 'combo') {
        if (fnbSubpage) fnbSubpage.style.display = 'none';
        if (comboSubpage) comboSubpage.style.display = 'flex';
        loadCombos();
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
    if (!confirm(`Xác nhận đổi vai trò thành ${newRole}?`)) {
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
    if (!confirm('Bạn có chắc muốn thay đổi trạng thái tài khoản này?')) return;
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
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const el = document.getElementById('liveClock');
    if (el) el.textContent = `${h}:${m}:${s}`;
}

/* ══════════════════════════
   UTILITIES & ANIMATED COUNTERS
══════════════════════════ */
function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(val));
}

function animateCounter(el, target, prefix = '', suffix = '', decimals = 0, isCurrency = false) {
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
let scheduleDate = toLocalDateInputValue();
let allCinemas = [];
let selectedCity = '';
let selectedCinemaId = null;

async function loadCinemas() {
    try {
        const res = await apiFetch('/api/admin/cinemas');
        if (res.success && res.data) {
            allCinemas = res.data;
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
window.filterStCity = function (city) {
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

window.filterStCinema = function (cinemaId) {
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
        filteredRooms.map(r => `<option value="${r.RoomID}">${r.RoomType && r.RoomType !== 'Standard' ? '[' + r.RoomType + '] ' : ''}${r.RoomName}</option>`).join('');
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
        const timeStr = start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) +
            ' - ' + end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
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

    container.querySelectorAll('tbody tr').forEach((row, index) => {
        const badge = row.querySelector('.status-badge');
        if (!badge) return;
        const displayStatus = getShowtimeDisplayStatus(SHOWTIME_DATA[index]);
        badge.className = `status-badge ${displayStatus.className}`;
        badge.textContent = displayStatus.label;
    });
}

function getShowtimeDisplayStatus(showtime) {
    const status = String(showtime?.Status || '').toLowerCase();
    if (status === 'cancelled') return { className: 'cancelled', label: '\u0110\u00e3 h\u1ee7y' };
    if (status === 'finished') return { className: 'finished', label: '\u0110\u00e3 k\u1ebft th\u00fac' };
    if (status !== 'active') return { className: status || 'unknown', label: showtime?.Status || 'Kh\u00f4ng r\u00f5' };

    const now = Date.now();
    const start = new Date(showtime.StartTime).getTime();
    const end = new Date(showtime.EndTime).getTime();
    if (!Number.isNaN(start) && now < start) return { className: 'upcoming', label: 'S\u1eafp chi\u1ebfu' };
    if (!Number.isNaN(end) && now > end) return { className: 'finished', label: '\u0110\u00e3 k\u1ebft th\u00fac' };
    return { className: 'active', label: '\u0110ang chi\u1ebfu' };
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
        const d = dateInputToLocalDate(scheduleDate);
        dateLabel.textContent = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
}

function renderScheduleMovieLibrary() {
    const list = document.getElementById('scheduleMovieList');
    const badge = document.getElementById('scheduleMovieCount');
    if (!list) return;
    const showing = MOVIE_DATA.filter(m => m.Status === 'Now Showing');
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
    populateAiScheduleMovieSelect();
}

function populateAiScheduleMovieSelect() {
    const sel = document.getElementById('aiScheduleMovieSelect');
    if (!sel) return;
    const current = sel.value;
    const movies = MOVIE_DATA.filter(m => m.Status === 'Now Showing');
    sel.innerHTML = '<option value="">-- Tất cả phim đang chiếu --</option>' +
        movies.map(m => `<option value="${m.MovieID}">${m.Title} (${m.Duration || 120} phút)</option>`).join('');
    if (current && movies.some(m => String(m.MovieID) === String(current))) {
        sel.value = current;
    }
}

async function loadAiScheduleSuggestion() {
    const box = document.getElementById('aiScheduleSuggestion');
    const providerEl = document.getElementById('aiScheduleProvider');
    const movieSel = document.getElementById('aiScheduleMovieSelect');
    if (!box) return;

    if (!selectedCinemaId) {
        alert('Vui lòng chọn rạp trước khi dùng AI gợi ý xếp lịch.');
        return;
    }

    box.classList.add('ai-insight-loading');
    box.textContent = 'Đang phân tích phim, phòng và lịch chiếu hiện có...';
    if (providerEl) providerEl.textContent = 'Đang chạy';

    try {
        const res = await apiFetch('/api/admin/ai/schedule-suggestion', {
            method: 'POST',
            body: JSON.stringify({
                date: scheduleDate,
                cinemaId: selectedCinemaId,
                movieId: movieSel?.value || null
            })
        });

        box.classList.remove('ai-insight-loading');

        if (res.success && res.data) {
            if (providerEl) {
                providerEl.textContent = res.data.provider === 'gemini' ? 'Gemini' : 'Dự phòng';
            }
            box.textContent = res.data.warning
                ? `${res.data.warning}\n\n${res.data.suggestion || ''}`
                : (res.data.suggestion || 'AI chưa trả về gợi ý xếp lịch.');
        } else {
            if (providerEl) providerEl.textContent = 'Lỗi';
            box.textContent = res.status
                ? `${res.message || 'Không thể tạo gợi ý xếp lịch.'} (HTTP ${res.status})`
                : (res.message || 'Không thể tạo gợi ý xếp lịch.');
        }
    } catch (err) {
        box.classList.remove('ai-insight-loading');
        if (providerEl) providerEl.textContent = 'Lỗi';
        box.textContent = `Không thể kết nối tới dịch vụ gợi ý lịch chiếu AI: ${err.message || 'lỗi không xác định'}`;
        console.error('AI schedule suggestion failed:', err);
    }
}

function selectScheduleMovie(movieId) {
    const movie = MOVIE_DATA.find(m => m.MovieID === Number(movieId));
    if (!movie || movie.Status !== 'Now Showing') {
        alert('Chỉ phim đang chiếu mới được thêm vào lịch chiếu.');
        return;
    }

    openShowtimeModal();
    const sel = document.getElementById('stMovieSelect');
    if (sel) {
        sel.value = String(movieId);
        sel.dispatchEvent(new Event('change'));
    }
}

function changeScheduleDate(delta) {
    const d = dateInputToLocalDate(scheduleDate);
    d.setDate(d.getDate() + delta);
    scheduleDate = toLocalDateInputValue(d);
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
            MOVIE_DATA.filter(m => m.Status === 'Now Showing').map(m =>
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
        document.getElementById('stDate').value = toLocalDateInputValue(stDateObj);
        document.getElementById('stStartTime').value = toLocalTimeInputValue(stDateObj);
        document.getElementById('stEndTime').value = toLocalTimeInputValue(enDateObj);
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
    stEnd.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
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
    const selectedMovie = MOVIE_DATA.find(m => m.MovieID === movieId);
    if (!selectedMovie || selectedMovie.Status !== 'Now Showing') {
        return alert('Chỉ phim đang chiếu mới được thêm vào lịch chiếu.');
    }

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
        MOVIE_DATA.filter(m => m.Status === 'Now Showing').map(m =>
            `<option value="${m.MovieID}">${m.Title}</option>`
        ).join('');
}

function filterScheduleMovies(query) {
    const q = query.toLowerCase();
    const showing = MOVIE_DATA.filter(m =>
        m.Status === 'Now Showing' &&
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
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-icon-xs" title="Sửa rạp" onclick="event.stopPropagation(); openEditCinemaModal(${c.CinemaID})">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button class="btn-icon-xs" title="Xóa rạp" onclick="event.stopPropagation(); deleteCinema(${c.CinemaID})">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                    </div>
                </div>
                <div class="cs-name">${c.CinemaName}</div>
                <div class="cs-meta">${roomsInCinema.length} Phòng | ${totalSeats} Ghế</div>
            </div>
        `;
    }).join('');
}

window.selectCinemaForBuilder = function (cinemaId, el) {
    document.querySelectorAll('#csList .cs-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    const rooms = ROOM_DATA.filter(r => r.CinemaID === cinemaId);
    const grid = document.getElementById('csRoomsGrid');
    if (!grid) return;

    if (rooms.length === 0) {
        grid.innerHTML = '<p style="color:#9ca3af;font-size:0.85rem;">Không có phòng</p>' +
            `<button class="room-btn add-btn" onclick="openAddRoomModal(${cinemaId})">+</button>`;
    } else {
        grid.innerHTML = rooms.map(r =>
            `<button class="room-btn" onclick="selectRoomForBuilder(${r.RoomID}, this)">
                ${r.RoomName}
                <div class="room-actions">
                    <span class="room-act-edit" onclick="event.stopPropagation(); openEditRoomModal(${r.RoomID}, '${r.RoomName}')">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </span>
                    <span class="room-act-del" onclick="event.stopPropagation(); deleteRoom(${r.RoomID})">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                </div>
             </button>`
        ).join('') + `<button class="room-btn add-btn" onclick="openAddRoomModal(${cinemaId})">+</button>`;
    }

    // Toggle Workspace visibility vs Detail visibility
    const ws = document.getElementById('cinemaWorkspace');
    const detail = document.getElementById('cinemaDetail');
    if (ws) ws.style.display = 'none';
    if (detail) {
        detail.style.display = 'flex';

        // Find cinema object
        const c = allCinemas.find(x => x.CinemaID === cinemaId);
        if (c) {
            const totalSeats = rooms.reduce((sum, r) => sum + r.TotalSeats, 0);
            detail.innerHTML = `
                <div class="cinema-detail-header" style="border-bottom: 1px solid var(--border); padding-bottom: 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <span class="badge" style="background: var(--yellow); color: #fff; font-size: 0.7rem; font-weight: 800; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">Cụm rạp chi nhánh</span>
                        <h1 style="font-size: 1.8rem; font-weight: 800; color: var(--text); margin: 8px 0 4px 0;">${c.CinemaName}</h1>
                        <p style="color: var(--text2); display: flex; align-items: center; gap: 6px; font-size: 0.9rem;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            ${c.Address}, ${c.City}
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-outline-red" style="padding: 10px 20px; font-size: 0.85rem;" onclick="openEditCinemaModal(${c.CinemaID})">
                            Sửa cụm rạp
                        </button>
                        <button class="btn-solid-red" style="padding: 10px 20px; font-size: 0.85rem;" onclick="deleteCinema(${c.CinemaID})">
                            Xóa cụm rạp
                        </button>
                    </div>
                </div>

                <div class="cinema-detail-body" style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h2 style="font-size: 1.1rem; font-weight: 800; color: var(--text);">DANH SÁCH PHÒNG CHIẾU (${rooms.length})</h2>
                            <button class="btn-solid-red" style="padding: 6px 14px; font-size: 0.75rem;" onclick="openAddRoomModal(${c.CinemaID})">
                                + Thêm phòng
                            </button>
                        </div>
                        <div class="rooms-detail-list" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                            ${rooms.map(r => `
                                <div style="padding: 20px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-white); transition: all 0.2s; cursor: pointer; position: relative;" onclick="document.querySelector('[onclick*=\\'selectRoomForBuilder(${r.RoomID}\\')').click()">
                                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 6px;">${r.RoomName}</div>
                                    <div style="font-size: 0.8rem; color: var(--text2); display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21v-4a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v4"/><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>
                                        Sức chứa: <strong>${r.TotalSeats}</strong> ghế
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn-outline-red" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 4px;" onclick="event.stopPropagation(); openEditRoomModal(${r.RoomID}, '${r.RoomName}')">Sửa tên</button>
                                        <button class="btn-outline-red" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 4px;" onclick="event.stopPropagation(); deleteRoom(${r.RoomID})">Xóa</button>
                                    </div>
                                </div>
                            `).join('') || '<p style="color: var(--text3); font-style: italic;">Chưa có phòng chiếu nào được tạo.</p>'}
                        </div>
                    </div>
                    
                    <div>
                        <h2 style="font-size: 1.1rem; font-weight: 800; color: var(--text); margin-bottom: 16px;">THÔNG TIN THỐNG KÊ</h2>
                        <div style="border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--bg-white);">
                            <div style="padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.85rem; color: var(--text2);">Tổng số phòng</span>
                                <strong style="font-size: 1.1rem; color: var(--text);">${rooms.length}</strong>
                            </div>
                            <div style="padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.85rem; color: var(--text2);">Tổng số ghế</span>
                                <strong style="font-size: 1.1rem; color: var(--text);">${totalSeats}</strong>
                            </div>
                            <div style="padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.85rem; color: var(--text2);">Thành phố</span>
                                <strong style="font-size: 1.1rem; color: var(--text);">${c.City}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
};

window.selectRoomForBuilder = async function (roomId, el) {
    // If element is not passed, find it
    if (!el) {
        const buttons = document.querySelectorAll('#csRoomsGrid .room-btn');
        for (let btn of buttons) {
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`selectRoomForBuilder(${roomId}`)) {
                el = btn;
                break;
            }
        }
    }
    document.querySelectorAll('#csRoomsGrid .room-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');

    currentBuilderRoomId = roomId;

    // Toggle Workspace visibility vs Detail visibility
    const ws = document.getElementById('cinemaWorkspace');
    const detail = document.getElementById('cinemaDetail');
    if (ws) ws.style.display = 'flex';
    if (detail) detail.style.display = 'none';

    const matrix = document.getElementById('seatMatrix');
    if (matrix) matrix.innerHTML = '<p style="color:#9ca3af;padding:20px;">Đang tải sơ đồ ghế...</p>';

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
            
            // Update size inputs
            const rowsInput = document.getElementById('gridRowsInput');
            const colsInput = document.getElementById('gridColsInput');
            if (rowsInput) rowsInput.value = maxRow;
            if (colsInput) colsInput.value = maxCol;
            
            const presetSelect = document.getElementById('presetTemplateSelect');
            if (presetSelect) presetSelect.value = '';

            renderSeatMatrix();
        }
    } catch (err) {
        console.error('Failed to load room seats:', err);
    }
};

// --- Cinema CRUD ---
window.openAddCinemaModal = function () {
    document.getElementById('cinemaModalTitle').innerText = 'Thêm cụm rạp mới';
    document.getElementById('cinemaId').value = '';
    document.getElementById('cinemaForm').reset();
    document.getElementById('cinemaModalOverlay').style.display = 'block';
    document.getElementById('cinemaModal').style.display = 'block';
};

window.openEditCinemaModal = function (id) {
    const c = allCinemas.find(x => x.CinemaID === id);
    if (!c) return;
    document.getElementById('cinemaModalTitle').innerText = 'Sửa thông tin cụm rạp';
    document.getElementById('cinemaId').value = c.CinemaID;
    document.getElementById('cinemaNameInput').value = c.CinemaName;
    document.getElementById('cinemaAddressInput').value = c.Address;
    document.getElementById('cinemaCityInput').value = c.City;
    document.getElementById('cinemaModalOverlay').style.display = 'block';
    document.getElementById('cinemaModal').style.display = 'block';
};

window.closeCinemaModal = function () {
    document.getElementById('cinemaModalOverlay').style.display = 'none';
    document.getElementById('cinemaModal').style.display = 'none';
};

window.saveCinema = async function (e) {
    if (e) e.preventDefault();
    const id = document.getElementById('cinemaId').value;
    const name = document.getElementById('cinemaNameInput').value.trim();
    const address = document.getElementById('cinemaAddressInput').value.trim();
    const city = document.getElementById('cinemaCityInput').value;

    if (!name || !address || !city) {
        showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
        return;
    }

    try {
        let res;
        if (id) {
            res = await apiFetch(`/api/admin/cinemas/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, address, city })
            });
        } else {
            res = await apiFetch('/api/admin/cinemas', {
                method: 'POST',
                body: JSON.stringify({ name, address, city })
            });
        }

        if (res.success) {
            showToast(id ? 'Cập nhật cụm rạp thành công' : 'Thêm cụm rạp mới thành công');
            closeCinemaModal();
            // Reload cinemas
            await loadCinemas();
            // If we are editing, we can re-render detail panel
            if (id) {
                selectCinemaForBuilder(parseInt(id));
            } else {
                // If it's a new cinema, clear selection/render empty state
                const list = document.getElementById('csList');
                if (list) {
                    list.innerHTML = '<p style="padding: 16px; color: #9ca3af; text-align: center;">Đang tải danh sách rạp...</p>';
                }
                renderCinemaSidebar();
                // Select the new cinema if we can find it
                if (res.data && res.data.CinemaID) {
                    selectCinemaForBuilder(res.data.CinemaID);
                }
            }
        } else {
            showToast(res.message || 'Lỗi khi lưu cụm rạp', 'error');
        }
    } catch (err) {
        console.error('saveCinema error:', err);
        showToast('Có lỗi xảy ra', 'error');
    }
};

window.deleteCinema = async function (id) {
    const c = allCinemas.find(x => x.CinemaID === id);
    if (!c) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa cụm rạp "${c.CinemaName}"? Hành động này không thể hoàn tác.`)) {
        return;
    }

    try {
        const res = await apiFetch(`/api/admin/cinemas/${id}`, {
            method: 'DELETE'
        });

        if (res.success) {
            showToast('Xóa cụm rạp thành công');
            // Hide workspaces
            const ws = document.getElementById('cinemaWorkspace');
            const detail = document.getElementById('cinemaDetail');
            if (ws) ws.style.display = 'none';
            if (detail) {
                detail.innerHTML = `
                    <div class="cd-empty-state" style="margin: auto; text-align: center; color: var(--text3);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; color: var(--border2);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
                        <h3>Chọn một cụm rạp hoặc phòng để bắt đầu thiết lập</h3>
                        <p style="margin-top: 8px; font-size: 0.85rem;">Chọn rạp từ danh sách bên trái hoặc nhấn nút "+" để thêm cụm rạp mới.</p>
                    </div>
                `;
            }
            await loadCinemas();
            renderCinemaSidebar();
        } else {
            showToast(res.message || 'Lỗi khi xóa cụm rạp', 'error');
        }
    } catch (err) {
        console.error('deleteCinema error:', err);
        showToast('Có lỗi xảy ra', 'error');
    }
};

// --- Room CRUD ---
window.openAddRoomModal = function (cinemaId) {
    document.getElementById('roomModalTitle').innerText = 'Thêm phòng chiếu mới';
    document.getElementById('roomId').value = '';
    document.getElementById('roomCinemaId').value = cinemaId;
    document.getElementById('roomForm').reset();
    document.getElementById('roomTypeInput').value = 'Standard';
    document.getElementById('roomModalOverlay').style.display = 'block';
    document.getElementById('roomModal').style.display = 'block';
};

window.openEditRoomModal = function (id, currentName) {
    const r = ROOM_DATA.find(x => x.RoomID === id);
    document.getElementById('roomModalTitle').innerText = 'Sửa tên phòng chiếu';
    document.getElementById('roomId').value = id;
    document.getElementById('roomCinemaId').value = r ? r.CinemaID : '';
    document.getElementById('roomNameInput').value = currentName;
    document.getElementById('roomTypeInput').value = r ? (r.RoomType || 'Standard') : 'Standard';
    document.getElementById('roomModalOverlay').style.display = 'block';
    document.getElementById('roomModal').style.display = 'block';
};

window.closeRoomModal = function () {
    document.getElementById('roomModalOverlay').style.display = 'none';
    document.getElementById('roomModal').style.display = 'none';
};

window.saveRoom = async function (e) {
    if (e) e.preventDefault();
    const id = document.getElementById('roomId').value;
    const cinemaId = document.getElementById('roomCinemaId').value;
    const name = document.getElementById('roomNameInput').value.trim();
    const roomType = document.getElementById('roomTypeInput').value;

    if (!name) {
        showToast('Vui lòng nhập tên phòng chiếu', 'error');
        return;
    }

    try {
        let res;
        if (id) {
            res = await apiFetch(`/api/admin/rooms/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, roomType })
            });
        } else {
            res = await apiFetch('/api/admin/rooms', {
                method: 'POST',
                body: JSON.stringify({ cinemaId: parseInt(cinemaId), name, roomType })
            });
        }

        if (res.success) {
            showToast(id ? 'Cập nhật phòng thành công' : 'Thêm phòng chiếu mới thành công');
            closeRoomModal();
            // Reload rooms
            await loadRooms();
            // Re-render sidebar/details
            const activeCinemaId = cinemaId ? parseInt(cinemaId) : (ROOM_DATA.find(x => x.RoomID === parseInt(id))?.CinemaID);
            if (activeCinemaId) {
                selectCinemaForBuilder(activeCinemaId);
            }
        } else {
            showToast(res.message || 'Lỗi khi lưu phòng chiếu', 'error');
        }
    } catch (err) {
        console.error('saveRoom error:', err);
        showToast('Có lỗi xảy ra', 'error');
    }
};

window.deleteRoom = async function (id) {
    const r = ROOM_DATA.find(x => x.RoomID === id);
    if (!r) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa phòng "${r.RoomName}"? Hành động này sẽ xóa tất cả ghế trong phòng.`)) {
        return;
    }

    try {
        const res = await apiFetch(`/api/admin/rooms/${id}`, {
            method: 'DELETE'
        });

        if (res.success) {
            showToast('Xóa phòng chiếu thành công');
            // Hide workspace if deleted room was current active
            if (currentBuilderRoomId === id) {
                currentBuilderRoomId = null;
                const ws = document.getElementById('cinemaWorkspace');
                if (ws) ws.style.display = 'none';
            }
            await loadRooms();
            selectCinemaForBuilder(r.CinemaID);
        } else {
            showToast(res.message || 'Lỗi khi xóa phòng chiếu', 'error');
        }
    } catch (err) {
        console.error('deleteRoom error:', err);
        showToast('Có lỗi xảy ra', 'error');
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

/* ─── Update room type inline from stats bar ─── */
window.updateBuilderRoomType = async function(newType) {
    if (!currentBuilderRoomId || !newType) return;
    const room = ROOM_DATA && ROOM_DATA.find(r => r.RoomID === currentBuilderRoomId);
    if (!room) return;
    try {
        const res = await apiFetch(`/api/admin/rooms/${currentBuilderRoomId}`, {
            method: 'PUT',
            body: JSON.stringify({ roomName: room.RoomName, roomType: newType })
        });
        if (res.success) {
            await loadRooms();
            updateBuilderStats();
            showToast(`Đã đổi loại phòng sang "${newType}"`, 'success');
        } else {
            showToast('Không thể đổi loại phòng: ' + (res.message || ''), 'error');
        }
    } catch(e) {
        console.error(e);
        showToast('Lỗi kết nối.', 'error');
    }
};

/* ─── Helpers: update builder seat count stats ─── */
function updateBuilderStats() {
    const total = builderSeats.filter(s => s.SeatType !== 'None').length;
    const normal = builderSeats.filter(s => s.SeatType === 'Normal').length;
    const vip = builderSeats.filter(s => s.SeatType === 'VIP').length;
    const couple = builderSeats.filter(s => s.SeatType === 'Couple').length;
    const tEl = document.getElementById('totalSeatCount');
    const nEl = document.getElementById('normalSeatCount');
    const vEl = document.getElementById('vipSeatCount');
    const cEl = document.getElementById('coupleSeatCount');
    if (tEl) tEl.textContent = total;
    if (nEl) nEl.textContent = normal;
    if (vEl) vEl.textContent = vip;
    if (cEl) cEl.textContent = Math.floor(couple / 2) + ' cặp (' + couple + ' ghế)';
    const bar = document.getElementById('seatStatsBar');
    if (bar && currentBuilderRoomId) {
        const room = (typeof ROOM_DATA !== 'undefined') ? ROOM_DATA.find(r => r.RoomID === currentBuilderRoomId) : null;
        const typeColors = {
            'IMAX Laser': { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#60a5fa' },
            '3D':          { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)', color: '#c084fc' },
            '2D':          { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  color: '#4ade80' },
            'Standard':    { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', color: '#94a3b8' }
        };
        let typeSelectHtml = '';
        if (room) {
            const types = ['Standard', '2D', '3D', 'IMAX Laser'];
            const currentType = room.RoomType || 'Standard';
            const tc = typeColors[currentType] || typeColors['Standard'];
            const options = types.map(t => `<option value="${t}" ${t === currentType ? 'selected' : ''} style="background:#1a2030;color:#fff;">${t}</option>`).join('');
            typeSelectHtml = `<select id="builderRoomTypeSelect" onchange="updateBuilderRoomType(this.value)" style="background:${tc.bg}; color:${tc.color}; border:1px solid ${tc.border}; border-radius:20px; padding:3px 10px; font-size:0.75rem; font-weight:700; cursor:pointer; outline:none; font-family:inherit; transition:all 0.2s;">${options}</select>`;
        }
        const sep = `<span style="color:rgba(255,255,255,0.1);font-size:1rem;line-height:1;">│</span>`;
        bar.innerHTML = `
            <span style="display:flex;align-items:center;gap:8px;">
                <span style="width:8px;height:8px;border-radius:50%;background:#e8192c;box-shadow:0 0 8px rgba(232,25,44,0.6);flex-shrink:0;"></span>
                <span style="color:#fff;font-weight:800;font-size:0.88rem;">${room ? room.RoomName : 'Phòng đã chọn'}</span>
                ${typeSelectHtml}
            </span>
            ${sep}
            <span style="display:flex;align-items:center;gap:6px;">
                <span style="width:14px;height:12px;border-radius:2px;background:linear-gradient(180deg,#475569,#1e293b);flex-shrink:0;border:1px solid rgba(100,116,139,0.3);"></span>
                <span style="color:#94a3b8;font-size:0.82rem;">Thường: <strong style="color:#cbd5e1;">${normal}</strong></span>
            </span>
            ${sep}
            <span style="display:flex;align-items:center;gap:6px;">
                <span style="width:14px;height:12px;border-radius:2px;background:linear-gradient(180deg,#e28a18,#8a4805);flex-shrink:0;border:1px solid rgba(252,211,77,0.3);"></span>
                <span style="color:#94a3b8;font-size:0.82rem;">VIP: <strong style="color:#fbbf24;">&#9733; ${vip}</strong></span>
            </span>
            ${sep}
            <span style="display:flex;align-items:center;gap:6px;">
                <span style="width:28px;height:12px;border-radius:2px;background:linear-gradient(180deg,#db2777,#7d0e3d);flex-shrink:0;border:1px solid rgba(251,207,232,0.3);"></span>
                <span style="color:#94a3b8;font-size:0.82rem;">Cặp đôi: <strong style="color:#f472b6;">&#9829; ${Math.floor(couple/2)} cặp</strong></span>
            </span>
            ${sep}
            <span style="color:#4ade80;font-weight:800;font-size:0.88rem;margin-left:2px;">Tổng: ${total} ghế</span>`;
    }
}

/* ═════════════════════════════════════════
   SEAT MATRIX — Premium Cinema Style
   Mirrors exactly what customers see in seats.html
   ═════════════════════════════════════════ */
window.renderSeatMatrix = function () {
    const matrix = document.getElementById('seatMatrix');
    if (!matrix) return;

    // Detect couple rows
    const coupleRowSet = new Set();
    builderSeats.forEach(s => { if (s.SeatType === 'Couple') coupleRowSet.add(s.SeatRow); });

    let html = '';

    // Render Column headers row
    html += `<div class="col-headers-row">`;
    html += `<div class="col-header-spacer"></div>`;
    for (let c = 1; c <= maxCol; c++) {
        if (maxCol > 4 && c === Math.floor(maxCol / 2) + 1) {
            html += `<div class="aisle-gap-admin"></div>`;
        }
        html += `<div class="col-header-admin" onclick="toggleColBulk(${c})" title="Áp dụng cho cả cột ${c}">${c}</div>`;
    }
    html += `<div class="col-header-spacer"></div>`;
    html += `</div>`;

    for (let r = 1; r <= maxRow; r++) {
        const rowChar = String.fromCharCode(64 + r);
        const isCouple = coupleRowSet.has(rowChar);
        const half = Math.floor(maxCol / 2);

        html += `<div class="seat-row" data-row="${rowChar}">`;
        // Left row label
        html += `<div class="row-label-admin" onclick="toggleRowBulk('${rowChar}')" title="Áp dụng cho cả hàng ${rowChar}">${rowChar}</div>`;

        for (let c = 1; c <= maxCol; c++) {
            const seat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === c);

            // Center aisle gap (for standard aesthetic)
            if (maxCol > 4 && c === Math.floor(maxCol / 2) + 1) {
                html += `<div class="aisle-gap-admin"></div>`;
            }

            // Check if seat is booked (locked)
            if (seat && seat.IsBooked) {
                let lockClass = 'locked-seat';
                if (seat.SeatType === 'Couple') {
                    lockClass += ' couple';
                    const lbl = `${rowChar}${c}-${c+1}`;
                    html += `<button class="seat-btn ${lockClass}" disabled title="Ghế đôi ${lbl} đã bán vé (Khóa)">
                        <span style="position:relative;z-index:5;font-size:0.6rem;font-weight:800;">🔒 ${lbl}</span>
                    </button>`;
                    c++; // Skip sibling
                } else {
                    if (seat.SeatType === 'VIP') lockClass += ' vip';
                    else if (seat.SeatType === 'Normal') lockClass += ' standard';
                    else lockClass += ' blocked';
                    html += `<button class="seat-btn ${lockClass}" disabled title="Ghế ${rowChar}${c} đã bán vé (Khóa)">
                        <span style="position:relative;z-index:5;font-size:0.6rem;font-weight:800;">🔒 ${rowChar}${c}</span>
                    </button>`;
                }
                continue;
            }

            const sType = seat ? seat.SeatType : 'None';

            if (sType === 'Couple') {
                const c2 = c + 1;
                const seat2 = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === c2);
                if (c2 <= maxCol && seat2 && seat2.SeatType === 'Couple' && !seat2.IsBooked) {
                    const lbl = `${rowChar}${c}-${c2}`;
                    html += `<button class="seat-btn couple"
                        onclick="toggleCoupleSeat('${rowChar}', ${c}, this)"
                        data-row="${rowChar}" data-col1="${c}" data-col2="${c2}"
                        title="Ghế cặp đôi ${lbl}">
                        <span style="position:relative;z-index:5;margin-top:10px;font-size:0.6rem;font-weight:800;">${lbl}</span>
                    </button>`;
                    c++; // skip next column if it was part of the pair
                } else {
                    html += `<button class="seat-btn couple"
                        onclick="toggleSeat('${rowChar}', ${c}, this)"
                        data-row="${rowChar}" data-col="${c}"
                        title="Ghế cặp đôi ${rowChar}${c}">
                        <span style="position:relative;z-index:5;margin-top:10px;font-size:0.6rem;font-weight:800;">${rowChar}${c}</span>
                    </button>`;
                }

            } else {
                let sClass = 'blocked';
                let inner = `<span style="color:rgba(255,255,255,0.04);position:relative;z-index:2;">${c}</span>`;

                if (sType === 'Normal') {
                    sClass = 'standard';
                    inner = `<span style="position:relative;z-index:2;">${c}</span>`;
                } else if (sType === 'VIP') {
                    sClass = 'vip';
                    inner = `<span style="position:relative;z-index:2;">
                        <span style="position:absolute;top:-11px;right:-2px;font-size:0.48rem;color:#fbbf24;z-index:10;">&#9733;</span>
                        ${c}
                    </span>`;
                }

                html += `<button class="seat-btn ${sClass}"
                    onclick="toggleSeat('${rowChar}', ${c}, this)"
                    data-row="${rowChar}" data-col="${c}"
                    title="${rowChar}${c} (${sType === 'None' ? 'trống' : sType})">
                    ${inner}
                </button>`;
            }
        }

        // Right row label
        html += `<div class="row-label-admin" onclick="toggleRowBulk('${rowChar}')" title="Áp dụng cho cả hàng ${rowChar}">${rowChar}</div>`;
        html += `</div>`;  // end seat-row
    }

    matrix.innerHTML = html;
    updateBuilderStats();
};

/* Toggle a single (Normal/VIP/None) seat */
window.toggleSeat = function (rowChar, colNum, btn) {
    if (!currentBuilderRoomId) { alert('Vui lòng chọn phòng trước!'); return; }
    const tool = document.querySelector('input[name="seat_tool"]:checked').value;

    let seat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === colNum);
    if (seat && seat.IsBooked) {
        showToast('Ghế này đã bán vé, không thể sửa đổi!', 'error');
        return;
    }

    // If tool is Couple, snap to pair
    if (tool === 'Couple') {
        const pairStart = (colNum % 2 === 0) ? colNum - 1 : colNum;
        window.toggleCoupleSeat(rowChar, pairStart, btn);
        return;
    }

    if (!seat) {
        seat = { SeatRow: rowChar, SeatNumber: colNum, SeatType: tool, PriceMultiplier: tool === 'VIP' ? 1.2 : 1.0 };
        builderSeats.push(seat);
    } else {
        seat.SeatType = tool;
        seat.PriceMultiplier = tool === 'VIP' ? 1.2 : 1.0;
    }
    renderSeatMatrix();
};

/* Toggle a couple seat pair */
window.toggleCoupleSeat = function (rowChar, col1, btn) {
    if (!currentBuilderRoomId) { alert('Vui lòng chọn phòng trước!'); return; }
    const tool = document.querySelector('input[name="seat_tool"]:checked').value;
    const col2 = col1 + 1;

    let s1 = builderSeats.find(x => x.SeatRow === rowChar && x.SeatNumber === col1);
    let s2 = builderSeats.find(x => x.SeatRow === rowChar && x.SeatNumber === col2);

    if ((s1 && s1.IsBooked) || (s2 && s2.IsBooked)) {
        showToast('Một trong hai ghế đôi này đã bán vé, không thể sửa đổi!', 'error');
        return;
    }

    [col1, col2].forEach((cn) => {
        if (cn > maxCol) return;
        let s = builderSeats.find(x => x.SeatRow === rowChar && x.SeatNumber === cn);
        if (!s) {
            s = {
                SeatRow: rowChar,
                SeatNumber: cn,
                SeatType: tool === 'None' ? 'None' : 'Couple',
                PriceMultiplier: tool === 'None' ? 1.0 : 1.5
            };
            builderSeats.push(s);
        } else if (tool === 'None') {
            s.SeatType = 'None';
            s.PriceMultiplier = 1.0;
        } else {
            s.SeatType = 'Couple';
            s.PriceMultiplier = 1.5;
        }
    });
    renderSeatMatrix();
};

/* Zoom */
let adminBuilderZoom = 1.0;
window.adminZoomIn  = function() { adminBuilderZoom = Math.min(2.0, adminBuilderZoom + 0.12); const c = document.querySelector('.cw-canvas'); if(c) c.style.transform = `scale(${adminBuilderZoom})`; };
window.adminZoomOut = function() { adminBuilderZoom = Math.max(0.45, adminBuilderZoom - 0.12); const c = document.querySelector('.cw-canvas'); if(c) c.style.transform = `scale(${adminBuilderZoom})`; };

window.addSeatRow = function() {
    maxRow++;
    const rowsInput = document.getElementById('gridRowsInput');
    if (rowsInput) rowsInput.value = maxRow;
    renderSeatMatrix();
};
window.addSeatCol = function() {
    maxCol++;
    const colsInput = document.getElementById('gridColsInput');
    if (colsInput) colsInput.value = maxCol;
    renderSeatMatrix();
};

window.removeSeatRow = function() {
    if (maxRow > 1) {
        maxRow--;
        const rowsInput = document.getElementById('gridRowsInput');
        if (rowsInput) rowsInput.value = maxRow;
        builderSeats = builderSeats.filter(s => (s.SeatRow.charCodeAt(0) - 64) <= maxRow);
        renderSeatMatrix();
    }
};

window.removeSeatCol = function() {
    if (maxCol > 1) {
        maxCol--;
        const colsInput = document.getElementById('gridColsInput');
        if (colsInput) colsInput.value = maxCol;
        builderSeats = builderSeats.filter(s => s.SeatNumber <= maxCol);
        renderSeatMatrix();
    }
};

window.resizeGrid = function() {
    const rowsVal = parseInt(document.getElementById('gridRowsInput').value) || 10;
    const colsVal = parseInt(document.getElementById('gridColsInput').value) || 12;
    
    const targetRow = Math.max(1, Math.min(26, rowsVal));
    const targetCol = Math.max(1, Math.min(24, colsVal));
    
    // Check if we are shrinking and cutting off booked seats
    const cutBooked = builderSeats.filter(s => s.IsBooked && ((s.SeatRow.charCodeAt(0) - 64) > targetRow || s.SeatNumber > targetCol));
    if (cutBooked.length > 0) {
        showToast('Không thể thu nhỏ ma trận vì sẽ cắt bỏ các ghế đã bán vé!', 'error');
        document.getElementById('gridRowsInput').value = maxRow;
        document.getElementById('gridColsInput').value = maxCol;
        return;
    }
    
    maxRow = targetRow;
    maxCol = targetCol;
    
    // Filter out seats that are out of bounds
    builderSeats = builderSeats.filter(s => {
        const rowIdx = s.SeatRow.charCodeAt(0) - 64;
        return rowIdx <= maxRow && s.SeatNumber <= maxCol;
    });
    
    renderSeatMatrix();
};

window.applyPresetTemplate = function(type) {
    if (!currentBuilderRoomId) { alert('Vui lòng chọn phòng trước!'); return; }
    if (!type) return;

    if (!confirm('Áp dụng mẫu sẽ thay đổi cấu trúc ghế hiện tại (ngoại trừ các ghế đã bán vé). Bạn có chắc chắn muốn tiếp tục?')) {
        document.getElementById('presetTemplateSelect').value = '';
        return;
    }

    let newRows = 10, newCols = 12;
    if (type === 'standard') { newRows = 10; newCols = 12; }
    else if (type === 'imax') { newRows = 12; newCols = 14; }
    else if (type === 'gold') { newRows = 6; newCols = 8; }
    else if (type === 'blank') { newRows = maxRow; newCols = maxCol; }

    const preservedSeats = builderSeats.filter(s => s.IsBooked);
    
    // Check if new dimensions cut off booked seats
    const cutBooked = preservedSeats.filter(s => (s.SeatRow.charCodeAt(0) - 64) > newRows || s.SeatNumber > newCols);
    if (cutBooked.length > 0) {
        showToast('Không thể áp dụng mẫu vì kích thước nhỏ hơn vị trí ghế đã bán vé!', 'error');
        document.getElementById('presetTemplateSelect').value = '';
        return;
    }

    document.getElementById('gridRowsInput').value = newRows;
    document.getElementById('gridColsInput').value = newCols;
    maxRow = newRows;
    maxCol = newCols;

    const newSeats = [];
    for (let r = 1; r <= maxRow; r++) {
        const rowChar = String.fromCharCode(64 + r);
        for (let c = 1; c <= maxCol; c++) {
            const booked = preservedSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === c);
            if (booked) {
                newSeats.push(booked);
                continue;
            }

            let seatType = 'Normal';
            let priceMultiplier = 1.0;

            if (type === 'blank') {
                seatType = 'None';
            } else if (type === 'standard') {
                if (r >= 5 && r <= 8) { seatType = 'VIP'; priceMultiplier = 1.2; }
                else if (r >= 9) { seatType = 'Couple'; priceMultiplier = 1.5; }
            } else if (type === 'imax') {
                if (r >= 4 && r <= 10) { seatType = 'VIP'; priceMultiplier = 1.2; }
                else if (r >= 11) { seatType = 'Couple'; priceMultiplier = 1.5; }
            } else if (type === 'gold') {
                if (r <= 5) { seatType = 'VIP'; priceMultiplier = 1.2; }
                else { seatType = 'Couple'; priceMultiplier = 1.5; }
            }

            newSeats.push({ SeatRow: rowChar, SeatNumber: c, SeatType: seatType, PriceMultiplier: priceMultiplier });
        }
    }

    builderSeats = newSeats;
    renderSeatMatrix();
    document.getElementById('presetTemplateSelect').value = '';
};

window.toggleRowBulk = function(rowChar) {
    if (!currentBuilderRoomId) { alert('Vui lòng chọn phòng trước!'); return; }
    const tool = document.querySelector('input[name="seat_tool"]:checked').value;

    let changedCount = 0;
    for (let c = 1; c <= maxCol; c++) {
        const seat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === c);
        if (seat && seat.IsBooked) continue;

        let sType = tool;
        let mult = tool === 'VIP' ? 1.2 : (tool === 'Couple' ? 1.5 : 1.0);

        if (tool === 'Couple') {
            const pairCol = (c % 2 === 0) ? c - 1 : c + 1;
            const pairSeat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === pairCol);
            if (pairSeat && pairSeat.IsBooked) {
                sType = 'Normal';
                mult = 1.0;
            }
        }

        if (!seat) {
            builderSeats.push({ SeatRow: rowChar, SeatNumber: c, SeatType: sType, PriceMultiplier: mult });
        } else {
            seat.SeatType = sType;
            seat.PriceMultiplier = mult;
        }
        changedCount++;
    }
    if (changedCount > 0) renderSeatMatrix();
};

window.toggleColBulk = function(colNum) {
    if (!currentBuilderRoomId) { alert('Vui lòng chọn phòng trước!'); return; }
    const tool = document.querySelector('input[name="seat_tool"]:checked').value;

    let changedCount = 0;
    for (let r = 1; r <= maxRow; r++) {
        const rowChar = String.fromCharCode(64 + r);
        const seat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === colNum);
        if (seat && seat.IsBooked) continue;

        let sType = tool;
        let mult = tool === 'VIP' ? 1.2 : (tool === 'Couple' ? 1.5 : 1.0);

        if (tool === 'Couple') {
            const pairCol = (colNum % 2 === 0) ? colNum - 1 : colNum + 1;
            if (pairCol < 1 || pairCol > maxCol) {
                sType = 'Normal';
                mult = 1.0;
            } else {
                const pairSeat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === pairCol);
                if (pairSeat && pairSeat.IsBooked) {
                    sType = 'Normal';
                    mult = 1.0;
                } else {
                    if (!pairSeat) {
                        builderSeats.push({ SeatRow: rowChar, SeatNumber: pairCol, SeatType: 'Couple', PriceMultiplier: 1.5 });
                    } else {
                        pairSeat.SeatType = 'Couple';
                        pairSeat.PriceMultiplier = 1.5;
                    }
                }
            }
        }

        if (!seat) {
            builderSeats.push({ SeatRow: rowChar, SeatNumber: colNum, SeatType: sType, PriceMultiplier: mult });
        } else {
            seat.SeatType = sType;
            seat.PriceMultiplier = mult;
        }
        changedCount++;
    }
    if (changedCount > 0) renderSeatMatrix();
};

window.validateCoupleSeats = function() {
    const couples = builderSeats.filter(s => s.SeatType === 'Couple');
    const invalidPairs = [];
    couples.forEach(s => {
        const row = s.SeatRow;
        const col = s.SeatNumber;
        const pairCol = (col % 2 === 0) ? col - 1 : col + 1;
        const pairSeat = couples.find(x => x.SeatRow === row && x.SeatNumber === pairCol);
        if (!pairSeat) {
            invalidPairs.push(`${row}${col}`);
        }
    });
    return invalidPairs;
};

window.clearSeatMap = function () {
    if (!confirm('Bạn có chắc chắn muốn làm mới toàn bộ sơ đồ ghế? Toàn bộ ghế sẽ được xóa (ngoại trừ các ghế đã bán vé).')) return;
    builderSeats = builderSeats.filter(s => s.IsBooked);
    renderSeatMatrix();
};

/* ─── Customer Preview Modal ─── */
window.previewCustomerView = function () {
    if (!currentBuilderRoomId) { alert('Vui lòng chọn một phòng!'); return; }
    const validSeats = builderSeats.filter(s => s.SeatType !== 'None');
    if (validSeats.length === 0) { alert('Phòng này chưa có ghế nào!'); return; }

    const room = (typeof ROOM_DATA !== 'undefined') ? ROOM_DATA.find(r => r.RoomID === currentBuilderRoomId) : null;
    const roomName = room ? room.RoomName : 'Phòng chiếu';

    let ov = document.getElementById('seatPreviewOverlay');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'seatPreviewOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#0a0c0e;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;max-width:95vw;max-height:92vh;overflow:auto;width:900px;box-shadow:0 30px 80px rgba(0,0,0,0.8);';

    // Build preview
    const rowsMap = {};
    validSeats.forEach(s => { if (!rowsMap[s.SeatRow]) rowsMap[s.SeatRow] = []; rowsMap[s.SeatRow].push(s); });
    const allRows = Object.keys(rowsMap).sort();
    const coupleRowSet = new Set(validSeats.filter(s => s.SeatType === 'Couple').map(s => s.SeatRow));

    const sortedRows = [...allRows].sort((a, b) => {
        const pA = coupleRowSet.has(a) ? 1 : (rowsMap[a].some(s => s.SeatType === 'VIP') ? 2 : 3);
        const pB = coupleRowSet.has(b) ? 1 : (rowsMap[b].some(s => s.SeatType === 'VIP') ? 2 : 3);
        return pA !== pB ? pB - pA : a.localeCompare(b);
    });

    const S = {
        base: 'width:36px;height:34px;border-radius:8px 8px 6px 6px;display:inline-flex;align-items:flex-end;justify-content:center;padding-bottom:3px;font-size:0.7rem;font-weight:800;position:relative;flex-shrink:0;border:1px solid rgba(255,255,255,0.08);box-shadow:0 3px 6px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.12);cursor:default;',
        normal: 'background:linear-gradient(180deg,#475569,#1e293b);color:#cbd5e1;',
        vip: 'background:linear-gradient(180deg,#e28a18,#8a4805);color:#fef08a;border-color:rgba(252,211,77,0.3);',
        couple: 'width:80px;height:34px;border-radius:9px 9px 6px 6px;background:linear-gradient(180deg,#db2777,#7d0e3d);color:#fce7f3;border-color:rgba(251,207,232,0.3);',
        locked: 'background:linear-gradient(180deg,#181d24,#0b0e12);color:#ef4444;border-color:rgba(239,68,68,0.3);opacity:0.8;'
    };

    let seatsHtml = '';
    sortedRows.forEach(row => {
        const rowSeats = rowsMap[row].sort((a, b) => a.SeatNumber - b.SeatNumber);
        const isCpl = coupleRowSet.has(row);
        seatsHtml += `<div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:8px;">`;
        seatsHtml += `<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-weight:800;color:#6b7280;font-size:0.75rem;flex-shrink:0;">${row}</div>`;

        const total = rowSeats.length;
        const half = Math.floor(total / 2);

        for (let i = 0; i < total; i++) {
            const s = rowSeats[i];

            if (total > 4 && i === half) seatsHtml += `<div style="width:20px;"></div>`;

            if (s.SeatType === 'None') {
                seatsHtml += `<div style="width:36px;height:34px;visibility:hidden;pointer-events:none;flex-shrink:0;"></div>`;
            } else if (s.IsBooked) {
                if (s.SeatType === 'Couple') {
                    const s2 = rowSeats[i + 1];
                    const lbl = (s2 && s2.SeatType === 'Couple') ? `${row}${s.SeatNumber}-${s2.SeatNumber}` : `${row}${s.SeatNumber}`;
                    seatsHtml += `<div style="${S.base}${S.couple}${S.locked}" title="Cặp đôi ${lbl} (Đã đặt)"><span style="position:relative;z-index:5;margin-bottom:2px;font-size:0.6rem;">🔒 ${lbl}</span></div>`;
                    if (s2 && s2.SeatType === 'Couple') i++;
                } else {
                    seatsHtml += `<div style="${S.base}${s.SeatType==='VIP'?S.vip:S.normal}${S.locked}" title="${row}${s.SeatNumber} (Đã đặt)"><span style="position:relative;z-index:2;">🔒 ${s.SeatNumber}</span></div>`;
                }
            } else if (s.SeatType === 'Couple') {
                const s2 = rowSeats[i + 1];
                if (s2 && s2.SeatType === 'Couple' && s2.SeatNumber === s.SeatNumber + 1 && !s2.IsBooked) {
                    const lbl = `${row}${s.SeatNumber}-${s2.SeatNumber}`;
                    seatsHtml += `<div style="${S.base}${S.couple}" title="Cặp đôi ${lbl}"><span style="position:relative;z-index:5;margin-bottom:2px;font-size:0.6rem;">${lbl}</span></div>`;
                    i++; // skip next
                } else {
                    seatsHtml += `<div style="${S.base}${S.couple}" title="Cặp đôi ${row}${s.SeatNumber}"><span style="position:relative;z-index:5;margin-bottom:2px;font-size:0.6rem;">${row}${s.SeatNumber}</span></div>`;
                }
            } else {
                const isVip = s.SeatType === 'VIP';
                const st = isVip ? S.vip : S.normal;
                seatsHtml += `<div style="${S.base}${st}" title="${row}${s.SeatNumber}${isVip ? ' (VIP)' : ''}"><span style="position:relative;z-index:2;">${isVip ? '<span style="position:absolute;top:-12px;right:-1px;font-size:0.48rem;color:#fbbf24;">&#9733;</span>' : ''} ${s.SeatNumber}</span></div>`;
            }
        }
        seatsHtml += `<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-weight:800;color:#6b7280;font-size:0.75rem;flex-shrink:0;">${row}</div>`;
        seatsHtml += `</div>`;
    });

    const nCnt = validSeats.filter(s => s.SeatType === 'Normal').length;
    const vCnt = validSeats.filter(s => s.SeatType === 'VIP').length;
    const cCnt = validSeats.filter(s => s.SeatType === 'Couple').length;

    modal.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
            <div>
                <div style="font-size:1.1rem;font-weight:900;color:#fff;">&#128065; Xem trước — ${roomName}</div>
                <div style="font-size:0.8rem;color:#6b7280;margin-top:4px;">Giao diện khách hàng sẽ thấy khi chọn ghế</div>
            </div>
            <button onclick="document.getElementById('seatPreviewOverlay').remove()"
                style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#9ca3af;width:34px;height:34px;border-radius:50%;font-size:1.1rem;cursor:pointer;">
                &times;
            </button>
        </div>
        <div style="width:70%;max-width:550px;margin:0 auto 44px;text-align:center;perspective:600px;">
            <div style="height:10px;background:linear-gradient(90deg,transparent 5%,rgba(229,9,20,0.2)20%,#ff2a36 50%,rgba(229,9,20,0.2)80%,transparent 95%);border-radius:50%/100% 100% 0 0;box-shadow:0 6px 30px rgba(229,9,20,0.85);transform:rotateX(-12deg);"></div>
            <div style="margin-top:14px;font-size:0.7rem;font-weight:800;letter-spacing:8px;color:rgba(255,255,255,0.3);">MÀN HÌNH CHIẾU</div>
        </div>
        <div style="overflow-x:auto;margin-bottom:28px;">${seatsHtml}</div>
        <div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;background:rgba(255,255,255,0.02);padding:14px 24px;border-radius:30px;border:1px solid rgba(255,255,255,0.07);max-width:650px;margin:0 auto;">
            <span style="display:flex;align-items:center;gap:7px;font-size:0.8rem;color:#94a3b8;">
                <span style="width:26px;height:20px;border-radius:3px;background:linear-gradient(180deg,#475569,#1e293b);display:inline-block;"></span>
                Thường (${nCnt})
            </span>
            <span style="display:flex;align-items:center;gap:7px;font-size:0.8rem;color:#f59e0b;">
                <span style="width:26px;height:20px;border-radius:3px;background:linear-gradient(180deg,#e28a18,#8a4805);display:inline-block;"></span>
                VIP +20% (${vCnt})
            </span>
            <span style="display:flex;align-items:center;gap:7px;font-size:0.8rem;color:#ec4899;">
                <span style="width:52px;height:20px;border-radius:3px;background:linear-gradient(180deg,#db2777,#7d0e3d);display:inline-block;"></span>
                Cap doi +50% (${Math.floor(cCnt / 2)} cap)
            </span>
        </div>`;

    ov.appendChild(modal);
    document.body.appendChild(ov);
};

window.saveSeatLayout = async function () {
    if (!currentBuilderRoomId) {
        alert('Vui lòng chọn phòng trước khi lưu.');
        return;
    }

    // Validate couple seats
    const orphans = window.validateCoupleSeats();
    if (orphans.length > 0) {
        if (!confirm(`Cảnh báo: Có ghế Couple bị lẻ (không đi theo cặp liền kề): ${orphans.join(', ')}. Bạn có chắc chắn muốn lưu không? Khách hàng có thể gặp lỗi khi đặt ghế lẻ.`)) {
            return;
        }
    }

    const payload = [];
    for (let r = 1; r <= maxRow; r++) {
        const rowChar = String.fromCharCode(64 + r);
        for (let c = 1; c <= maxCol; c++) {
            const seat = builderSeats.find(s => s.SeatRow === rowChar && s.SeatNumber === c);
            payload.push({
                SeatID: seat && seat.SeatID,
                SeatRow: rowChar,
                SeatNumber: c,
                SeatType: seat ? (seat.SeatType || 'None') : 'None',
                PriceMultiplier: seat ? (seat.PriceMultiplier || 1.0) : 1.0
            });
        }
    }

    let roomType = null;
    const room = ROOM_DATA.find(r => r.RoomID === currentBuilderRoomId);
    if (room) {
        roomType = room.RoomType || 'Standard';
    }

    const saveBtn = document.getElementById('btnSaveSeatLayout') || document.querySelector('#page-cinema .btn-solid-red');
    const oldHtml = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) { saveBtn.innerHTML = '&#8987; Đang lưu...'; saveBtn.disabled = true; }
    try {
        const res = await apiFetch(`/api/admin/rooms/${currentBuilderRoomId}/seats`, {
            method: 'PUT',
            body: JSON.stringify({ seats: payload, roomType: roomType })
        });
        if (res.success) {
            showToast('Lưu sơ đồ ghế thành công!');
            await loadRooms();
            renderCinemaSidebar();
            const cRoom = ROOM_DATA.find(r => r.RoomID === currentBuilderRoomId);
            if (cRoom) {
                const el = [...document.querySelectorAll('#csList .cs-item')].find(i => i.innerHTML.includes(cRoom.CinemaName));
                if (el) window.selectCinemaForBuilder(cRoom.CinemaID, el);
                setTimeout(() => {
                    const rEl = [...document.querySelectorAll('#csRoomsGrid .room-btn')].find(b => b.textContent.trim().startsWith(cRoom.RoomName));
                    if (rEl) window.selectRoomForBuilder(currentBuilderRoomId, rEl);
                }, 100);
            }
        } else { showToast('Lỗi: ' + (res.message || 'Không xác định'), 'error'); }
    } catch (err) {
        console.error(err);
        showToast('Lỗi kết nối khi lưu sơ đồ.', 'error');
    } finally {
        if (saveBtn) { saveBtn.innerHTML = oldHtml || '💾 Lưu bố cục'; saveBtn.disabled = false; }
    }
};

/* ══════════════════════════
   INIT
══════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    ensureReportExportButtons();
    loadMovies();
    loadRecentTransactions();
    loadFnB();
    loadCombos();
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
    } catch (e) { }

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
        const time = new Date(n.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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



/* ════════════════════════════════════════════════
   PROMOTIONS MANAGEMENT
════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════
   MOVIE REVIEW MANAGEMENT
════════════════════════════════════════════════ */
let REVIEW_DATA = [];
let reviewSearchTimer = null;

function renderAdminStars(rating) {
    const value = Math.max(0, Math.min(5, parseInt(rating, 10) || 0));
    return '★'.repeat(value) + '<span style="color:#d1d5db;">' + '★'.repeat(5 - value) + '</span>';
}

function populateReviewMovieFilter() {
    const select = document.getElementById('reviewMovieFilter');
    if (!select) return;
    const current = select.value;
    const movies = Array.isArray(MOVIE_DATA) ? MOVIE_DATA : [];
    select.innerHTML = '<option value="">Tất cả phim</option>' + movies
        .slice()
        .sort((a, b) => String(a.Title || '').localeCompare(String(b.Title || ''), 'vi'))
        .map(movie => `<option value="${movie.MovieID}">${adminEscape(movie.Title)}</option>`)
        .join('');
    if ([...select.options].some(option => option.value === current)) select.value = current;
}

function getReviewFilters() {
    const params = new URLSearchParams();
    const movieId = document.getElementById('reviewMovieFilter')?.value;
    const status = document.getElementById('reviewStatusFilter')?.value;
    const rating = document.getElementById('reviewRatingFilter')?.value;
    const search = document.getElementById('reviewSearchInput')?.value.trim();
    if (movieId) params.set('movieId', movieId);
    if (status) params.set('status', status);
    if (rating) params.set('rating', rating);
    if (search) params.set('search', search);
    return params.toString();
}

async function loadAdminReviews() {
    const body = document.getElementById('reviewAdminBody');
    if (body) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">Đang tải đánh giá...</td></tr>';
    }
    try {
        const query = getReviewFilters();
        const res = await apiFetch('/api/admin/movie-reviews' + (query ? '?' + query : ''));
        if (!res.success) {
            if (body) body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:30px;">${adminEscape(res.message || 'Không thể tải đánh giá.')}</td></tr>`;
            return;
        }
        REVIEW_DATA = (res.data && res.data.reviews) || [];
        renderAdminReviewSummary(res.data && res.data.summary);
        renderAdminReviewTable();
    } catch (err) {
        console.error('[Admin] loadAdminReviews:', err);
        if (body) body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:30px;">Lỗi kết nối server.</td></tr>';
    }
}

function debouncedLoadAdminReviews() {
    clearTimeout(reviewSearchTimer);
    reviewSearchTimer = setTimeout(loadAdminReviews, 350);
}

function renderAdminReviewSummary(summary = {}) {
    const totalEl = document.getElementById('reviewKpiTotal');
    const visibleEl = document.getElementById('reviewKpiVisible');
    const hiddenEl = document.getElementById('reviewKpiHidden');
    const averageEl = document.getElementById('reviewKpiAverage');
    if (totalEl) totalEl.textContent = summary.totalReviews || 0;
    if (visibleEl) visibleEl.textContent = summary.visibleReviews || 0;
    if (hiddenEl) hiddenEl.textContent = summary.hiddenReviews || 0;
    if (averageEl) averageEl.textContent = Number(summary.averageRating || 0).toFixed(1);
}

function renderAdminReviewTable() {
    const body = document.getElementById('reviewAdminBody');
    if (!body) return;

    if (!REVIEW_DATA.length) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">Chưa có đánh giá phù hợp.</td></tr>';
        return;
    }

    body.innerHTML = REVIEW_DATA.map(review => {
        const poster = review.PosterURL || 'images/default_poster.svg';
        const updated = review.UpdatedAt ? `<div style="font-size:0.72rem;color:var(--text3);margin-top:3px;">Cập nhật: ${formatAdminDate(review.UpdatedAt)}</div>` : '';
        return `
            <tr class="txn-row">
                <td>
                    <div style="display:flex;align-items:center;gap:12px;min-width:220px;">
                        <img src="${adminEscape(poster)}" alt="${adminEscape(review.MovieTitle)}" onerror="this.onerror=null;this.src='images/default_poster.svg'" style="width:48px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">
                        <div>
                            <div style="font-weight:800;color:var(--text);font-size:0.88rem;">${adminEscape(review.MovieTitle)}</div>
                            <div style="font-size:0.72rem;color:var(--text2);margin-top:3px;">ID phim: ${review.MovieID}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight:700;color:var(--text);font-size:0.86rem;">${adminEscape(review.FullName)}</div>
                    <div style="font-size:0.75rem;color:var(--text2);margin-top:4px;">${adminEscape(review.Email || '')}</div>
                </td>
                <td>
                    <div style="color:#f59e0b;font-size:1rem;white-space:nowrap;">${renderAdminStars(review.Rating)}</div>
                    <div style="font-size:0.75rem;color:var(--text2);margin-top:4px;">${review.Rating}/5</div>
                </td>
                <td style="max-width:360px;">
                    <div style="color:var(--text);font-size:0.84rem;line-height:1.5;white-space:normal;">${adminEscape(review.Comment || 'Không có bình luận.')}</div>
                </td>
                <td style="color:var(--text2);font-size:0.84rem;">
                    ${formatAdminDate(review.CreatedAt)}
                    ${updated}
                </td>
                <td>
                    ${review.IsVisible
                ? '<span class="status-badge active">Đang hiển thị</span>'
                : '<span class="status-badge finished">Đã ẩn</span>'}
                </td>
                <td>
                    <div class="table-actions">
                        <button class="tb-icon-sm" title="${review.IsVisible ? 'Ẩn đánh giá' : 'Hiển thị đánh giá'}" onclick="toggleAdminReview(${review.ReviewID})" style="color:${review.IsVisible ? '#6b7280' : '#10b981'}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="tb-icon-sm danger" title="Xóa đánh giá" onclick="deleteAdminReview(${review.ReviewID})" style="color:var(--danger)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleAdminReview(reviewId) {
    try {
        const res = await apiFetch(`/api/admin/movie-reviews/${reviewId}/toggle`, { method: 'PATCH' });
        if (res.success) {
            showAdminToast(res.message, 'success');
            loadAdminReviews();
        } else {
            showAdminToast('Lỗi: ' + res.message, 'error');
        }
    } catch (err) {
        console.error('[Admin] toggleAdminReview:', err);
        showAdminToast('Lỗi kết nối server.', 'error');
    }
}

async function deleteAdminReview(reviewId) {
    if (!confirm('Bạn có chắc muốn xóa đánh giá này không?')) return;
    try {
        const res = await apiFetch(`/api/admin/movie-reviews/${reviewId}`, { method: 'DELETE' });
        if (res.success) {
            showAdminToast(res.message, 'success');
            loadAdminReviews();
        } else {
            showAdminToast('Lỗi: ' + res.message, 'error');
        }
    } catch (err) {
        console.error('[Admin] deleteAdminReview:', err);
        showAdminToast('Lỗi kết nối server.', 'error');
    }
}

let REFUND_DATA = [];
let refundSearchTimer = null;

function formatAdminVnd(value) {
    return Number(value || 0).toLocaleString('vi-VN') + 'đ';
}

function getRefundFilters() {
    const params = new URLSearchParams();
    const status = document.getElementById('refundStatusFilter')?.value;
    const search = document.getElementById('refundSearchInput')?.value.trim();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    return params.toString();
}

async function loadAdminRefunds() {
    const body = document.getElementById('refundAdminBody');
    if (body) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">Đang tải yêu cầu hoàn tiền...</td></tr>';
    }
    try {
        const query = getRefundFilters();
        const res = await apiFetch('/api/admin/refunds' + (query ? '?' + query : ''));
        if (!res.success) {
            if (body) body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:30px;">${adminEscape(res.message || 'Không thể tải yêu cầu hoàn tiền.')}</td></tr>`;
            return;
        }
        REFUND_DATA = (res.data && res.data.refunds) || [];
        renderAdminRefundSummary(res.data && res.data.summary);
        renderAdminRefundTable();
    } catch (err) {
        console.error('[Admin] loadAdminRefunds:', err);
        if (body) body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:30px;">Lỗi kết nối server.</td></tr>';
    }
}

function debouncedLoadAdminRefunds() {
    clearTimeout(refundSearchTimer);
    refundSearchTimer = setTimeout(loadAdminRefunds, 350);
}

function renderAdminRefundSummary(summary = {}) {
    const totalEl = document.getElementById('refundKpiTotal');
    const pendingEl = document.getElementById('refundKpiPending');
    const approvedEl = document.getElementById('refundKpiApproved');
    const amountEl = document.getElementById('refundKpiPendingAmount');
    if (totalEl) totalEl.textContent = summary.totalRefunds || 0;
    if (pendingEl) pendingEl.textContent = summary.pendingRefunds || 0;
    if (approvedEl) approvedEl.textContent = summary.approvedRefunds || 0;
    if (amountEl) amountEl.textContent = formatAdminVnd(summary.pendingAmount || 0);
}

function renderRefundStatus(status) {
    const labels = {
        pending: 'Chờ xử lý',
        approved: 'Đã duyệt',
        completed: 'Đã hoàn tiền',
        rejected: 'Đã từ chối'
    };
    const colors = {
        pending: 'background:rgba(245,158,11,0.12);color:#d97706;',
        approved: 'background:rgba(59,130,246,0.12);color:#2563eb;',
        completed: 'background:rgba(16,185,129,0.12);color:#059669;',
        rejected: 'background:rgba(239,68,68,0.12);color:#dc2626;'
    };
    return `<span class="status-badge" style="${colors[status] || ''}">${labels[status] || status}</span>`;
}

function renderAdminRefundTable() {
    const body = document.getElementById('refundAdminBody');
    if (!body) return;

    if (!REFUND_DATA.length) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">Chưa có yêu cầu hoàn tiền phù hợp.</td></tr>';
        return;
    }

    body.innerHTML = REFUND_DATA.map(item => {
        const seat = `${item.SeatRow || ''}${item.SeatNumber || ''}`;
        const showtime = item.StartTime ? formatAdminDate(item.StartTime) : '';
        const actionButtons = item.Status === 'pending'
            ? `
                <a class="tb-icon-sm refund-action-btn" href="admin-refund-action.html?refundId=${item.RefundID}&action=approve" data-refund-id="${item.RefundID}" data-refund-action="approve" title="Duyệt yêu cầu" style="color:#2563eb;text-decoration:none;">Duyệt</a>
                <a class="tb-icon-sm danger refund-action-btn" href="admin-refund-action.html?refundId=${item.RefundID}&action=reject" data-refund-id="${item.RefundID}" data-refund-action="reject" title="Từ chối" style="color:#dc2626;text-decoration:none;">Từ chối</a>
              `
            : item.Status === 'approved'
                ? `<a class="tb-icon-sm refund-action-btn" href="admin-refund-action.html?refundId=${item.RefundID}&action=complete" data-refund-id="${item.RefundID}" data-refund-action="complete" title="Đã chuyển khoản" style="color:#059669;text-decoration:none;">Đã chuyển</a>`
                : '<span style="color:var(--text3);font-size:0.78rem;">Đã xử lý</span>';

        return `
            <tr class="txn-row">
                <td>
                    <div style="font-weight:800;color:var(--text);font-size:0.88rem;">#${item.TicketID} - ${adminEscape(item.MovieTitle)}</div>
                    <div style="font-size:0.74rem;color:var(--text2);margin-top:4px;">${adminEscape(showtime)} • ${adminEscape(item.CinemaName || '')} • ${adminEscape(item.RoomName || '')} • Ghế ${adminEscape(seat)}</div>
                </td>
                <td>
                    <div style="font-weight:700;color:var(--text);font-size:0.86rem;">${adminEscape(item.FullName)}</div>
                    <div style="font-size:0.75rem;color:var(--text2);margin-top:4px;">${adminEscape(item.Email || '')}</div>
                    <div style="font-size:0.75rem;color:var(--text2);margin-top:2px;">${adminEscape(item.Phone || '')}</div>
                </td>
                <td style="font-weight:900;color:var(--accent);">${formatAdminVnd(item.RefundAmount)}</td>
                <td>
                    <div style="font-weight:800;color:var(--text);">${adminEscape(item.BankName)}</div>
                    <div style="font-size:0.8rem;color:var(--text2);margin-top:4px;">STK: ${adminEscape(item.BankAccountNumber)}</div>
                    <div style="font-size:0.8rem;color:var(--text2);margin-top:2px;">Chủ TK: ${adminEscape(item.BankAccountHolder)}</div>
                    ${item.RefundTransactionCode ? `<div style="font-size:0.75rem;color:#059669;margin-top:4px;">Mã GD: ${adminEscape(item.RefundTransactionCode)}</div>` : ''}
                </td>
                <td style="max-width:260px;">
                    <div style="font-size:0.84rem;line-height:1.45;white-space:normal;color:var(--text);">${adminEscape(item.Reason || 'Không có lý do.')}</div>
                    ${item.AdminNote ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:6px;">Admin: ${adminEscape(item.AdminNote)}</div>` : ''}
                </td>
                <td>
                    ${renderRefundStatus(item.Status)}
                    <div style="font-size:0.72rem;color:var(--text2);margin-top:6px;">${formatAdminDate(item.RequestedAt)}</div>
                </td>
                <td><div class="table-actions" style="gap:6px;flex-wrap:wrap;">${actionButtons}</div></td>
            </tr>
        `;
    }).join('');
    bindRefundActionButtons();
}

let refundActionState = null;
let refundActionSubmitting = false;

function getRefundActionConfig(action) {
    return {
        approve: {
            title: '\u0110\u00e3 duy\u1ec7t y\u00eau c\u1ea7u ho\u00e0n ti\u1ec1n',
            desc: 'Sau khi duy\u1ec7t, admin c\u1ea7n chuy\u1ec3n kho\u1ea3n cho kh\u00e1ch r\u1ed3i b\u1ea5m "\u0110\u00e3 chuy\u1ec3n".',
            noteLabel: 'Ghi ch\u00fa duy\u1ec7t',
            notePlaceholder: 'C\u00f3 th\u1ec3 b\u1ecf tr\u1ed1ng ho\u1eb7c nh\u1eadp ghi ch\u00fa...',
            submitLabel: 'Duy\u1ec7t y\u00eau c\u1ea7u',
            showTxCode: false,
            submitColor: '#ef1b2d'
        },
        reject: {
            title: 'T\u1eeb ch\u1ed1i ho\u00e0n ti\u1ec1n',
            desc: 'Nh\u1eadp l\u00fd do t\u1eeb ch\u1ed1i \u0111\u1ec3 l\u01b0u l\u1ecbch s\u1eed x\u1eed l\u00fd.',
            noteLabel: 'L\u00fd do t\u1eeb ch\u1ed1i *',
            notePlaceholder: 'VD: V\u00e9 kh\u00f4ng \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n ho\u00e0n ti\u1ec1n...',
            submitLabel: 'T\u1eeb ch\u1ed1i y\u00eau c\u1ea7u',
            showTxCode: false,
            submitColor: '#dc2626'
        },
        complete: {
            title: 'X\u00e1c nh\u1eadn \u0111\u00e3 chuy\u1ec3n kho\u1ea3n',
            desc: 'Nh\u1eadp m\u00e3 giao d\u1ecbch sau khi admin \u0111\u00e3 chuy\u1ec3n kho\u1ea3n ho\u00e0n ti\u1ec1n.',
            noteLabel: 'Ghi ch\u00fa ho\u00e0n ti\u1ec1n',
            notePlaceholder: 'C\u00f3 th\u1ec3 b\u1ecf tr\u1ed1ng ho\u1eb7c nh\u1eadp ghi ch\u00fa...',
            submitLabel: 'X\u00e1c nh\u1eadn \u0111\u00e3 chuy\u1ec3n',
            showTxCode: true,
            submitColor: '#059669'
        }
    }[action] || null;
}

function ensureRefundActionModal() {
    if (document.getElementById('refundActionOverlay') && document.getElementById('refundActionModal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'refundActionOverlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:520;backdrop-filter:blur(3px);';
    overlay.addEventListener('click', () => closeRefundActionModal());

    const modal = document.createElement('div');
    modal.id = 'refundActionModal';
    modal.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:521;background:#fff;border-radius:14px;width:520px;max-width:94vw;box-shadow:0 24px 70px rgba(15,23,42,0.35);overflow:hidden;';
    modal.innerHTML = [
        '<div style="padding:22px 26px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;gap:16px;">',
        '<div><h2 id="refundActionTitle" style="margin:0;color:#111827;font-size:1.2rem;font-weight:900;text-transform:uppercase;">X\u1eed l\u00fd ho\u00e0n ti\u1ec1n</h2>',
        '<p id="refundActionDesc" style="margin:6px 0 0;color:#6b7280;font-size:0.9rem;line-height:1.45;">Nh\u1eadp th\u00f4ng tin x\u1eed l\u00fd y\u00eau c\u1ea7u ho\u00e0n ti\u1ec1n.</p></div>',
        '<button type="button" onclick="closeRefundActionModal()" style="width:36px;height:36px;border:none;border-radius:50%;background:#f3f4f6;color:#475569;font-size:1.4rem;line-height:1;cursor:pointer;">&times;</button>',
        '</div>',
        '<form id="refundActionForm" style="padding:24px 26px;display:flex;flex-direction:column;gap:16px;">',
        '<div id="refundTxCodeGroup" style="display:none;"><label for="refundTxCodeInput" style="display:block;margin-bottom:8px;color:#374151;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">M\u00e3 giao d\u1ecbch chuy\u1ec3n kho\u1ea3n *</label><input id="refundTxCodeInput" type="text" autocomplete="off" placeholder="VD: MBVCB240709001" style="width:100%;padding:12px 14px;border:1px solid #d1d5db;border-radius:8px;color:#111827;font-size:0.95rem;"></div>',
        '<div><label id="refundNoteLabel" for="refundNoteInput" style="display:block;margin-bottom:8px;color:#374151;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">Ghi ch\u00fa</label><textarea id="refundNoteInput" rows="4" placeholder="Nh\u1eadp ghi ch\u00fa cho y\u00eau c\u1ea7u n\u00e0y..." style="width:100%;padding:12px 14px;border:1px solid #d1d5db;border-radius:8px;color:#111827;font-size:0.95rem;font-family:inherit;resize:vertical;"></textarea><div id="refundActionError" style="display:none;margin-top:8px;color:#dc2626;font-size:0.84rem;font-weight:600;"></div></div>',
        '<div style="display:flex;justify-content:flex-end;gap:12px;margin-top:4px;"><button type="button" onclick="closeRefundActionModal()" style="padding:11px 22px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#475569;font-weight:800;cursor:pointer;">H\u1ee7y</button><button id="refundActionSubmitBtn" type="submit" style="padding:11px 24px;border:none;border-radius:8px;background:#ef1b2d;color:#fff;font-weight:900;cursor:pointer;">X\u00e1c nh\u1eadn</button></div>',
        '</form>'
    ].join('');
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

function getRefundModalParts() {
    return { overlay: document.getElementById('refundActionOverlay'), modal: document.getElementById('refundActionModal'), title: document.getElementById('refundActionTitle'), desc: document.getElementById('refundActionDesc'), txGroup: document.getElementById('refundTxCodeGroup'), txInput: document.getElementById('refundTxCodeInput'), noteLabel: document.getElementById('refundNoteLabel'), noteInput: document.getElementById('refundNoteInput'), error: document.getElementById('refundActionError'), submitBtn: document.getElementById('refundActionSubmitBtn') };
}

function openRefundActionModal(refundId, action) {
    const parsedRefundId = Number.parseInt(refundId, 10);
    const config = getRefundActionConfig(action);
    if (!Number.isInteger(parsedRefundId) || parsedRefundId <= 0 || !config) { showAdminToast('Kh\u00f4ng th\u1ec3 m\u1edf x\u1eed l\u00fd ho\u00e0n ti\u1ec1n v\u00ec d\u1eef li\u1ec7u kh\u00f4ng h\u1ee3p l\u1ec7.', 'error'); return false; }
    ensureRefundActionModal();
    const p = getRefundModalParts();
    if (!p.overlay || !p.modal || !p.title || !p.desc || !p.txGroup || !p.txInput || !p.noteLabel || !p.noteInput || !p.error || !p.submitBtn) { showAdminToast('Kh\u00f4ng th\u1ec3 m\u1edf h\u1ed9p x\u1eed l\u00fd ho\u00e0n ti\u1ec1n. H\u00e3y t\u1ea3i l\u1ea1i trang admin.', 'error'); return false; }
    refundActionState = { refundId: parsedRefundId, action }; refundActionSubmitting = false;
    p.title.textContent = config.title; p.desc.textContent = config.desc; p.noteLabel.textContent = config.noteLabel; p.noteInput.placeholder = config.notePlaceholder; p.noteInput.value = ''; p.txInput.value = ''; p.txGroup.style.display = config.showTxCode ? 'block' : 'none'; p.error.textContent = ''; p.error.style.display = 'none'; p.submitBtn.disabled = false; p.submitBtn.textContent = config.submitLabel; p.submitBtn.style.background = config.submitColor; p.overlay.style.display = 'block'; p.modal.style.display = 'block';
    setTimeout(() => (config.showTxCode ? p.txInput : p.noteInput).focus(), 0);
    return false;
}

function closeRefundActionModal() { const p = getRefundModalParts(); if (p.overlay) p.overlay.style.display = 'none'; if (p.modal) p.modal.style.display = 'none'; refundActionState = null; refundActionSubmitting = false; }

async function submitRefundActionModal(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (refundActionSubmitting) return false;
    if (!refundActionState) { showAdminToast('Ch\u01b0a ch\u1ecdn y\u00eau c\u1ea7u ho\u00e0n ti\u1ec1n \u0111\u1ec3 x\u1eed l\u00fd.', 'error'); return false; }
    const p = getRefundModalParts(); const { refundId, action } = refundActionState; const note = (p.noteInput && p.noteInput.value.trim()) || ''; const txCode = (p.txInput && p.txInput.value.trim()) || '';
    const fail = msg => { if (p.error) { p.error.textContent = msg; p.error.style.display = 'block'; } };
    if (action === 'reject' && !note) { fail('Vui l\u00f2ng nh\u1eadp l\u00fd do t\u1eeb ch\u1ed1i ho\u00e0n ti\u1ec1n.'); return false; }
    if (action === 'complete' && !txCode) { fail('Vui l\u00f2ng nh\u1eadp m\u00e3 giao d\u1ecbch ho\u00e0n ti\u1ec1n.'); return false; }
    const payload = { action }; if (note) payload.adminNote = note; if (txCode) payload.refundTransactionCode = txCode;
    refundActionSubmitting = true; if (p.submitBtn) { p.submitBtn.disabled = true; p.submitBtn.textContent = '\u0110ang x\u1eed l\u00fd...'; }
    try {
        const res = await apiFetch('/api/admin/refunds/' + refundId, { method: 'PATCH', body: JSON.stringify(payload) });
        if (res.success) { showAdminToast(res.message || '\u0110\u00e3 c\u1eadp nh\u1eadt y\u00eau c\u1ea7u ho\u00e0n ti\u1ec1n.', 'success'); closeRefundActionModal(); loadAdminRefunds(); } else { fail(res.message || 'Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt y\u00eau c\u1ea7u ho\u00e0n ti\u1ec1n.'); }
    } catch (err) { console.error('[Admin] submitRefundActionModal:', err); fail('L\u1ed7i k\u1ebft n\u1ed1i server.'); }
    finally { if (refundActionState && p.submitBtn) { const config = getRefundActionConfig(action); p.submitBtn.disabled = false; p.submitBtn.textContent = (config && config.submitLabel) || 'X\u00e1c nh\u1eadn'; refundActionSubmitting = false; } }
    return false;
}

function adminRefundAction(refundId, action) {
    return openRefundActionModal(refundId, action);
}
function handleRefundActionClick(event) {
    if (event) {
        event.preventDefault();
    }
    const button = (event && event.target && event.target.closest && event.target.closest('.refund-action-btn')) || (event && event.currentTarget);
    if (!button) return false;
    return adminRefundAction(button.getAttribute('data-refund-id'), button.getAttribute('data-refund-action'));
}
function updateAdminRefund(refundId, action) { return adminRefundAction(refundId, action); }
function bindRefundActionButtons() {
    document.querySelectorAll('button.refund-action-btn').forEach(button => {
        if (button.dataset.refundBound === '1') return;
        button.dataset.refundBound = '1';
        button.addEventListener('click', handleRefundActionClick);
    });
}
document.addEventListener('submit', event => { if (event.target && event.target.id === 'refundActionForm') submitRefundActionModal(event); }, true);
window.adminRefundAction = adminRefundAction; window.openRefundActionModal = openRefundActionModal; window.closeRefundActionModal = closeRefundActionModal; window.submitRefundActionModal = submitRefundActionModal; window.updateAdminRefund = updateAdminRefund; window.handleRefundActionClick = handleRefundActionClick; window.bindRefundActionButtons = bindRefundActionButtons; window.loadAdminRefunds = loadAdminRefunds;
let NEWS_DATA = [];

function adminEscape(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatAdminDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function toDateInputValue(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return toLocalDateInputValue();
    return toLocalDateInputValue(date);
}

async function loadNewsArticles() {
    try {
        const res = await apiFetch('/api/admin/news');
        if (res.success) {
            NEWS_DATA = res.data || [];
            renderNewsAdminTable();
        }
    } catch (err) {
        console.error('[Admin] loadNewsArticles:', err);
    }
}

function renderNewsAdminTable() {
    const body = document.getElementById('newsAdminBody');
    if (!body) return;

    if (!NEWS_DATA.length) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:30px;">Chưa có bài viết nào.</td></tr>';
        return;
    }
    body.innerHTML = NEWS_DATA.map(item => `
        <tr class="txn-row">
            <td><img src="${item.ImageURL || 'images/default_poster.svg'}" alt="${adminEscape(item.Title)}" onerror="this.onerror=null;this.src='images/default_poster.svg'" style="width:70px;height:48px;object-fit:cover;border-radius:6px;box-shadow:var(--shadow-xs);border:1px solid var(--border);"></td>
            <td>
                <div style="font-weight:700;color:var(--text);font-size:0.88rem;">${adminEscape(item.Title)}</div>
                <div style="font-size:0.78rem;color:var(--text2);margin-top:4px;line-height:1.4;">${adminEscape((item.Summary || '').substring(0, 90))}${item.Summary && item.Summary.length > 90 ? '...' : ''}</div>
            </td>
            <td><span class="status-badge ${item.Type === 'events' ? 'active' : 'finished'}">${item.Type === 'events' ? 'Sự kiện' : 'Tin tức'}</span></td>
            <td style="color:var(--text2);font-size:0.84rem;">${formatAdminDate(item.PublishedAt)}</td>
            <td>${item.IsFeatured ? '<span class="status-badge active">Nổi bật</span>' : '<span class="status-badge finished">Thường</span>'}</td>
            <td>${item.IsActive ? '<span class="status-badge active">Đang hiện</span>' : '<span class="status-badge finished">Đã ẩn</span>'}</td>
            <td>
                <div class="table-actions">
                    <button class="tb-icon-sm" title="Sửa" onclick="openNewsModal(${item.ArticleID})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="tb-icon-sm" title="${item.IsActive ? 'Ẩn' : 'Hiện'}" onclick="toggleNewsArticle(${item.ArticleID})" style="color:${item.IsActive ? '#6b7280' : '#10b981'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    <button class="tb-icon-sm danger" title="Xóa" onclick="deleteNewsArticle(${item.ArticleID})" style="color:var(--danger)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openNewsModal(id) {
    document.getElementById('newsForm').reset();
    document.getElementById('newsCurrentImg').innerHTML = '';
    document.getElementById('newsPublishedAt').value = toDateInputValue();
    document.getElementById('newsActive').checked = true;
    document.getElementById('newsFeatured').checked = false;
    document.getElementById('newsId').value = '';
    document.getElementById('newsModalTitle').textContent = 'THÊM TIN TỨC';
    document.getElementById('newsFileName').textContent = 'Chưa chọn file';
    const preview = document.getElementById('newsPreviewImg');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    if (id) {
        const item = NEWS_DATA.find(x => x.ArticleID === id);
        if (!item) return;
        document.getElementById('newsModalTitle').textContent = 'SỬA TIN TỨC';
        document.getElementById('newsId').value = item.ArticleID;
        document.getElementById('newsTitle').value = item.Title || '';
        document.getElementById('newsType').value = item.Type || 'news';
        document.getElementById('newsSummary').value = item.Summary || '';
        document.getElementById('newsContent').value = item.Content || '';
        document.getElementById('newsAuthor').value = item.Author || '';
        document.getElementById('newsPublishedAt').value = toDateInputValue(item.PublishedAt);
        document.getElementById('newsBadge').value = item.BadgeLabel || '';
        document.getElementById('newsSort').value = item.SortOrder || 0;
        document.getElementById('newsFeatured').checked = !!item.IsFeatured;
        document.getElementById('newsActive').checked = !!item.IsActive;
        if (item.ImageURL) {
            document.getElementById('newsCurrentImg').innerHTML = `Ảnh hiện tại: <a href="${item.ImageURL}" target="_blank" style="color:var(--accent);">${item.ImageURL}</a>`;
            if (preview) {
                preview.src = item.ImageURL;
                preview.style.display = 'block';
            }
        }
    }
    document.getElementById('newsModalOverlay').style.display = 'block';
    document.getElementById('newsAdminModal').style.display = 'block';
}

function closeNewsModal() {
    document.getElementById('newsModalOverlay').style.display = 'none';
    document.getElementById('newsAdminModal').style.display = 'none';

    document.getElementById('newsImage').value = '';
    document.getElementById('newsFileName').textContent = 'Chưa chọn file';
    const preview = document.getElementById('newsPreviewImg');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
}

async function saveNewsArticle(event) {
    event.preventDefault();
    const id = document.getElementById('newsId').value;
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
    const formData = new FormData();
    formData.append('title', document.getElementById('newsTitle').value);
    formData.append('type', document.getElementById('newsType').value);
    formData.append('summary', document.getElementById('newsSummary').value);
    formData.append('content', document.getElementById('newsContent').value);
    formData.append('author', document.getElementById('newsAuthor').value);
    formData.append('publishedAt', document.getElementById('newsPublishedAt').value);
    formData.append('badgeLabel', document.getElementById('newsBadge').value);
    formData.append('sortOrder', document.getElementById('newsSort').value);
    formData.append('isFeatured', document.getElementById('newsFeatured').checked ? 'true' : 'false');
    formData.append('isActive', document.getElementById('newsActive').checked ? 'true' : 'false');
    const imageFile = document.getElementById('newsImage').files[0];
    if (imageFile) formData.append('image', imageFile);
    try {
        const res = await fetch(id ? `/api/admin/news/${id}` : '/api/admin/news', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            showAdminToast(data.message, 'success');
            closeNewsModal();
            loadNewsArticles();
        } else {
            showAdminToast('Lỗi: ' + data.message, 'error');
        }
    } catch (err) {
        console.error('[Admin] saveNewsArticle:', err);
        showAdminToast('Lỗi kết nối server.', 'error');
    }
}

async function deleteNewsArticle(id) {
    if (!confirm('Bạn có chắc muốn xóa bài viết này không?')) return;
    try {
        const res = await apiFetch(`/api/admin/news/${id}`, { method: 'DELETE' });
        if (res.success) {
            showAdminToast(res.message, 'success');
            loadNewsArticles();
        } else {
            showAdminToast('Lỗi: ' + res.message, 'error');
        }
    } catch (err) {
        showAdminToast('Lỗi kết nối server.', 'error');
    }
}

async function toggleNewsArticle(id) {
    try {
        const res = await apiFetch(`/api/admin/news/${id}/toggle`, { method: 'PATCH' });
        if (res.success) {
            showAdminToast(res.message, 'success');
            loadNewsArticles();
        } else {
            showAdminToast('Lỗi: ' + res.message, 'error');
        }
    } catch (err) {
        showAdminToast('Lỗi kết nối server.', 'error');
    }
}

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
    document.getElementById('promoFileName').textContent = 'Chưa chọn file';
    const preview = document.getElementById('promoPreviewImg');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }

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
            if (preview) {
                preview.src = p.ImageURL;
                preview.style.display = 'block';
            }
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

    document.getElementById('promoImage').value = '';
    document.getElementById('promoFileName').textContent = 'Chưa chọn file';
    const preview = document.getElementById('promoPreviewImg');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
}

async function savePromo(event) {
    event.preventDefault();
    const id = document.getElementById('promoId').value;
    const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));

    const formData = new FormData();
    formData.append('title', document.getElementById('promoTitle').value);
    formData.append('description', document.getElementById('promoDesc').value);
    formData.append('badgeLabel', document.getElementById('promoBadge').value);
    formData.append('linkURL', document.getElementById('promoLink').value);
    formData.append('sortOrder', document.getElementById('promoSort').value);
    formData.append('isFeatured', document.getElementById('promoFeatured').checked ? 'true' : 'false');
    formData.append('isActive', document.getElementById('promoActive').checked ? 'true' : 'false');

    const imageFile = document.getElementById('promoImage').files[0];
    if (imageFile) formData.append('image', imageFile);

    const url = id ? `/api/admin/promotions/${id}` : '/api/admin/promotions';
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
            if (document.getElementById('cfg_BASE_TICKET_PRICE')) document.getElementById('cfg_BASE_TICKET_PRICE').value = data.BASE_TICKET_PRICE || '';
            if (document.getElementById('cfg_VIP_MULTIPLIER')) document.getElementById('cfg_VIP_MULTIPLIER').value = data.VIP_MULTIPLIER || '';
            if (document.getElementById('cfg_COUPLE_MULTIPLIER')) document.getElementById('cfg_COUPLE_MULTIPLIER').value = data.COUPLE_MULTIPLIER || '';

            if (document.getElementById('cfg_HOTLINE')) document.getElementById('cfg_HOTLINE').value = data.HOTLINE || '';
            if (document.getElementById('cfg_SUPPORT_EMAIL')) document.getElementById('cfg_SUPPORT_EMAIL').value = data.SUPPORT_EMAIL || '';
            if (document.getElementById('cfg_MAINTENANCE_MODE')) document.getElementById('cfg_MAINTENANCE_MODE').checked = (data.MAINTENANCE_MODE === 'true');
        }
    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

async function savePricingSettings() {
    const basePrice = document.getElementById('cfg_BASE_TICKET_PRICE').value;
    const vipM = document.getElementById('cfg_VIP_MULTIPLIER').value;
    const coupleM = document.getElementById('cfg_COUPLE_MULTIPLIER').value;

    if (!basePrice || !vipM || !coupleM) return showToast('Lỗi', 'Vui lòng điền đủ thông tin');

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
