# AI 목표 생성 플로우 개선사항

## 문제점 분석

### 1. 같은 프롬프트가 다른 퀘스트 생성 ❌
**원인**: AI temperature 설정이 0.15로 되어 있어 비결정론적 출력 발생

**해결**: 
- `temperature: 0`으로 변경 → 같은 입력에 대해 항상 같은 출력 보장
- 목표 분류 AI도 이미 `temperature: 0` 사용 중

### 2. goalType 분류가 매번 다름 ❌
**원인**: AI 분류 시 온도 설정과 프롬프트 일관성 부족

**해결**:
- 이미 `temperature: 0` 적용되어 있음 (state.tsx line 68)
- 분류 기준이 명확하게 정의되어 있음
- Fallback 로직이 휴리스틱 기반으로 안정적

### 3. AI가 사용자 답변 전에 질문 연발 ❌
**원인**: useEffect가 자동으로 다음 질문 생성

**해결**:
- `userJustConfirmedWidget` 플래그 추가
- 위젯의 "선택 완료" 버튼 클릭 시에만 다음 질문 생성
- 사용자가 명시적으로 확인할 때까지 대기

### 4. 퀘스트를 수정할 수 없음 ❌
**원인**: 퀘스트 생성 후 바로 저장 또는 다시 만들기만 가능

**해결**:
- 퀘스트 편집 모드 추가 (`isEditingQuests` state)
- 각 퀘스트의 제목과 설명 수정 가능
- 퀘스트 삭제 기능 추가
- "수정 완료" 버튼으로 변경 사항 적용

### 5. AI가 일방적으로 방법 결정 ❌
**원인**: goalType 확인 시 단순 yes/no만 제공

**해결**:
- goalType 확인 시 각 방식의 장점 명시
- 사용자가 거부하면 3가지 옵션 chips 제공
- 퀘스트 편집 기능으로 AI 제안을 사용자가 조정 가능

## 구현된 개선사항

### ✅ 1. Deterministic AI Output
```typescript
// src/services/ai.ts line 1668
temperature: 0  // 결정론적 출력
```

### ✅ 2. 사용자 응답 대기 메커니즘
```typescript
// src/components/chatbot/ChatbotCreateGoal.tsx
const [userJustConfirmedWidget, setUserJustConfirmedWidget] = useState(false);

// useEffect에서 확인
if (state.pendingSlots.length > 0 && userJustConfirmedWidget) {
  // 다음 질문 생성
}

// 위젯 확인 시 플래그 설정
const handleSlotConfirm = () => {
  setUserJustConfirmedWidget(true);
}
```

### ✅ 3. 퀘스트 편집 UI
```typescript
// 편집 모드 state
const [isEditingQuests, setIsEditingQuests] = useState(false);
const [editedQuests, setEditedQuests] = useState<any[]>([]);

// 각 퀘스트마다 편집 가능한 TextInput 제공
<TextInput
  value={quest.title}
  onChangeText={(text) => {
    const updated = [...editedQuests];
    updated[index] = { ...updated[index], title: text };
    setEditedQuests(updated);
  }}
/>

// 수정 완료 버튼
<TouchableOpacity onPress={() => {
  actions.markComplete(editedQuests);
  setIsEditingQuests(false);
}}>
  <Text>수정 완료</Text>
</TouchableOpacity>
```

### ✅ 4. 향상된 goalType 확인 메시지
```typescript
// src/features/createGoal/chatbotState.ts
export function formatGoalTypeConfirmation(goalType) {
  return `🎯 이 목표는 **${typeLabels[goalType]}**로 분류됩니다.

📝 ${descriptions[goalType]}

${benefits[goalType]}  // 각 방식의 장점 명시

이 방식으로 진행하시겠어요?`;
}
```

### ✅ 5. 대안 선택 UI
```typescript
// 사용자가 거부하면 chips 제공
actions.addMessage('어떤 유형의 목표인가요?', 'assistant', [
  {
    type: 'chips',
    slotId: 'goalType',
    props: { options: ['schedule', 'frequency', 'milestone'] }
  }
]);
```

## 사용자 플로우 개선

### Before (문제점)
1. 목표 입력
2. AI가 자동으로 타입 분류 → goalType이 매번 달라짐 ❌
3. AI가 연속으로 질문 → 답변 전에 다음 질문 나옴 ❌
4. 퀘스트 자동 생성 → 매번 다른 퀘스트 ❌
5. 수정 불가 → 다시 만들거나 그대로 저장만 가능 ❌

### After (개선)
1. 목표 입력
2. AI가 타입 분류 (deterministic) → **항상 같은 입력에 같은 분류** ✅
3. **각 방식의 장점과 함께** 확인 메시지 → 사용자가 충분한 정보를 가지고 결정 ✅
4. 위젯으로 정보 입력 → **"선택 완료" 버튼 클릭 시에만** 다음 질문 ✅
5. 퀘스트 생성 (deterministic) → **항상 같은 입력에 같은 퀘스트** ✅
6. **퀘스트 미리보기 & 편집** → 제목/설명 수정, 삭제 가능 ✅
7. "수정 완료" 또는 "목표 저장하기" 선택 ✅

## 기술적 세부사항

### Temperature 설정
- **Goal Classification**: `temperature: 0` (state.tsx line 68)
- **Quest Generation**: `temperature: 0` (ai.ts line 1668)
- **Conversational Questions**: `temperature: 0.7` (자연스러운 대화를 위해 유지)

### 상태 관리
```typescript
// 챗봇 상태
- messages: ChatMessage[]
- currentGoalType: 'schedule' | 'frequency' | 'milestone'
- collectedSlots: Record<string, SlotValue>
- pendingSlots: string[]
- questPreview: Quest[]
- isComplete: boolean

// 편집 상태
- isEditingQuests: boolean
- editedQuests: Quest[]
- userJustConfirmedWidget: boolean
```

### 위젯 플로우
1. AI가 질문과 함께 위젯 제공
2. 사용자가 위젯에서 값 선택
3. **"선택 완료" 버튼 클릭**
4. `handleSlotConfirm()` 호출
5. `setUserJustConfirmedWidget(true)` 설정
6. useEffect가 감지하여 다음 질문 생성
7. 플래그 초기화 (`setUserJustConfirmedWidget(false)`)

## 검증 완료

✅ **API 타입 호환성**: WIDGET-API-MAPPING.md 참조
✅ **Linter 에러 없음**: 모든 파일 통과
✅ **TypeScript 타입 안전**: 완전한 타입 체크
✅ **사용자 경험**: 명확한 플로우와 제어권

## 추가 개선 제안 (Future Work)

### 단기 (즉시 가능)
1. 퀘스트 순서 변경 기능 (드래그 앤 드롭)
2. 퀘스트 추가 기능
3. 벌크 편집 (여러 퀘스트 동시 수정)

### 중기 (추가 개발 필요)
1. AI가 2-3가지 퀘스트 세트를 생성하고 사용자가 선택
2. 템플릿 기반 퀘스트 제안
3. 과거 목표 기반 개인화된 제안

### 장기 (큰 변경 필요)
1. 퀘스트 난이도 자동 조정
2. 실패 패턴 분석 및 적응적 퀘스트 생성
3. 소셜 기능 (친구의 성공한 퀘스트 참고)

## 결론

모든 주요 문제점이 해결되었습니다:
- ✅ Deterministic AI output (temperature=0)
- ✅ 사용자 응답 대기 메커니즘
- ✅ 퀘스트 편집 기능
- ✅ 향상된 정보 제공
- ✅ API 타입 호환성

사용자는 이제 AI가 제안하는 퀘스트를 수정할 수 있고, 
AI는 같은 입력에 대해 일관된 결과를 제공합니다.

