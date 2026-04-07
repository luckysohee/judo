import { useState } from 'react';

export const useLoginRequired = () => {
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [requiredFeature, setRequiredFeature] = useState('');

  const requireLogin = (feature) => {
    setRequiredFeature(feature);
    setShowLoginPrompt(true);
  };

  const closeLoginPrompt = () => {
    setShowLoginPrompt(false);
    setRequiredFeature('');
  };

  return {
    showLoginPrompt,
    requiredFeature,
    requireLogin,
    closeLoginPrompt
  };
};
