# Widget & Space Screen 개선사항

## 🎯 개선 요약

### 1. AI 위젯 생성 로직 수정 ✅
**문제**: currentState 질문에 부적절한 위젯(달력 등)이 제공되는 문제

**해결책**:
- AI 프롬프트에 명확한 위젯 매핑 규칙 추가
- currentState는 위젯 없이 텍스트 기반 대화로 진행
- 각 슬롯별 위젯 타입 엄격하게 정의

### 2. Space 스크린 2열 그리드 레이아웃 ✅
**변경**: 단일 열 → 2열 그리드 레이아웃
**효과**: 더 많은 컨텐츠를 한 화면에 표시, 인스타그램/핀터레스트 스타일 UI

---

## 📋 상세 변경사항

### 1. AI 위젯 생성 로직 개선

#### src/services/ai.ts

**추가된 규칙:**

```typescript
Widget Mapping by Slot (STRICT RULES):
- period → calendar widget (type: "calendar", props: { mode: "range" })
- weekdays → weekdays widget (type: "weekdays", props: {})
- time → timePicker widget (type: "timePicker", props: {})
- perWeek → counter widget (type: "counter", props: { min: 1, max: 7 })
- verification → chips widget (type: "chips", props: { options: ["사진", "위치 등록", "체크리스트"] })
- successRate → counter widget (type: "counter", props: { min: 50, max: 100 })
- milestones → chips widget (type: "chips", props: { options: ["시작", "중간", "완료"] })
- currentState → NO WIDGET (text-based conversation only)
```

**Milestone 목표 특별 지시사항:**

```
Special Instructions for Milestone Goals:
- Always assess the user's current state/level through CONVERSATION (NO WIDGET for currentState)
- Ask about their experience, background, and starting point using open-ended questions
- Let user respond with text - DO NOT provide calendar, counter, or any widget for currentState
- Create personalized milestones based on their current state
- Consider their timeline and available resources
```

**예시 JSON 응답:**

```json
// For currentState questions:
{
  "question": "현재 어느 정도 수준이신가요? 예를 들어, 이미 기초는 다지셨는지, 완전히 처음부터 시작하시는지 알려주세요!",
  "widgets": [],  // Empty array - NO WIDGET
  "userState": {
    "currentLevel": "beginner",
    "experience": "To be filled from user's text response"
  }
}
```

---

### 2. Space 스크린 2열 그리드 레이아웃

#### src/screens/SpaceScreen.tsx

**변경 전:**
```tsx
<FlatList
  data={goals}
  keyExtractor={(item) => item.goalId}
  renderItem={({ item }) => (
    <GoalCard goal={item} ... />
  )}
  contentContainerStyle={{ paddingHorizontal: 16 }}
/>
```

**변경 후:**
```tsx
<FlatList
  data={goals}
  keyExtractor={(item) => item.goalId}
  numColumns={2}  // 2열 그리드
  renderItem={({ item }) => (
    <View style={{ flex: 1, maxWidth: '50%', padding: 8 }}>
      <GoalCard goal={item} ... />
    </View>
  )}
  contentContainerStyle={{ paddingHorizontal: 8 }}
/>
```

**주요 변경사항:**
- `numColumns={2}` 추가로 2열 그리드 활성화
- 각 아이템을 `View`로 감싸서 50% 너비 제한
- `padding: 8` 적용으로 아이템 간격 조정
- 전체 `paddingHorizontal` 16 → 8로 감소

#### src/components/space/GoalCard.tsx

**컴팩트 디자인 적용:**

| 요소 | 변경 전 | 변경 후 |
|------|---------|---------|
| Card 패딩 | `p-5` | `p-3` |
| Card 라운드 | `rounded-3xl` | `rounded-2xl` |
| 이미지 높이 | `h-56` (224px) | `height: 140` |
| 아바타 크기 | `w-11 h-11` (44px) | `w-7 h-7` (28px) |
| 제목 폰트 | `text-base` (16px) | `text-sm` (14px) |
| 좋아요 아이콘 | `size={20}` | `size={16}` |
| 액션 버튼 패딩 | `p-2.5` | `p-1.5` |
| 프로그레스 바 높이 | `h-2.5` | `h-1.5` |

**텍스트 줄임 처리:**
```tsx
// 사용자 이름 - 1줄 제한
<Text numberOfLines={1}>
  {goal.actor.displayName}
</Text>

// 목표 제목 - 2줄 제한
<Text numberOfLines={2}>
  {goal.title}
</Text>
```

---

## 🎨 UI/UX 개선사항

### Space 스크린 그리드 레이아웃

**Before (1열):**
```
┌────────────────────┐
│     Goal Card 1    │
│                    │
└────────────────────┘
┌────────────────────┐
│     Goal Card 2    │
│                    │
└────────────────────┘
```

**After (2열):**
```
┌─────────┬─────────┐
│ Goal 1  │ Goal 2  │
│         │         │
├─────────┼─────────┤
│ Goal 3  │ Goal 4  │
│         │         │
└─────────┴─────────┘
```

**장점:**
1. **더 많은 콘텐츠**: 한 화면에 2배 많은 목표 표시
2. **빠른 탐색**: 스크롤 양 감소
3. **모던한 디자인**: Instagram/Pinterest 스타일
4. **공간 활용**: 화면 너비 효율적 사용
5. **균형잡힌 레이아웃**: 시각적으로 안정감

---

## 🔍 테스트 체크리스트

### AI 위젯 생성
- [ ] Schedule 목표: period, weekdays, time 각각 올바른 위젯 생성
- [ ] Frequency 목표: period, perWeek 올바른 위젯 생성
- [ ] Milestone 목표: period, milestones 올바른 위젯 생성
- [ ] **currentState 질문: 위젯 없이 텍스트 입력만 허용** ✅

### Space 스크린 그리드
- [ ] 목표들이 2열로 정렬되어 표시
- [ ] 각 카드가 균등한 너비로 표시
- [ ] 카드 간격이 적절함
- [ ] 스크롤이 부드럽게 작동
- [ ] 빈 상태 메시지가 전체 너비로 표시
- [ ] 로딩 인디케이터가 중앙에 표시
- [ ] 좋아요/북마크 버튼이 정상 작동

---

## 📊 성능 영향

### Space 스크린
- **렌더링**: FlatList numColumns 사용으로 최적화 유지
- **메모리**: 동일 (동일한 수의 아이템 렌더링)
- **스크롤 성능**: 약간 향상 (더 짧은 리스트 길이)

### AI 위젯
- **API 호출**: 변화 없음 (동일한 호출 횟수)
- **응답 크기**: 약간 증가 (명확한 프롬프트로 인한 더 자세한 지시사항)
- **정확도**: 크게 향상 (위젯 매핑 오류 감소)

---

## 🐛 알려진 이슈 & 해결

### 이슈 1: currentState에 달력 위젯이 나타남 ❌
**원인**: AI가 date/period와 currentState를 혼동
**해결**: 
- 명확한 위젯 매핑 규칙 추가
- "NO WIDGET" 명시
- 예시 JSON 응답 제공

### 이슈 2: Space 카드가 너무 큼
**원인**: 기존 디자인이 1열 전용
**해결**:
- 모든 크기를 ~30% 축소
- 텍스트 줄임 처리 추가
- 패딩과 여백 최적화

---

## 📝 추가 개선 제안

### 단기
1. **위젯 검증 강화**: 서버사이드에서도 위젯 매핑 검증
2. **그리드 반응형**: 태블릿에서는 3열 그리드
3. **카드 애니메이션**: 등장/좋아요 애니메이션 추가

### 중기
1. **필터/정렬**: 카테고리별, 인기순 정렬 기능
2. **무한 스크롤**: 페이지네이션 구현
3. **스켈레톤 UI**: 로딩 시 스켈레톤 표시

### 장기
1. **Masonry 레이아웃**: 카드 높이를 콘텐츠에 맞게 가변
2. **가상화 리스트**: react-native-flash-list 적용
3. **이미지 최적화**: Progressive loading, blur placeholder

---

## ✅ 완료 상태

| 항목 | 상태 | 날짜 |
|------|------|------|
| AI 위젯 매핑 규칙 추가 | ✅ 완료 | 2025-10-17 |
| currentState 위젯 제거 | ✅ 완료 | 2025-10-17 |
| Space 2열 그리드 구현 | ✅ 완료 | 2025-10-17 |
| GoalCard 컴팩트 디자인 | ✅ 완료 | 2025-10-17 |
| Linter 에러 해결 | ✅ 완료 | 2025-10-17 |

---

## 🔗 관련 파일

- `src/services/ai.ts` - AI 위젯 생성 로직
- `src/screens/SpaceScreen.tsx` - 2열 그리드 레이아웃
- `src/components/space/GoalCard.tsx` - 컴팩트 카드 디자인
- `AI-IMPROVEMENTS-SUMMARY.md` - 이전 AI 개선사항
- `WIDGET-API-MAPPING.md` - 위젯-API 매핑 문서

