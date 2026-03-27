import React, { useState, useEffect } from 'react';

const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getToastStyle = () => {
    const baseStyle = {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '16px 24px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '500',
      fontSize: '14px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 9999,
      minWidth: '250px',
      maxWidth: '350px',
      wordBreak: 'break-word',
      transform: 'translateX(0)',
      transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
      opacity: 1
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyle,
          backgroundColor: '#2ECC71',
          borderLeft: '4px solid #27AE60'
        };
      case 'error':
        return {
          ...baseStyle,
          backgroundColor: '#E74C3C',
          borderLeft: '4px solid #C0392B'
        };
      case 'info':
        return {
          ...baseStyle,
          backgroundColor: '#3498DB',
          borderLeft: '4px solid #2980B9'
        };
      case 'warning':
        return {
          ...baseStyle,
          backgroundColor: '#F39C12',
          borderLeft: '4px solid #E67E22'
        };
      default:
        return baseStyle;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      default:
        return '✅';
    }
  };

  return (
    <div style={getToastStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>{getIcon()}</span>
        <span>{message}</span>
      </div>
    </div>
  );
};

export default Toast;
