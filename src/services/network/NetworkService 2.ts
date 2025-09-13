import NetInfo from '@react-native-community/netinfo';
import { flush, getQueueSize } from '../verification/OfflineQueue';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

class NetworkService {
  private listeners: Set<(state: NetworkState) => void> = new Set();
  private currentState: NetworkState = {
    isConnected: false,
    isInternetReachable: null,
    type: null
  };

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Get initial network state
    const initialState = await NetInfo.fetch();
    this.updateState(initialState);

    // Listen for network state changes
    NetInfo.addEventListener(state => {
      this.updateState(state);
    });
  }

  private updateState(state: any) {
    const newState: NetworkState = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type
    };

    const wasOffline = !this.currentState.isConnected;
    const isNowOnline = newState.isConnected;

    this.currentState = newState;

    // Notify listeners
    this.listeners.forEach(listener => listener(newState));

    // If we just came back online, flush the queue
    if (wasOffline && isNowOnline) {
      console.log('[NetworkService] Connection restored, flushing offline queue');
      this.flushOfflineQueue();
    }
  }

  private async flushOfflineQueue() {
    try {
      const queueSize = await getQueueSize();
      if (queueSize === 0) {
        console.log('[NetworkService] No offline queue to flush');
        return;
      }

      console.log(`[NetworkService] Flushing ${queueSize} queued verifications`);
      
      // Import the verification processor
      const { processQueuedVerification } = await import('../verificationService');
      
      // Flush the queue
      await flush(processQueuedVerification);
      
      console.log('[NetworkService] Offline queue flush completed');
    } catch (error) {
      console.error('[NetworkService] Failed to flush offline queue:', error);
    }
  }

  // Public methods
  getCurrentState(): NetworkState {
    return { ...this.currentState };
  }

  isOnline(): boolean {
    return this.currentState.isConnected;
  }

  addListener(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  async checkConnection(): Promise<NetworkState> {
    const state = await NetInfo.fetch();
    this.updateState(state);
    return this.currentState;
  }
}

// Export singleton instance
export const networkService = new NetworkService();
