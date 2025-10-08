import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'verification_queue_v1';

export type QueuedAttempt = { 
  id: string; 
  payload: any; 
  createdAt: number;
  retryCount?: number;
  maxRetries?: number;
};

export async function enqueueAttempt(a: QueuedAttempt) {
  console.group(`[OfflineQueue] Enqueuing attempt ${a.id}`);
  console.time(`[OfflineQueue] Enqueue time for ${a.id}`);
  
  try {
    const raw = (await AsyncStorage.getItem(KEY)) ?? '[]';
    const arr = JSON.parse(raw) as QueuedAttempt[];
    arr.push(a);
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
    
    console.log(`[OfflineQueue] Successfully enqueued attempt ${a.id}`, {
      queueSize: arr.length,
      payload: {
        goalId: a.payload.goal?.id,
        signals: Object.keys(a.payload.rawSignals || {}),
        createdAt: new Date(a.createdAt).toISOString()
      }
    });
    
    console.timeEnd(`[OfflineQueue] Enqueue time for ${a.id}`);
    console.groupEnd();
  } catch (error) {
    console.error('[OfflineQueue] Failed to enqueue attempt:', error);
    console.timeEnd(`[OfflineQueue] Enqueue time for ${a.id}`);
    console.groupEnd();
    throw error;
  }
}

export async function peekAll(): Promise<QueuedAttempt[]> {
  try {
    const raw = (await AsyncStorage.getItem(KEY)) ?? '[]';
    return JSON.parse(raw);
  } catch (error) {
    console.error('[OfflineQueue] Failed to peek queue:', error);
    return [];
  }
}

export async function flush(processor: (a: QueuedAttempt) => Promise<void>) {
  console.group('[OfflineQueue] Flushing queued attempts');
  console.time('[OfflineQueue] Flush time');
  
  try {
    const arr = await peekAll();
    if (arr.length === 0) {
      console.log('[OfflineQueue] No queued attempts to flush');
      console.timeEnd('[OfflineQueue] Flush time');
      console.groupEnd();
      return;
    }

    console.log(`[OfflineQueue] Starting flush of ${arr.length} queued attempts`);
    const remain: QueuedAttempt[] = [];
    let successCount = 0;
    let retryCount = 0;
    let dropCount = 0;
    
    for (const a of arr) {
      console.log(`[OfflineQueue] Processing attempt ${a.id} (retry ${a.retryCount || 0}/${a.maxRetries || 3})`);
      
      try {
        await processor(a);
        successCount++;
        console.log(`[OfflineQueue] ✅ Successfully processed attempt ${a.id}`);
      } catch (error) {
        console.error(`[OfflineQueue] ❌ Failed to process attempt ${a.id}:`, error);
        
        // Increment retry count
        const newRetryCount = (a.retryCount ?? 0) + 1;
        const maxRetries = a.maxRetries ?? 3;
        
        if (newRetryCount < maxRetries) {
          retryCount++;
          console.log(`[OfflineQueue] 🔄 Retrying attempt ${a.id} (${newRetryCount}/${maxRetries})`);
          remain.push({ ...a, retryCount: newRetryCount });
        } else {
          dropCount++;
          console.error(`[OfflineQueue] 🗑️ Max retries exceeded for attempt ${a.id}, dropping`);
        }
      }
    }
    
    await AsyncStorage.setItem(KEY, JSON.stringify(remain));
    
    console.log(`[OfflineQueue] Flush complete:`, {
      total: arr.length,
      successful: successCount,
      retrying: retryCount,
      dropped: dropCount,
      remaining: remain.length
    });
    
    console.timeEnd('[OfflineQueue] Flush time');
    console.groupEnd();
  } catch (error) {
    console.error('[OfflineQueue] Failed to flush queue:', error);
    console.timeEnd('[OfflineQueue] Flush time');
    console.groupEnd();
  }
}

export async function clearQueue() {
  try {
    await AsyncStorage.removeItem(KEY);
    console.log('[OfflineQueue] Queue cleared');
  } catch (error) {
    console.error('[OfflineQueue] Failed to clear queue:', error);
  }
}

export async function getQueueSize(): Promise<number> {
  const arr = await peekAll();
  return arr.length;
}

// Utility to create a queued attempt
export function createQueuedAttempt(
  id: string, 
  payload: any, 
  maxRetries: number = 3
): QueuedAttempt {
  return {
    id,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries
  };
}
