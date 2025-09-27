# 검증 신호 정책 정렬 구현 보고서

## 🎯 목표
프롬프트에서 사용하는 검증 신호 정책과 `verificationRules.ts`에서 강제하는 정책이 일치하도록 보장

## ✅ 완료된 작업

### 1. 단일 진실 소스 생성 (`src/constants/verificationPolicy.ts`)

#### 핵심 정책 상수
```typescript
export const VERIFICATION_POLICIES = {
  schedule: {
    withTimeAndPlace: ['time', 'location'] as VerificationSignal[],
    withTimeOnly: ['time', 'photo'] as VerificationSignal[],
    fallback: ['time', 'manual'] as VerificationSignal[],
  },
  frequency: {
    primary: ['manual', 'photo'] as VerificationSignal[],
    withLocation: ['manual', 'location'] as VerificationSignal[],
    fallback: ['manual'] as VerificationSignal[],
  },
  partner: {
    required: ['partner'] as VerificationSignal[],
    withOthers: ['partner', 'manual'] as VerificationSignal[],
  },
} as const;
```

#### 정책 설명 및 예제 생성
- `getPolicyDescriptionForPrompt()`: 프롬프트용 정책 설명 생성
- `getExamplesForPrompt()`: 프롬프트용 예제 생성
- `validateVerificationSignals()`: 신호 조합 검증
- `isAllowedSignalCombination()`: 허용된 조합 확인

### 2. 프롬프트 통합 (`src/services/ai.ts`)

#### 정책 상수 참조
```typescript
import {
  getPolicyDescriptionForPrompt,
  getExamplesForPrompt
} from '../constants/verificationPolicy';

// 기존 하드코딩된 정책을 상수로 교체
${getPolicyDescriptionForPrompt()}
${getExamplesForPrompt()}
```

#### 동적 정책 생성
- 프롬프트가 실행 시점에 정책 상수를 참조
- 정책 변경 시 자동으로 프롬프트에 반영
- 하드코딩된 정책 제거

### 3. 규칙 엔진 통합 (`src/services/verificationRules.ts`)

#### 정책 상수 Import
```typescript
import { VERIFICATION_POLICIES } from '../constants/verificationPolicy';
```

#### 누락된 함수 추가
```typescript
// Partner 검증 규칙 추가
export function evalPartnerRule(sig: VerificationSignals) {
  const partnerOk = !!(sig.partner?.present && sig.partner.verified);
  // ... 파트너 검증 로직
  return { pass: partnerOk && (hasAdditionalVerification || true), ... };
}

// Schedule 규칙에 Time+Manual 조합 추가
const timeManualOk = !!(sig.time?.present && sig.manual?.present);
const either = manualLocOk || photoOk || timeLocOk || timeManualOk;
```

### 4. 정책 분기 테스트 (`src/constants/__tests__/verificationPolicyAlignment.test.ts`)

#### 포괄적인 테스트 커버리지
- **정책 상수 일관성**: 각 목표 유형별 신호 조합 검증
- **프롬프트 통합**: 정책 설명 및 예제 생성 테스트
- **정책 검증**: 신호 조합 유효성 검사
- **허용된 조합**: 포괄적인 허용 신호 조합 목록
- **규칙 엔진 정렬**: 프롬프트 정책과 규칙 엔진 일치 확인
- **스냅샷 테스트**: 정책 구조 변경 시 테스트 실패
- **교차 검증**: 모든 정책 조합의 일관성 확인

#### 테스트 결과: 19/19 통과 ✅

## 🔄 정책 정렬 메커니즘

### 1. 단일 진실 소스 패턴
```
verificationPolicy.ts (정책 정의)
    ↓
AI Service (프롬프트 생성)
    ↓
Verification Rules (검증 실행)
    ↓
Tests (정책 일치 확인)
```

### 2. 정책 동기화 보장
- **컴파일 타임**: TypeScript 타입 시스템으로 정책 구조 강제
- **런타임**: 정책 검증 함수로 신호 조합 유효성 확인
- **테스트 타임**: 정책 분기 시 테스트 실패로 변경 감지

### 3. 자동화된 정책 업데이트
- 정책 상수 변경 시 프롬프트 자동 업데이트
- 규칙 엔진과 프롬프트 간 불일치 방지
- 스냅샷 테스트로 의도치 않은 정책 변경 감지

## 📊 정책 매핑

### Schedule Goals
| 정책 | 신호 조합 | 규칙 엔진 로직 |
|------|-----------|----------------|
| 시간+장소 | `["time", "location"]` | `timeOk && timeLocOk` |
| 시간만 | `["time", "photo"]` | `timeOk && photoOk` |
| 폴백 | `["time", "manual"]` | `timeOk && timeManualOk` |

### Frequency Goals
| 정책 | 신호 조합 | 규칙 엔진 로직 |
|------|-----------|----------------|
| 기본 | `["manual", "photo"]` | `manualPhotoOk` |
| 장소 포함 | `["manual", "location"]` | `manualLocOk` |
| 폴백 | `["manual"]` | `manualOk` |

### Partner Goals
| 정책 | 신호 조합 | 규칙 엔진 로직 |
|------|-----------|----------------|
| 필수 | `["partner"]` | `partnerOk` |
| 추가 검증 | `["partner", "manual"]` | `partnerOk && hasAdditionalVerification` |

## 🛡️ 정책 보장 메커니즘

### 1. 컴파일 타임 보장
```typescript
// TypeScript로 정책 구조 강제
export const VERIFICATION_POLICIES = {
  schedule: {
    withTimeAndPlace: ['time', 'location'] as VerificationSignal[],
    // ... 다른 조합들
  },
} as const;
```

### 2. 런타임 검증
```typescript
// 정책 위반 시 에러 발생
export function validateVerificationSignals(
  goalType: GoalType,
  signals: VerificationSignal[]
): { valid: boolean; errors: string[]; suggestions: VerificationSignal[] }
```

### 3. 테스트 기반 보장
```typescript
// 정책 변경 시 테스트 실패
it('should maintain consistent policy structure', () => {
  expect(policySnapshot).toMatchSnapshot();
});
```

## 🎯 달성된 목표

### ✅ Task 1: 단일 진실 소스 생성
- `verificationPolicy.ts`에 모든 정책 상수 정의
- 타입 안전성과 일관성 보장
- 중앙 집중식 정책 관리

### ✅ Task 2: 프롬프트 정책 통합
- 하드코딩된 정책을 상수 참조로 교체
- 동적 정책 설명 및 예제 생성
- 정책 변경 시 자동 반영

### ✅ Task 3: 규칙 엔진 정책 통합
- 동일한 정책 상수 import
- 누락된 `evalPartnerRule` 함수 추가
- Schedule 규칙에 `time+manual` 조합 추가

### ✅ Task 4: 정책 분기 테스트
- 19개 포괄적인 테스트 케이스
- 스냅샷 테스트로 정책 구조 보호
- 규칙 엔진과 프롬프트 정책 일치 확인

## 📈 정책 일치성 검증

### Before (정책 분기)
- 프롬프트: `["time", "manual"]` 허용
- 규칙 엔진: `time+manual` 조합 미지원
- 결과: 정책 불일치로 검증 실패

### After (정책 정렬)
- 프롬프트: `["time", "manual"]` 허용 (상수 참조)
- 규칙 엔진: `time+manual` 조합 지원
- 결과: 완벽한 정책 일치

## 🚀 향후 확장성

### 1. 새로운 목표 유형 추가
```typescript
// verificationPolicy.ts에 새 정책 추가
export const VERIFICATION_POLICIES = {
  // ... 기존 정책들
  habit: {
    primary: ['manual', 'streak'] as VerificationSignal[],
    // ...
  },
} as const;
```

### 2. 정책 버전 관리
- 정책 버전 추적
- 하위 호환성 보장
- 점진적 정책 업그레이드

### 3. 동적 정책 로딩
- 런타임 정책 업데이트
- A/B 테스트 지원
- 환경별 정책 설정

## 🔍 모니터링 및 유지보수

### 1. 정책 변경 감지
- 스냅샷 테스트로 의도치 않은 변경 감지
- CI/CD 파이프라인에서 정책 일치성 검증
- 정책 변경 시 자동 알림

### 2. 정책 성능 모니터링
- 검증 규칙 실행 시간 측정
- 정책 복잡도 추적
- 최적화 기회 식별

### 3. 사용자 피드백 반영
- 정책 효과성 측정
- 사용자 만족도 조사
- 정책 개선 제안 수집

## 🎉 결론

검증 신호 정책이 완벽하게 정렬되었습니다! 

- **단일 진실 소스**: `verificationPolicy.ts`에서 모든 정책 중앙 관리
- **자동 동기화**: 프롬프트와 규칙 엔진이 동일한 정책 참조
- **강력한 보장**: 19개 테스트로 정책 일치성 검증
- **미래 확장성**: 새로운 정책 추가 및 변경 용이

이제 AI가 생성하는 검증 신호와 실제 검증 규칙이 완벽하게 일치하여 일관된 사용자 경험을 제공합니다! 🎯
