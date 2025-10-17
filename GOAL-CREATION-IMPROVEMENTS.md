# 목표 생성 개선사항 (AI + Manual)

## 🎯 구현된 기능

### 1. ✅ AI/Manual 생성 방식 선택
**위치**: Goals 화면 + 버튼 클릭 시

**구현사항**:
- 목표 생성 버튼(+) 클릭 시 방식 선택 모달 표시
- 2가지 옵션:
  - **AI와 대화하기**: 챗봇이 질문하며 맞춤형 목표 생성
  - **직접 만들기**: 모든 설정을 수동으로 입력

**파일**:
- `src/screens/GoalsScreen.tsx` - 선택 모달 UI 추가
- `src/components/CreateGoalModal.tsx` - creationMethod prop으로 라우팅

### 2. ✅ Manual 목표 생성 플로우
**새 컴포넌트**: `src/components/manual/ManualGoalCreator.tsx`

**기능**:
- 2단계 플로우:
  1. **기본 정보**: 제목, 설명, 기간, 태그
  2. **퀘스트 추가**: 여러 타입의 퀘스트 추가 가능

**퀘스트 타입**:
- **스케줄형**: 특정 날짜 + 시간
- **빈도형**: 주당 횟수
- **마일스톤형**: 단계별 목표값

### 3. ✅ 여러 GoalType의 퀘스트 혼합 가능
**핵심 기능**: 하나의 목표에 다양한 타입의 퀘스트 추가

**예시**:
```
목표: "한 달 안에 5kg 감량하기"

퀘스트:
1. [빈도형] 주 3회 헬스장 가기
2. [마일스톤형] 주당 1kg씩 감량하기 (5단계)
3. [스케줄형] 매주 일요일 체중 측정하기
```

### 4. ✅ 퀘스트 편집 개선
**문제**: TextInput에 입력 시 키보드가 자동으로 닫힘

**해결**:
```tsx
<TextInput
  blurOnSubmit={false}        // 입력 완료 시 자동 닫기 방지
  returnKeyType="next"         // 다음 필드로 이동
  textAlignVertical="top"      // multiline에서 상단 정렬
  numberOfLines={3}            // multiline 높이 지정
/>
```

**파일**: `src/components/chatbot/ChatbotCreateGoal.tsx`

---

## 📋 TODO: Milestone 챗봇 개선

### 목표
Milestone 목표 생성 시 여러 방법을 제안하고 사용자가 선택하도록 개선

### 현재 상태
- AI가 하나의 접근 방법만 제시
- 사용자가 currentState를 입력하면 바로 퀘스트 생성

### 개선 방향
1. 사용자의 currentState 파악 후
2. **여러 가지 목표 달성 방법 제안** (3-4가지)
3. 사용자가 선택한 방법에 대해 추가 질문
4. 선택된 방법으로 퀘스트 생성

### 예시 플로우

**목표**: "TOEIC 900점 달성하기"

**AI**: "현재 TOEIC 점수는 어떻게 되시나요?"
**사용자**: "700점 정도입니다"

**AI**: "700점에서 900점까지 200점을 올리는 방법을 제안해드릴게요!"

**제안 1: 단계별 점수 향상 (추천)**
- 1단계: 750점 달성 (기초 문법 강화)
- 2단계: 850점 달성 (실전 문제 풀이)
- 3단계: 900점 달성 (약점 집중 공략)

**제안 2: 파트별 집중 공략**
- LC 파트 집중 (매일 듣기 연습)
- RC 파트 집중 (문법 + 독해)
- 실전 모의고사 (주 2회)

**제안 3: 빠른 집중 학습**
- 매일 3시간 학습
- 주 5회 학원/강의
- 월 1회 실전 모의고사

**사용자**: 제안 1 선택

**AI**: (제안 1에 대한 추가 질문 진행)
- "각 단계를 언제까지 달성하시겠어요?"
- "하루 몇 시간 공부 가능하세요?"
- etc...

---

## 🏗️ 구현 구조

### Modal 라우팅
```
Goals Screen (+버튼)
    ↓
Method Selection Modal
    ├─ AI 선택 → ChatbotCreateGoal
    └─ Manual 선택 → ManualGoalCreator
```

### CreateGoalModal.tsx
```tsx
export default function CreateGoalModal({ 
  visible, 
  onClose, 
  onGoalCreated, 
  creationMethod 
}: CreateGoalModalProps) {
  if (creationMethod === 'ai') {
    return <ChatbotCreateGoal .../>;
  } else if (creationMethod === 'manual') {
    return <ManualGoalCreator .../>;
  }
  return <CreateGoalModalContent .../>;  // Legacy fallback
}
```

### ManualGoalCreator 구조
```tsx
State:
- step: 'basic' | 'quests'
- goalTitle, goalDescription, startDate, endDate, tags
- quests: Quest[]  // 여러 타입 혼합 가능
- showAddQuestModal, selectedQuestType

Quest Types:
interface ScheduleQuest {
  type: 'schedule';
  date: string;
  time: string;
  verificationMethod: 'camera' | 'location' | 'manual';
}

interface FrequencyQuest {
  type: 'frequency';
  unit: number;  // 회차
  verificationMethod: 'camera' | 'location' | 'manual';
}

interface MilestoneQuest {
  type: 'milestone';
  targetValue: number;  // 목표값
  verificationMethod: 'camera' | 'location' | 'manual';
}
```

---

## 🎨 UI/UX

### Method Selection Modal
```
┌─────────────────────────────┐
│   목표 생성 방식 선택        │
│                             │
│  ┌───────────────────────┐  │
│  │ ✨ AI와 대화하기       │  │
│  │ AI가 질문하면서...    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ✏️ 직접 만들기         │  │
│  │ 원하는 대로 설정...   │  │
│  └───────────────────────┘  │
│                             │
│         [취소]              │
└─────────────────────────────┘
```

### Manual Goal Creator - Step 1 (Basic Info)
```
┌─────────────────────────────┐
│ [X]  기본 정보      [다음]  │
├─────────────────────────────┤
│                             │
│ 목표 제목 *                 │
│ ┌─────────────────────────┐ │
│ │ 한 달 안에 5kg 감량하기  │ │
│ └─────────────────────────┘ │
│                             │
│ 목표 설명                   │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ 기간 *                      │
│ ┌──────────┐  ~  ┌────────┐│
│ │2025-01-01│     │2025-01-│││
│ └──────────┘     └────────┘│
│                             │
│ 태그                        │
│ ┌──────────────┐ [추가]    │
│ │              │            │
│ └──────────────┘            │
│ [운동] [다이어트] [건강]    │
└─────────────────────────────┘
```

### Manual Goal Creator - Step 2 (Quests)
```
┌─────────────────────────────┐
│ [X]  퀘스트 추가    [완료]  │
├─────────────────────────────┤
│                             │
│ 퀘스트 유형 선택            │
│                             │
│ ┌─────────────────────────┐ │
│ │ 📅 스케줄형           [+]│ │
│ │ 특정 날짜와 시간에 실행  │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🔁 빈도형             [+]│ │
│ │ 주당 횟수로 관리        │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🚩 마일스톤형         [+]│ │
│ │ 단계별 목표 달성        │ │
│ └─────────────────────────┘ │
│                             │
│ 추가된 퀘스트 (2)           │
│                             │
│ ┌─────────────────────────┐ │
│ │ [빈도형] 주 3회 헬스장  │ │
│ │ 가기              ✏️ 🗑️  │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ [마일스톤형] 주당 1kg씩 │ │
│ │ 감량하기          ✏️ 🗑️  │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

## 🔧 API 호환성

### 혼합 Quest 처리
현재 API는 한 목표당 하나의 goalType만 지원하므로, 첫 번째 퀘스트의 타입을 primary로 사용:

```typescript
const primaryType = quests[0].type;

const goalData = {
  goalType: primaryType,
  // ... 해당 타입에 맞는 필드만 전송
}
```

### 향후 개선 방향
1. **Multiple Goal Types**: 하나의 목표에 여러 타입의 퀘스트를 저장할 수 있도록 API 확장
2. **Quest Groups**: 퀘스트를 그룹으로 관리 (예: 주간 그룹, 단계별 그룹)
3. **Dependencies**: 퀘스트 간 의존성 설정 (예: Quest A 완료 후 Quest B 활성화)

---

## ✅ 테스트 체크리스트

### Method Selection
- [ ] Goals 화면에서 + 버튼 클릭 시 모달 표시
- [ ] "AI와 대화하기" 선택 → ChatbotCreateGoal 실행
- [ ] "직접 만들기" 선택 → ManualGoalCreator 실행
- [ ] 취소 버튼으로 모달 닫기

### Manual Goal Creator - Basic
- [ ] 목표 제목 입력
- [ ] 목표 설명 입력 (optional)
- [ ] 시작일/종료일 입력
- [ ] 태그 추가/삭제
- [ ] "다음" 버튼으로 퀘스트 단계 진입

### Manual Goal Creator - Quests
- [ ] 스케줄형 퀘스트 추가 (날짜, 시간, 검증방법)
- [ ] 빈도형 퀘스트 추가 (회차, 검증방법)
- [ ] 마일스톤형 퀘스트 추가 (목표값, 검증방법)
- [ ] 여러 타입의 퀘스트 혼합 추가
- [ ] 퀘스트 수정
- [ ] 퀘스트 삭제
- [ ] 최소 1개 퀘스트 필요 (유효성 검사)
- [ ] "완료" 버튼으로 목표 저장

### Quest Editing
- [ ] TextInput에 입력 시 키보드 유지
- [ ] multiline 입력 시 줄바꿈 가능
- [ ] "수정 완료" 버튼으로 변경사항 저장

---

## 📊 성능 고려사항

### 상태 관리
- Local state로 충분 (복잡한 전역 상태 불필요)
- Quest 배열은 최대 ~20개 정도로 제한 권장

### API 호출
- 목표 생성은 한 번만 (완료 버튼 클릭 시)
- 낙관적 UI 업데이트 고려 (Goals 화면 즉시 반영)

### UX 개선
- 로딩 인디케이터 표시 (저장 중...)
- 에러 핸들링 (alert or toast)
- 뒤로가기 시 확인 모달 (작성 중인 내용 손실 방지)

---

## 🐛 알려진 제한사항

1. **API 제약**: 현재 API는 단일 goalType만 지원
   - 해결: 첫 번째 퀘스트 타입을 primary로 사용
   - 장기: API 확장 필요

2. **날짜 입력**: 현재는 텍스트 입력만 지원
   - 개선: 날짜 피커 컴포넌트 추가 고려

3. **검증 방법**: 3가지 고정 옵션만 제공
   - 향후: 커스텀 검증 방법 추가 가능

---

## 🚀 향후 개선 계획

### 단기
1. [ ] 날짜 피커 UI 추가
2. [ ] 퀘스트 순서 변경 (드래그 앤 드롭)
3. [ ] 퀘스트 복제 기능
4. [ ] 템플릿 저장/불러오기

### 중기
1. [ ] Milestone 챗봇 여러 방법 제안 구현
2. [ ] 퀘스트 그룹핑 기능
3. [ ] 퀘스트 간 의존성 설정
4. [ ] 목표 공유 기능

### 장기
1. [ ] API 확장 (Multiple GoalTypes)
2. [ ] AI 제안 개선 (개인화)
3. [ ] 협업 목표 (여러 사용자)
4. [ ] 목표 분석 및 인사이트

---

## 📁 관련 파일

### 신규 파일
- `src/components/manual/ManualGoalCreator.tsx` - Manual 목표 생성 UI

### 수정 파일
- `src/screens/GoalsScreen.tsx` - 방식 선택 모달 추가
- `src/components/CreateGoalModal.tsx` - creationMethod 라우팅
- `src/components/chatbot/ChatbotCreateGoal.tsx` - TextInput 개선

### 참고 문서
- `AI-IMPROVEMENTS-SUMMARY.md` - AI 챗봇 개선사항
- `WIDGET-SPACE-IMPROVEMENTS.md` - 위젯 및 Space 개선사항
- `WIDGET-API-MAPPING.md` - 위젯-API 매핑

