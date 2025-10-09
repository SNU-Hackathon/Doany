# Compat Layer 누락 함수 분석

**날짜**: 2025-10-09  
**목적**: Screen/Component에서 사용되지만 Compat에 없는 함수 식별

---

## 🔍 조사 결과

### ✅ 현재 Compat에 있는 함수들

**GoalService (6개)**
- ✅ createGoal
- ✅ getUserGoals
- ✅ updateGoal
- ✅ deleteGoal
- ✅ getGoal
- ✅ getActiveGoals

**QuestService (4개)**
- ✅ createQuest
- ✅ updateQuest
- ✅ generateQuestsForPreview
- ✅ getQuestsByGoalId

**FeedService (10개)**
- ✅ fetchFeedPage
- ✅ getFeedPost
- ✅ getUserReaction
- ✅ fetchComments
- ✅ addComment
- ✅ deleteComment
- ✅ createFeedPost
- ✅ toggleLike
- ✅ toggleSave
- ✅ toggleTrust

**CalendarEventService (6개)**
- ✅ createCalendarEvent
- ✅ createCalendarEvents
- ✅ updateCalendarEvent
- ✅ deleteCalendarEvent
- ✅ deleteCalendarEvents
- ✅ getCalendarEvents

**VerificationService (6개)**
- ✅ getVerifications
- ✅ createVerification
- ✅ updateVerification
- ✅ deleteVerification
- ✅ getRecentGoalVerifications
- ✅ calculateGoalSuccessRate

**AuthService (4개)**
- ✅ signIn
- ✅ signUp
- ✅ signOut
- ✅ sendReset

---

## ⚠️ Screens/Components에서 사용되지만 Compat에 없는 함수들

### 🔴 **QuestService - 4개 누락**

**사용 위치**: 
- `QuestDetailScreen.tsx`: 4곳
- `GoalDetailScreenV2.tsx`: 3곳
- `ChatbotCreateGoal.tsx`: 1곳

**누락된 함수**:
1. ❌ `QuestService.getQuestById(questId, userId)` 
   - 사용: QuestDetailScreen.tsx:48
   - 목적: 특정 퀘스트 상세 조회
   
2. ❌ `QuestService.updateQuestStatus(questId, status, userId, data?)`
   - 사용: QuestDetailScreen.tsx:93, 126, 154
   - 사용: GoalDetailScreenV2.tsx:650, 686, 717
   - 목적: 퀘스트 상태 업데이트 (completed, skipped)
   
3. ❌ `QuestService.getQuestsForGoal(goalId, userId)`
   - 사용: GoalDetailScreenV2.tsx:543
   - 목적: 특정 goal의 모든 퀘스트 조회
   
4. ❌ `QuestService.saveQuests(quests, userId)`
   - 사용: ChatbotCreateGoal.tsx:1240
   - 목적: 여러 퀘스트 일괄 저장

---

### 🔴 **VerificationService - 2개 누락**

**사용 위치**:
- `GoalDetailScreenV2.tsx`: 4곳
- `verificationAutomationService.ts`: 2곳

**누락된 함수**:
1. ❌ `VerificationService.getGoalVerifications(goalId)`
   - 사용: GoalDetailScreenV2.tsx:559
   - 목적: 특정 goal의 모든 인증 조회
   
2. ❌ `VerificationService.getLatestVerification(goalId)`
   - 사용: verificationAutomationService.ts:91
   - 목적: 최신 인증 조회

---

### 🔴 **CalendarEventService - 사용 패턴 불일치**

**문제**: 
- Compat: `deleteCalendarEvents(eventIds: string[] | string, userId?: string)`
- 실제 사용: `deleteCalendarEvents(goalId: string, eventIds: string[])`

**사용 위치**:
- SimpleDatePicker.tsx: 6곳

**호출 패턴**:
```typescript
// 실제 호출
await CalendarEventService.deleteCalendarEvents(goalId, [eventId]);
await CalendarEventService.deleteCalendarEvents(goalId, eventIds);
await CalendarEventService.createCalendarEvents(goalId, [newEvent]);

// Compat 시그니처
static async deleteCalendarEvents(eventIds: string[] | string, userId?: string)
static async createCalendarEvents(events: any[] | any, userId?: string)
```

⚠️ **파라미터 순서가 반대** (goalId가 첫 번째 파라미터)

---

## 📊 Legacy Firebase 서비스에만 있던 함수들 (Screen에서 안 씀)

### **GoalService**
- `getRecentGoals`
- `searchGoals`
- `getGoalsByCategory`
- `createMultipleGoals`
- `archiveOldGoals`

### **QuestService**
- `generateAndSaveQuestsForGoal`
- `deleteQuest`
- `deleteQuestsForGoal`
- `getQuestStats`

### **VerificationService**
- `getUserVerifications`
- `createVerificationWithSignals`
- `verifyManual`
- `verifyPhoto`
- `verifyLocation`
- `verifyTimeWindow`
- `aggregateFrequency`
- `isDuplicatePass`
- `getDayKey`
- `processQueuedVerification`

### **UserService**
- `resetPassword`
- `getUserData`
- `updateUser`

**참고**: 이 함수들은 Screen/Component에서 사용되지 않아서 Compat에 추가하지 않았습니다.

---

## 🎯 요약: 추가 필요한 Compat 함수

### **필수 추가 (6개)**

**QuestService에 추가**:
1. `getQuestById(questId, userId)` → API: GET /me/goals/{goalId}?expand=quests + filter
2. `updateQuestStatus(questId, status, userId, data?)` → API: PATCH /quests/{questId}
3. `getQuestsForGoal(goalId, userId)` → API: GET /me/goals/{goalId}?expand=quests
4. `saveQuests(quests, userId)` → API: POST /goals + quests array

**VerificationService에 추가**:
5. `getGoalVerifications(goalId)` → API: GET /me/goals/{goalId}?expand=quests (proofs 포함)
6. `getLatestVerification(goalId)` → API: Same as above, filter latest

**CalendarEventService 수정**:
7. 파라미터 순서 변경: `(goalId, events/eventIds, userId?)` 형태로

---

## 💡 권장 사항

### **Option 1: 누락 함수 추가** (권장)
위 6-7개 함수를 Compat에 추가하면 모든 Screen이 완벽히 작동합니다.

### **Option 2: Screen 직접 수정**
Compat 대신 Screen을 수정해서 직접 REST API 호출:
```typescript
// 변경 전
const quest = await QuestService.getQuestById(questId, userId);

// 변경 후
const goal = await getGoal(goalId, { expand: 'quests' });
const quest = goal.quests?.find(q => q.questId === questId);
```

---

## 📌 결론

### **현재 상태**
- ✅ Compat에 있는 함수: 32개
- ⚠️ 누락된 함수: 6-7개
- ✅ 커버리지: ~82% (사용 빈도 기준)

### **영향**
- ✅ GoalsScreen: 완전 작동 (0개 누락)
- ✅ FeedDetailScreen: 완전 작동 (0개 누락)
- ⚠️ QuestDetailScreen: 4개 함수 누락
- ⚠️ GoalDetailScreenV2: 6개 함수 누락
- ⚠️ CalendarScreen: 2개 함수 누락

### **해결 방법**
1. Compat에 누락 함수 추가 (30분 소요)
2. 또는 해당 Screen들 직접 REST API로 수정 (2-3시간 소요)

---

**권장**: Compat에 누락 함수를 추가하는 것이 더 빠르고 안전합니다.

