// ==========================================
// public/js/admin-voucher.js
// JavaScript Client for Voucher Management (SPA mode)
// Wrapped in IIFE to prevent variable conflicts with admin.js
// ==========================================
(function () {

// Helper to get fresh token (SPA: don't redirect at load time)
function getVoucherToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

// Global state (isolated in IIFE)
let vouchersData = [];
let currentPage = 1;
const itemsPerPage = 8;
let searchQuery = '';
let statusFilterValue = '';
let editingVoucherId = null;
let voucherFormInitialized = false;

// Called by navigate() when switching to the voucher page
function initVoucherForm() {
    if (voucherFormInitialized) return;
    voucherFormInitialized = true;

    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const el = document.getElementById('adminName');
            if (el) el.textContent = user.FullName || 'Admin';
        } catch (e) {}
    }

    resetFormDates();
}

function resetFormDates() {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + 30);
    const sdEl = document.getElementById('startDate');
    const edEl = document.getElementById('endDate');
    if (sdEl) sdEl.value = formatDateTimeLocal(now);
    if (edEl) edEl.value = formatDateTimeLocal(future);
}


// Helper: Format Date for <input type="datetime-local">
function formatDateTimeLocal(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
}

// Helper: Format Date for displaying in UI
function formatDateDisplay(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// API Helper
async function apiCall(url, method = 'GET', body = null) {
    try {
        const token = getVoucherToken();
        const headers = {
            'Authorization': `Bearer ${token}`
        };
        if (body) {
            headers['Content-Type'] = 'application/json';
        }
        
        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const res = await fetch(url, options);
        const data = await res.json();
        return data;
    } catch (err) {
        console.error(`API Call failed [${method} ${url}]:`, err);
        return { success: false, message: 'Lỗi kết nối máy chủ.' };
    }
}

// Show Toast message (voucher-scoped, uses adminToastContainer from admin.js)
function vShowToast(message, type = 'success') {
    // Try admin.js toast container first
    let container = document.getElementById('adminToastContainer');
    if (!container) container = document.getElementById('toastContainer');
    if (!container) { console.warn('No toast container found'); return; }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#e8192c' : '#f59e0b';
    toast.style.cssText = `background:#1f2937; color:#fff; padding:12px 20px; border-radius:8px;
        box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:0.88rem; min-width:250px;
        border-left:4px solid ${bgColor}; display:flex; align-items:center;
        justify-content:space-between; margin-top:8px;`;
    toast.innerHTML = `<span>${message}</span>
        <span style="cursor:pointer; font-weight:bold; margin-left:12px; opacity:0.7;" onclick="this.parentElement.remove()">×</span>`;

    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

// Load Vouchers from Server
async function loadVouchers() {
    const tbody = document.getElementById('voucherListContainer');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:var(--text2);padding:24px;">Đang tải...</td></tr>`;
    }

    let url = `/api/admin/vouchers`;
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (statusFilterValue) params.set('status', statusFilterValue);
    
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const res = await apiCall(url);
    if (res.success) {
        vouchersData = res.data || [];
        renderVouchersTable();
    } else {
        // Hiện lỗi ngay trong bảng để dễ debug
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#ef4444;padding:24px;">
                ⚠️ ${res.message || 'Không thể tải danh sách voucher'}<br>
                <small style="color:var(--text2);">Kiểm tra Console (F12) để xem chi tiết lỗi.</small>
            </td></tr>`;
        }
        console.error('[loadVouchers] API error:', res);
        vShowToast(res.message || 'Không thể tải danh sách voucher', 'error');
    }
}

// Render Table with Pagination & Filters
function renderVouchersTable() {
    const tbody = document.getElementById('voucherListContainer');
    if (!tbody) return;

    // Filter results locally or calculate client pagination
    const totalItems = vouchersData.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = vouchersData.slice(startIndex, endIndex);

    if (totalItems === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">Không tìm thấy voucher nào.</td></tr>`;
        updatePaginationInfo(0, 0, 0);
        return;
    }

    let html = '';
    paginatedItems.forEach(v => {
        // Double check exp status
        const isExpired = new Date(v.EndDate) < new Date();
        const displayStatus = isExpired ? 'Expired' : v.Status;
        
        let statusBadge = '';
        if (displayStatus === 'Active') {
            statusBadge = `<span class="badge badge-active">Hoạt động</span>`;
        } else if (displayStatus === 'Expired') {
            statusBadge = `<span class="badge badge-expired">Hết hạn</span>`;
        } else {
            statusBadge = `<span class="badge badge-inactive">Tạm ẩn</span>`;
        }

        const discVal = parseFloat(v.DiscountValue);
        const discountText = v.DiscountType === 'Percentage' 
            ? `${discVal}%` 
            : `${discVal.toLocaleString('vi-VN')} đ`;

        const minOrder = parseFloat(v.MinimumOrder).toLocaleString('vi-VN') + ' đ';
        const limitText = `${v.UsedCount} / ${v.UsageLimit}`;
        const duration = `Từ: ${formatDateDisplay(v.StartDate)}<br>Đến: ${formatDateDisplay(v.EndDate)}`;

        // Expired vouchers disable edit if status is Expired
        const disableEdit = displayStatus === 'Expired';
        const editButton = disableEdit 
            ? `<button class="btn-icon" style="opacity:0.3; cursor:not-allowed;" title="Voucher đã hết hạn, không được sửa" disabled><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`
            : `<button class="btn-icon edit-btn" onclick="startEdit(${v.VoucherID})" title="Sửa"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`;

        // Active toggle action
        const toggleIcon = v.Status === 'Active' 
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
            
        const toggleButton = disableEdit
            ? ''
            : `<button class="btn-icon" onclick="toggleActiveStatus(${v.VoucherID}, '${v.Status}')" title="${v.Status === 'Active' ? 'Vô hiệu hóa' : 'Kích hoạt'}">${toggleIcon}</button>`;

        html += `
            <tr>
                <td style="font-weight:700; color:var(--accent);">${v.VoucherCode}</td>
                <td>${v.VoucherName}</td>
                <td style="font-weight:600;">${discountText}</td>
                <td>${minOrder}</td>
                <td>${limitText}</td>
                <td style="font-size:0.8rem; color:var(--text2);">${duration}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="actions-cell">
                        ${editButton}
                        ${toggleButton}
                        <button class="btn-icon delete-btn" onclick="deleteVoucher(${v.VoucherID})" title="Xóa vĩnh viễn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    updatePaginationInfo(startIndex + 1, endIndex, totalItems);
}

// Update pagination buttons state
function updatePaginationInfo(start, end, total) {
    const info = document.getElementById('paginationInfo');
    if (info) {
        info.textContent = total > 0 ? `Hiển thị ${start}-${end} trên tổng ${total}` : `Hiển thị 0 trên tổng 0`;
    }

    const prev = document.getElementById('btnPrevPage');
    const next = document.getElementById('btnNextPage');
    if (prev) prev.disabled = currentPage === 1;
    if (next) next.disabled = end >= total;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderVouchersTable();
    }
}

function nextPage() {
    const totalItems = vouchersData.length;
    if (currentPage * itemsPerPage < totalItems) {
        currentPage++;
        renderVouchersTable();
    }
}

// Search & filter handling
function handleSearch() {
    searchQuery = document.getElementById('searchInput').value.trim();
    currentPage = 1;
    loadVouchers();
}

function handleFilter() {
    statusFilterValue = document.getElementById('statusFilter').value;
    currentPage = 1;
    loadVouchers();
}

// Change Input field label based on Discount Type
function handleDiscountTypeChange() {
    const type = document.getElementById('discountType').value;
    const label = document.getElementById('discountValueLabel');
    const input = document.getElementById('discountValue');
    
    if (type === 'Percentage') {
        label.textContent = 'Giá trị giảm (%) *';
        input.placeholder = 'VD: 10';
        input.max = '100';
    } else {
        label.textContent = 'Giá trị giảm (VND) *';
        input.placeholder = 'VD: 50000';
        input.removeAttribute('max');
    }
}

// Edit voucher loader
async function startEdit(id) {
    const res = await apiCall(`/api/admin/vouchers/${id}`);
    if (res.success && res.data) {
        const v = res.data;
        
        // Double check Expired status
        if (v.Status === 'Expired' || new Date(v.EndDate) < new Date()) {
            vShowToast('Không thể chỉnh sửa voucher đã hết hạn!', 'error');
            return;
        }

        editingVoucherId = v.VoucherID;
        document.getElementById('voucherId').value = v.VoucherID;
        document.getElementById('voucherCode').value = v.VoucherCode;
        document.getElementById('voucherName').value = v.VoucherName;
        document.getElementById('discountType').value = v.DiscountType;
        document.getElementById('discountValue').value = v.DiscountValue;
        document.getElementById('minimumOrder').value = v.MinimumOrder;
        document.getElementById('maximumDiscount').value = v.MaximumDiscount;
        document.getElementById('usageLimit').value = v.UsageLimit;
        
        document.getElementById('startDate').value = formatDateTimeLocal(new Date(v.StartDate));
        document.getElementById('endDate').value = formatDateTimeLocal(new Date(v.EndDate));
        
        document.getElementById('description').value = v.Description || '';
        document.getElementById('status').value = v.Status;

        handleDiscountTypeChange();

        document.getElementById('formTitle').textContent = 'CHỈNH SỬA VOUCHER';
        document.getElementById('btnSubmit').textContent = 'Cập nhật';
    } else {
        vShowToast('Không thể lấy chi tiết voucher', 'error');
    }
}

// Reset Form
function resetForm() {
    editingVoucherId = null;
    document.getElementById('voucherForm').reset();
    document.getElementById('voucherId').value = '';
    document.getElementById('formTitle').textContent = 'TẠO VOUCHER MỚI';
    document.getElementById('btnSubmit').textContent = 'Thêm Voucher';
    
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + 30);
    
    document.getElementById('startDate').value = formatDateTimeLocal(now);
    document.getElementById('endDate').value = formatDateTimeLocal(future);
    handleDiscountTypeChange();
}

// Submit Create/Update Form
async function handleSubmit(event) {
    event.preventDefault();

    const code = document.getElementById('voucherCode').value.trim();
    const name = document.getElementById('voucherName').value.trim();
    const type = document.getElementById('discountType').value;
    const value = parseFloat(document.getElementById('discountValue').value);
    const minOrder = parseFloat(document.getElementById('minimumOrder').value);
    const maxDiscount = parseFloat(document.getElementById('maximumDiscount').value);
    const limit = parseInt(document.getElementById('usageLimit').value);
    const startStr = document.getElementById('startDate').value;
    const endStr = document.getElementById('endDate').value;
    const desc = document.getElementById('description').value.trim();
    const status = document.getElementById('status').value;

    // Client-side Validations
    if (!code) {
        vShowToast('Mã voucher không được để trống.', 'error');
        return;
    }
    if (!name) {
        vShowToast('Tên chương trình không được để trống.', 'error');
        return;
    }
    if (isNaN(value) || value <= 0) {
        vShowToast('Giá trị giảm phải lớn hơn 0.', 'error');
        return;
    }
    if (type === 'Percentage' && value > 100) {
        vShowToast('Phần trăm giảm không được vượt quá 100%.', 'error');
        return;
    }
    if (isNaN(minOrder) || minOrder < 0) {
        vShowToast('Giá trị đơn hàng tối thiểu phải >= 0.', 'error');
        return;
    }
    if (isNaN(maxDiscount) || maxDiscount < 0) {
        vShowToast('Giá trị giảm tối đa phải >= 0.', 'error');
        return;
    }
    if (isNaN(limit) || limit < 1) {
        vShowToast('Giới hạn lượt dùng phải >= 1.', 'error');
        return;
    }

    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start >= end) {
        vShowToast('Ngày bắt đầu phải nhỏ hơn ngày kết thúc.', 'error');
        return;
    }

    const payload = {
        voucherCode: code,
        voucherName: name,
        discountType: type,
        discountValue: value,
        minimumOrder: minOrder,
        maximumDiscount: maxDiscount,
        usageLimit: limit,
        startDate: startStr,
        endDate: endStr,
        description: desc,
        status: status
    };

    const submitBtn = document.getElementById('btnSubmit');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý...';

    const url = editingVoucherId ? `/api/admin/vouchers/${editingVoucherId}` : `/api/admin/vouchers`;
    const method = editingVoucherId ? 'PUT' : 'POST';

    const res = await apiCall(url, method, payload);
    submitBtn.disabled = false;
    submitBtn.textContent = origText;

    if (res.success) {
        vShowToast(res.message || 'Lưu thành công!', 'success');
        resetForm();
        // Reset về trang 1 và xóa filter để voucher mới luôn hiển thị
        currentPage = 1;
        searchQuery = '';
        statusFilterValue = '';
        const si = document.getElementById('searchInput');
        const sf = document.getElementById('statusFilter');
        if (si) si.value = '';
        if (sf) sf.value = '';
        loadVouchers();
    } else {
        vShowToast(res.message || 'Lưu thất bại.', 'error');
    }
}

// Toggle status Bật/Tắt trạng thái hoạt động
async function toggleActiveStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const res = await apiCall(`/api/admin/vouchers/${id}`, 'PUT', { status: newStatus });
    if (res.success) {
        vShowToast(`Đã chuyển trạng thái sang ${newStatus === 'Active' ? 'Kích hoạt' : 'Tạm ẩn'}.`, 'success');
        loadVouchers();
    } else {
        vShowToast(res.message || 'Không thể đổi trạng thái.', 'error');
    }
}

// Hard Delete – xóa vĩnh viễn khỏi database
async function deleteVoucher(id) {
    if (!confirm('⚠️ Bạn có chắc chắn muốn XÓA HẰN voucher này khỏi hệ thống?\nHành động này không thể hoàn tác!')) {
        return;
    }

    const res = await apiCall(`/api/admin/vouchers/${id}`, 'DELETE');
    if (res.success) {
        vShowToast(res.message || 'Đã xóa voucher thành công!', 'success');
        loadVouchers();
        if (editingVoucherId === id) resetForm();
    } else {
        vShowToast(res.message || 'Không thể xóa voucher.', 'error');
    }
}

// Logout handler removed from voucher module (handled by admin.js adminLogout())

// ── Export functions to window so HTML event handlers can call them ──
window.loadVouchers          = loadVouchers;
window.initVoucherForm       = initVoucherForm;
window.handleSearch          = handleSearch;
window.handleFilter          = handleFilter;
window.handleSubmit          = handleSubmit;
window.handleDiscountTypeChange = handleDiscountTypeChange;
window.resetForm             = resetForm;
window.startEdit             = startEdit;
window.deleteVoucher         = deleteVoucher;
window.toggleActiveStatus    = toggleActiveStatus;
window.prevPage              = prevPage;
window.nextPage              = nextPage;

})(); // end IIFE
