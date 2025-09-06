# 통합 테스트 시나리오

이 문서는 Weekly Schedule과 Calendar Override 시스템의 통합 테스트 시나리오를 정의합니다.

## 🎯 핵심 테스트 시나리오

### **시나리오 A: "롱프레스가 하루만 바꾸는지"**

**목적**: 롱프레스 override가 특정 날짜에만 영향을 주고, 같은 요일의 다른 날짜는 영향받지 않는지 확인

#### **Given (초기 상태):**
- Weekly 패턴: 화요일 09:00 설정
- 기간: 2025-08-01 ~ 2025-08-31 (4주간)
- 예상 화요일들: 2025-08-05, 2025-08-12, 2025-08-19, 2025-08-26

#### **When (액션):**
1. 달력에서 2025-08-26(화요일) 롱프레스
2. DateEditModal에서 08:00 추가
3. 저장 버튼 클릭

#### **Then (기대 결과):**
**✅ 개별 날짜 확인:**
- **2025-08-26**: 08:00 (orange, override) + 09:00 (blue, weekly) 두 시간 모두 표시
- **2025-08-05**: 09:00 (blue, weekly)만 표시
- **2025-08-12**: 09:00 (blue, weekly)만 표시  
- **2025-08-19**: 09:00 (blue, weekly)만 표시

**✅ Weekly Schedule 카드 확인:**
- **Basic Pattern**: "화 09:00" (파란색 배지)
- **Override Times**: "08:00" (주황색 배지, ! 마크)
- **화요일 옆에 주황색 점 표시** (override 존재 표시)

**✅ 데이터베이스 확인:**
```
Collection: users/{userId}/calendarEvents
Documents:
- {goalId}_2025-08-05_09:00_weekly (source: 'weekly')
- {goalId}_2025-08-12_09:00_weekly (source: 'weekly')
- {goalId}_2025-08-19_09:00_weekly (source: 'weekly')
- {goalId}_2025-08-26_09:00_weekly (source: 'weekly')
- {goalId}_2025-08-26_08:00_override (source: 'override') ← 추가된 override
```

---

### **시나리오 B: "요약 반영"**

**목적**: Weekly Schedule 카드가 CalendarEvent 기반으로 정확한 요약을 표시하는지 확인

#### **Given (시나리오 A 완료 상태):**
- Weekly 패턴: 화요일 09:00
- Override: 2025-08-26에 08:00 추가

#### **When (확인 액션):**
1. CreateGoalModal의 Schedule 단계에서 Weekly Schedule 카드 확인
2. Edit 모드와 Display 모드 모두 확인

#### **Then (기대 결과):**

**✅ Edit 모드 표시:**
```
화 [2 times] [Override 1 override] [Add time]

Basic Pattern:
- 09:00 (파란색 배지)

Override Times:
- 08:00 (주황색 배지, ! 마크)
- "Override times added via calendar long-press"
```

**✅ Display 모드 표시:**
```
화 🟠  09:00  08:00●
     (파란색) (주황색+점)
```

**✅ 로그 확인:**
```
[SimpleDatePicker] Auto-updating Weekly Schedule summary based on calendarEvents: {
  eventsCount: 5,
  weeklyEvents: 4,
  overrideEvents: 1
}
```

---

## 🔍 추가 검증 시나리오

### **시나리오 C: "Multiple Override Days"**
- 여러 날짜에 override 추가 후 각각 독립적으로 관리되는지 확인
- 2025-08-05에 10:00 override, 2025-08-19에 11:00 override 추가

### **시나리오 D: "Override Deletion"**
- Override 삭제 시 해당 날짜만 영향받고 weekly 패턴은 유지되는지 확인

### **시나리오 E: "Weekly Pattern Change"**
- Weekly 패턴 변경 시 override는 보존되고 weekly 이벤트만 갱신되는지 확인

---

## 🧪 수동 테스트 가이드

### **테스트 준비:**
1. CreateGoalModal 열기
2. Schedule 단계로 이동
3. 시작일: 2025-08-01, 종료일: 2025-08-31 설정
4. Weekly Schedule에서 화요일 선택 후 09:00 추가

### **시나리오 A 실행:**
1. **달력 스크롤**: 8월 26일 화요일 찾기
2. **롱프레스**: 2025-08-26 날짜 롱프레스
3. **시간 추가**: DateEditModal에서 08:00 입력 후 Add 클릭
4. **결과 확인**: 
   - 8/26에 08:00, 09:00 두 시간 표시되는지 확인
   - 다른 화요일들(8/5, 8/12, 8/19)은 09:00만 표시되는지 확인

### **시나리오 B 실행:**
1. **상단 카드 확인**: Weekly Schedule 카드에서 Basic Pattern과 Override Times 구분 표시 확인
2. **Edit 모드**: "Edit Schedule" 버튼 클릭 후 상세 표시 확인
3. **Visual 확인**: 파란색(weekly) vs 주황색(override) 구분 확인

---

## 🐛 알려진 이슈 / 제한사항

1. **로컬 상태 vs DB 동기화**: 네트워크 오류 시 로컬 상태와 DB 불일치 가능
2. **대량 데이터**: 긴 기간(6개월+)에서 성능 테스트 필요
3. **타임존**: Asia/Seoul 고정, 다른 타임존 지원 필요 시 추가 구현

---

## 📝 테스트 로그 모니터링

### **성공 로그 패턴:**
```
[CalendarEventService] Upserted override event: {goalId}_2025-08-26_08:00_override (date-specific only)
[SimpleDatePicker] Auto-updating Weekly Schedule summary based on calendarEvents
[SimpleDatePicker] Added time to ONLY this specific date: { date: "2025-08-26", time: "08:00", affectedOtherDates: false }
```

### **실패 로그 패턴:**
```
[CalendarEventService] Error upserting override event: ...
[SimpleDatePicker] Error in handleDateLongPress: ...
```

이 시나리오들을 통해 Weekly Schedule과 Override 시스템의 완전한 동작을 검증할 수 있습니다.
