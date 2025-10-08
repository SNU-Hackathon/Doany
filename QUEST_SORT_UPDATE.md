# 🎯 퀘스트 정렬 및 다음 퀘스트 강조 업데이트

## 날짜: 2025-10-02

---

## ✅ 변경 사항

### 1. **정렬 순서 변경**
```
Before: 과거 → 미래 (아래로 스크롤하면 미래)
After: 가까운 미래 → 먼 미래 (위에서 아래로) ✅
```

**효과**:
```
┌─────────────────────┐
│ 10/02 ⭐ NEXT      │ ← 다음 퀘스트 (제일 위)
│ 10/05 🔒            │
│ 10/07 🔒            │
│ 10/23 🔒            │
│ 10/26 🔒            │
│ 10/28 🔒            │
│ 10/30 🔒            │
└─────────────────────┘
```

---

### 2. **다음 퀘스트 강조**

**Before**: TODAY 배지 (초록)
```
┌───────────────┐
│   TODAY       │ ← 초록 배지
│   🟢          │
└───────────────┘
```

**After**: NEXT ⭐ 배지 (노란)
```
┌───────────────┐
│  NEXT ⭐      │ ← 노란 배지 + 별
│   🟡          │
│ 다음 퀘스트    │
└───────────────┘
```

---

### 3. **잠금 로직**

**Before**: 이전 퀘스트 미완료 시 잠금
```
- 순차적 잠금 해제
```

**After**: 다음 퀘스트만 열림, 나머지 모두 잠금
```
✅ 완료된 퀘스트: 파랑 (클릭 가능)
⭐ 다음 퀘스트: 초록 + 별 (클릭 가능)
🔒 나머지 퀘스트: 회색 + 잠금 (클릭 불가)
```

---

### 4. **자동 스크롤 제거**

**Before**: Goal Detail 진입 시 오늘 퀘스트로 자동 스크롤
```typescript
useEffect(() => {
  // 오늘 퀘스트 찾아서 스크롤
  scrollToIndex({ index: todayIndex });
}, []);
```

**After**: 자동 스크롤 없음, 다음 퀘스트가 자연스럽게 위에 위치
```typescript
// 제거됨 ✅
```

---

## 📝 수정된 파일

### 1. **QuestMapView.tsx**
```typescript
// 정렬: 가까운 미래가 위로
const sortedData = React.useMemo(() => {
  return [...data].sort((a, b) => {
    const dateA = new Date(a.targetDate || a.scheduledDate || '').getTime();
    const dateB = new Date(b.targetDate || b.scheduledDate || '').getTime();
    return dateA - dateB; // ✅ 오름차순
  });
}, [data]);

// 다음 퀘스트 찾기
const nextQuestId = React.useMemo(() => {
  const upcomingQuests = sortedData.filter(q => {
    const questDate = new Date(q.targetDate || q.scheduledDate || '');
    questDate.setHours(0, 0, 0, 0);
    return questDate.getTime() >= now.getTime() && q.status !== 'completed';
  });
  return upcomingQuests[0]?.id || null;
}, [sortedData, now]);

// 잠금 로직
const isLocked = !isCompleted && !isNextQuest && questDate.getTime() >= now.getTime();
```

### 2. **QuestNode.tsx**
```typescript
{/* NEXT 배지 (별 표시) */}
{isToday && (
  <View className="absolute -top-2 left-1/2 -ml-6 bg-[#FCD34D] px-2 py-0.5 rounded-full z-10">
    <Text className="text-gray-900 text-xs font-bold">NEXT ⭐</Text>
  </View>
)}

{/* 하단 텍스트 */}
{isToday && (
  <Text className="text-xs text-gray-900 font-semibold mt-1 text-center">
    다음 퀘스트
  </Text>
)}
```

### 3. **QuestDetailList.tsx**
```typescript
// 동일한 정렬 적용
const sortedData = React.useMemo(() => {
  return [...data].sort((a, b) => {
    const dateA = new Date(a.targetDate || a.scheduledDate || '').getTime();
    const dateB = new Date(b.targetDate || b.scheduledDate || '').getTime();
    return dateA - dateB; // ✅ 오름차순
  });
}, [data]);
```

### 4. **GoalDetailScreenV2.tsx**
```typescript
// 다음 퀘스트 자동 선택
const nextQuest = sortedQuests.find(q => {
  const qDate = new Date(q.targetDate || q.scheduledDate || '');
  qDate.setHours(0, 0, 0, 0);
  return qDate.getTime() >= now.getTime() && q.status !== 'completed';
});

if (nextQuest) {
  setSelectedId(nextQuest.id);
}
```

---

## 🎨 시각적 변화

### Map 모드
```
┌─────────────────────────────┐
│  퀘스트  |  상세보기        │
├─────────────────────────────┤
│                             │
│      🟡 NEXT ⭐             │ ← 다음 (노란)
│   다음 퀘스트                │
│                             │
│      🔒                     │ ← 잠김 (회색)
│                             │
│      🔒                     │
│                             │
│      🔵                     │ ← 완료 (파랑)
│                             │
└─────────────────────────────┘
```

### Split 모드
```
┌──────┬────────────────────┐
│ 🟡⭐ │ [10/02 퀘스트]     │ ← 다음
│      │  - 완료/건너뛰기    │
│      │                    │
│ 🔒   │ [10/05 퀘스트]     │ ← 잠김
│      │  (클릭 불가)        │
│      │                    │
│ 🔒   │ [10/07 퀘스트]     │
│      │                    │
│ 🔵   │ [09/30 퀘스트]     │ ← 완료
└──────┴────────────────────┘
```

---

## 🎯 사용자 경험

1. **Goal Detail 진입**:
   - 다음 퀘스트가 자동으로 제일 위에 위치
   - 별(⭐)과 노란 배지로 강조

2. **퀘스트 진행**:
   - 다음 퀘스트만 클릭 가능
   - 나머지는 잠금 상태로 보호

3. **완료 후**:
   - 완료된 퀘스트는 파란색으로 표시
   - 자동으로 그 다음 퀘스트가 "NEXT"로 변경

---

## 🚀 적용 완료!

**앱 재시작 또는 새로고침 (Shake → Reload) 후 확인하세요!**

