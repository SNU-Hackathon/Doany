# Firebase Removal Plan

## 📋 Classification of Firebase Usage

### 🔴 Core Firebase Services (to move to `/src/legacy/firebase/`)

**Initialization & Config:**
- `src/services/firebase.ts` - Firebase app initialization, auth, firestore

**Authentication:**
- `src/services/auth.ts` - Firebase Auth (signIn, signUp, onAuthStateChanged)
- `src/hooks/useAuth.tsx` - Firebase Auth hook

**Data Services:**
- `src/services/goalService.ts` - Firestore CRUD for goals
- `src/services/questService.ts` - Firestore CRUD for quests  
- `src/services/feedService.ts` - Firestore feed operations
- `src/services/calendarEventService.ts` - Firestore calendar events
- `src/services/userData.ts` - Firestore user data
- `src/services/userService.ts` - Firestore user operations

**Verification:**
- `src/services/verificationService.ts` - Firestore verification
- `src/services/verificationRules.ts` - Verification rules
- `src/services/partnerVerificationService.ts` - Partner verification
- `src/services/test/VerificationTestHarness.ts` - Test harness

**Types:**
- `src/types/firestore.ts` - Firestore-specific types
- `src/types/firebase-auth-react-native.d.ts` - Firebase Auth type declarations

**Utils:**
- `src/utils/firebaseDebug.ts` - Firebase debugging utilities

**Tests:**
- `src/services/__tests__/verificationTestHarness.test.ts`
- `src/constants/__tests__/verificationPolicyAlignment.test.ts`

### 🟡 Screens Using Firebase (to refactor with REST API)

- `src/screens/GoalsScreen.tsx` - Uses Firestore onSnapshot for goals
- `src/screens/FeedDetailScreen.tsx` - Uses Firestore for feed details

### 🟢 Files with Minor References (to clean up)

- `src/utils/dateUtils.ts` - May have Timestamp conversions
- `src/types/chatbot.ts` - May reference Firestore types
- `src/types/feed.ts` - May reference Firestore types
- `src/utils/promptSecurity.ts` - Minor references
- `src/services/ai.ts` - May use Firebase for goal storage

## 🔄 Replacement Strategy

### Auth → REST API
```typescript
// OLD (Firebase)
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// NEW (REST API)
import { loginPassword } from '../api/auth';
import { setAuth } from '../state/auth.store';
```

### Goals → REST API
```typescript
// OLD (Firebase)
import { GoalService } from '../services/goalService';
const goals = await GoalService.getUserGoals(userId);

// NEW (REST API)
import { useMyGoals } from '../hooks/useGoals';
const { data: goals } = useMyGoals({ page: 1, pageSize: 20 });
```

### Feed → REST API
```typescript
// OLD (Firebase)
import { fetchFeedPage } from '../services/feedService';

// NEW (REST API)
import { useFeedGoals } from '../hooks/useFeed';
const { data: feed } = useFeedGoals({ page: 1 });
```

### Real-time Listeners → Polling/Refetch
```typescript
// OLD (Firebase)
onSnapshot(collection(db, 'goals'), (snapshot) => {
  setGoals(snapshot.docs.map(doc => doc.data()));
});

// NEW (REST API)
const { data, refetch } = useMyGoals();
// Refetch manually or use polling
```

## 📦 Dependencies to Remove

```json
{
  "firebase": "^12.1.0"
}
```

## ✅ Validation Checklist

- [ ] All Firebase imports removed from src/
- [ ] All screens work with REST API + mocks
- [ ] Auth flow uses new auth.store.ts
- [ ] No Firestore dependencies remain
- [ ] App builds and runs successfully
- [ ] All mock data loads correctly
- [ ] No console errors related to Firebase

## 🎯 Implementation Order

1. ✅ Create `/src/legacy/firebase/` directory
2. ✅ Move all Firebase services to legacy folder
3. ✅ Refactor GoalsScreen to use REST API
4. ✅ Refactor FeedDetailScreen to use REST API  
5. ✅ Update useAuth to use auth.store
6. ✅ Clean up minor Firebase references
7. ✅ Remove firebase from package.json
8. ✅ Verify app builds and works with mocks
9. ✅ Delete legacy folder

---

**Target**: Zero Firebase dependencies, 100% REST API with mock support.

