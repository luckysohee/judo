import React from 'react';
import { motion } from 'framer-motion';

const CheckInConfirmModal = ({ 
  place, 
  userNickname, 
  onConfirm, 
  onCancel, 
  isOpen 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 max-w-sm mx-4 ring-1 ring-black/5"
      >
        {/* 헤더 */}
        <div className="text-center mb-4">
          <div className="text-3xl mb-2">🍶</div>
          <h3 className="text-lg font-bold text-gray-900">{place.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{place.address || '장소 정보'}</p>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-blue-500 text-xl">ℹ️</div>
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">한잔함 기록 안내</p>
              <p className="text-gray-600">
                기록 시 <span className="font-semibold text-blue-600">"{userNickname}"</span> 닉네임으로
              </p>
              <p className="text-gray-600">
                이 장소에 대한 한잔 흔적이 다른 사용자에게도 비슷하게 보일 수 있어요.
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg"
          >
            동의하고 한잔 남기기
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CheckInConfirmModal;
