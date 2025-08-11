// Network utilities for handling connectivity and offline states

import NetInfo from '@react-native-community/netinfo';

/**
 * Wait for network to be online
 * @param timeoutMs Maximum time to wait in milliseconds
 * @returns Promise that resolves when online or times out
 */
export const waitForOnline = async (timeoutMs: number = 5000): Promise<boolean> => {
  console.time('[Network] Wait for Online');
  
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribe) unsubscribe();
      console.timeEnd('[Network] Wait for Online');
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      cleanup();
      console.warn('[Network] Wait for online timed out after', timeoutMs, 'ms');
      resolve(false); // Timeout
    }, timeoutMs);

    // Check current state first
    NetInfo.fetch().then((state) => {
      console.log('[Network] Current state:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type
      });

      if (state.isConnected && state.isInternetReachable !== false) {
        cleanup();
        resolve(true);
        return;
      }

      // If not online, listen for changes
      unsubscribe = NetInfo.addEventListener((state) => {
        console.log('[Network] State changed:', {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type
        });

        if (state.isConnected && state.isInternetReachable !== false) {
          cleanup();
          resolve(true);
        }
      });
    }).catch((error) => {
      console.error('[Network] Error checking network state:', error);
      cleanup();
      resolve(false);
    });
  });
};

/**
 * Get current network status
 */
export const getNetworkStatus = async () => {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isOnline: state.isConnected && state.isInternetReachable !== false
    };
  } catch (error) {
    console.error('[Network] Error getting network status:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      isOnline: false
    };
  }
};

/**
 * Log network status for debugging
 */
export const logNetworkStatus = async (context: string = '') => {
  const status = await getNetworkStatus();
  console.log(`[Network] ${context}:`, status);
  return status;
};
