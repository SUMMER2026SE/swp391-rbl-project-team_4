import React from 'react';
import '../../assets/css/ticket-prices.css';

const TicketPricesPage = () => {
  return (
    <div className="ticket-prices-page">
      <div className="hero-section">
        <h1>GIÁ VÉ - TICKET PRICES</h1>
      </div>

      <div className="ticket-container">
        <section className="price-section">
          <h2>Bảng Giá Vé Cơ Bản</h2>
          <table className="ticket-table">
            <thead>
              <tr>
                <th>Loại Ghế / Phòng chiếu</th>
                <th>Thứ 2 - Thứ 5</th>
                <th>Thứ 6 - CN & Ngày Lễ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Standard (2D)</td>
                <td>85,000đ</td>
                <td>100,000đ</td>
              </tr>
              <tr>
                <td>VIP</td>
                <td>105,000đ</td>
                <td>120,000đ</td>
              </tr>
              <tr>
                <td>IMAX</td>
                <td>130,000đ</td>
                <td>150,000đ</td>
              </tr>
              <tr>
                <td>4DX</td>
                <td>150,000đ</td>
                <td>170,000đ</td>
              </tr>
            </tbody>
          </table>
          
          <div className="note-section">
            <p><strong>Lưu ý:</strong></p>
            <ul>
              <li>Trẻ em dưới 1m3: Giảm 20% giá vé tiêu chuẩn.</li>
              <li>Học sinh, sinh viên và người cao tuổi (trên 60 tuổi): Giảm 10% khi xuất trình giấy tờ.</li>
              <li>Phụ thu 10,000đ cho các phim Blockbuster (Phim bom tấn).</li>
            </ul>
          </div>
        </section>

        <section className="combo-section">
          <h2>Các Gói Combo Đặc Biệt</h2>
          <div className="combo-grid">
            <div className="price-card combo-card">
              <h3>Combo Đôi</h3>
              <p className="combo-desc">2 Vé xem phim + 1 Bắp lớn + 2 Nước ngọt</p>
              <div className="combo-price">250,000đ</div>
            </div>
            <div className="price-card combo-card">
              <h3>Combo Gia Đình</h3>
              <p className="combo-desc">4 Vé xem phim + 2 Bắp lớn + 4 Nước ngọt</p>
              <div className="combo-price">480,000đ</div>
            </div>
            <div className="price-card combo-card">
              <h3>Combo Sinh Viên</h3>
              <p className="combo-desc">1 Vé xem phim + 1 Bắp vừa + 1 Nước</p>
              <div className="combo-price">110,000đ</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TicketPricesPage;
