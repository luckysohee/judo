import { useState, useEffect } from 'react';

export const useToastSettings = () => {
  const [toastEnabled, setToastEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  useEffect(() => {
    // 설정 불러오기
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('toast_settings');
        if (saved) {
          const settings = JSON.parse(saved);
          setToastEnabled(settings.toastEnabled !== false); // 기본값 true
          setLocationEnabled(settings.locationEnabled !== false); // 기본값 true
        }
      } catch (error) {
        console.log('설정 로드 실패:', error);
      }
    };

    loadSettings();
  }, []);

  const saveSettings = (newSettings) => {
    const settings = {
      toastEnabled: newSettings.toastEnabled !== false,
      locationEnabled: newSettings.locationEnabled !== false
    };
    
    try {
      localStorage.setItem('toast_settings', JSON.stringify(settings));
      setToastEnabled(settings.toastEnabled);
      setLocationEnabled(settings.locationEnabled);
    } catch (error) {
      console.log('설정 저장 실패:', error);
    }
  };

  const toggleToast = () => {
    saveSettings({
      toastEnabled: !toastEnabled,
      locationEnabled
    });
  };

  const toggleLocation = () => {
    saveSettings({
      toastEnabled,
      locationEnabled: !locationEnabled
    });
  };

  return {
    toastEnabled,
    locationEnabled,
    toggleToast,
    toggleLocation,
    saveSettings
  };
};
