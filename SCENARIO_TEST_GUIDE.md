# 🔧 시나리오 테스트 가이드

## 📋 테스트 시나리오

### **시나리오 A: "한 번에 추가 안 됨/사라짐" 재현 방지**
**목표**: 같은 날짜에 여러 시간 추가 시 이전 시간이 사라지지 않고 누적되는지 확인

**테스트 절차:**
1. 2025-08-26 날짜 롱프레스
2. 09:00 추가 → 즉시 칩 표시 확인
3. 같은 날짜 다시 롱프레스  
4. 10:00 추가 → 09:00 유지 + 10:00 추가됨 확인

**예상 로그:**
```
[Override Upsert] 🔧 SCENARIO TEST: {
  goalId: "goal123",
  date: "2025-08-26", 
  time: "09:00",
  docId: "goal123_2025-08-26_09:00_override",
  scenario: "A: 한 번에 추가 안 됨/사라짐 방지"
}

[Override Upsert] ✅ SUCCESS: {
  docId: "goal123_2025-08-26_09:00_override",
  scenario: "A: 즉시 칩 표시 유지"
}

[Fetch Events] ✅ requestId 1 / 적용여부: SUCCESS
[Fetch Events] 🔧 SCENARIO TEST: {
  weeklyEvents: 0,
  overrideEvents: 1,
  scenario: "A+B: 적용여부 확인"
}

// 10:00 추가 시
[Override Upsert] 🔧 SCENARIO TEST: {
  date: "2025-08-26",
  time: "10:00", 
  docId: "goal123_2025-08-26_10:00_override"
}

[Fetch Events] 🔧 SCENARIO TEST: {
  overrideEvents: 2, // 09:00 + 10:00 유지됨
  scenario: "A+B: 적용여부 확인"
}
```

---

### **시나리오 B: "하루만 바꿨는데 요일 전체 변함" 방지**
**목표**: 롱프레스로 특정 날짜만 변경 시 다른 동일 요일은 영향받지 않는지 확인

**테스트 절차:**
1. Weekly Schedule에서 화요일 09:00 설정
2. 2025-08-26(화) 롱프레스 → 08:00로 변경
3. 다음 주 화요일 (2025-09-02) → 여전히 09:00인지 확인

**예상 로그:**
```
// Weekly 패턴 설정 시
[Weekly Apply] 🔧 SCENARIO TEST - 벌크 생성 시작: {
  weekdays: [2], // 화요일
  scenario: "B: 하루만 바꿨는데 요일 전체 변함 방지"
}

[Weekly Apply] ✅ 생성/갱신 완료: {
  생성갱신건수: 8, // 전체 기간의 화요일들
  override보존건수: 0,
  scenario: "B: Weekly 변경해도 override 보존됨"
}

// 특정 날짜 롱프레스 변경 시
[Override Upsert] 🔧 SCENARIO TEST: {
  date: "2025-08-26", // 특정 화요일만
  time: "08:00",
  docId: "goal123_2025-08-26_08:00_override"
}

[Fetch Events] 🔧 SCENARIO TEST: {
  weeklyEvents: 8, // 다른 화요일들은 그대로
  overrideEvents: 1, // 2025-08-26만 override
  scenario: "A+B: 적용여부 확인"
}
```

---

## 📂 **테스트 위치 및 로그**

### **1) 로그 위치**

| 로그 태그 | 파일 위치 | 함수/위치 | 용도 |
|----------|----------|----------|------|
| `[Override Upsert]` | `src/services/calendarEventService.ts` | `upsertOverride()` Line 746, 771 | 롱프레스 override 저장 추적 |
| `[Weekly Apply]` | `src/services/calendarEventService.ts` | `applyWeeklyPattern()` Line 634, 707 | Weekly 패턴 벌크 적용 추적 |  
| `[Fetch Events]` | `src/services/calendarEventService.ts` | `getCalendarEvents()` Line 137 | 이벤트 조회 및 중복 제거 추적 |
| `[Fetch Events]` | `src/components/GoalScheduleCalendar.tsx` | `handleAddTime/Update/Delete` Line 274, 377, 451 | requestId 가드 및 UI 반영 추적 |

### **2) 핵심 로그 메시지**

#### **시나리오 A 관련:**
- `🔧 SCENARIO TEST:` - 작업 시작 및 파라미터
- `✅ SUCCESS:` - override 저장 성공  
- `requestId X / 적용여부: SUCCESS` - UI 반영 성공
- `overrideEvents: N` - 누적된 override 이벤트 수

#### **시나리오 B 관련:**
- `벌크 생성 시작:` - Weekly 패턴 적용 시작
- `생성갱신건수: N` - 생성/갱신된 weekly 이벤트 수
- `override보존건수: N` - 보존된 override 이벤트 수
- `weeklyEvents: N, overrideEvents: N` - 각 소스별 이벤트 분포

### **3) 테스트 실행 방법**

1. **앱 실행 후 개발자 콘솔 열기**
2. **시나리오 A 테스트:**
   - 날짜 롱프레스 → 시간 추가
   - 같은 날짜 다시 롱프레스 → 다른 시간 추가
   - 로그에서 `overrideEvents` 누적 확인
3. **시나리오 B 테스트:**
   - Weekly Schedule 설정
   - 특정 날짜만 롱프레스로 변경
   - 다른 동일 요일 확인

### **4) 성공 판정 기준**

#### **시나리오 A 성공:**
- ✅ `overrideEvents` 수가 누적됨 (1 → 2)
- ✅ `requestId` 가드 SUCCESS
- ✅ UI에서 두 시간 모두 표시

#### **시나리오 B 성공:**  
- ✅ `override보존건수` 유지됨
- ✅ `weeklyEvents` 수 변하지 않음
- ✅ 다른 요일은 원래 시간 유지

---

## 🎯 **문제 진단 가이드**

### **시나리오 A 실패 시:**
- `overrideEvents` 수가 증가하지 않음 → 중복 제거 로직 확인
- `requestId` BLOCKED → 경쟁 상태 발생, 재시도 필요
- UI에서 이전 시간 사라짐 → key 안정성 확인

### **시나리오 B 실패 시:**
- `override보존건수` 감소 → Weekly Apply가 override 삭제함  
- 다른 요일도 변경됨 → 문서 ID 패턴 또는 날짜 필터링 문제
- `weeklyEvents` 수 변경 → 예상치 못한 Weekly 재적용

---

## 📝 **추가 검증 항목**

1. **데이터베이스 확인**: Firestore에서 실제 문서 ID 패턴 확인
2. **성능 확인**: 대량 데이터에서도 중복 제거 및 가드 동작 확인  
3. **네트워크 지연**: 느린 네트워크에서 requestId 가드 효과 확인
4. **동시성 테스트**: 빠른 연속 클릭 시 데이터 일관성 확인
