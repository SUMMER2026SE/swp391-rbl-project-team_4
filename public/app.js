const socket = io('http://localhost:9999');

const mockMovies = [
    { id: 1, title: 'LẬT MẶT 7: MỘT ĐIỀU ƯỚC', rating: 'T16', image: 'images/poster.png', genre: 'Hành động', duration: 120, trailer: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: 2, title: 'DORAEMON: NOBITA VÀ BẢN GIAO HƯỞNG', rating: 'P', image: 'images/poster.png', genre: 'Hoạt hình', duration: 110, trailer: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { id: 3, title: 'HÀNH TINH KHỈ: VƯƠNG QUỐC MỚI', rating: 'T13', image: 'images/poster.png', genre: 'Viễn tưởng', duration: 145, trailer: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }
];

const mockFB = [
    { id: 'fb1', name: 'Combo Solo (1 Bắp + 1 Nước)', price: 89000, img: 'images/poster.png' },
    { id: 'fb2', name: 'Combo Couple (1 Bắp lớn + 2 Nước)', price: 129000, img: 'images/poster.png' },
    { id: 'fb3', name: 'Snack Khoai Tây', price: 45000, img: 'images/poster.png' }
];

const app = {
    currentShowtimeId: null,
    bookingData: {
        step: 1,
        movieId: null,
        seats: new Set(),
        fb: {}, // { fbId: quantity }
        priceSeat: 85000,
        priceVIP: 105000
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
        window.scrollTo(0,0);
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
        const modal = document.getElementById('trailerModal');
        const iframe = document.getElementById('trailerIframe');
        iframe.src = url;
        modal.classList.remove('hidden');
    },
    closeTrailer() {
        const modal = document.getElementById('trailerModal');
        const iframe = document.getElementById('trailerIframe');
        iframe.src = '';
        modal.classList.add('hidden');
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
        document.getElementById(`step-${step}-${['filter','seat','fb','checkout'][step-1]}`).classList.remove('hidden');

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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.renderMovies();
    app.initSocket();
});
