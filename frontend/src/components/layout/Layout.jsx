import Navbar from './Navbar';
import Footer from './Footer';
import Chatbot from '../common/Chatbot';

export default function Layout({ children, noFooter = false, noNavbar = false }) {
  return (
    <>
      {!noNavbar && <Navbar />}
      <main>{children}</main>
      {!noFooter && <Footer />}
      <Chatbot />
    </>
  );
}
