/**
 * DoAny API Configuration
 * 
 * Environment variables should be set with EXPO_PUBLIC_ prefix:
 * - EXPO_PUBLIC_API_BASE_URL
 * - EXPO_PUBLIC_USE_API_MOCKS
 * - EXPO_PUBLIC_VOTE_PATH_MODE
 * 
 * You can set these in .env files (add to .gitignore):
 * .env, .env.development, .env.production
 */

export const apiConfig = {
  /**
   * Base URL for DoAny API
   * Default: https://13.209.220.97:8080/api
   */
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://13.209.220.97:8080/api',
  
  /**
   * Whether to use mock responses instead of real API calls
   * Set to 'true' during development when backend is not available
   * Default: true (for safety during integration)
   */
  useMocks: process.env.EXPO_PUBLIC_USE_API_MOCKS === 'false' ? false : true,
  
  /**
   * Vote path mode for swipe voting
   * - 'auto': Try goal-path first, fallback to proof-path on 404
   * - 'goal': Always use /swipe/proofs/{goalId}/votes
   * - 'proof': Always use /swipe/proofs/{proofId}/votes
   * Default: auto
   */
  votePathMode: (process.env.EXPO_PUBLIC_VOTE_PATH_MODE as 'auto' | 'goal' | 'proof') || 'auto',
} as const;

/**
 * Helper to check if we're in mock mode
 */
export const isMockMode = (): boolean => apiConfig.useMocks;

/**
 * Helper to get the full API URL for a path
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const cleanBase = apiConfig.baseURL.endsWith('/') 
    ? apiConfig.baseURL.slice(0, -1) 
    : apiConfig.baseURL;
  return `${cleanBase}/${cleanPath}`;
};

