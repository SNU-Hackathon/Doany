# 테스트/로그 위치 요약

이 문서는 Weekly Schedule과 Calendar Override 시스템의 테스트 문서와 로깅 위치를 요약합니다.

## 📁 **변경 파일 목록**

### **1. 새로 생성된 파일:**
- **`INTEGRATION_TEST_SCENARIOS.md`** - 통합 테스트 시나리오 문서

### **2. 수정된 파일:**
- **`src/services/calendarEventService.ts`** - 로깅 시스템 개선

---

## 🧪 **테스트 문서 위치**

### **`INTEGRATION_TEST_SCENARIOS.md`**
**위치**: 프로젝트 루트
**내용**:
- ✅ **시나리오 A**: "롱프레스가 하루만 바꾸는지" 테스트
- ✅ **시나리오 B**: "요약 반영" 테스트  
- ✅ **추가 검증 시나리오**: Multiple Override, Deletion, Pattern Change
- ✅ **수동 테스트 가이드**: 단계별 실행 방법
- ✅ **알려진 이슈/제한사항**: 로컬 동기화, 성능, 타임존
- ✅ **로그 모니터링**: 성공/실패 패턴

---

## 📝 **로깅 시스템 위치**

### **Calendar Save Override 로깅 (`src/services/calendarEventService.ts`)**

#### **1) upsertOverride 함수:**
```typescript
// 시작 로그 (라인 487-493)
console.log('[Calendar Save Override] upsertOverride params:', {
  goalId,
  date,
  time,
  action: 'per-date override only',
  docId: `${goalId}_${date}_${time}_override`
});

// 성공 로그 (라인 511-517)
console.log(`[Calendar Save Override] Successfully saved override event:`, {
  docId,
  goalId,
  date,
  time,
  note: 'date-specific only, weekly pattern unaffected'
});
```

#### **2) deleteOverride 함수:**
```typescript
// 시작 로그 (라인 544-550)
console.log('[Calendar Save Override] deleteOverride params:', {
  goalId,
  date,
  time,
  action: 'delete per-date override only',
  docId: `${goalId}_${date}_${time}_override`
});

// 성공 로그 (라인 560-566)
console.log(`[Calendar Save Override] Successfully deleted override event:`, {
  docId,
  goalId,
  date,
  time,
  note: 'date-specific deletion only, weekly pattern preserved'
});
```

### **Weekly Apply Pattern 로깅 (`src/services/calendarEventService.ts`)**

#### **syncWeeklyScheduleToCalendar 함수:**
```typescript
// 시작 로그 (라인 346-353)
console.log('[Weekly Apply Pattern] syncWeeklyScheduleToCalendar - Weekly 편집 저장 시작:', {
  goalId,
  weeklyWeekdays,
  timeSettingsCount: Object.keys(weeklyTimeSettings).length,
  startDate,
  endDate,
  action: 'Weekly 패턴을 기간 내 모든 날짜로 확장, override 보존'
});

// 기존 이벤트 분석 로그 (라인 363-368)
console.log('[Weekly Apply Pattern] Existing events analysis:', {
  totalEvents: existingEvents.length,
  weeklyEvents: existingWeekly.length,
  overrideEvents: existingOverride.length,
  note: 'Override 이벤트는 전혀 건드리지 않음'
});

// Override 보존 로그 (라인 403)
console.log(`[Weekly Apply Pattern] Preserving ${existingOverride.length} override events (롱프레스 수정사항 보존)`);

// 완료 로그 (라인 414-423)
console.log(`[Weekly Apply Pattern] Weekly 편집 저장 완료:`, {
  goalId,
  적용범위수: dayRange,
  생성갱신카운트: newWeeklyEvents.length,
  override보존수: existingOverride.length,
  oldWeeklyEvents: existingWeekly.length,
  newWeeklyEvents: newWeeklyEvents.length,
  totalEventsAfterSync: newWeeklyEvents.length + existingOverride.length,
  note: 'Weekly 패턴 확장 완료, Override 보존 완료'
});
```

---

## 🔍 **로그 모니터링 가이드**

### **성공적인 롱프레스 Override 로그 시퀀스:**
```
[Calendar Save Override] upsertOverride params: { goalId: "...", date: "2025-08-26", time: "08:00", ... }
[Calendar Save Override] Successfully saved override event: { docId: "..._2025-08-26_08:00_override", ... }
[SimpleDatePicker] Auto-updating Weekly Schedule summary based on calendarEvents: { eventsCount: 5, weeklyEvents: 4, overrideEvents: 1 }
```

### **성공적인 Weekly 패턴 적용 로그 시퀀스:**
```
[Weekly Apply Pattern] syncWeeklyScheduleToCalendar - Weekly 편집 저장 시작: { goalId: "...", weeklyWeekdays: [2], ... }
[Weekly Apply Pattern] Existing events analysis: { totalEvents: 1, weeklyEvents: 0, overrideEvents: 1, ... }
[Weekly Apply Pattern] Preserving 1 override events (롱프레스 수정사항 보존)
[Weekly Apply Pattern] Weekly 편집 저장 완료: { 적용범위수: 31, 생성갱신카운트: 4, override보존수: 1, ... }
```

### **오류 로그 패턴:**
```
[CalendarEventService] Error upserting override event: ...
[Weekly Apply Pattern] Error syncing weekly schedule: ...
```

---

## 🎯 **로깅 주요 메트릭**

### **Calendar Save Override 메트릭:**
- **goalId**: 목표 ID
- **date**: 수정 날짜 (YYYY-MM-DD)
- **time**: 수정 시간 (HH:MM)
- **docId**: 생성된 문서 ID

### **Weekly Apply Pattern 메트릭:**
- **goalId**: 목표 ID
- **적용범위수**: 패턴이 적용되는 총 일수
- **생성갱신카운트**: 새로 생성/갱신된 weekly 이벤트 수
- **override보존수**: 보존된 override 이벤트 수

이 로깅 시스템을 통해 Weekly Schedule과 Override 시스템의 동작을 완전히 추적하고 디버깅할 수 있습니다.
