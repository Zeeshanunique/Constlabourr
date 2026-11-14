import { useState, useEffect } from 'react';
import { networkService } from '../services/network';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(networkService.isOnline);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const unsubscribe = networkService.subscribe((online) => {
      setIsOnline(online);
    });
    return unsubscribe;
  }, []);

  const refreshConnectivity = async () => {
    setIsChecking(true);
    const reachable = await networkService.checkReachability();
    setIsChecking(false);
    return reachable;
  };

  return {
    isOnline,
    isChecking,
    refreshConnectivity,
  };
}
