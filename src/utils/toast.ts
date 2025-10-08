/**
 * Toast utility for non-blocking user feedback
 * Provides simple toast notifications without external dependencies
 */

export interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom' | 'center';
  type?: 'success' | 'error' | 'warning' | 'info';
}

export interface Toast {
  id: string;
  message: string;
  type: ToastOptions['type'];
  duration: number;
  timestamp: number;
}

class ToastManager {
  private toasts: Toast[] = [];
  private listeners: ((toasts: Toast[]) => void)[] = [];
  private nextId = 0;

  /**
   * Show a toast notification
   */
  show(message: string, options: ToastOptions = {}): string {
    const id = `toast-${this.nextId++}`;
    const toast: Toast = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration || 4000,
      timestamp: Date.now()
    };

    this.toasts.push(toast);
    this.notifyListeners();

    // Auto-remove after duration
    setTimeout(() => {
      this.remove(id);
    }, toast.duration);

    return id;
  }

  /**
   * Remove a toast by ID
   */
  remove(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  /**
   * Get current toasts
   */
  getToasts(): Toast[] {
    return [...this.toasts];
  }

  /**
   * Subscribe to toast changes
   */
  subscribe(listener: (toasts: Toast[]) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.toasts);
      } catch (error) {
        console.error('Toast listener error:', error);
      }
    });
  }
}

// Global toast manager instance
export const toastManager = new ToastManager();

// Convenience functions
export const toast = {
  success: (message: string, options?: Omit<ToastOptions, 'type'>) => 
    toastManager.show(message, { ...options, type: 'success' }),
  
  error: (message: string, options?: Omit<ToastOptions, 'type'>) => 
    toastManager.show(message, { ...options, type: 'error', duration: 6000 }),
  
  warning: (message: string, options?: Omit<ToastOptions, 'type'>) => 
    toastManager.show(message, { ...options, type: 'warning' }),
  
  info: (message: string, options?: Omit<ToastOptions, 'type'>) => 
    toastManager.show(message, { ...options, type: 'info' }),
  
  remove: (id: string) => toastManager.remove(id),
  clear: () => toastManager.clear()
};

/**
 * React hook for toast notifications
 */
export function useToast() {
  return {
    show: toastManager.show.bind(toastManager),
    remove: toastManager.remove.bind(toastManager),
    clear: toastManager.clear.bind(toastManager),
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info
  };
}
