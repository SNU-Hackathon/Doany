/**
 * Structured logging utilities for production debugging
 * PII-safe logging with feature flags for development
 */

import { Platform } from 'react-native';

// Feature flags
const VERBOSE_LOGS_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_VERBOSE_LOGS === 'true';
const PII_LOGGING_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_LOG_PII === 'true';

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

// Base log interface
interface BaseLogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// AI-specific log interfaces
export interface AIRequestLog extends BaseLogEntry {
  category: 'ai_request';
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs: number;
  success: boolean;
  schemaValid: boolean;
  promptLength: number;
  promptHash?: string;
  errorCode?: string;
}

export interface AIResponseLog extends BaseLogEntry {
  category: 'ai_response';
  model: string;
  durationMs: number;
  success: boolean;
  schemaValid: boolean;
  responseLength: number;
  responseHash?: string;
  errorCode?: string;
}

// User action log interfaces
export interface UserActionLog extends BaseLogEntry {
  category: 'user_action';
  action: string;
  context?: Record<string, any>;
  success?: boolean;
}

// Validation log interface
export interface ValidationLog extends BaseLogEntry {
  category: 'validation';
  validationType: string;
  passed: boolean;
  errorCount: number;
  errors?: string[];
}

// Storage log interface
export interface StorageLog extends BaseLogEntry {
  category: 'storage';
  operation: string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
  recordCount?: number;
}

// Union type for all log entries
export type LogEntry = AIRequestLog | AIResponseLog | UserActionLog | ValidationLog | StorageLog;

// Generate unique request ID
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Generate session ID
export const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Hash text for PII-safe logging
export const hashText = (text: string): string => {
  if (!text) return '';
  
  // Simple hash function for development
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

// Safe text logging (length + hash, no actual content)
export const safeTextLog = (text: string): { length: number; hash: string } => {
  return {
    length: text?.length || 0,
    hash: hashText(text || '')
  };
};

// Main logging function
export const logStructured = (entry: LogEntry): void => {
  if (!VERBOSE_LOGS_ENABLED && entry.level === LogLevel.DEBUG) {
    return;
  }

  // Add timestamp if not provided
  if (!entry.timestamp) {
    entry.timestamp = new Date().toISOString();
  }

  // Format log entry
  const logMessage = `[${entry.level.toUpperCase()}] ${entry.category}: ${entry.message}`;
  const logData = {
    ...entry,
    platform: Platform.OS,
    environment: __DEV__ ? 'development' : 'production',
  };

  // Console logging
  switch (entry.level) {
    case LogLevel.DEBUG:
      console.debug(logMessage, logData);
      break;
    case LogLevel.INFO:
      console.info(logMessage, logData);
      break;
    case LogLevel.WARN:
      console.warn(logMessage, logData);
      break;
    case LogLevel.ERROR:
      console.error(logMessage, logData);
      break;
  }

  // Send to monitoring service (Sentry, etc.)
  sendToMonitoring(logData);
};

// Send logs to monitoring service
const sendToMonitoring = (logData: LogEntry): void => {
  // In production, this would send to Sentry or other monitoring service
  if (!__DEV__) {
    // Example: Sentry.addBreadcrumb(logData);
    // Example: Analytics.track('structured_log', logData);
  }
};

// Convenience functions for common log types
export const logAIRequest = (data: Omit<AIRequestLog, 'timestamp' | 'level' | 'category'>): void => {
  logStructured({
    ...data,
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    category: 'ai_request',
  });
};

export const logAIResponse = (data: Omit<AIResponseLog, 'timestamp' | 'level' | 'category'>): void => {
  logStructured({
    ...data,
    timestamp: new Date().toISOString(),
    level: data.success ? LogLevel.INFO : LogLevel.ERROR,
    category: 'ai_response',
  });
};

export const logUserAction = (data: Omit<UserActionLog, 'timestamp' | 'level' | 'category'>): void => {
  logStructured({
    ...data,
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    category: 'user_action',
  });
};

export const logValidation = (data: Omit<ValidationLog, 'timestamp' | 'level' | 'category'>): void => {
  logStructured({
    ...data,
    timestamp: new Date().toISOString(),
    level: data.passed ? LogLevel.INFO : LogLevel.WARN,
    category: 'validation',
  });
};

export const logStorage = (data: Omit<StorageLog, 'timestamp' | 'level' | 'category'>): void => {
  logStructured({
    ...data,
    timestamp: new Date().toISOString(),
    level: data.success ? LogLevel.INFO : LogLevel.ERROR,
    category: 'storage',
  });
};

// Debug logging (only in development)
export const logDebug = (message: string, metadata?: Record<string, any>): void => {
  if (VERBOSE_LOGS_ENABLED) {
    logStructured({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      category: 'user_action', // Use user_action category for debug logs
      message,
      action: 'debug',
      metadata,
    } as UserActionLog);
  }
};

// PII-safe text logging
export const logTextSafely = (text: string, context: string): void => {
  if (PII_LOGGING_ENABLED) {
    logDebug(`Text content (PII enabled): ${context}`, { 
      text, 
      length: text.length,
      hash: hashText(text)
    });
  } else {
    logDebug(`Text content: ${context}`, safeTextLog(text));
  }
};

// Performance timing helper
export class PerformanceTimer {
  private startTime: number;
  private requestId: string;
  private context: string;

  constructor(context: string, requestId?: string) {
    this.context = context;
    this.requestId = requestId || generateRequestId();
    this.startTime = Date.now();
  }

  end(success: boolean, metadata?: Record<string, any>): number {
    const duration = Date.now() - this.startTime;
    
    logDebug(`Performance: ${this.context}`, {
      requestId: this.requestId,
      durationMs: duration,
      success,
      ...metadata,
    });

    return duration;
  }

  getRequestId(): string {
    return this.requestId;
  }
}

// Session management
class LoggingSession {
  private sessionId: string;
  private userId?: string;

  constructor(userId?: string) {
    this.sessionId = generateSessionId();
    this.userId = userId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getUserId(): string | undefined {
    return this.userId;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }
}

// Global session instance
export const loggingSession = new LoggingSession();

// Export session management
export const setLoggingUserId = (userId: string): void => {
  loggingSession.setUserId(userId);
};

export const getLoggingSessionId = (): string => {
  return loggingSession.getSessionId();
};
