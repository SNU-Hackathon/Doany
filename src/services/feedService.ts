/**
 * Feed Service - Thin Re-export Layer
 * 
 * Re-exports feed functions from REST API v1.3.
 */

// Re-export from api/feed
export {
    getFeedGoals, getMyLikes, likeGoal,
    unlikeGoal
} from '../api/feed';

import * as FeedAPI from '../api/feed';
import { FeedPage, FeedPost } from '../types/feed';

/**
 * Adapter: Fetch feed page
 * Maps to GET /feed/goals
 */
export async function fetchFeedPage(options?: {
  page?: number;
  pageSize?: number;
  cursor?: any;
}): Promise<FeedPage> {
  try {
    const response = await FeedAPI.getFeedGoals({
      page: options?.page || 1,
      pageSize: options?.pageSize || 20,
    });

    const feedItems: FeedPost[] = response.items.map(item => ({
      id: item.goalId || '',
      userId: item.userId,
      userName: item.userName,
      goalId: item.goalId,
      goalTitle: item.title,
      title: item.title,
      description: item.description,
      media: [],
      createdAt: item.createdAt || new Date(),
      likes: item.likes || 0,
      likeCount: item.likes || 0,
      didILike: item.didILike,
      comments: 0,
      commentCount: 0,
    } as FeedPost));

    return {
      items: feedItems,
      cursor: null,
      hasMore: response.items.length >= (options?.pageSize || 20),
    };
  } catch (error) {
    console.error('[feedService.fetchFeedPage] Error:', error);
    return { items: [], cursor: null, hasMore: false };
  }
}

/**
 * Get single feed post (stub - not in v1.3)
 */
export async function getFeedPost(postId: string): Promise<FeedPost | null> {
  console.warn('[feedService.getFeedPost] Not in API v1.3 - use GET /me/goals/{goalId}');
  return null;
}

/**
 * Get user reaction (stub - info in didILike field)
 */
export async function getUserReaction(postId: string, userId: string): Promise<any> {
  console.warn('[feedService.getUserReaction] Use didILike from feed item');
  return null;
}

/**
 * Toggle like (adapter)
 */
export async function toggleLike(postId: string, userId: string): Promise<void> {
  // Assume postId is goalId
  await FeedAPI.likeGoal(postId);
}

/**
 * Toggle save (stub - not in v1.3)
 */
export async function toggleSave(postId: string, userId: string): Promise<void> {
  console.warn('[feedService.toggleSave] Not in API v1.3');
}

/**
 * Toggle trust (stub - not in v1.3)
 */
export async function toggleTrust(postId: string, userId: string): Promise<void> {
  console.warn('[feedService.toggleTrust] Not in API v1.3');
}

/**
 * Fetch comments (stub - not in v1.3)
 */
export async function fetchComments(postId: string, cursor?: any): Promise<any> {
  console.warn('[feedService.fetchComments] Comments not in API v1.3');
  return { items: [], cursor: null, hasMore: false };
}

/**
 * Add comment (stub - not in v1.3)
 */
export async function addComment(postId: string, text: string, userId: string): Promise<void> {
  console.warn('[feedService.addComment] Comments not in API v1.3');
  throw new Error('Comments not supported in API v1.3');
}

/**
 * Delete comment (stub - not in v1.3)
 */
export async function deleteComment(commentId: string): Promise<void> {
  console.warn('[feedService.deleteComment] Comments not in API v1.3');
  throw new Error('Comments not supported in API v1.3');
}

/**
 * Create feed post (stub - not in v1.3)
 */
export async function createFeedPost(postData: any): Promise<string> {
  console.warn('[feedService.createFeedPost] Not in API v1.3');
  throw new Error('createFeedPost not supported in API v1.3');
}

// Default export
export default FeedAPI;

