import React from 'react';
import { useToastSettings } from '../../hooks/useToastSettings';

const ToastSettings = () => {
  const { toastEnabled, locationEnabled, toggleToast, toggleLocation } = useToastSettings();

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 ring-1 ring-black/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="text-2xl">🔔</div>
        <h3 className="text-lg font-bold text-gray-900">알림 설정</h3>
      </div>

      <div className="space-y-4">
        {/* 주변 체크인 알림 */}
        <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="text-xl">📍</div>
            <div>
              <div className="font-medium text-gray-900">주변 체크인 알림</div>
              <div className="text-sm text-gray-600">내 위치 3km 내 체크인 알림</div>
            </div>
          </div>
          <button
            onClick={toggleLocation}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              locationEnabled ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                locationEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 전국 체크인 알림 */}
        <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="text-xl">🌍</div>
            <div>
              <div className="font-medium text-gray-900">전국 체크인 알림</div>
              <div className="text-sm text-gray-600">모든 지역 체크인 알림</div>
            </div>
          </div>
          <button
            onClick={toggleToast}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              toastEnabled ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                toastEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 체크인 알림 끄기 */}
        <div className="flex items-center justify-between p-4 bg-red-50/50 rounded-xl border border-red-200/50">
          <div className="flex items-center gap-3">
            <div className="text-xl">🔕</div>
            <div>
              <div className="font-medium text-gray-900">체크인 알림 끄기</div>
              <div className="text-sm text-gray-600">모든 체크인 알림 비활성화</div>
            </div>
          </div>
          <button
            onClick={() => {
              toggleToast();
              toggleLocation();
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              !toastEnabled && !locationEnabled ? 'bg-red-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                !toastEnabled && !locationEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 현재 상태 안내 */}
      <div className="mt-6 p-3 bg-blue-50/30 rounded-lg border border-blue-200/30">
        <div className="text-xs text-blue-700">
          <div className="font-medium mb-1">현재 상태:</div>
          <div>
            {toastEnabled && locationEnabled ? '🟢 모든 체크인 알림 활성화' :
             !toastEnabled && !locationEnabled ? '🔴 모든 체크인 알림 비활성화' :
             locationEnabled ? '🔵 주변 체크인만 알림' : '🟡 전국 체크인만 알림'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToastSettings;
