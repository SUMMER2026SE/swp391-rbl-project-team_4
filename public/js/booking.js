const socket = io('http://localhost:9999');

const state = {
    step: 1,
    cinema: null,
    time: null,
    showtimeId: null,
    seats: new Set(),
    fb: {}, // {id: quantity}
    payment: null,
    
    prices: {
        standard: 85000,
        vip: 105000,
        couple: 160000
    }
};

const fbCatalog = [
    { id: 'fb1', name: 'Combo Solo', desc: '1 Bắp Ngọt Lớn + 1 Nước Lớn', price: 89000, img: 'images/combo_popcorn.png' },
    { id: 'fb2', name: 'Combo Couple', desc: '1 Bắp Ngọt Lớn + 2 Nước Lớn', price: 129000, img: 'images/combo_popcorn.png' },
    { id: 'fb3', name: 'Combo Family', desc: '2 Bắp Lớn + 4 Nước Lớn', price: 199000, img: 'images/combo_popcorn.png' },
    { id: 'fb4', name: 'Nước Ngọt Lớn', desc: 'Pepsi / 7Up / Mirinda', price: 35000, img: 'images/combo_popcorn.png' }
];

const app = {
    init() {
        this.renderSeats();
        this.renderFb();
        
        socket.on('connect', () => console.log('Socket connected'));
        socket.on('seatStatusUpdated', (data) => {
            if (data.showtimeId !== state.showtimeId) return;
            const seatEl = document.getElementById(`seat-${data.seatId}`);
            if (!seatEl) return;
            
            if (data.status === 'Trống') {
                seatEl.classList.remove('taken', 'selected');
            } else if (data.status === 'Đã bán') {
                seatEl.classList.add('taken');
                seatEl.classList.remove('selected');
                state.seats.delete(data.seatId);
            } else if (data.status === 'Đang chọn' && !state.seats.has(data.seatId)) {
                seatEl.classList.add('taken'); // visually mark as taken by others
            }
            this.updateSummary();
        });
    },

    selectDate(el) {
        document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        // Filter logic mock
    },

    selectShowtime(cinema, time, showtimeId) {
        state.cinema = cinema;
        state.time = time;
        state.showtimeId = showtimeId;
        
        // Update UI
        document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('active'));
        event.currentTarget.classList.add('active');
        
        document.getElementById('sumCinema').textContent = cinema;
        document.getElementById('sumTime').textContent = `${time} - Hôm nay`;
        document.getElementById('roomInfo').innerHTML = `${cinema.toUpperCase()} &nbsp;•&nbsp; Phòng 04 &nbsp;•&nbsp; <span class="neon">${time} - Hôm nay</span>`;
        
        document.getElementById('btnContinue').disabled = false;
        
        // Auto go to step 2
        setTimeout(() => this.goToStep(2), 500);
        
        socket.emit('joinShowtime', showtimeId);
    },

    renderSeats() {
        const matrix = document.getElementById('seatMatrix');
        matrix.innerHTML = '';
        
        const rows = ['A','B','C','D','E','F','G','H','I','J'];
        const soldMock = ['E5','E6','F8','G3','G4','H7'];
        
        rows.forEach(r => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'seat-row';
            rowDiv.innerHTML = `<div class="row-label">${r}</div>`;
            
            const group1 = document.createElement('div');
            group1.className = 'seats-group gap-right';
            const group2 = document.createElement('div');
            group2.className = 'seats-group gap-left';
            
            let cols = 10;
            if(r === 'I' || r === 'J') cols = 8;
            else if (r === 'A' || r === 'B') cols = 8;
            
            for(let c=1; c<=cols; c++) {
                const seatId = `${r}${c}`;
                let type = 'standard';
                if(r === 'E' || r === 'F' || r === 'G' || r === 'H') type = 'vip';
                if(r === 'I' || r === 'J') type = 'couple';
                
                const seatDiv = document.createElement('div');
                seatDiv.id = `seat-${seatId}`;
                seatDiv.className = `seat seat-${type}`;
                if (soldMock.includes(seatId)) seatDiv.classList.add('taken');
                
                seatDiv.textContent = type==='couple' ? `Đôi ${seatId}` : seatId;
                seatDiv.dataset.type = type;
                
                seatDiv.onclick = () => this.toggleSeat(seatDiv, seatId, type);
                
                if (c <= cols/2) group1.appendChild(seatDiv);
                else group2.appendChild(seatDiv);
            }
            
            rowDiv.appendChild(group1);
            rowDiv.appendChild(group2);
            rowDiv.innerHTML += `<div class="row-label">${r}</div>`;
            matrix.appendChild(rowDiv);
        });
    },

    toggleSeat(el, id, type) {
        if(el.classList.contains('taken')) return;
        
        if (state.seats.has(id)) {
            state.seats.delete(id);
            el.classList.remove('selected');
            socket.emit('releaseSeat', { showtimeId: state.showtimeId, seatId: id });
        } else {
            if (state.seats.size >= 8) {
                alert("Tối đa 8 ghế!"); return;
            }
            state.seats.add(id);
            el.classList.add('selected');
            socket.emit('holdSeat', { showtimeId: state.showtimeId, seatId: id });
        }
        this.updateSummary();
    },

    renderFb() {
        const grid = document.getElementById('fbGrid');
        grid.innerHTML = fbCatalog.map(fb => `
            <div class="fb-card">
                <img src="${fb.img}" class="fb-img">
                <div class="fb-info">
                    <div>
                        <div class="fb-name">${fb.name}</div>
                        <div class="fb-desc">${fb.desc}</div>
                    </div>
                    <div class="fb-bottom">
                        <div class="fb-price">${fb.price.toLocaleString('vi-VN')}đ</div>
                        <div class="qty-controls">
                            <button class="btn-qty" onclick="app.updateFb('${fb.id}', -1)">-</button>
                            <span class="qty-val" id="qty-${fb.id}">0</span>
                            <button class="btn-qty" onclick="app.updateFb('${fb.id}', 1)">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    updateFb(id, delta) {
        let current = state.fb[id] || 0;
        current += delta;
        if(current < 0) current = 0;
        state.fb[id] = current;
        document.getElementById(`qty-${id}`).textContent = current;
        this.updateSummary();
    },

    selectPayment(el, method) {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        state.payment = method;
        this.updateSummary();
    },

    updateSummary() {
        // Update seats text
        const seatsArr = Array.from(state.seats);
        document.getElementById('sumSeats').textContent = seatsArr.length > 0 ? seatsArr.join(', ') : '—';
        
        // Update FB text
        let fbArr = [];
        for(let id in state.fb) {
            if(state.fb[id] > 0) {
                const item = fbCatalog.find(f => f.id === id);
                fbArr.push(`${state.fb[id]}x ${item.name}`);
            }
        }
        document.getElementById('sumFb').textContent = fbArr.length > 0 ? fbArr.join(', ') : '—';
        
        // Calculate total
        let total = 0;
        seatsArr.forEach(s => {
            const el = document.getElementById(`seat-${s}`);
            const type = el.dataset.type;
            total += state.prices[type];
        });
        
        for(let id in state.fb) {
            const item = fbCatalog.find(f => f.id === id);
            total += state.fb[id] * item.price;
        }
        
        document.getElementById('sumTotal').textContent = `${total.toLocaleString('vi-VN')} đ`;
        
        // Check continue button
        const btn = document.getElementById('btnContinue');
        if (state.step === 2) {
            btn.disabled = state.seats.size === 0;
        } else if (state.step === 4) {
            btn.disabled = !state.payment;
        }
    },

    goToStep(targetStep) {
        // Validate
        if (targetStep === 2 && !state.showtimeId) return;
        if (targetStep === 3 && state.seats.size === 0) { alert("Vui lòng chọn ghế!"); return; }
        
        state.step = targetStep;
        
        // Hide/Show content
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-${targetStep}`).classList.add('active');
        
        // Update progress bar UI
        document.querySelectorAll('.progress-steps .step').forEach((el, idx) => {
            el.classList.remove('active', 'completed');
            if (idx + 1 < targetStep) el.classList.add('completed');
            if (idx + 1 === targetStep) el.classList.add('active');
        });
        
        const fillPercents = [0, 33, 66, 100];
        document.getElementById('progressFill').style.width = `${fillPercents[targetStep-1]}%`;
        
        // Update buttons
        const btnContinue = document.getElementById('btnContinue');
        const btnBack = document.getElementById('btnBack');
        
        if (targetStep > 1) btnBack.style.display = 'inline-block';
        else btnBack.style.display = 'none';
        
        if (targetStep === 1) btnContinue.textContent = 'TIẾP TỤC BƯỚC 2';
        else if (targetStep === 2) btnContinue.textContent = 'TIẾP TỤC BƯỚC 3';
        else if (targetStep === 3) btnContinue.textContent = 'TIẾP TỤC THANH TOÁN';
        else if (targetStep === 4) btnContinue.textContent = 'XÁC NHẬN ĐẶT VÉ';
        
        window.scrollTo(0,0);
        this.updateSummary();
    },

    handleContinue() {
        if (state.step < 4) {
            this.goToStep(state.step + 1);
        } else {
            alert('Đặt vé thành công! Cảm ơn bạn đã sử dụng dịch vụ.');
            window.location.href = 'index.html';
        }
    },
    
    handleBack() {
        if (state.step > 1) {
            this.goToStep(state.step - 1);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
