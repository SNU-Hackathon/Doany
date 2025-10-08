/**
 * Hook for preventing bursty AI calls and duplicate requests
 */

import { useCallback, useRef, useState } from 'react';
import { logUserAction } from '../utils/structuredLogging';

interface UseBurstyCallPreventionOptions {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface RequestState {
  isInFlight: boolean;
  abortController: AbortController | null;
  requestId: string | null;
  retryCount: number;
}

interface UseBurstyCallPreventionReturn {
  isInFlight: boolean;
  executeRequest: <T>(
    requestFn: (signal: AbortSignal, requestId: string) => Promise<T>,
    context?: Record<string, any>
  ) => Promise<T | null>;
  cancelCurrentRequest: () => void;
  debouncedExecute: <T>(
    requestFn: (signal: AbortSignal, requestId: string) => Promise<T>,
    context?: Record<string, any>
  ) => void;
  clearDebounce: () => void;
}

export const useBurstyCallPrevention = (
  options: UseBurstyCallPreventionOptions = {}
): UseBurstyCallPreventionReturn => {
  const {
    debounceMs = 600, // 600ms debounce
    maxRetries = 3,
    retryDelayMs = 1000
  } = options;

  const [requestState, setRequestState] = useState<RequestState>({
    isInFlight: false,
    abortController: null,
    requestId: null,
    retryCount: 0
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestTimeRef = useRef<number>(0);
  const duplicateRequestCountRef = useRef<number>(0);

  // Generate unique request ID
  const generateRequestId = useCallback((): string => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Cancel current request
  const cancelCurrentRequest = useCallback(() => {
    if (requestState.abortController) {
      console.log('[BurstyCallPrevention] Cancelling current request');
      requestState.abortController.abort();
    }
    
    setRequestState(prev => ({
      ...prev,
      isInFlight: false,
      abortController: null,
      requestId: null,
      retryCount: 0
    }));
  }, [requestState.abortController]);

  // Clear debounce timeout
  const clearDebounce = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  // Execute request with bursty call prevention
  const executeRequest = useCallback(async <T>(
    requestFn: (signal: AbortSignal, requestId: string) => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T | null> => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    
    // Detect rapid successive requests (bursty calls)
    if (timeSinceLastRequest < 1000) { // Less than 1 second
      duplicateRequestCountRef.current++;
      console.warn('[BurstyCallPrevention] Rapid successive request detected', {
        timeSinceLastRequest,
        duplicateCount: duplicateRequestCountRef.current,
        context
      });
      
      // Log duplicate request attempt
      logUserAction({
        action: 'duplicate_request_blocked',
        message: 'Rapid successive request blocked',
        context: {
          timeSinceLastRequest,
          duplicateCount: duplicateRequestCountRef.current,
          ...context
        }
      });
      
      // If already in flight, cancel previous request
      if (requestState.isInFlight) {
        cancelCurrentRequest();
      }
    } else {
      duplicateRequestCountRef.current = 0; // Reset counter
    }

    lastRequestTimeRef.current = now;

    // If already in flight, abort previous request
    if (requestState.isInFlight) {
      console.log('[BurstyCallPrevention] Aborting previous request');
      cancelCurrentRequest();
    }

    // Create new abort controller
    const abortController = new AbortController();
    const requestId = generateRequestId();

    setRequestState({
      isInFlight: true,
      abortController,
      requestId,
      retryCount: 0
    });

    try {
      console.log('[BurstyCallPrevention] Starting request', { requestId, context });
      
      // Log request start
      logUserAction({
        action: 'ai_request_started',
        message: 'AI request started with bursty call prevention',
        context: {
          requestId,
          isRetry: requestState.retryCount > 0,
          ...context
        }
      });

      const result = await requestFn(abortController.signal, requestId);
      
      // Log successful completion
      logUserAction({
        action: 'ai_request_completed',
        message: 'AI request completed successfully',
        context: {
          requestId,
          durationMs: Date.now() - now,
          ...context
        }
      });

      setRequestState(prev => ({
        ...prev,
        isInFlight: false,
        abortController: null,
        requestId: null,
        retryCount: 0
      }));

      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[BurstyCallPrevention] Request aborted', { requestId });
        
        // Log request abort
        logUserAction({
          action: 'ai_request_aborted',
          message: 'AI request was aborted',
          context: {
            requestId,
            reason: 'user_action',
            ...context
          }
        });
        
        return null;
      }

      console.error('[BurstyCallPrevention] Request failed', { requestId, error });
      
      // Log request failure
      logUserAction({
        action: 'ai_request_failed',
        message: 'AI request failed',
        context: {
          requestId,
          error: error.message,
          retryCount: requestState.retryCount,
          ...context
        }
      });

      // Handle retry logic
      if (requestState.retryCount < maxRetries) {
        const retryCount = requestState.retryCount + 1;
        console.log('[BurstyCallPrevention] Retrying request', { requestId, retryCount });
        
        setRequestState(prev => ({
          ...prev,
          retryCount,
          isInFlight: false,
          abortController: null,
          requestId: null
        }));

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * retryCount));
        
        // Recursive retry
        return executeRequest(requestFn, { ...context, isRetry: true, retryCount });
      }

      setRequestState(prev => ({
        ...prev,
        isInFlight: false,
        abortController: null,
        requestId: null,
        retryCount: 0
      }));

      throw error;
    }
  }, [requestState.isInFlight, requestState.retryCount, generateRequestId, cancelCurrentRequest, maxRetries, retryDelayMs]);

  // Debounced execute function
  const debouncedExecute = useCallback(<T>(
    requestFn: (signal: AbortSignal, requestId: string) => Promise<T>,
    context: Record<string, any> = {}
  ) => {
    // Clear existing timeout
    clearDebounce();
    
    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      executeRequest(requestFn, context);
    }, debounceMs);
    
    console.log('[BurstyCallPrevention] Debounced request scheduled', { debounceMs, context });
  }, [executeRequest, clearDebounce, debounceMs]);

  return {
    isInFlight: requestState.isInFlight,
    executeRequest,
    cancelCurrentRequest,
    debouncedExecute,
    clearDebounce
  };
};

/**
 * Hook for input debouncing specifically
 */
export const useInputDebounce = (
  callback: (value: string) => void,
  delayMs: number = 500
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<string>('');

  const debouncedCallback = useCallback((value: string) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only process if value actually changed
    if (value === lastValueRef.current) {
      return;
    }

    lastValueRef.current = value;

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      callback(value);
    }, delayMs);
  }, [callback, delayMs]);

  const clearDebounce = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    debouncedCallback,
    clearDebounce
  };
};

/**
 * Telemetry for tracking duplicate request patterns
 */
export const useDuplicateRequestTelemetry = () => {
  const requestHistoryRef = useRef<Array<{
    timestamp: number;
    requestId: string;
    duration: number;
    success: boolean;
  }>>([]);

  const recordRequest = useCallback((
    requestId: string,
    duration: number,
    success: boolean
  ) => {
    const now = Date.now();
    requestHistoryRef.current.push({
      timestamp: now,
      requestId,
      duration,
      success
    });

    // Keep only last 100 requests
    if (requestHistoryRef.current.length > 100) {
      requestHistoryRef.current = requestHistoryRef.current.slice(-100);
    }
  }, []);

  const getDuplicateRate = useCallback(() => {
    const history = requestHistoryRef.current;
    const now = Date.now();
    const lastMinute = history.filter(req => now - req.timestamp < 60000);
    
    if (lastMinute.length < 2) return 0;
    
    // Calculate requests per second
    const requestsPerSecond = lastMinute.length / 60;
    
    // Consider > 0.5 requests per second as potential duplicates
    const duplicateRate = Math.max(0, requestsPerSecond - 0.5);
    
    return duplicateRate;
  }, []);

  const getMetrics = useCallback(() => {
    const history = requestHistoryRef.current;
    const now = Date.now();
    const lastMinute = history.filter(req => now - req.timestamp < 60000);
    
    const successRate = lastMinute.length > 0 
      ? lastMinute.filter(req => req.success).length / lastMinute.length 
      : 1;
    
    const avgDuration = lastMinute.length > 0
      ? lastMinute.reduce((sum, req) => sum + req.duration, 0) / lastMinute.length
      : 0;
    
    return {
      totalRequests: history.length,
      requestsLastMinute: lastMinute.length,
      duplicateRate: getDuplicateRate(),
      successRate,
      avgDuration
    };
  }, [getDuplicateRate]);

  return {
    recordRequest,
    getDuplicateRate,
    getMetrics
  };
};
