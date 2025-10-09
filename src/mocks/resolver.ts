/**
 * Mock API Response Resolver
 * 
 * Routes API requests to local JSON mock files when USE_API_MOCKS=true.
 * Keeps response shapes identical to API spec for seamless transition.
 */

import { HttpMethod } from '@/lib/http';

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
      return require('./goals.detail.json') as T;
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
      return require('./proofs.detail.json') as T;
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
    if (path.match(/^\/swipe\/proofs\/[\w-]+\/votes$/) && method === 'POST') {
      return require('./swipe.vote.json') as T;
    }

    // Auth endpoints
    if (path === '/auth/login' && method === 'POST') {
      // Will be added later
      return {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'mock-user-id',
          name: 'Mock User',
        },
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

