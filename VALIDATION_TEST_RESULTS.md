# Validation 수정 결과 확인 및 재현 테스트

## 🔧 수정 사항 요약

### 문제점
- **주 원인**: `validateGoalByCalendarEvents()` 호출 시 `await` 누락으로 검증 결과를 기다리지 않고 즉시 다음 단계로 진행
- **부차 문제**: SimpleDatePicker에서 검증 우회 경로 존재, UI 피드백 부족

### 핵심 수정
1. **🛑 Early Return 패턴**: 검증 실패 시 `return`으로 조기 종료 → REVIEW 진행 차단
2. **🔒 경쟁 상태 방지**: RequestId 패턴으로 마지막 검증만 유효 처리
3. **🎯 중복 경로 제거**: SimpleDatePicker의 검증 우회 경로 차단
4. **✨ UI 피드백 강화**: 검증 상태별 명확한 버튼 텍스트 및 에러 배너

---

## 📋 수동 재현 테스트 체크리스트

### ❌ 실패 시나리오 테스트

#### 테스트 케이스 1: 빈도 부족
**설정**: 주 3회 필요한 목표에 주 2회만 일정 설정

1. **준비**:
   - 새 목표 생성 (AI: "주 3회 운동하기")
   - Schedule 단계에서 월/수 2일만 시간 설정
   - Console 열어 로그 확인

2. **실행**: Next 버튼 클릭

3. **예상 결과**:
   ```javascript
   [Next] pressed
   [Next] setValidating(true)
   [Next] calling validate…
   [Validation Start] start=... end=... events=6  // 3주 * 2회 = 6
   [Validation End] ok=false reason=주 3회 필요하지만 2회만 확인됨
   [Next] validate result: ok=false reason=주 3회 필요하지만 2회만 확인됨
   [Validation End: FAIL] 검증 실패
   [Next] setValidating(false)
   // ❌ [Next] advancing to REVIEW 로그가 없어야 함
   ```

4. **UI 확인**:
   - ✅ 빨간 에러 배너 표시: "Schedule Requirements Not Met"
   - ✅ 버튼 텍스트: "Fix Issues" (회색, 비활성화)
   - ✅ 경고 아이콘 표시
   - ✅ Step이 1(Schedule)에 머물러 있음 (2로 진행 안 됨)

---

#### 테스트 케이스 2: 요일 부족
**설정**: 다양한 요일 필요하지만 한 요일만 설정

1. **준비**:
   - 새 목표 생성 (AI: "매일 독서하기")
   - Schedule 단계에서 월요일에만 3번 시간 설정

2. **실행**: Next 버튼 클릭

3. **예상 결과**:
   ```javascript
   [Validation End] ok=false reason=월요일과 수요일에 일정이 필요하지만 없음
   [Validation End: FAIL] 검증 실패
   ```

4. **UI 확인**:
   - ✅ 에러 배너: 누락된 요일 명시
   - ✅ Step 진행 차단

---

### ✅ 성공 시나리오 테스트

#### 테스트 케이스 3: 수정 후 성공
**설정**: 이전 실패 케이스에서 일정 추가

1. **준비**: 케이스 1에서 계속, 금요일 시간 추가

2. **실행**: Next 버튼 다시 클릭

3. **예상 결과**:
   ```javascript
   [Next] pressed
   [Next] setValidating(true)
   [Next] calling validate…
   [Validation Start] start=... end=... events=9  // 3주 * 3회 = 9
   [Validation End] ok=true reason=
   [Next] validate result: ok=true reason=
   [Validation End: OK] 검증 성공
   [Next] advancing to REVIEW  // ✅ 이 로그가 있어야 함
   ```

4. **UI 확인**:
   - ✅ 에러 배너 사라짐
   - ✅ Step이 2(Review)로 진행
   - ✅ 버튼 정상 상태 복귀

---

### 🔄 로딩 상태 테스트

#### 테스트 케이스 4: 버튼 상태 변화
**설정**: 검증 과정 중 UI 상태 확인

1. **실행**: Next 버튼 클릭 후 즉시 버튼 상태 확인

2. **예상 결과**:
   ```
   클릭 순간: [파랑] "Next" → [회색] "Validating..." + 스피너
   검증 완료 후: 
   - 실패 시: [회색] "Fix Issues" + 경고 아이콘
   - 성공 시: [파랑] "Next" + 화살표 (Step 진행)
   ```

---

### 🏁 경쟁 상태 테스트

#### 테스트 케이스 5: 빠른 중복 클릭
**설정**: Next 버튼 연속 클릭

1. **실행**: Next 버튼을 빠르게 여러 번 클릭

2. **예상 결과**:
   ```javascript
   [Next] pressed
   [Next] setValidating(true)
   [Next] pressed  // 두 번째 클릭
   [CreateGoalModal] 스케줄 검증 중복 요청 차단  // ✅ 차단됨
   ```

3. **UI 확인**:
   - ✅ 중복 검증 실행되지 않음
   - ✅ 하나의 요청만 처리

---

## 🎯 최종 검증 포인트

### ❌ 이제 일어나면 안 되는 것들
- [ ] 검증 실패했는데 Review 단계로 진행
- [ ] `[Next] advancing to REVIEW` 로그가 실패 시나리오에서 출력
- [ ] 에러 상태에서 Next 버튼이 활성화
- [ ] 중복 검증 요청 실행

### ✅ 반드시 확인해야 할 것들
- [ ] 실패 시: Early return으로 조기 종료 (`return` 후 더 이상 실행 안 됨)
- [ ] 성공 시: `goToStep(2)` 호출로 Review 진행
- [ ] UI 일관성: 버튼 텍스트/색상/비활성화 상태 정확
- [ ] 로그 순서: pressed → setValidating(true) → validate → result → setValidating(false)
- [ ] 경쟁 상태: requestId 체크로 최신 요청만 처리

---

## 🔧 디버깅 가이드

### 문제가 여전히 발생한다면

#### 1. 로그 확인
```javascript
// 이 순서로 로그가 나와야 함
[Next] pressed
[Next] setValidating(true)
[Next] calling validate…
[Validation End] ok=false reason=...
[Next] validate result: ok=false reason=...
[Validation End: FAIL] 검증 실패
[Next] setValidating(false)

// 절대 나오면 안 되는 로그 (실패 시)
[Next] advancing to REVIEW  ← 이게 있으면 문제!
```

#### 2. 코드 체크 포인트
- `src/components/CreateGoalModal.tsx:921-927`: Early return 로직
- `src/components/SimpleDatePicker.tsx:1508-1514`: 검증 경로 확인
- `src/services/ai.ts:1858`: validateGoalByCalendarEvents 동기 함수

#### 3. 일반적인 실수들
- `await` 추가하지 마세요 (이미 동기 함수)
- `then()` 체이닝 사용하지 마세요
- 검증 전에 `goToStep(2)` 호출하지 마세요

---

## 📊 테스트 결과 기록

### 테스트 실행 일시: [기록 필요]

| 테스트 케이스 | 실행 결과 | 로그 확인 | UI 확인 | 비고 |
|---------------|-----------|-----------|---------|------|
| 빈도 부족 | ⬜ Pass/Fail | ⬜ OK | ⬜ OK | |
| 요일 부족 | ⬜ Pass/Fail | ⬜ OK | ⬜ OK | |
| 수정 후 성공 | ⬜ Pass/Fail | ⬜ OK | ⬜ OK | |
| 로딩 상태 | ⬜ Pass/Fail | ⬜ OK | ⬜ OK | |
| 중복 클릭 | ⬜ Pass/Fail | ⬜ OK | ⬜ OK | |

### 종합 평가: ⬜ 수정 성공 / ⬜ 추가 수정 필요

---

## 🏆 성공 기준

**✅ 모든 테스트 케이스 통과**: 검증 실패 시 Review로 진행하지 않고, 성공 시에만 진행하는 것이 확인됨
