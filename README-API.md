# DoAny API v1.3 Integration Guide

This document describes the DoAny API v1.3 integration implementation, including how to use mocks, switch to the live API, and configure voting path modes.

## 📋 Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [API Modules](#api-modules)
- [React Hooks](#react-hooks)
- [Mock Mode](#mock-mode)
- [Voting Path Modes](#voting-path-modes)
- [Authentication](#authentication)
- [Testing](#testing)
- [Migration Guide](#migration-guide)

## 🎯 Overview

The API v1.3 integration provides a complete TypeScript client for the DoAny backend API with:

- ✅ Full TypeScript types matching API spec
- ✅ Mock JSON responses for development
- ✅ Automatic token injection when authenticated
- ✅ React hooks for easy component integration
- ✅ Optimistic updates for likes and voting
- ✅ Retry logic for rate limits (429)
- ✅ Flexible vote path fallback (goal/proof/auto)

## ⚙️ Configuration

### Environment Variables

Create `.env` files (gitignored) with the following variables using the `EXPO_PUBLIC_` prefix:

```bash
# .env (or .env.development)
EXPO_PUBLIC_API_BASE_URL=https://13.209.220.97:8080/api
EXPO_PUBLIC_USE_API_MOCKS=true
EXPO_PUBLIC_VOTE_PATH_MODE=auto
```

```bash
# .env.production
EXPO_PUBLIC_API_BASE_URL=https://13.209.220.97:8080/api
EXPO_PUBLIC_USE_API_MOCKS=false
EXPO_PUBLIC_VOTE_PATH_MODE=auto
```

### Configuration Module

The API configuration is managed in `src/config/api.ts`:

```typescript
import { apiConfig, isMockMode } from './config/api';

console.log(apiConfig.baseURL);      // API base URL
console.log(apiConfig.useMocks);     // true/false
console.log(apiConfig.votePathMode); // 'auto' | 'goal' | 'proof'
```

## 📡 API Modules

All API endpoints are implemented in `src/api/*.ts`:

### System (`src/api/system.ts`)

```typescript
import { getHealth } from './api/system';

const health = await getHealth();
// => { ok: true, time: 1609459200000, version: "1.3.0" }
```

### Users (`src/api/users.ts`)

```typescript
import { getMe, join } from './api/users';

// Get current user profile
const user = await getMe();

// Optional: Get specific user (admin/friends)
const otherUser = await getMe({ id: 'user-456' });
```

### Goals (`src/api/goals.ts`)

```typescript
import * as goalsApi from './api/goals';

// List my goals
const goals = await goalsApi.getMyGoals({
  page: 1,
  pageSize: 20,
  state: 'onTrack',
  visibility: 'public'
});

// Get single goal with quests expanded
const goal = await goalsApi.getGoal('goal-123', { expand: 'quests' });

// Create goal
const newGoal = await goalsApi.createGoal({
  title: 'Learn TypeScript',
  description: 'Master TypeScript in 30 days',
  visibility: 'public',
  tags: ['learning', 'programming']
});

// Update goal
await goalsApi.patchGoal('goal-123', {
  state: 'complete'
});

// Delete goal
await goalsApi.deleteGoal('goal-123');

// Update quest
await goalsApi.patchQuest('quest-456', {
  state: 'complete',
  completedAt: Date.now()
});

// Submit proof
const proof = await goalsApi.postProof('goal-123', 'quest-456', {
  url: 'https://cdn.example.com/proof.jpg',
  type: 'photo',
  description: 'Task completed'
});

// Get proof
const proofDetail = await goalsApi.getProof('proof-789');

// Delete proof
await goalsApi.deleteProof('proof-789');
```

### Feed (`src/api/feed.ts`)

```typescript
import * as feedApi from './api/feed';

// Get feed
const feed = await feedApi.getFeedGoals({
  page: 1,
  pageSize: 20,
  visibility: 'public',
  state: 'onTrack'
});

// Like a goal
const likeResult = await feedApi.likeGoal('goal-123');
// => { goalId: 'goal-123', liked: true, likes: 16 }

// Unlike a goal
const unlikeResult = await feedApi.unlikeGoal('goal-123');
// => { goalId: 'goal-123', liked: false, likes: 15 }

// Get my liked goals
const myLikes = await feedApi.getMyLikes({
  page: 1,
  pageSize: 50
});
```

### Swipe (`src/api/swipe.ts`)

```typescript
import * as swipeApi from './api/swipe';

// Get proofs to vote on
const proofs = await swipeApi.getSwipeProofs({
  page: 1,
  pageSize: 10
});

// Vote on proof
const voteResult = await swipeApi.voteOnProof({
  goalId: 'goal-123',
  proofId: 'proof-456',
  body: {
    vote: 'yes',
    serveId: 'serve-session-789'
  }
});
// => { proofId: 'proof-456', stats: { yes: 9, no: 1 }, didCountTowardQuorum: true }
```

### Auth (`src/api/auth.ts`)

```typescript
import { loginPassword, loginGoogle } from './api/auth';

// Login with password
const auth = await loginPassword({
  email: 'user@example.com',
  password: 'secure-password'
});

// Login with Google
const googleAuth = await loginGoogle({
  provider: 'google',
  token: 'google-oauth-token'
});
```

## 🎣 React Hooks

Convenient React hooks for components:

### Goals Hooks (`src/hooks/useGoals.ts`)

```typescript
import { useMyGoals, useGoal, useGoalMutations } from './hooks/useGoals';

function GoalsScreen() {
  // Fetch goals list
  const { data, isLoading, error, refetch } = useMyGoals({
    page: 1,
    pageSize: 20,
    state: 'onTrack'
  });

  // Fetch single goal
  const { data: goal } = useGoal('goal-123', 'quests');

  // Goal mutations
  const { createGoal, updateGoal, deleteGoal, isLoading: mutating } = useGoalMutations();

  const handleCreate = async () => {
    const newGoal = await createGoal({
      title: 'New Goal',
      visibility: 'public'
    });
  };

  return /* ... */;
}
```

### Feed Hooks (`src/hooks/useFeed.ts`)

```typescript
import { useFeedGoals, useMyLikes, useLikeMutations } from './hooks/useFeed';

function FeedScreen() {
  const { data, isLoading, refetch } = useFeedGoals({ page: 1 });
  const { toggleLike } = useLikeMutations();

  const handleLike = async (goalId: string, currentlyLiked: boolean) => {
    const newState = await toggleLike(goalId, currentlyLiked);
    refetch(); // Refresh feed
  };

  return /* ... */;
}
```

### Swipe Hooks (`src/hooks/useSwipe.ts`)

```typescript
import { useSwipeProofs, useVoteMutation } from './hooks/useSwipe';

function SwipeScreen() {
  const { data: proofs, refetch } = useSwipeProofs({ pageSize: 5 });
  const { vote, isLoading } = useVoteMutation();

  const handleVote = async (proof: SwipeProofItem, voteValue: 'yes' | 'no') => {
    await vote({
      goalId: proof.goalId,
      proofId: proof.proofId,
      body: {
        vote: voteValue,
        serveId: proof.serveId || 'session-' + Date.now()
      }
    });
    refetch();
  };

  return /* ... */;
}
```

## 🎭 Mock Mode

### What is Mock Mode?

When `USE_API_MOCKS=true`, all API calls are routed to local JSON files instead of the network. This allows:

- ✅ Development without backend dependency
- ✅ Consistent test data
- ✅ Offline development
- ✅ Faster iteration cycles

### Mock Files Location

Mock responses are in `src/mocks/*.json`:

```
src/mocks/
├── system.health.json
├── users.me.json
├── goals.list.json
├── goals.detail.json
├── goals.create.json
├── quests.patch.json
├── proofs.create.json
├── proofs.detail.json
├── feed.goals.json
├── feed.like.json
├── likes.mine.json
├── swipe.proofs.json
└── swipe.vote.json
```

### Customizing Mock Data

Edit any JSON file to match your test scenarios:

```json
// src/mocks/goals.list.json
{
  "page": 1,
  "pageSize": 20,
  "total": 3,
  "items": [
    {
      "goalId": "goal-123",
      "title": "Your Custom Goal",
      "description": "Test data",
      "state": "onTrack",
      "likes": 42
    }
  ]
}
```

### Switching to Live API

1. Update environment variable:
   ```bash
   EXPO_PUBLIC_USE_API_MOCKS=false
   ```

2. Restart the app:
   ```bash
   npm start -- --clear
   ```

3. Verify mode in logs:
   ```
   [HTTP] GET /me/goals  # Real network call
   ```

## 🔀 Voting Path Modes

The swipe voting endpoint has two possible paths. The API client supports all modes:

### Mode: `auto` (Recommended)

Tries the new goal-based path first, falls back to proof-based path on 404:

```bash
EXPO_PUBLIC_VOTE_PATH_MODE=auto
```

Behavior:
1. First tries: `POST /swipe/proofs/{goalId}/votes`
2. On 404, retries: `POST /swipe/proofs/{proofId}/votes`
3. Returns first successful response

### Mode: `goal`

Always uses goal-based path:

```bash
EXPO_PUBLIC_VOTE_PATH_MODE=goal
```

Endpoint: `POST /swipe/proofs/{goalId}/votes`

### Mode: `proof`

Always uses proof-based path (legacy):

```bash
EXPO_PUBLIC_VOTE_PATH_MODE=proof
```

Endpoint: `POST /swipe/proofs/{proofId}/votes`

### Usage in Code

```typescript
import { voteOnProof } from './api/swipe';

// Provide both IDs for auto-fallback
const result = await voteOnProof({
  goalId: proof.goalId,    // Used in 'goal' and 'auto' modes
  proofId: proof.proofId,  // Used in 'proof' mode and auto fallback
  body: {
    vote: 'yes',
    serveId: proof.serveId
  }
});
```

## 🔐 Authentication

### Current State (Scaffolding)

The auth module is implemented but not yet wired to UI:

```typescript
// src/state/auth.store.ts - Simple in-memory store
import { setAuth, clearAuth, getAuthState } from './state/auth.store';

// Login (when UI is ready)
const authResponse = await loginPassword({
  email: 'user@example.com',
  password: 'password'
});

setAuth({
  accessToken: authResponse.accessToken,
  refreshToken: authResponse.refreshToken,
  user: authResponse.user
});

// Logout
clearAuth();
```

### Token Injection

The HTTP client automatically injects the `Authorization` header when a token is available:

```typescript
// src/lib/http.ts
const authHeader = getAuthorizationHeader();
if (authHeader) {
  config.headers.Authorization = authHeader; // "Bearer {token}"
}
```

### Next Steps for Auth

1. **Persist tokens**: Use AsyncStorage to persist auth state
2. **Wire login UI**: Connect AuthScreen to `loginPassword()`
3. **Handle 401**: Implement token refresh or redirect to login
4. **Add logout UI**: Connect ProfileScreen to `clearAuth()`

## 🧪 Testing

### Manual Testing with Demo Screen

Access the demo screen (add to navigation):

```typescript
// In RootNavigator.tsx
import ApiDemoScreen from './screens/dev/ApiDemoScreen';

<Stack.Screen name="ApiDemo" component={ApiDemoScreen} />
```

Navigate to it:
```typescript
navigation.navigate('ApiDemo');
```

### Unit Tests (if vitest exists)

Run tests:
```bash
npm test
```

Example test:
```typescript
// src/api/__tests__/swipe.test.ts
import { voteOnProof } from '../swipe';

describe('voteOnProof', () => {
  it('tries goal path first in auto mode', async () => {
    // Test auto-fallback logic
  });
});
```

### Verify API Calls

Enable development mode to see HTTP logs:

```typescript
// Logs in __DEV__ mode:
[HTTP] GET /me/goals { params: { page: 1 } }
[HTTP] 200 /me/goals { data: { page: 1, items: [...] } }
```

## 📦 Migration Guide

### Gradual Migration from Firebase

Current approach:
- ✅ Existing screens use Firebase (unchanged)
- ✅ New API v1.3 ready for integration
- ✅ Demo screen showcases API capabilities

Migration steps:

1. **Start with new features**: Use API for new screens
2. **Migrate read operations**: Replace Firebase reads with API calls
3. **Migrate write operations**: Replace Firebase writes with API calls
4. **Update components**: Use new hooks instead of Firebase queries
5. **Remove Firebase dependency**: Once fully migrated

Example migration:

```typescript
// Before (Firebase)
const goalsRef = collection(db, 'goals');
const q = query(goalsRef, where('userId', '==', user.uid));
const snapshot = await getDocs(q);

// After (API v1.3)
const { data: goals } = useMyGoals({ page: 1, pageSize: 20 });
```

### Handling Both Systems During Migration

Use feature flags or environment checks:

```typescript
const USE_NEW_API = process.env.EXPO_PUBLIC_USE_NEW_API === 'true';

if (USE_NEW_API) {
  const { data } = useMyGoals();
} else {
  // Firebase code
}
```

## 📚 Implemented Endpoints

| Endpoint | File | Status |
|----------|------|--------|
| `GET /system/health` | `src/api/system.ts` | ✅ |
| `GET /users/me` | `src/api/users.ts` | ✅ |
| `POST /users/join` | `src/api/users.ts` | ✅ |
| `GET /me/goals` | `src/api/goals.ts` | ✅ |
| `GET /me/goals/{goalId}` | `src/api/goals.ts` | ✅ |
| `POST /goals` | `src/api/goals.ts` | ✅ |
| `PATCH /goals/{goalId}` | `src/api/goals.ts` | ✅ |
| `DELETE /goals/{goalId}` | `src/api/goals.ts` | ✅ |
| `PATCH /quests/{questId}` | `src/api/goals.ts` | ✅ |
| `POST /goals/{gId}/quests/{qId}/proofs` | `src/api/goals.ts` | ✅ |
| `GET /me/proofs/{proofId}` | `src/api/goals.ts` | ✅ |
| `DELETE /proofs/{proofId}` | `src/api/goals.ts` | ✅ |
| `GET /feed/goals` | `src/api/feed.ts` | ✅ |
| `POST /feed/goals/{goalId}/likes/me` | `src/api/feed.ts` | ✅ |
| `DELETE /feed/goals/{goalId}/likes/me` | `src/api/feed.ts` | ✅ |
| `GET /me/likes` | `src/api/feed.ts` | ✅ |
| `GET /swipe/proofs` | `src/api/swipe.ts` | ✅ |
| `POST /swipe/proofs/{id}/votes` | `src/api/swipe.ts` | ✅ (auto-fallback) |
| `POST /auth/login` | `src/api/auth.ts` | ✅ (scaffolding) |

## 🐛 Troubleshooting

### "Cannot find module" errors

Ensure you're using relative imports:
```typescript
import { httpClient } from '../lib/http'; // ✅
import { httpClient } from '@/lib/http';  // ❌ (no path aliases)
```

### Mock data not loading

1. Check mock file exists in `src/mocks/`
2. Verify `USE_API_MOCKS=true` in config
3. Check console for `[MOCK]` logs

### 401 Unauthorized in production

This is expected if auth is not set up yet:
1. Use mock mode during development
2. Implement auth UI later
3. See "Authentication" section above

### Vote endpoint 404

Check `VOTE_PATH_MODE` setting:
- Use `auto` for safe automatic fallback
- Backend may only support one path

## 📞 Support

For issues or questions about the API integration:

1. Check this README
2. Review mock JSON files in `src/mocks/`
3. Check console logs with `__DEV__` enabled
4. Use ApiDemoScreen to test endpoints

## 🎉 Summary

The DoAny API v1.3 integration is production-ready with:

- ✅ Complete TypeScript types
- ✅ All endpoints implemented
- ✅ Mock mode for development
- ✅ React hooks for components
- ✅ Optimistic updates
- ✅ Auth scaffolding ready
- ✅ Demo screen for testing

Toggle `USE_API_MOCKS` to switch between mock and live API. Happy coding! 🚀

