import React, { useState } from 'react';
import { ticketApi } from '../../services/api';
import '../../assets/css/shared-layout.css';

const VerifyTicketPage = () => {
  const [ticketCode, setTicketCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!ticketCode.trim()) {
      setError('Vui lòng nhập mã vé');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const response = await ticketApi.verify(ticketCode);
      setResult(response.data);
    } catch (err) {
      setError('Mã vé không hợp lệ hoặc không tồn tại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-ticket-page" style={{ padding: '40px 20px', minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="verify-container" style={{ width: '100%', maxWidth: '600px' }}>
        <div className="verify-card" style={{ background: '#1a1d20', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
          <h2 style={{ textAlign: 'center', color: '#e50914', marginBottom: '30px' }}>Xác Thực Vé</h2>
          
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="scanner-section">
              <label htmlFor="ticketCode" style={{ display: 'block', marginBottom: '10px', color: 'white' }}>Nhập mã vé hoặc quét QR:</label>
              <input
                id="ticketCode"
                type="text"
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value)}
                placeholder="Nhập mã vé..."
                style={{ width: '100%', padding: '15px', borderRadius: '5px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '16px' }}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '15px', borderRadius: '5px', background: '#e50914', color: 'white', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Đang xác thực...' : 'Xác Thực'}
            </button>
          </form>

          {error && (
            <div className="verify-result result-invalid" style={{ marginTop: '20px', padding: '15px', background: 'rgba(229, 9, 20, 0.1)', border: '1px solid #e50914', borderRadius: '5px', color: '#e50914', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {result && (
            <div className="verify-result result-valid" style={{ marginTop: '20px', padding: '20px', background: 'rgba(40, 167, 69, 0.1)', border: '1px solid #28a745', borderRadius: '5px', color: 'white' }}>
              <h3 style={{ color: '#28a745', textAlign: 'center', marginBottom: '15px' }}>Vé Hợp Lệ</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p><strong>Phim:</strong> {result.movieName}</p>
                <p><strong>Suất chiếu:</strong> {result.showtime}</p>
                <p><strong>Ghế:</strong> {result.seat}</p>
                <p><strong>Khách hàng:</strong> {result.customerName}</p>
                <p><strong>Trạng thái:</strong> {result.status}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyTicketPage;
