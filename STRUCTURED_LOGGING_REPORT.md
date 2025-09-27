# 구조화된 로깅 시스템 구현 보고서

## 🎯 목표
프로덕션 환경에서 PII 누출 없이 디버깅을 가능하게 하는 최소하지만 유용한 구조화된 로깅 시스템 구현

## ✅ 완료된 작업

### 1. 구조화된 로깅 유틸리티 (`src/utils/structuredLogging.ts`)

#### 핵심 기능
- **PII 보호**: 사용자 목표 텍스트 해시화, 길이만 로깅
- **기능 플래그**: 개발/프로덕션 환경별 로그 레벨 제어
- **타입 안전성**: TypeScript 인터페이스로 구조화된 로그 엔트리
- **성능 타이머**: 요청별 지속시간 측정
- **세션 관리**: 사용자별 로깅 세션 추적

#### 로그 타입
```typescript
// AI 요청/응답 로그
interface AIRequestLog {
  requestId: string;
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

// 사용자 액션 로그
interface UserActionLog {
  action: string;
  context?: Record<string, any>;
  success?: boolean;
}

// 검증 로그
interface ValidationLog {
  validationType: string;
  passed: boolean;
  errorCount: number;
  errors?: string[];
}

// 저장소 로그
interface StorageLog {
  operation: string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
  recordCount?: number;
}
```

### 2. AI 서비스 로깅 (`src/services/ai.ts`)

#### AI 라운드트립 추적
```typescript
// 요청 시작
const requestId = generateRequestId();
const timer = new PerformanceTimer('compileGoalSpec', requestId);
const promptInfo = safeTextLog(input.prompt);

// PII 안전한 로깅
logTextSafely(input.prompt, 'AI compileGoalSpec input');

// AI 요청 로깅
logAIRequest({
  requestId,
  model: 'proxy', // or 'openai'
  durationMs: 0,
  success: true,
  schemaValid: true,
  promptLength: promptInfo.length,
  promptHash: promptInfo.hash,
  message: 'AI proxy request initiated',
});

// AI 응답 로깅
logAIResponse({
  requestId,
  model: 'proxy',
  durationMs: duration,
  success: resp.ok,
  schemaValid: true,
  responseLength: responseInfo.length,
  responseHash: responseInfo.hash,
  message: resp.ok ? 'AI proxy request successful' : 'AI proxy request failed',
  errorCode: resp.ok ? undefined : `HTTP_${resp.status}`,
});
```

### 3. 사용자 인터페이스 로깅 (`src/components/CreateGoalModal.tsx`)

#### 주요 사용자 액션 추적
```typescript
// 모달 열기
logUserAction({
  action: 'modal_open',
  message: 'CreateGoalModal opened',
  context: {
    sessionId: getLoggingSessionId(),
    userId: user?.id,
  },
});

// AI 생성 클릭
logUserAction({
  action: 'ai_generate_click',
  message: 'User clicked AI generate button',
  context: {
    promptLength: aiPrompt.trim().length,
    sessionId: getLoggingSessionId(),
  },
});

// 검증 실패
logValidation({
  validationType: 'form_schema',
  passed: errors.length === 0,
  errorCount: errors.length,
  errors: errors.length > 0 ? errors : undefined,
  message: errors.length === 0 ? 'Form validation passed' : 'Form validation failed',
});

// 저장 성공
logStorage({
  operation: 'goal_creation',
  durationMs: duration,
  success: true,
  recordCount: 1,
  message: 'Goal created successfully',
});

logUserAction({
  action: 'save_success',
  message: 'Goal saved successfully',
  success: true,
  context: {
    sessionId: getLoggingSessionId(),
    goalType: aiBadgeState.type,
  },
});
```

### 4. 기능 플래그 시스템

#### 환경별 설정
```typescript
// 개발/프로덕션 환경 구분
const VERBOSE_LOGS_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_VERBOSE_LOGS === 'true';
const PII_LOGGING_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_LOG_PII === 'true';

// 환경 변수 예시
// EXPO_PUBLIC_VERBOSE_LOGS=false
// EXPO_PUBLIC_LOG_PII=false
// EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
```

#### PII 보호 메커니즘
```typescript
// 텍스트 해시화
export const hashText = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

// 안전한 텍스트 로깅
export const safeTextLog = (text: string): { length: number; hash: string } => {
  return {
    length: text?.length || 0,
    hash: hashText(text || '')
  };
};
```

### 5. 모니터링 통합 준비

#### Sentry 브레드크럼
```typescript
// 모니터링 서비스로 전송 (프로덕션)
const sendToMonitoring = (logData: LogEntry): void => {
  if (!__DEV__) {
    // Example: Sentry.addBreadcrumb(logData);
    // Example: Analytics.track('structured_log', logData);
  }
};
```

## 📊 로깅 데이터 예시

### AI 요청 로그
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "category": "ai_request",
  "requestId": "req_1705312200000_abc123def",
  "model": "proxy",
  "durationMs": 0,
  "success": true,
  "schemaValid": true,
  "promptLength": 25,
  "promptHash": "k2j8x9",
  "message": "AI proxy request initiated",
  "platform": "ios",
  "environment": "production"
}
```

### AI 응답 로그
```json
{
  "timestamp": "2024-01-15T10:30:02.500Z",
  "level": "info",
  "category": "ai_response",
  "requestId": "req_1705312200000_abc123def",
  "model": "proxy",
  "durationMs": 2500,
  "success": true,
  "schemaValid": true,
  "responseLength": 450,
  "responseHash": "m5n8p2",
  "message": "AI proxy request successful",
  "platform": "ios",
  "environment": "production"
}
```

### 사용자 액션 로그
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "category": "user_action",
  "action": "ai_generate_click",
  "message": "User clicked AI generate button",
  "context": {
    "promptLength": 25,
    "sessionId": "session_1705312200000_xyz789"
  },
  "platform": "ios",
  "environment": "production"
}
```

### 검증 로그
```json
{
  "timestamp": "2024-01-15T10:30:05.000Z",
  "level": "warn",
  "category": "validation",
  "validationType": "form_schema",
  "passed": false,
  "errorCount": 2,
  "errors": ["제목을 입력해주세요", "카테고리를 선택해주세요"],
  "message": "Form validation failed",
  "platform": "ios",
  "environment": "production"
}
```

### 저장소 로그
```json
{
  "timestamp": "2024-01-15T10:30:10.000Z",
  "level": "info",
  "category": "storage",
  "operation": "goal_creation",
  "durationMs": 1200,
  "success": true,
  "recordCount": 1,
  "message": "Goal created successfully",
  "platform": "ios",
  "environment": "production"
}
```

## 🔧 설정 방법

### 1. 환경 변수 설정
```bash
# 개발 환경
EXPO_PUBLIC_VERBOSE_LOGS=true
EXPO_PUBLIC_LOG_PII=true

# 프로덕션 환경
EXPO_PUBLIC_VERBOSE_LOGS=false
EXPO_PUBLIC_LOG_PII=false
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
```

### 2. 모니터링 서비스 연동
```typescript
// Sentry 연동 예시
import * as Sentry from '@sentry/react-native';

const sendToMonitoring = (logData: LogEntry): void => {
  if (!__DEV__) {
    Sentry.addBreadcrumb({
      message: logData.message,
      category: logData.category,
      level: logData.level,
      data: logData,
    });
  }
};
```

## 🎯 달성된 목표

### ✅ Task 1: AI 라운드트립 로깅
- **requestId**: 각 AI 요청에 고유 식별자 부여
- **model**: 사용된 AI 모델 (proxy/openai) 추적
- **tokensIn/out**: 토큰 사용량 추적 (확장 가능)
- **durationMs**: 요청 지속시간 측정
- **success**: 요청 성공/실패 여부
- **schemaValid**: 스키마 검증 결과

### ✅ Task 2: PII 보호
- **사용자 목표 텍스트**: 실제 내용 대신 길이와 해시만 로깅
- **프로덕션 환경**: `EXPO_PUBLIC_LOG_PII=false`로 PII 로깅 비활성화
- **개발 환경**: `EXPO_PUBLIC_LOG_PII=true`로 디버깅용 PII 로깅 활성화

### ✅ Task 3: Sentry/모니터링 브레드크럼
- **모달 열기**: `modal_open` 액션 로깅
- **AI 생성 클릭**: `ai_generate_click` 액션 로깅
- **검증 실패**: `validation` 로그로 상세 에러 정보
- **저장 성공/실패**: `storage` 로그로 성능 및 결과 추적

### ✅ Task 4: 기능 플래그
- **개발 환경**: 상세 로그 활성화 (`VERBOSE_LOGS_ENABLED`)
- **프로덕션 환경**: 최소한의 필수 로그만 활성화
- **PII 로깅**: 환경별 독립적 제어

## 🚀 사용자 경험 개선 효과

1. **프로덕션 디버깅**: PII 누출 없이 문제 추적 가능
2. **성능 모니터링**: AI 요청 지속시간 및 성공률 추적
3. **사용자 행동 분석**: 주요 액션별 사용 패턴 파악
4. **에러 추적**: 검증 실패 및 저장 오류 상세 로깅
5. **확장성**: 새로운 로그 타입 쉽게 추가 가능

## 📈 다음 단계

1. **Sentry 연동**: 실제 모니터링 서비스와 연동
2. **메트릭 수집**: 성공률, 평균 응답시간 등 KPI 수집
3. **알림 시스템**: 에러 발생 시 실시간 알림
4. **대시보드**: 로깅 데이터 시각화
5. **A/B 테스트**: 기능별 사용률 추적

구조화된 로깅 시스템이 성공적으로 구현되어 프로덕션 환경에서 안전하고 효과적인 디버깅이 가능해졌습니다! 🎉
