import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [hasShownOfflineAlert, setHasShownOfflineAlert] = useState(false);

  useEffect(() => {
    // Simple offline detection based on Firebase errors
    // This is a basic implementation - in a production app you'd use NetInfo
    const checkNetworkStatus = () => {
      // Reset offline alert flag when app becomes active
      setHasShownOfflineAlert(false);
    };

    checkNetworkStatus();
  }, []);

  const handleOfflineError = (error: any) => {
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      setIsOffline(true);
      
      if (!hasShownOfflineAlert) {
        Alert.alert(
          'Connection Issue',
          'You appear to be offline. Some features may not work until you reconnect to the internet.',
          [{ text: 'OK', onPress: () => setHasShownOfflineAlert(true) }]
        );
      }
      
      return true; // Indicates this was an offline error
    }
    
    return false; // Not an offline error
  };

  const setOnline = () => {
    setIsOffline(false);
    setHasShownOfflineAlert(false);
  };

  return {
    isOffline,
    handleOfflineError,
    setOnline
  };
}
