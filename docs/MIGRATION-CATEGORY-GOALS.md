# Category 1: Goals Migration

**Status**: 🔄 In Progress  
**Date**: 2025-10-09

---

## 📋 Inventory

### Files
- **Legacy**: `src/legacy/firebase/services/goalService.ts` (archived)
- **Compat**: `src/compat/goalService.ts` (current adapter)
- **New API**: `src/api/goals.ts` (REST API v1.3)
- **Service Shim**: `src/services/goalService.ts` (to be created as thin re-export)

### API Endpoints
- `GET /me/goals` → `getMyGoals(query)`
- `GET /me/goals/{goalId}` → `getGoal(goalId, query)`
- `POST /goals` → `createGoal(body)`
- `PATCH /goals/{goalId}` → `patchGoal(goalId, body)`
- `DELETE /goals/{goalId}` → `deleteGoal(goalId)`

---

## 🗺️ Function Mapping Table

| Legacy Function (Caller) | New API Function | Endpoint | Used By | Status |
|-------------------------|------------------|----------|---------|--------|
| `createGoal(data)` | `createGoal(body)` | POST /goals | CalendarScreen, CreateGoalModal, ChatbotCreateGoal | ✅ |
| `getActiveGoals(userId)` | `getMyGoals({ state: 'onTrack' })` | GET /me/goals?state=onTrack | CalendarScreen | ✅ |
| `getUserGoals(userId)` | `getMyGoals({ page, pageSize })` | GET /me/goals | GoalsScreen (via hook) | ✅ |
| `getGoal(goalId)` | `getGoal(goalId, { expand })` | GET /me/goals/{goalId} | GoalDetailScreenV2 | ✅ |
| `updateGoal(goalId, updates)` | `patchGoal(goalId, body)` | PATCH /goals/{goalId} | - | ✅ |
| `deleteGoal(goalId)` | `deleteGoal(goalId)` | DELETE /goals/{goalId} | - | ✅ |

### Unused Legacy Functions (not in screens)
- `getRecentGoals` - not used
- `searchGoals` - not used
- `getGoalsByCategory` - not used
- `createMultipleGoals` - not used
- `archiveOldGoals` - not used

---

## 🔄 Adapters Needed

### Status Normalization
```typescript
// Legacy: "completed" | "ontrack" | "fail"
// New API: "complete" | "onTrack" | "fail"

function normalizeStatus(legacy: string): string {
  if (legacy === "completed") return "complete";
  if (legacy === "ontrack") return "onTrack";
  return legacy;
}
```

### User ID
```typescript
// Legacy: user.uid
// New: user.id
// Accept both in function signatures
```

### Timestamps
```typescript
// Legacy: Firestore Timestamp or Date
// New: number (epoch seconds) or string (ISO)
// Normalize to number for API
```

---

## ✅ Validation Checklist

- [ ] Service shim created (`src/services/goalService.ts`)
- [ ] Re-exports from `src/api/goals.ts`
- [ ] Adapters for status/id normalization
- [ ] TypeScript compiles (`tsc --noEmit`)
- [ ] CalendarScreen works with mocks
- [ ] GoalDetailScreenV2 works with mocks
- [ ] CreateGoalModal works with mocks

---

## 📝 Implementation Plan

1. Create `src/services/goalService.ts` as thin re-export
2. Add adapter functions for status normalization
3. Test CalendarScreen
4. Test GoalDetailScreenV2
5. Test CreateGoalModal
6. Commit: `refactor(goals): rewire services to api, align types, green build`

---

**Next Category**: Quests (after Goals is green)

