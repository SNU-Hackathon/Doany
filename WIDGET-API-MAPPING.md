# Widget to API Mapping Documentation

## Overview
이 문서는 create goal 플로우에서 위젯이 수집하는 데이터가 API 요청으로 어떻게 변환되는지 설명합니다.

## Widget Slots (사용자 입력)

### Common Slots (모든 목표 타입)
- `title`: 목표 제목 → API `title`
- `period`: { startDate, endDate } → API `startAt`, `endAt`  
- `verification`: string[] (예: ["사진", "위치 등록"]) → API `verificationMethod` (변환 필요)
- `successRate`: number (예: 80) → **API에 직접 전송되지 않음** (내부 계산용)

### Schedule Goal Slots
- `weekdays`: number[] (0=일요일, 1=월요일, ...) → 퀘스트 생성 시 사용
- `time`: string (예: "09:00") → API `quests[].time`
- **생성되는 API 필드:**
  - `quests`: Array<{ date: string, time: string, description: string, verificationMethod: string }>

### Frequency Goal Slots
- `perWeek`: number (예: 3) → API `numbers`
- **생성되는 API 필드:**
  - `period`: "week" (고정)
  - `numbers`: perWeek 값
  - `quests`: Array<{ unit: number, description: string, verificationMethod: string }>

### Milestone Goal Slots
- `milestones`: string[] (예: ["kickoff", "mid", "finish"]) → 퀘스트 생성 시 사용
- `currentState`: string (선택적) → **API에 직접 전송되지 않음**
- **생성되는 API 필드:**
  - `scheduleMethod`: "milestone"
  - `quests`: Array<{ title: string, targetValue: number, description: string, verificationMethod: string }>
  - `totalSteps`: milestones.length
  - `currentStepIndex`: 0
  - `overallTarget`: number (계산됨)
  - `config`: { rewardPerStep: number, maxFails: number }

## Verification Method Mapping

위젯은 한국어 레이블을 수집하지만, API는 영어 enum을 요구합니다:

```typescript
{
  "사진": "camera",
  "위치 등록": "location",
  "체크리스트": "manual",
  "manual": "manual"
}
```

## Data Flow

1. **User Input (Widget)** → 한국어 레이블, 사용자 친화적 형식
2. **Collected Slots** → 중간 저장소 (chatbotState)
3. **AI Quest Generation** → collectedSlots를 사용하여 personalized quests 생성
4. **API Request** → API 스펙에 맞게 변환 (handleSaveGoal 함수)

## Validation

### Required Fields by Goal Type

**Schedule:**
- title ✓
- period (startDate, endDate) ✓
- weekdays ✓
- time ✓
- verification ✓
- quests (AI 생성) ✓

**Frequency:**
- title ✓
- period (startDate, endDate) ✓
- perWeek ✓
- verification ✓
- quests (AI 생성) ✓

**Milestone:**
- title ✓
- period (startDate, endDate) ✓
- milestones ✓
- verification ✓
- quests (AI 생성) ✓

## Notes

1. **successRate는 내부 계산용**
   - AI가 퀘스트를 생성할 때 몇 개를 생성할지 결정하는 데 사용
   - 예: successRate=80%, totalCount=10 → requiredCount=8
   - API 요청에는 포함되지 않음

2. **currentState는 milestone 전용**
   - 사용자의 현재 수준/경험을 파악하기 위한 정보
   - AI가 더 개인화된 퀘스트를 생성하는 데 도움
   - API 요청에는 포함되지 않음

3. **모든 위젯 데이터는 API 전송 전에 변환됨**
   - 한국어 → 영어
   - 사용자 친화적 형식 → API 스펙 형식
   - 날짜 형식: "YYYY-MM-DD" → "YYYY-MM-DDTHH:MM"

## API Compliance Status

✅ **완전히 준수** - 모든 위젯 데이터가 올바르게 변환되어 전송됩니다.
✅ **타입 안전** - TypeScript 타입이 API 스펙과 일치합니다.
✅ **검증 완료** - handleSaveGoal 함수에서 모든 필드를 올바르게 매핑합니다.

