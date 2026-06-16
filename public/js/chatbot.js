// chatbot.js
function initChatbotWidget() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'moviebot-container';

    const clapperSvg = `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <!-- Base part -->
            <rect x="12" y="45" width="76" height="40" fill="#2d2d2d" />
            <line x1="18" y1="55" x2="82" y2="55" stroke="#f0f0f0" stroke-width="1.5" />
            <line x1="18" y1="65" x2="82" y2="65" stroke="#f0f0f0" stroke-width="1.5" />
            <line x1="18" y1="80" x2="82" y2="80" stroke="#f0f0f0" stroke-width="1.5" />
            <line x1="50" y1="55" x2="50" y2="65" stroke="#f0f0f0" stroke-width="1.5" />
            <!-- Lower striped bar -->
            <g transform="translate(12, 33)">
                <rect x="0" y="0" width="76" height="10" fill="#2d2d2d" />
                <polygon points="10,0 20,0 15,10 5,10" fill="#f0f0f0" />
                <polygon points="30,0 40,0 35,10 25,10" fill="#f0f0f0" />
                <polygon points="50,0 60,0 55,10 45,10" fill="#f0f0f0" />
                <polygon points="70,0 76,0 75,10 65,10" fill="#f0f0f0" />
            </g>
            <!-- Hinge block -->
            <rect x="12" y="30" width="12" height="15" fill="#202020" />
            <!-- Upper striped bar (tilted) -->
            <g transform="rotate(-12 18 33) translate(12, 21)">
                <rect x="0" y="0" width="76" height="10" fill="#2d2d2d" />
                <polygon points="10,0 20,0 15,10 5,10" fill="#f0f0f0" />
                <polygon points="30,0 40,0 35,10 25,10" fill="#f0f0f0" />
                <polygon points="50,0 60,0 55,10 45,10" fill="#f0f0f0" />
                <polygon points="70,0 76,0 75,10 65,10" fill="#f0f0f0" />
            </g>
        </svg>
    `;

    chatContainer.innerHTML = `
        <div id="moviebot-window">
            <div id="moviebot-header">
                <div class="header-left">
                    <div class="bot-avatar">${clapperSvg}</div>
                    <div class="bot-info">
                        <span class="bot-name">CinemaVerse Bot</span>
                        <span class="bot-status"><span class="status-dot"></span> Online</span>
                    </div>
                </div>
                <button id="moviebot-close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <div id="moviebot-messages"></div>

            <div id="moviebot-suggestions">
                <div class="sugg-header">✨ Bạn cần hỗ trợ?</div>
                <div class="sugg-grid">
                    <div class="sugg-card" data-action="Cho tôi xem lịch chiếu phim mới nhất">
                        <div class="sugg-icon">📅</div>
                        <div class="sugg-title">Lịch chiếu</div>
                        <div class="sugg-desc">Xem lịch chiếu<br>phim mới nhất</div>
                    </div>
                    <div class="sugg-card" data-action="Giá vé hiện tại là bao nhiêu?">
                        <div class="sugg-icon">🎟️</div>
                        <div class="sugg-title">Giá vé</div>
                        <div class="sugg-desc">Tìm hiểu giá vé<br>theo rạp</div>
                    </div>
                    <div class="sugg-card" data-action="Hướng dẫn tôi cách đặt vé">
                        <div class="sugg-icon">🎬</div>
                        <div class="sugg-title">Đặt vé</div>
                        <div class="sugg-desc">Chọn ghế, thanh toán<br>và nhận vé</div>
                    </div>
                    <div class="sugg-card" data-action="Tư vấn cho tôi phim hay đang chiếu">
                        <div class="sugg-icon">🍿</div>
                        <div class="sugg-title">Tư vấn phim</div>
                        <div class="sugg-desc">Gợi ý phim<br>theo sở thích</div>
                    </div>
                </div>
            </div>

            <div id="moviebot-input-area">
                <div class="input-wrapper">
                    <div class="input-icon">${clapperSvg}</div>
                    <input type="text" id="moviebot-input" placeholder="Nhập câu hỏi của bạn..." autocomplete="off"/>
                    <div class="input-emoji">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                    </div>
                </div>
                <button id="moviebot-send">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
            
            <div class="bot-footer">
                ✨ Powered by <span class="highlight">CinemaVerse AI</span>
            </div>
        </div>
        <button id="moviebot-btn">
            ${clapperSvg}
        </button>
    `;
    document.body.appendChild(chatContainer);

    const btn = document.getElementById('moviebot-btn');
    const win = document.getElementById('moviebot-window');
    const close = document.getElementById('moviebot-close');
    const input = document.getElementById('moviebot-input');
    const send = document.getElementById('moviebot-send');
    const messages = document.getElementById('moviebot-messages');
    const suggCards = document.querySelectorAll('.sugg-card');

    btn.addEventListener('click', () => { win.style.display = win.style.display === 'flex' ? 'none' : 'flex'; });
    close.addEventListener('click', () => { win.style.display = 'none'; });

    // Format AM/PM Time
    const getTimeString = () => {
        const d = new Date();
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const appendMessage = (text, sender) => {
        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${sender}`;

        let avatarHtml = '';
        if (sender === 'bot') {
            avatarHtml = `<div class="bot-avatar">${clapperSvg}</div>`;
        }

        const timeHtml = `<div class="msg-time">${getTimeString()}${sender === 'user' ? ' <span style="color:#e50914">✔✔</span>' : ''}</div>`;

        wrapper.innerHTML = `
            ${avatarHtml}
            <div class="msg-content">
                <div class="msg">${text.replace(/\n/g, '<br>')}</div>
                ${timeHtml}
            </div>
        `;
        messages.appendChild(wrapper);
        messages.scrollTop = messages.scrollHeight;
    };

    // Initial greeting
    setTimeout(() => {
        appendMessage('Chào bạn! Mình là trợ lý AI của CinemaVerse. Mình có thể giúp gì cho bạn hôm nay? (Ví dụ: lịch chiếu phim, giá vé, tư vấn phim...)', 'bot');
    }, 500);

    const sendMessage = async (text) => {
        if (!text) return;
        input.value = '';
        appendMessage(text, 'user');

        // Typing indicator
        const typingId = 'typing-' + Date.now();
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper bot';
        wrapper.id = typingId;
        wrapper.innerHTML = `
            <div class="bot-avatar">${clapperSvg}</div>
            <div class="msg-content">
                <div class="msg">Đang suy nghĩ...</div>
            </div>
        `;
        messages.appendChild(wrapper);
        messages.scrollTop = messages.scrollHeight;

        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();

            // Artificial delay of 10 seconds
            await new Promise(resolve => setTimeout(resolve, 10000));

            document.getElementById(typingId).remove();
            if (data.reply) {
                appendMessage(data.reply, 'bot');
            } else {
                appendMessage('Xin lỗi, mình gặp lỗi xử lý. Bạn thử lại nhé.', 'bot');
            }
        } catch (e) {
            // Delay error response as well
            await new Promise(resolve => setTimeout(resolve, 10000));

            document.getElementById(typingId).remove();
            appendMessage('Mất kết nối với máy chủ AI.', 'bot');
        }
    };

    send.addEventListener('click', () => sendMessage(input.value.trim()));
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(input.value.trim()); });

    suggCards.forEach(card => {
        card.addEventListener('click', () => {
            sendMessage(card.getAttribute('data-action'));
        });
    });
}

document.addEventListener('DOMContentLoaded', initChatbotWidget);
