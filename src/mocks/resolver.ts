/**
 * Mock API Response Resolver
 * 
 * Routes API requests to local JSON mock files when USE_API_MOCKS=true.
 * Keeps response shapes identical to API spec for seamless transition.
 */

import { HttpMethod } from '../lib/http';

// Mock data imports (will be added as we create JSON files)
// For now, we'll use dynamic requires to avoid errors before files exist

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

    // Goals endpoints
    if (path === '/me/goals' && method === 'GET') {
      return require('./goals.list.json') as T;
    }
    if (path.match(/^\/me\/goals\/[\w-]+$/) && method === 'GET') {
      // Extract goalId from path
      const match = path.match(/\/me\/goals\/([\w-]+)/);
      const requestedGoalId = match ? match[1] : 'goal-123';
      
      // Load all goal details
      const allDetails = require('./goals.detail.json');
      
      // Find specific goal by goalId
      const goalDetail = allDetails.find((g: any) => g.goalId === requestedGoalId);
      
      if (!goalDetail) {
        console.warn(`[MOCK] Goal not found: ${requestedGoalId}, returning first goal`);
        return allDetails[0] as T;
      }
      
      return goalDetail as T;
    }
    if (path === '/goals' && method === 'POST') {
      return require('./goals.create.json') as T;
    }
    if (path.match(/^\/goals\/[\w-]+$/) && method === 'PATCH') {
      return require('./goals.detail.json') as T;
    }
    if (path.match(/^\/goals\/[\w-]+$/) && method === 'DELETE') {
      return { success: true } as T;
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
      // Extract proofId from path
      const match = path.match(/\/me\/proofs\/([\w-]+)/);
      const requestedProofId = match ? match[1] : 'proof-123-001';
      
      // Load proof map
      const proofsMap = require('./proofs.detail.json');
      
      // Find specific proof by proofId
      const proof = proofsMap[requestedProofId];
      
      if (!proof) {
        console.warn(`[MOCK] Proof not found: ${requestedProofId}, returning fallback`);
        return {
          proofId: requestedProofId,
          userId: 'user-123',
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

    // Feed endpoints
    if (path === '/feed/goals' && method === 'GET') {
      return require('./feed.goals.json') as T;
    }
    if (path.match(/^\/feed\/goals\/[\w-]+\/likes\/me$/) && method === 'POST') {
      return require('./feed.like.json') as T;
    }
    if (path.match(/^\/feed\/goals\/[\w-]+\/likes\/me$/) && method === 'DELETE') {
      return require('./feed.like.json') as T;
    }
    if (path === '/me/likes' && method === 'GET') {
      return require('./likes.mine.json') as T;
    }

    // Swipe endpoints
    if (path === '/swipe/proofs' && method === 'GET') {
      const mockData = require('./swipe.proofs.json');
      // Normalize to array if single object
      if (mockData && !Array.isArray(mockData) && typeof mockData === 'object') {
        if (mockData.items) {
          return mockData as T; // Already paginated
        }
        return [mockData] as T; // Single proof -> array
      }
      return mockData as T;
    }
    
    // PATCH /swipe/proofs/{proofId} - Vote on proof
    if (path.match(/^\/swipe\/proofs\/[\w-]+$/) && method === 'PATCH') {
      const voteResult = require('./swipe.vote.json');
      return {
        ...voteResult,
        voteAttempt: (voteResult.voteAttempt || 0) + 1,
      } as T;
    }
    
    // PATCH /swipe-complete/proofs/{proofId} - Complete voting
    if (path.match(/^\/swipe-complete\/proofs\/[\w-]+$/) && method === 'PATCH') {
      const voteResult = require('./swipe.vote.json');
      return {
        ...voteResult,
        state: voteResult.stats.yes > voteResult.stats.no ? 'complete' : 'fail',
      } as T;
    }
    
    // Legacy POST endpoint (backwards compatibility)
    if (path.match(/^\/swipe\/proofs\/[\w-]+\/votes$/) && method === 'POST') {
      return require('./swipe.vote.json') as T;
    }

    // Auth endpoints
    if (path === '/auth/login' && method === 'POST') {
      // Return mock login response per v1.3 spec
      return {
        accessToken: 'mock-jwt-token-' + Date.now(),
        tokenType: 'Bearer',
        expiresIn: 3600,
        userId: 'user_123',
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
    
    // Return a safe fallback
    return {
      success: false,
      error: `Mock file not found for ${method} ${path}`,
    } as T;
  }
}

/**
 * Helper to simulate network delay (optional)
 */
export async function simulateDelay(ms: number = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

