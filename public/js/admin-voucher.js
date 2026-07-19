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

        let res = await fetch(url, options);
        if (res.status === 404) {
            let altUrl = null;
            if (url.startsWith('/api/admin/vouchers')) altUrl = url.replace('/api/admin/vouchers', '/admin/vouchers');
            else if (url.startsWith('/admin/vouchers')) altUrl = url.replace('/admin/vouchers', '/api/admin/vouchers');
            if (altUrl) {
                res = await fetch(altUrl, options);
            }
        }

        let data;
        try {
            data = await res.json();
        } catch (jsonErr) {
            console.error(`[apiCall] Invalid JSON response from ${url}:`, jsonErr);
            return { success: false, message: `Lỗi phản hồi máy chủ (HTTP ${res.status}).` };
        }
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
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color:var(--text2);padding:24px;">Đang tải...</td></tr>`;
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
            tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color:#ef4444;padding:24px;">
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
        tbody.innerHTML = `<tr><td colspan="9" class="text-center">Không tìm thấy voucher nào.</td></tr>`;
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

        const displayVoucherType = v.VoucherType || 'Mã Khuyến Mãi';
        const imgThumbCell = (v.ImageUrl && v.ImageUrl.trim() !== '') 
            ? `<img src="${v.ImageUrl}" alt="${v.VoucherCode}" style="width:44px; height:44px; object-fit:cover; border-radius:8px; border:1px solid #4b5563; display:block; margin:0 auto; cursor:pointer;" title="Bấm để xem ảnh" onclick="window.open('${v.ImageUrl}', '_blank')">` 
            : `<span style="font-size:0.75rem; color:#9ca3af; padding:4px 8px; border:1px dashed #4b5563; border-radius:6px; white-space:nowrap; display:inline-block;">Chưa có ảnh</span>`;

        html += `
            <tr>
                <td style="text-align:center; padding:8px;">${imgThumbCell}</td>
                <td style="font-weight:700; color:var(--accent);">${v.VoucherCode}</td>
                <td style="font-weight:600; color:#38bdf8;">${displayVoucherType}</td>
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

// Image preview helper
function updateImagePreview() {
    const input = document.getElementById('imageUrl');
    const container = document.getElementById('imagePreviewContainer');
    const img = document.getElementById('imagePreview');
    if (!input || !container || !img) return;

    const val = input.value.trim();
    if (val) {
        img.src = val;
        container.style.display = 'flex';
        img.onerror = function() {
            container.style.display = 'none';
        };
    } else {
        container.style.display = 'none';
        img.src = '';
    }
}

// Helper to compress image file to lightweight Base64 (~20KB) to prevent HTTP 413 Payload Too Large
function compressImage(file, maxWidth = 400, maxHeight = 400, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = function() {
                resolve(e.target.result);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// File upload helper
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 1. Instant zero-latency preview
    const objectUrl = URL.createObjectURL(file);
    const imgEl = document.getElementById('imagePreview');
    const container = document.getElementById('imagePreviewContainer');
    if (imgEl && container) {
        imgEl.src = objectUrl;
        container.style.display = 'flex';
    }

    // 2. Upload file via FormData to server (Multer handles files directly)
    const formData = new FormData();
    formData.append('image', file);

    try {
        const token = getVoucherToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        let res = await fetch('/api/admin/vouchers/upload', {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (res.status === 404) {
            res = await fetch('/admin/vouchers/upload', {
                method: 'POST',
                headers: headers,
                body: formData
            });
        }

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.imageUrl) {
                const input = document.getElementById('imageUrl');
                if (input) input.value = data.imageUrl;
                updateImagePreview();
                vShowToast('Đã tải ảnh lên thành công!', 'success');
                return;
            }
        }
    } catch (e) {
        console.warn('[handleFileUpload] Multipart upload warning:', e);
    }

    // 3. Fallback: compress image to lightweight ~20KB Base64 so JSON payload never triggers HTTP 413
    try {
        const compressedBase64 = await compressImage(file, 400, 400, 0.7);
        const input = document.getElementById('imageUrl');
        if (input) input.value = compressedBase64;
        updateImagePreview();
        vShowToast('Đã chọn ảnh thành công!', 'success');
    } catch (err) {
        console.error('[handleFileUpload] Compression error:', err);
        vShowToast('Không thể xử lý file ảnh.', 'error');
    }
}

// Edit voucher loader
async function startEdit(id) {
    let v = vouchersData.find(item => item.VoucherID === id);
    if (!v || v.ImageUrl === undefined) {
        const res = await apiCall(`/api/admin/vouchers/${id}`);
        if (res.success && res.data) {
            v = res.data;
        }
    }

    if (v) {
        // Double check Expired status
        if (v.Status === 'Expired' || new Date(v.EndDate) < new Date()) {
            vShowToast('Không thể chỉnh sửa voucher đã hết hạn!', 'error');
            return;
        }

        editingVoucherId = v.VoucherID;
        document.getElementById('voucherId').value = v.VoucherID;
        document.getElementById('voucherCode').value = v.VoucherCode || v.Code || '';
        const vTypeEl = document.getElementById('voucherType');
        if (vTypeEl) vTypeEl.value = v.VoucherType || 'Mã Khuyến Mãi';
        document.getElementById('voucherName').value = v.VoucherName || v.VoucherCode || v.Code || '';
        document.getElementById('discountType').value = v.DiscountType;
        document.getElementById('discountValue').value = v.DiscountValue;
        document.getElementById('minimumOrder').value = v.MinimumOrder !== undefined ? v.MinimumOrder : (v.MinOrderValue || 0);
        document.getElementById('maximumDiscount').value = v.MaximumDiscount !== undefined ? v.MaximumDiscount : (v.MaxDiscount || 0);
        document.getElementById('usageLimit').value = v.UsageLimit;
        
        document.getElementById('startDate').value = formatDateTimeLocal(new Date(v.StartDate));
        document.getElementById('endDate').value = formatDateTimeLocal(new Date(v.EndDate));
        
        document.getElementById('description').value = v.Description || '';
        const imgInput = document.getElementById('imageUrl');
        if (imgInput) imgInput.value = v.ImageUrl || v.imageUrl || '';
        updateImagePreview();

        document.getElementById('status').value = v.Status || 'Active';

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
    const vTypeEl = document.getElementById('voucherType');
    if (vTypeEl) vTypeEl.value = 'Mã Khuyến Mãi';
    const imgInput = document.getElementById('imageUrl');
    if (imgInput) imgInput.value = '';
    updateImagePreview();

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
    const vTypeEl = document.getElementById('voucherType');
    const voucherType = vTypeEl ? vTypeEl.value : 'Mã Khuyến Mãi';
    const name = document.getElementById('voucherName').value.trim();
    const type = document.getElementById('discountType').value;
    const value = parseFloat(document.getElementById('discountValue').value);
    const minOrder = parseFloat(document.getElementById('minimumOrder').value);
    const maxDiscount = parseFloat(document.getElementById('maximumDiscount').value);
    const limit = parseInt(document.getElementById('usageLimit').value);
    const startStr = document.getElementById('startDate').value;
    const endStr = document.getElementById('endDate').value;
    const desc = document.getElementById('description').value.trim();
    const imageUrl = document.getElementById('imageUrl') ? document.getElementById('imageUrl').value.trim() : '';
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
        voucherType: voucherType,
        voucherName: name,
        discountType: type,
        discountValue: value,
        minimumOrder: minOrder,
        maximumDiscount: maxDiscount,
        usageLimit: limit,
        startDate: startStr,
        endDate: endStr,
        description: desc,
        imageUrl: imageUrl,
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
window.updateImagePreview    = updateImagePreview;
window.handleFileUpload      = handleFileUpload;
window.resetForm             = resetForm;
window.startEdit             = startEdit;
window.deleteVoucher         = deleteVoucher;
window.toggleActiveStatus    = toggleActiveStatus;
window.prevPage              = prevPage;
window.nextPage              = nextPage;

})(); // end IIFE
