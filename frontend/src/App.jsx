import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/layout/Layout';

// Pages
import HomePage from './pages/Home';
import MoviesPage from './pages/Movies';
import MovieDetailPage from './pages/MovieDetail';
import AuthPage from './pages/Auth';
import ForgotPasswordPage from './pages/ForgotPassword';
import BookingPage from './pages/Booking';
import SeatsPage from './pages/Seats';
import ConcessionsPage from './pages/Concessions';
import CheckoutPage from './pages/Checkout';
import PaymentSuccessPage from './pages/PaymentSuccess';
import ProfilePage from './pages/Profile';
import AdminPage from './pages/Admin';
import PromotionsPage from './pages/Promotions';
import PromotionDetailPage from './pages/PromotionDetail';
import NewsPage from './pages/News';
import TicketPricesPage from './pages/TicketPrices';
import VerifyTicketPage from './pages/VerifyTicket';
import RefundRequestPage from './pages/RefundRequest';
import NotFoundPage from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            {/* Public pages with navbar + footer */}
            <Route path="/" element={<Layout><HomePage /></Layout>} />
            <Route path="/movies" element={<Layout><MoviesPage /></Layout>} />
            <Route path="/movies/:id" element={<Layout><MovieDetailPage /></Layout>} />
            <Route path="/promotions" element={<Layout><PromotionsPage /></Layout>} />
            <Route path="/promotions/:id" element={<Layout><PromotionDetailPage /></Layout>} />
            <Route path="/news" element={<Layout><NewsPage /></Layout>} />
            <Route path="/ticket-prices" element={<Layout><TicketPricesPage /></Layout>} />
            <Route path="/verify-ticket" element={<Layout><VerifyTicketPage /></Layout>} />

            {/* Auth pages - no footer needed */}
            <Route path="/auth" element={<Layout noFooter><AuthPage /></Layout>} />
            <Route path="/forgot-password" element={<Layout noFooter><ForgotPasswordPage /></Layout>} />

            {/* Booking flow - no footer */}
            <Route path="/booking" element={<Layout noFooter><BookingPage /></Layout>} />
            <Route path="/booking/seats" element={<Layout noFooter><SeatsPage /></Layout>} />
            <Route path="/booking/concessions" element={<Layout noFooter><ConcessionsPage /></Layout>} />
            <Route path="/booking/checkout" element={<Layout noFooter><CheckoutPage /></Layout>} />
            <Route path="/booking/success" element={<Layout noFooter><PaymentSuccessPage /></Layout>} />

            {/* User account */}
            <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
            <Route path="/refund-request" element={<Layout><RefundRequestPage /></Layout>} />

            {/* Admin - no layout wrapper, handles own */}
            <Route path="/admin/*" element={<AdminPage />} />

            {/* 404 */}
            <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
