/**
 * Hook for AI operations with retry logic, cancellation, and debouncing
 */

import { useCallback, useRef, useState } from 'react';
import { getErrorAction, getErrorInfo, isRecoverableError } from '../constants/errorCatalog';
import { toast } from '../utils/toast';

interface UseAIWithRetryOptions {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface AIOperationState {
  isLoading: boolean;
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
}

export function useAIWithRetry(options: UseAIWithRetryOptions = {}) {
  const {
    debounceMs = 500,
    maxRetries = 3,
    retryDelayMs = 1000,
  } = options;

  const [state, setState] = useState<AIOperationState>({
    isLoading: false,
    error: null,
    isRetrying: false,
    retryCount: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const cancelOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearTimers();
    setState(prev => ({ ...prev, isLoading: false, isRetrying: false }));
  }, [clearTimers]);

  const executeWithRetry = useCallback(async <T>(
    operation: (signal: AbortSignal) => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    // Cancel any existing operation
    cancelOperation();

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        // Check if operation was cancelled
        if (abortController.signal.aborted) {
          throw new Error('Operation cancelled');
        }

        const result = await operation(abortController.signal);
        
        // Success
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          isRetrying: false, 
          retryCount: 0,
          error: null 
        }));

        onSuccess?.(result);
        return result;

      } catch (error: any) {
        lastError = error;

        // Don't retry if operation was cancelled
        if (error.message === 'Operation cancelled' || abortController.signal.aborted) {
          setState(prev => ({ ...prev, isLoading: false, isRetrying: false }));
          return null;
        }

        // Check if error is recoverable
        if (!isRecoverableError(error) || attempt >= maxRetries) {
          // Final failure
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            isRetrying: false, 
            error: lastError 
          }));

          onError?.(lastError);
          
          // Show error toast
          const errorInfo = getErrorInfo(lastError);
          toast.error(errorInfo.message);
          
          return null;
        }

        // Retry logic
        attempt++;
        setState(prev => ({ 
          ...prev, 
          isRetrying: true, 
          retryCount: attempt,
          error: lastError 
        }));

        // Show retry toast
        const errorInfo = getErrorInfo(lastError);
        const action = getErrorAction(lastError);
        toast.warning(`${errorInfo.message} (${attempt}/${maxRetries})`);

    // Wait before retry
    await new Promise<void>(resolve => {
      retryTimerRef.current = setTimeout(resolve, retryDelayMs * attempt) as any;
    });

        // Check if cancelled during retry delay
        if (abortController.signal.aborted) {
          setState(prev => ({ ...prev, isLoading: false, isRetrying: false }));
          return null;
        }
      }
    }

    return null;
  }, [maxRetries, retryDelayMs, cancelOperation]);

  const executeWithDebounce = useCallback(async <T>(
    operation: (signal: AbortSignal) => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<void> => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      executeWithRetry(operation, onSuccess, onError);
    }, debounceMs);
  }, [executeWithRetry, debounceMs]);

  return {
    ...state,
    executeWithRetry,
    executeWithDebounce,
    cancelOperation,
    isCancelled: abortControllerRef.current?.signal.aborted || false,
  };
}
