import { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export function useProGate() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isPro = user?.plan !== 'free' && user?.plan != null;
  const [showUpgrade, setShowUpgrade] = useState(false);

  /**
   * Call before allowing access to a pro feature.
   * Returns true if the user is on Pro (proceed), false if blocked (upgrade modal opened).
   */
  const requirePro = (): boolean => {
    if (isPro) return true;
    setShowUpgrade(true);
    return false;
  };

  return {
    isPro,
    showUpgrade,
    closeUpgrade: () => setShowUpgrade(false),
    requirePro,
  };
}
