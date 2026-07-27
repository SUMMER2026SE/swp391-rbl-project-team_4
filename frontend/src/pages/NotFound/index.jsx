import React from 'react';
import { Link } from 'react-router-dom';
import '../../assets/css/shared-layout.css';

const NotFoundPage = () => {
  return (
    <div style={{
      backgroundColor: '#0f1113',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '5%',
        width: '20px',
        background: 'repeating-linear-gradient(to bottom, #000, #000 10px, transparent 10px, transparent 20px)'
      }} />
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: '5%',
        width: '20px',
        background: 'repeating-linear-gradient(to bottom, #000, #000 10px, transparent 10px, transparent 20px)'
      }} />
      
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '40vw',
        height: '40vw',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(15,17,19,0) 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div style={{ zIndex: 1, textAlign: 'center' }}>
        <h1 style={{
          fontSize: '150px',
          margin: 0,
          color: '#e50914',
          textShadow: '0 0 20px rgba(229, 9, 20, 0.5)',
          fontFamily: 'Impact, sans-serif'
        }}>404</h1>
        <h2 style={{
          fontSize: '32px',
          margin: '20px 0 40px',
          fontWeight: 'normal'
        }}>Oops! Trang này không tồn tại.</h2>
        <Link to="/" style={{
          backgroundColor: '#e50914',
          color: 'white',
          padding: '15px 30px',
          textDecoration: 'none',
          borderRadius: '5px',
          fontSize: '18px',
          fontWeight: 'bold',
          transition: 'background-color 0.3s'
        }}>
          VỀ TRANG CHỦ
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
