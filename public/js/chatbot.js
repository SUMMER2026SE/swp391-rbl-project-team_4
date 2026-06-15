// chatbot.js
function initChatbotWidget() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'moviebot-container';
    chatContainer.innerHTML = `
        <div id="moviebot-window">
            <div id="moviebot-header">
                <span>🤖 CinemaVerse Bot</span>
                <button id="moviebot-close">&times;</button>
            </div>
            <div id="moviebot-messages">
                <div class="msg bot">Chào bạn! Mình là trợ lý AI của CinemaVerse. Mình có thể giúp gì cho bạn hôm nay? (Ví dụ: lịch chiếu phim, giá vé, tư vấn phim...)</div>
            </div>
            <div id="moviebot-input-area">
                <input type="text" id="moviebot-input" placeholder="Nhập câu hỏi của bạn..." />
                <button id="moviebot-send">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
            </div>
        </div>
        <button id="moviebot-btn">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 5.58 2 10c0 2.54 1.48 4.78 3.75 6.18L5 22l4.47-2.18c.8.12 1.63.18 2.53.18 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/></svg>
        </button>
    `;
    document.body.appendChild(chatContainer);

    const btn = document.getElementById('moviebot-btn');
    const win = document.getElementById('moviebot-window');
    const close = document.getElementById('moviebot-close');
    const input = document.getElementById('moviebot-input');
    const send = document.getElementById('moviebot-send');
    const messages = document.getElementById('moviebot-messages');

    btn.addEventListener('click', () => { win.style.display = win.style.display === 'flex' ? 'none' : 'flex'; });
    close.addEventListener('click', () => { win.style.display = 'none'; });

    const appendMessage = (text, sender) => {
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        div.innerHTML = text.replace(/\n/g, '<br>');
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    };

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        appendMessage(text, 'user');
        
        // Typing indicator
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.className = 'msg bot';
        typingDiv.id = typingId;
        typingDiv.innerText = 'Đang suy nghĩ...';
        messages.appendChild(typingDiv);
        messages.scrollTop = messages.scrollHeight;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            document.getElementById(typingId).remove();
            if (data.reply) {
                appendMessage(data.reply, 'bot');
            } else {
                appendMessage('Xin lỗi, mình gặp lỗi xử lý. Bạn thử lại nhé.', 'bot');
            }
        } catch (e) {
            document.getElementById(typingId).remove();
            appendMessage('Mất kết nối với máy chủ AI.', 'bot');
        }
    };

    send.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

document.addEventListener('DOMContentLoaded', initChatbotWidget);
