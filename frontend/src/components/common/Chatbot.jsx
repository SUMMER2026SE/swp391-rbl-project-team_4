import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/css/chatbot.css';

const CLAPPER_SVG = (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect x="12" y="45" width="76" height="40" fill="#2d2d2d" />
    <line x1="18" y1="55" x2="82" y2="55" stroke="#f0f0f0" strokeWidth="1.5" />
    <line x1="18" y1="65" x2="82" y2="65" stroke="#f0f0f0" strokeWidth="1.5" />
    <line x1="18" y1="80" x2="82" y2="80" stroke="#f0f0f0" strokeWidth="1.5" />
    <line x1="50" y1="55" x2="50" y2="65" stroke="#f0f0f0" strokeWidth="1.5" />
    <g transform="translate(12, 33)">
      <rect x="0" y="0" width="76" height="10" fill="#2d2d2d" />
      <polygon points="10,0 20,0 15,10 5,10" fill="#f0f0f0" />
      <polygon points="30,0 40,0 35,10 25,10" fill="#f0f0f0" />
      <polygon points="50,0 60,0 55,10 45,10" fill="#f0f0f0" />
      <polygon points="70,0 76,0 75,10 65,10" fill="#f0f0f0" />
    </g>
    <rect x="12" y="30" width="12" height="15" fill="#202020" />
    <g transform="rotate(-12 18 33) translate(12, 21)">
      <rect x="0" y="0" width="76" height="10" fill="#2d2d2d" />
      <polygon points="10,0 20,0 15,10 5,10" fill="#f0f0f0" />
      <polygon points="30,0 40,0 35,10 25,10" fill="#f0f0f0" />
      <polygon points="50,0 60,0 55,10 45,10" fill="#f0f0f0" />
      <polygon points="70,0 76,0 75,10 65,10" fill="#f0f0f0" />
    </g>
  </svg>
);

const SUGGESTIONS = [
  { icon: '📅', title: 'Lịch chiếu', desc: 'Xem lịch chiếu phim mới nhất', action: 'Xem lịch chiếu phim hôm nay' },
  { icon: '🎟️', title: 'Giá vé', desc: 'Tìm hiểu giá vé theo rạp', action: 'Giá vé xem phim là bao nhiêu?' },
  { icon: '🎬', title: 'Đặt vé', desc: 'Chọn ghế, thanh toán và nhận vé', action: 'Hướng dẫn đặt vé xem phim' },
  { icon: '🍿', title: 'Tư vấn phim', desc: 'Gợi ý phim theo sở thích', action: 'Gợi ý phim hay cho tôi xem' },
];

export default function Chatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesRef = useRef(null);

  // Don't show for Admin/Staff
  if (user && (user.Role === 'Admin' || user.role === 'Admin' || user.Role === 'Staff' || user.roleName === 'Admin')) {
    return null;
  }

  useEffect(() => {
    if (open && messages.length === 0) {
      setTimeout(() => {
        setMessages([{ sender: 'bot', text: 'Chào bạn! Mình là trợ lý AI của CinemaVerse. Mình có thể giúp gì cho bạn hôm nay? (Ví dụ: lịch chiếu phim, giá vé, tư vấn phim...)' }]);
      }, 500);
    }
  }, [open]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const getTime = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const sendMessage = async (text) => {
    if (!text || sending) return;
    setSending(true);
    const userMsg = { sender: 'user', text, time: getTime() };
    const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
    setMessages(prev => [...prev, userMsg, { sender: 'bot', text: '...', time: getTime(), loading: true }]);
    setInput('');

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ message: text, history, language: localStorage.getItem('dcinema_lang') || 'vi' }),
      });
      const data = await res.json();
      setMessages(prev => prev.filter(m => !m.loading).concat({ sender: 'bot', text: data.reply || 'Xin lỗi, mình gặp lỗi.', time: getTime() }));
    } catch {
      setMessages(prev => prev.filter(m => !m.loading).concat({ sender: 'bot', text: 'Mất kết nối với máy chủ AI.', time: getTime() }));
    } finally {
      setSending(false);
    }
  };

  return (
    <div id="moviebot-container">
      {open && (
        <div id="moviebot-window" style={{ display: 'flex' }}>
          <div id="moviebot-header">
            <div className="header-left">
              <div className="bot-avatar">{CLAPPER_SVG}</div>
              <div className="bot-info">
                <span className="bot-name">CinemaVerse Bot</span>
                <span className="bot-status"><span className="status-dot"></span> Online</span>
              </div>
            </div>
            <button id="moviebot-close" onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div id="moviebot-messages" ref={messagesRef}>
            {messages.length === 0 && (
              <div id="moviebot-suggestions">
                <div className="sugg-header">✨ Bạn cần hỗ trợ?</div>
                <div className="sugg-grid">
                  {SUGGESTIONS.map((s, i) => (
                    <div key={i} className="sugg-card" onClick={() => sendMessage(s.action)}>
                      <div className="sugg-icon">{s.icon}</div>
                      <div className="sugg-title">{s.title}</div>
                      <div className="sugg-desc">{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`msg-wrapper ${msg.sender}`}>
                {msg.sender === 'bot' && <div className="bot-avatar">{CLAPPER_SVG}</div>}
                <div className="msg-content">
                  <div className="msg" dangerouslySetInnerHTML={{ __html: msg.loading ? '<em>Đang suy nghĩ...</em>' : msg.text.replace(/\n/g, '<br>') }} />
                  {msg.time && (
                    <div className="msg-time">
                      {msg.time}
                      {msg.sender === 'user' && <span style={{ color: '#e50914' }}> ✔✔</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div id="moviebot-input-area">
            <div className="input-wrapper">
              <div className="input-icon">{CLAPPER_SVG}</div>
              <input
                type="text"
                id="moviebot-input"
                placeholder="Nhập câu hỏi của bạn..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage(input.trim())}
                autoComplete="off"
              />
            </div>
            <button id="moviebot-send" onClick={() => sendMessage(input.trim())}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="bot-footer">✨ Powered by <span className="highlight">CinemaVerse AI</span></div>
        </div>
      )}

      <button id="moviebot-btn" onClick={() => setOpen(!open)}>
        {CLAPPER_SVG}
      </button>
    </div>
  );
}
