# Step 1: Goals Migration - Detailed Plan

**Target**: Remove `compat/goalService.ts`, migrate screens to use `api/goals.ts` directly

---

## 📋 Current State

### Files Importing goalService (4 files)
1. `src/screens/CalendarScreen.tsx`
2. `src/screens/GoalDetailScreenV2.tsx`
3. `src/components/CreateGoalModal.tsx`
4. `src/components/chatbot/ChatbotCreateGoal.tsx`

---

## 🗺️ Function Mapping

| File | Legacy Call | New API Function | Endpoint | Notes |
|------|-------------|------------------|----------|-------|
| CalendarScreen | `GoalService.getActiveGoals(user.id)` | `getMyGoals({ state: 'onTrack' })` | GET /me/goals | Filter onTrack state |
| GoalDetailScreenV2 | `GoalService.getGoal(goalId)` | `getGoal(goalId, { expand: 'quests' })` | GET /me/goals/{goalId} | Expand quests |
| CreateGoalModal | `GoalService.createGoal(data)` | `createGoal(body)` | POST /goals | Direct call |
| ChatbotCreateGoal | `GoalService.createGoal(data)` | `createGoal(body)` | POST /goals | Direct call |

---

## 🔄 Migration Plan

### 1. CalendarScreen.tsx
**Before**:
```typescript
import { GoalService } from '../compat/goalService';
const goals = await GoalService.getActiveGoals(user.id);
```

**After**:
```typescript
import { getMyGoals } from '../api/goals';
const response = await getMyGoals({ state: 'onTrack', page: 1, pageSize: 100 });
const goals = response.items.map(item => ({...})); // Transform to Goal type
```

---

### 2. GoalDetailScreenV2.tsx
**Before**:
```typescript
import { GoalService } from '../compat/goalService';
const goal = await GoalService.getGoal(goalId);
```

**After**:
```typescript
import { getGoal } from '../api/goals';
const goal = await getGoal(goalId, { expand: 'quests' });
// Use GoalDetail type from api/types
```

---

### 3. CreateGoalModal.tsx
**Before**:
```typescript
import { GoalService } from '../compat/goalService';
const goalId = await GoalService.createGoal(goalData);
```

**After**:
```typescript
import { createGoal } from '../api/goals';
import type { CreateGoalRequest } from '../api/types';

const body: CreateGoalRequest = {
  title: goalData.title,
  description: goalData.description,
  // ... map fields
};
const result = await createGoal(body);
const goalId = result.goalId;
```

---

### 4. ChatbotCreateGoal.tsx
**Before**:
```typescript
import { GoalService } from '../compat/goalService';
const goalId = await GoalService.createGoal(goalFormData);
```

**After**:
```typescript
import { createGoal } from '../api/goals';
import type { CreateGoalRequest } from '../api/types';

const body: CreateGoalRequest = {...};
const result = await createGoal(body);
const goalId = result.goalId;
```

---

## ✅ Validation Steps

After migration:
1. [ ] Check imports: `grep "compat/goalService" src/` → 0 results
2. [ ] TypeScript: `tsc --noEmit` → green
3. [ ] Delete: `rm src/compat/goalService.ts`
4. [ ] Test CalendarScreen with mocks
5. [ ] Test GoalDetailScreenV2 with mocks
6. [ ] Test CreateGoalModal with mocks
7. [ ] Commit: `refactor(goals): migrate to api/goals directly, remove compat layer`

---

**Ready to proceed with migration**

