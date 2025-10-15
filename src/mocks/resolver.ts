/**
 * Mock API Response Resolver
 * 
 * Routes API requests to local JSON mock files when USE_API_MOCKS=true.
 * Keeps response shapes identical to API spec for seamless transition.
 */

import { HttpMethod } from '../lib/http';

// Import JSON mock data
import feedGoalsData from './feed.goals.json';
import groupsAllData from './groups.all.json';
import groupsMyData from './groups.my.json';
import likesMineData from './likes.mine.json';

// In-memory mutable copies for like/unlike operations
const memoryStore = {
  feedGoals: JSON.parse(JSON.stringify(feedGoalsData)),
  likesMine: JSON.parse(JSON.stringify(likesMineData)),
};

/**
 * Mock resolver that matches API paths to mock JSON files
 */
export async function resolveMock<T = any>(
  method: HttpMethod,
  url: string,
  payload?: any
): Promise<T> {
  const path = url.startsWith('/') ? url : `/${url}`;

  if (__DEV__) {
    console.log(`[MOCK] ${method} ${path}`, payload ? { payload } : '');
  }

  try {
    // System endpoints
    if (path === '/system/health' && method === 'GET') {
      return require('./system.health.json') as T;
    }

    // User endpoints
    if (path.match(/^\/users\/me/) && method === 'GET') {
      return require('./users.me.json') as T;
    }

    // Space/Feed endpoints - NEW
    if (path === '/space/goals' || path.startsWith('/space/goals?')) {
      if (method === 'GET') {
        return memoryStore.feedGoals as T;
      }
    }

    // Space likes - my liked goals
    if (path === '/space/likes/me' || path.startsWith('/space/likes/me?')) {
      if (method === 'GET') {
        return memoryStore.likesMine as T;
      }
    }

    // Like/Unlike toggle for specific goal
    if (path.match(/^\/space\/goals\/[\w-]+\/likes\/me$/)) {
      const match = path.match(/\/space\/goals\/([\w-]+)\/likes\/me$/);
      const goalId = match ? match[1] : '';
      const item = memoryStore.feedGoals.items.find((g: any) => g.goalId === goalId);

      if (item) {
        if (method === 'POST') {
          // Like the goal
          item.social.didILike = true;
          item.social.likes += 1;
          
          // Add to liked list if not already there
          const alreadyLiked = memoryStore.likesMine.items.find((l: any) => l.goalId === goalId);
          if (!alreadyLiked) {
            memoryStore.likesMine.items.unshift({
              id: goalId,
              likedAt: Math.floor(Date.now() / 1000),
              actor: item.actor,
              goalId: item.goalId,
              title: item.title,
              thumbnailUrl: item.thumbnailUrl,
              tags: item.tags,
              category: item.category,
              visibility: item.visibility,
              startAt: item.startAt,
              endAt: item.endAt,
              completedAt: item.completedAt,
              social: { ...item.social },
              progress: { ...item.progress },
            });
          }

          return {
            goalId,
            social: item.social,
            updatedAt: Math.floor(Date.now() / 1000),
          } as T;
        } else if (method === 'PATCH' || method === 'DELETE') {
          // Unlike the goal
          item.social.didILike = false;
          item.social.likes = Math.max(0, item.social.likes - 1);

          // Remove from liked list
          memoryStore.likesMine.items = memoryStore.likesMine.items.filter(
            (l: any) => l.goalId !== goalId
          );

          return {
            goalId,
            social: item.social,
            updatedAt: Math.floor(Date.now() / 1000),
          } as T;
        }
      }

      console.warn(`[MOCK] Goal not found for like toggle: ${goalId}`);
      return {
        success: false,
        error: 'Goal not found',
      } as T;
    }

    // Groups endpoints - NEW
    if (path === '/groups/all' || path.startsWith('/groups/all?')) {
      if (method === 'GET') {
        return groupsAllData as T;
      }
    }

    if (path === '/groups/my' || path.startsWith('/groups/my?')) {
      if (method === 'GET') {
        return groupsMyData as T;
      }
    }

    // Legacy Feed endpoints (backwards compatibility)
    if (path === '/feed/goals' && method === 'GET') {
      return memoryStore.feedGoals as T;
    }
    if (path.match(/^\/feed\/goals\/[\w-]+\/likes\/me$/)) {
      // Redirect to space endpoint logic
      const newPath = path.replace('/feed/', '/space/');
      return resolveMock(method, newPath, payload);
    }
    if (path === '/me/likes' && method === 'GET') {
      return memoryStore.likesMine as T;
    }

    // Quest endpoints
    if (path.match(/^\/quests\/[\w-]+$/) && method === 'PATCH') {
      return require('./quests.patch.json') as T;
    }

    // Proof endpoints
    if (path.match(/^\/goals\/[\w-]+\/quests\/[\w-]+\/proofs$/) && method === 'POST') {
      return require('./proofs.create.json') as T;
    }
    if (path.match(/^\/me\/proofs\/[\w-]+$/) && method === 'GET') {
      const match = path.match(/\/me\/proofs\/([\w-]+)/);
      const requestedProofId = match ? match[1] : 'proof-123-001';
      const proofsMap = require('./proofs.detail.json');
      const proof = proofsMap[requestedProofId];
      
      if (!proof) {
        console.warn(`[MOCK] Proof not found: ${requestedProofId}, returning fallback`);
        return {
          proofId: requestedProofId,
          userId: '1',
          url: 'https://cdn.example.com/fallback.jpg',
          description: 'Fallback proof',
          type: 'photo',
          votes: { yes: 0, no: 0 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as T;
      }
      
      return proof as T;
    }
    if (path.match(/^\/proofs\/[\w-]+$/) && method === 'DELETE') {
      return { success: true } as T;
    }

    // Swipe endpoints
    if (path === '/swipe/proofs' && method === 'GET') {
      const mockData = require('./swipe.proofs.json');
      if (mockData && !Array.isArray(mockData) && typeof mockData === 'object') {
        if (mockData.items) {
          return mockData as T;
        }
        return [mockData] as T;
      }
      return mockData as T;
    }
    
    if (path.match(/^\/swipe\/proofs\/[\w-]+$/) && method === 'PATCH') {
      const voteResult = require('./swipe.vote.json');
      return {
        ...voteResult,
        voteAttempt: (voteResult.voteAttempt || 0) + 1,
      } as T;
    }
    
    if (path.match(/^\/swipe-complete\/proofs\/[\w-]+$/) && method === 'PATCH') {
      const match = path.match(/\/swipe-complete\/proofs\/([\w-]+)/);
      const proofId = match ? match[1] : 'proof-swipe-1';
      
      return {
        proofId,
        state: Math.random() > 0.5 ? 'complete' : 'fail',
        stats: {
          yes: Math.floor(Math.random() * 20) + 5,
          no: Math.floor(Math.random() * 5),
        },
      } as T;
    }
    
    if (path.match(/^\/swipe\/proofs\/[\w-]+\/votes$/) && method === 'POST') {
      return require('./swipe.vote.json') as T;
    }

    // Auth endpoints
    if (path === '/auth/login' && method === 'POST') {
      return {
        accessToken: 'mock-jwt-token-' + Date.now(),
        tokenType: 'Bearer',
        expiresIn: 3600,
        userId: '1',
      } as T;
    }

    // Default fallback
    console.warn(`[MOCK] No mock found for ${method} ${path}`);
    return {
      success: false,
      message: `Mock not implemented for ${method} ${path}`,
    } as T;

  } catch (error) {
    console.error(`[MOCK] Error loading mock for ${method} ${path}:`, error);
    
    return {
      success: false,
      error: `Mock file not found for ${method} ${path}`,
    } as T;
  }
}

/**
 * Helper function to simulate mockFetch for direct component usage
 */
export async function mockFetch(method: string, url: string, payload?: any): Promise<{
  status: number;
  json: () => Promise<any>;
}> {
  try {
    const data = await resolveMock(method as HttpMethod, url, payload);
    return {
      status: 200,
      json: async () => data,
    };
  } catch (error) {
    return {
      status: 500,
      json: async () => ({ error: 'Mock fetch failed' }),
    };
  }
}

/**
 * Helper to simulate network delay (optional)
 */
export async function simulateDelay(ms: number = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
