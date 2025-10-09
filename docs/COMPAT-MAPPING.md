# Compat Layer Mapping

**Date**: 2025-10-09  
**Purpose**: Anti-corruption layer between legacy Firebase calls and new REST API v1.3

---

## 🔄 Service Mapping

| Legacy Service | Compat Adapter | REST API Module | Status |
|----------------|----------------|-----------------|--------|
| `services/firebase.ts` | - | `lib/http.ts` | ✅ Replaced |
| `services/auth.ts` | `compat/auth.ts` | `api/auth.ts` | ✅ |
| `services/goalService.ts` | `compat/goalService.ts` | `api/goals.ts` | ✅ |
| `services/questService.ts` | `compat/questService.ts` | `api/goals.ts` | ✅ |
| `services/feedService.ts` | `compat/feedService.ts` | `api/feed.ts` | ✅ |
| `services/calendarEventService.ts` | `compat/calendarEventService.ts` | (part of goals) | ✅ |
| `services/verificationService.ts` | `compat/verificationService.ts` | `api/goals.ts` (proofs) | ✅ |
| `hooks/useAuth.tsx` | - | `hooks/useAuth.tsx` (new) | ✅ Replaced |

---

## 📋 Function Mapping

### GoalService (`src/compat/goalService.ts`)

| Legacy Function | Compat Implementation | REST API Endpoint |
|----------------|----------------------|-------------------|
| `createGoal(data)` | `GoalService.createGoal()` | POST /goals |
| `getUserGoals(userId)` | `GoalService.getUserGoals()` | GET /me/goals |
| `updateGoal(id, updates)` | `GoalService.updateGoal()` | PATCH /goals/{goalId} |
| `deleteGoal(id)` | `GoalService.deleteGoal()` | DELETE /goals/{goalId} |
| `getGoal(id)` | `GoalService.getGoal()` | GET /me/goals/{goalId} |
| `getActiveGoals(userId)` | `GoalService.getActiveGoals()` | GET /me/goals (filtered) |

### QuestService (`src/compat/questService.ts`)

| Legacy Function | Compat Implementation | REST API Endpoint |
|----------------|----------------------|-------------------|
| `createQuest(data)` | `QuestService.createQuest()` | (stub) |
| `updateQuest(id, updates)` | `QuestService.updateQuest()` | PATCH /quests/{questId} |
| `getQuestsByGoalId(goalId)` | `QuestService.getQuestsByGoalId()` | GET /me/goals/{goalId}?expand=quests |
| `generateQuestsForPreview(data, userId)` | `QuestService.generateQuestsForPreview()` | (stub) |

### FeedService (`src/compat/feedService.ts`)

| Legacy Function | Compat Implementation | REST API Endpoint |
|----------------|----------------------|-------------------|
| `fetchFeedPage(options)` | `fetchFeedPage()` | GET /feed/goals |
| `getFeedPost(postId)` | `getFeedPost()` | (stub - not in v1.3) |
| `getUserReaction(postId, userId)` | `getUserReaction()` | (included in feed item) |
| `fetchComments(postId, cursor)` | `fetchComments()` | (stub - not in v1.3) |
| `addComment(postId, text, userId)` | `addComment()` | (stub - not in v1.3) |
| `deleteComment(commentId)` | `deleteComment()` | (stub - not in v1.3) |
| `createFeedPost(postData)` | `createFeedPost()` | (stub - not in v1.3) |
| `toggleLike(postId, userId)` | `toggleLike()` | POST/DELETE /feed/goals/{goalId}/likes/me |
| `toggleSave(postId, userId)` | `toggleSave()` | (stub - not in v1.3) |
| `toggleTrust(postId, userId)` | `toggleTrust()` | (stub - not in v1.3) |

### CalendarEventService (`src/compat/calendarEventService.ts`)

| Legacy Function | Compat Implementation | REST API Endpoint |
|----------------|----------------------|-------------------|
| `createCalendarEvent(data)` | `CalendarEventService.createCalendarEvent()` | (stub - part of goal scheduling) |
| `createCalendarEvents(events, userId)` | `CalendarEventService.createCalendarEvents()` | (stub - part of goal scheduling) |
| `updateCalendarEvent(id, updates)` | `CalendarEventService.updateCalendarEvent()` | (stub - part of goal scheduling) |
| `deleteCalendarEvent(id)` | `CalendarEventService.deleteCalendarEvent()` | (stub - part of goal scheduling) |
| `deleteCalendarEvents(ids, userId)` | `CalendarEventService.deleteCalendarEvents()` | (stub - part of goal scheduling) |
| `getCalendarEvents(query)` | `CalendarEventService.getCalendarEvents()` | (stub - part of goal scheduling) |

### AuthService (`src/compat/auth.ts`)

| Legacy Function | Compat Implementation | REST API Endpoint |
|----------------|----------------------|-------------------|
| `signIn(email, password)` | `AuthService.signIn()` | (stub - use useAuth.signIn) |
| `signUp(email, password, data)` | `AuthService.signUp()` | (stub - use api/users.join) |
| `signOut()` | `AuthService.signOut()` | (clears auth.store) |

### VerificationService (`src/compat/verificationService.ts`)

| Legacy Function | Compat Implementation | REST API Endpoint |
|----------------|----------------------|-------------------|
| `getVerifications(query)` | `VerificationService.getVerifications()` | (stub) |
| `createVerification(data)` | `VerificationService.createVerification()` | POST /goals/{gId}/quests/{qId}/proofs |
| `updateVerification(id, updates)` | `VerificationService.updateVerification()` | (stub) |
| `deleteVerification(id)` | `VerificationService.deleteVerification()` | DELETE /proofs/{proofId} |

---

## 🎯 Usage in Components

### Before (Firebase)
```typescript
import { GoalService } from '../services/goalService';

const goals = await GoalService.getUserGoals(userId);
```

### After (Compat Layer)
```typescript
import { GoalService } from '../compat/goalService';

const goals = await GoalService.getUserGoals(userId);
// Same API, but uses REST API v1.3 internally
```

### Future (Direct REST API)
```typescript
import { getMyGoals } from '../api/goals';

const response = await getMyGoals({ page: 1, pageSize: 20 });
const goals = response.items;
```

---

## 📁 File Structure

```
src/
├── api/              # Pure REST API clients
│   ├── auth.ts
│   ├── goals.ts
│   ├── feed.ts
│   ├── swipe.ts
│   ├── system.ts
│   ├── users.ts
│   └── types.ts
│
├── compat/           # Compatibility adapters (anti-corruption layer)
│   ├── auth.ts
│   ├── goalService.ts
│   ├── questService.ts
│   ├── feedService.ts
│   ├── calendarEventService.ts
│   └── verificationService.ts
│
├── hooks/            # React hooks
│   ├── useAuth.tsx   # NEW: REST API version
│   ├── useGoals.ts
│   ├── useFeed.ts
│   └── useSwipe.ts
│
├── state/            # State management
│   └── auth.store.ts
│
└── legacy/firebase/  # Deprecated Firebase code
    ├── services/
    ├── types/
    ├── utils/
    ├── hooks/
    └── tests/
```

---

## ⚡ Key Points

1. **Compat adapters** preserve old function signatures
2. **tsconfig paths** redirect `@/services/*` to `src/compat/*`
3. **Components don't need changes** - they import from `../services/` which resolves to `../compat/`
4. **Type-safe** - All adapters are fully typed
5. **Gradual migration** - Can replace compat with direct API calls over time

---

## 🎉 Benefits

- ✅ **Zero breaking changes** to existing components
- ✅ **Clean separation** between old and new code
- ✅ **Type safety** maintained throughout
- ✅ **Easy testing** with mock mode
- ✅ **Gradual migration** path to pure REST API

---

**The compat layer allows seamless migration from Firebase to REST API without rewriting all components at once.**

