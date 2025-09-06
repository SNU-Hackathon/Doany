# E2E 테스트 시나리오: Weekly 스케줄 및 Override 기능

## 테스트 목표
전체 흐름이 정상 동작하는지 E2E 수준으로 확인하고, 로깅을 통해 각 단계를 검증합니다.

## 시나리오 설정
- **목표**: "주 4회 이상"
- **기간**: 8~22일 (15일간, 2주 + 1일)
- **초기 상태**: 
  - 8~14일 구간: 3회 (1주차, 미달)
  - 15~21일 구간: 4회 (2주차, 충족)
  - 22일: 1회 (부분주)

## 테스트 단계

### 1단계: 초기 목표 생성 및 실패 확인
1. **목표 생성**
   ```
   AI 프롬프트: "매주 4번 이상 운동하기"
   기간: 2024-01-08 ~ 2024-01-22 (15일간)
   요일 선택: 월, 화, 수 (주 3회만 설정)
   ```

2. **예상 결과**: Next 버튼 클릭 시 validation 실패
   ```
   [Validation Start] 스케줄 검증 시작
   [Validation Result] 완전 주 수: 2
   [Validation Result] 각 블록 집계 결과:
     - frequency: { passed: false, details: "1주차: 3회 < 4회 (미달)" }
     - weekday: { passed: true, details: "요일 제약 없음" }
     - time: { passed: true, details: "시간 제약 없음" }
   [Validation Result] 실패 사유 요약: 주간 빈도 미달
   [Validation End: FAIL] 검증 실패
   ```

### 2단계: Override 추가로 문제 해결
1. **달력 롱프레스로 Override 추가**
   - 1월 11일(목) 추가 → 1주차 총 4회로 증가

2. **예상 결과**: Next 버튼 클릭 시 validation 성공
   ```
   [Validation Start] 스케줄 검증 시작
   [Validation Result] 완전 주 수: 2
   [Validation Result] 각 블록 집계 결과:
     - frequency: { passed: true, details: "모든 완전 주가 최소 빈도 충족" }
     - weekday: { passed: true, details: "요일 제약 없음" }
     - time: { passed: true, details: "시간 제약 없음" }
   [Validation End: OK] 검증 성공
   ```

### 3단계: Firestore 저장 및 CalendarEvent 생성 확인
1. **예상 로그**
   ```
   [GoalPayload Before Sanitize] { title: "매주 4번 이상 운동하기", ... }
   [GoalPayload After Sanitize] { title: "매주 4번 이상 운동하기", ... }
   [Firestore Write] Committing goal creation batch...
   [Firestore Write] Goal created successfully with ID: abc123
   [GoalService] Weekly schedule synced to calendar events for goal: abc123
   ```

### 4단계: GoalDetailScreen에서 CalendarEvent 확인
1. **생성된 Goal 상세 화면 진입**
2. **예상 결과**: 
   - 월, 화, 수 요일에 weekly 소스 이벤트 생성
   - 1월 11일(목)에 override 소스 이벤트 생성
   - 총 CalendarEvent: 주간 패턴 6개 + override 1개 = 7개

## 로그 체크포인트

### Validation 로그
- `[Validation Start]`: 검증 시작
- `[Validation Result] 완전 주 수`: 완전 주 개수
- `[Validation Result] 각 블록 집계 결과`: 빈도/요일/시간 체크 상세
- `[Validation End: OK/FAIL]`: 최종 결과

### Firestore 로그
- `[GoalPayload Before Sanitize]`: 원본 데이터
- `[GoalPayload After Sanitize]`: 정제된 데이터
- `[Firestore Write]`: 저장 과정
- `[Firestore Write Error]`: 오류 시 payload 스냅샷

### CalendarEvent 로그
- `[CalendarEventService] Synced weekly schedule`: 동기화 성공
- `[GoalService] Weekly schedule synced to calendar events`: Goal 생성 후 동기화

## 수동 QA 체크리스트

### ✅ UI 동작 확인
- [ ] AI 프롬프트 입력 후 GoalSpec 생성
- [ ] 스케줄 단계에서 요일 선택
- [ ] Next 버튼 클릭 시 validation 동작
- [ ] 실패 시 오류 메시지 표시
- [ ] 달력 롱프레스로 override 추가
- [ ] 성공 시 Review 단계로 진행
- [ ] Goal 저장 후 목록에 표시

### ✅ 데이터 정합성 확인
- [ ] Firestore에 Goal 문서 생성
- [ ] CalendarEvent 컬렉션에 이벤트 생성
- [ ] weekly 소스 이벤트와 override 소스 이벤트 구분
- [ ] GoalDetailScreen에서 이벤트 정상 로드

### ✅ 로그 출력 확인
- [ ] 각 단계별 로그가 명확하게 출력
- [ ] 실패 사유가 구체적으로 표시
- [ ] 에러 발생 시 payload 스냅샷 포함

## 예상 결과

### 성공 시나리오
1. 초기 설정으로 validation 실패 (예상됨)
2. Override 추가 후 validation 성공
3. Goal 및 CalendarEvent 정상 생성
4. GoalDetailScreen에서 스케줄 정상 표시

### 실패 시나리오 대응
- Validation 실패: 구체적인 오류 메시지와 수정 가이드
- Firestore 오류: payload 스냅샷과 함께 오류 로그
- CalendarEvent 동기화 실패: Goal은 생성되지만 warning 로그
