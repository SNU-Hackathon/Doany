/**
 * Centralized error catalog for user-friendly error messages
 * Maps technical error codes to Korean user messages
 */

export interface ErrorInfo {
  message: string;
  recoverable: boolean;
  action?: string;
  category: 'network' | 'validation' | 'auth' | 'storage' | 'ai' | 'security' | 'unknown';
}

export const ERROR_CATALOG: Record<string, ErrorInfo> = {
  // Network errors
  'NETWORK_ERROR': {
    message: '네트워크 연결을 확인해주세요',
    recoverable: true,
    action: '다시 시도',
    category: 'network'
  },
  'TIMEOUT': {
    message: '요청 시간이 초과되었습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'network'
  },
  'OFFLINE': {
    message: '인터넷 연결이 필요합니다',
    recoverable: true,
    action: '연결 확인 후 다시 시도',
    category: 'network'
  },

  // AI service errors
  'AI_PARSE_ERROR': {
    message: 'AI 응답 형식 오류: 다시 시도해주세요',
    recoverable: true,
    action: '다시 생성',
    category: 'ai'
  },
  'AI_QUEST_GENERATION_ERROR': {
    message: '퀀스트 생성 중 오류가 발생했습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'ai'
  },
  'AI_VALIDATION_ERROR': {
    message: '목표 형식이 올바르지 않습니다',
    recoverable: true,
    action: '목표를 다시 작성',
    category: 'ai'
  },
  'AI_TOKEN_LIMIT': {
    message: '목표가 너무 길어요. 더 간단히 적어보세요',
    recoverable: true,
    action: '목표 간소화',
    category: 'ai'
  },
  'AI_RATE_LIMIT': {
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
    recoverable: true,
    action: '잠시 후 재시도',
    category: 'ai'
  },
  'AI_SERVICE_UNAVAILABLE': {
    message: 'AI 서비스가 일시적으로 사용할 수 없습니다',
    recoverable: true,
    action: '잠시 후 다시 시도',
    category: 'ai'
  },
  'AI_SECURITY_VIOLATION': {
    message: '보안 정책 위반이 감지되었습니다',
    recoverable: false,
    action: '목표 내용을 다시 작성해주세요',
    category: 'security'
  },

  // Storage errors
  'STORAGE_PERMISSION_DENIED': {
    message: '권한이 없습니다. 다시 로그인해주세요',
    recoverable: true,
    action: '다시 로그인',
    category: 'storage'
  },
  'STORAGE_UNAVAILABLE': {
    message: '저장소를 사용할 수 없습니다. 인터넷 연결을 확인해주세요',
    recoverable: true,
    action: '연결 확인',
    category: 'storage'
  },
  'STORAGE_QUOTA_EXCEEDED': {
    message: '저장 공간이 부족합니다',
    recoverable: false,
    category: 'storage'
  },

  // Quest management errors
  'QUEST_GENERATION_ERROR': {
    message: '퀀스트 생성 중 오류가 발생했습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'ai'
  },
  'QUEST_SAVE_ERROR': {
    message: '퀀스트 저장에 실패했습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'storage'
  },
  'QUEST_FETCH_ERROR': {
    message: '퀀스트를 불러올 수 없습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'storage'
  },
  'QUEST_UPDATE_ERROR': {
    message: '퀀스트 업데이트에 실패했습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'storage'
  },
  'QUEST_DELETE_ERROR': {
    message: '퀀스트 삭제에 실패했습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'storage'
  },
  'QUEST_STATS_ERROR': {
    message: '퀀스트 통계를 불러올 수 없습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'storage'
  },

  // Authentication errors
  'AUTH_INVALID_CREDENTIALS': {
    message: '이메일 또는 비밀번호가 올바르지 않습니다',
    recoverable: true,
    action: '다시 입력',
    category: 'auth'
  },
  'AUTH_USER_NOT_FOUND': {
    message: '등록되지 않은 사용자입니다',
    recoverable: true,
    action: '회원가입',
    category: 'auth'
  },
  'AUTH_WEAK_PASSWORD': {
    message: '비밀번호가 너무 약합니다',
    recoverable: true,
    action: '더 강한 비밀번호 사용',
    category: 'auth'
  },

  // Validation errors
  'VALIDATION_REQUIRED_FIELD': {
    message: '필수 항목을 입력해주세요',
    recoverable: true,
    action: '항목 완성',
    category: 'validation'
  },
  'VALIDATION_INVALID_FORMAT': {
    message: '입력 형식이 올바르지 않습니다',
    recoverable: true,
    action: '형식 수정',
    category: 'validation'
  },
  'VALIDATION_DATE_FORMAT': {
    message: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)',
    recoverable: true,
    action: '날짜 형식 수정',
    category: 'validation'
  },

  // Generic errors
  'UNKNOWN_ERROR': {
    message: '알 수 없는 오류가 발생했습니다',
    recoverable: true,
    action: '다시 시도',
    category: 'unknown'
  }
};

/**
 * Error code mapping from technical errors to catalog keys
 */
export const ERROR_CODE_MAPPING: Record<string, string> = {
  // Network errors
  'Network request failed': 'NETWORK_ERROR',
  'AbortError': 'TIMEOUT',
  'TypeError: Network request failed': 'NETWORK_ERROR',
  'fetch failed': 'NETWORK_ERROR',

  // Firebase errors
  'permission-denied': 'STORAGE_PERMISSION_DENIED',
  'unavailable': 'STORAGE_UNAVAILABLE',
  'resource-exhausted': 'STORAGE_QUOTA_EXCEEDED',

  // OpenAI API errors
  'insufficient_quota': 'AI_RATE_LIMIT',
  'rate_limit_exceeded': 'AI_RATE_LIMIT',
  'context_length_exceeded': 'AI_TOKEN_LIMIT',
  'service_unavailable': 'AI_SERVICE_UNAVAILABLE',

  // HTTP status codes
  '429': 'AI_RATE_LIMIT',
  '500': 'AI_SERVICE_UNAVAILABLE',
  '502': 'AI_SERVICE_UNAVAILABLE',
  '503': 'AI_SERVICE_UNAVAILABLE',
  '504': 'TIMEOUT',
};

/**
 * Get user-friendly error information from error object
 */
export function getErrorInfo(error: any): ErrorInfo {
  // Check if error has a specific catalog key
  if (error?.catalogKey && ERROR_CATALOG[error.catalogKey]) {
    return ERROR_CATALOG[error.catalogKey];
  }

  // Map error message to catalog key
  const errorMessage = error?.message || error?.toString() || '';
  const catalogKey = ERROR_CODE_MAPPING[errorMessage] || 
                    ERROR_CODE_MAPPING[error?.code] || 
                    ERROR_CODE_MAPPING[error?.status?.toString()];

  if (catalogKey && ERROR_CATALOG[catalogKey]) {
    return ERROR_CATALOG[catalogKey];
  }

  // Check for partial matches in error messages
  for (const [key, mappedKey] of Object.entries(ERROR_CODE_MAPPING)) {
    if (errorMessage.includes(key)) {
      return ERROR_CATALOG[mappedKey];
    }
  }

  // Default to unknown error
  return ERROR_CATALOG.UNKNOWN_ERROR;
}

/**
 * Create an error with catalog information
 */
export function createCatalogError(catalogKey: string, originalError?: any): Error {
  console.log('[createCatalogError] Creating error for catalog key:', catalogKey);
  console.log('[createCatalogError] Available keys:', Object.keys(ERROR_CATALOG));
  
  const errorInfo = ERROR_CATALOG[catalogKey];
  if (!errorInfo) {
    console.error('[createCatalogError] Unknown catalog key:', catalogKey);
    console.error('[createCatalogError] Available keys:', Object.keys(ERROR_CATALOG));
    // Return a fallback error instead of throwing
    const fallbackError = new Error(`Unknown error: ${catalogKey}`);
    (fallbackError as any).catalogKey = catalogKey;
    (fallbackError as any).errorInfo = ERROR_CATALOG.UNKNOWN_ERROR;
    (fallbackError as any).originalError = originalError;
    return fallbackError;
  }

  const error = new Error(errorInfo.message);
  (error as any).catalogKey = catalogKey;
  (error as any).errorInfo = errorInfo;
  (error as any).originalError = originalError;
  return error;
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: any): boolean {
  const errorInfo = getErrorInfo(error);
  return errorInfo.recoverable;
}

/**
 * Get suggested action for an error
 */
export function getErrorAction(error: any): string | undefined {
  const errorInfo = getErrorInfo(error);
  return errorInfo.action;
}
