import React, { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import Toast from "./Toast";
import { TOAST_LAYER_Z_INDEX } from "../../constants/toastLayer.js";

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    // 자동으로 제거
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showToast = (message, type = 'success', duration = 3000) => {
    addToast(message, type, duration);
  };

  const toastLayer =
    typeof document !== "undefined"
      ? createPortal(
          <div
            id="judo-app-toast-layer"
            aria-live="polite"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: TOAST_LAYER_Z_INDEX,
              pointerEvents: "none",
            }}
          >
            {toasts.map((toast, index) => (
              <Toast
                key={toast.id}
                stackIndex={index}
                message={toast.message}
                type={toast.type}
                duration={toast.duration}
                onClose={() => removeToast(toast.id)}
              />
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <ToastContext.Provider value={{ showToast, addToast, removeToast }}>
      {children}
      {toastLayer}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
