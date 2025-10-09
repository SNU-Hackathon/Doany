/**
 * Feed Service Compatibility Adapter
 * 
 * Provides Firebase-compatible API while using REST API v1.3 internally.
 */

import * as feedApi from '../api/feed';
import { FeedPage, FeedPost } from '../types/feed';

/**
 * Fetch feed page
 * @param options Query options
 * @returns Paginated feed response
 */
export async function fetchFeedPage(options?: {
  page?: number;
  pageSize?: number;
  cursor?: any;
}): Promise<FeedPage> {
  try {
    const response = await feedApi.getFeedGoals({
      page: options?.page || 1,
      pageSize: options?.pageSize || 20,
    });

    // Transform to FeedPage format
    const feedItems: FeedPost[] = response.items.map(item => ({
      id: item.goalId,
      userId: item.userId,
      userName: item.userName,
      goalId: item.goalId,
      goalTitle: item.title,
      title: item.title,
      description: item.description,
      media: [],
      createdAt: item.createdAt,
      likes: item.likes,
      likeCount: item.likes,
      didILike: item.didILike,
      comments: 0,
      commentCount: 0,
    }));

    return {
      items: feedItems,
      cursor: null,
      hasMore: response.items.length >= (options?.pageSize || 20),
    };
  } catch (error) {
    console.error('[feedService.fetchFeedPage] Error:', error);
    return {
      items: [],
      cursor: null,
      hasMore: false,
    };
  }
}

/**
 * Get a single feed post
 * @param postId Post ID
 * @returns Feed post or null
 */
export async function getFeedPost(postId: string): Promise<FeedPost | null> {
  try {
    // TODO: Implement feed detail endpoint when available
    console.warn('[feedService.getFeedPost] Not yet implemented in REST API');
    return null;
  } catch (error) {
    console.error('[feedService.getFeedPost] Error:', error);
    return null;
  }
}

/**
 * Get user's reaction to a post
 * @param postId Post ID
 * @param userId User ID
 * @returns Reaction data or null
 */
export async function getUserReaction(postId: string, userId: string): Promise<any> {
  try {
    // This info is included in the feed item's didILike field
    console.warn('[feedService.getUserReaction] Use didILike from feed item');
    return null;
  } catch (error) {
    console.error('[feedService.getUserReaction] Error:', error);
    return null;
  }
}

/**
 * Fetch comments for a post
 * @param postId Post ID
 * @param cursor Pagination cursor
 * @returns Comments page
 */
export async function fetchComments(postId: string, cursor?: any): Promise<any> {
  try {
    // TODO: Implement comment endpoints when available
    console.warn('[feedService.fetchComments] Not yet implemented in REST API');
    return { items: [], cursor: null, hasMore: false };
  } catch (error) {
    console.error('[feedService.fetchComments] Error:', error);
    return { items: [], cursor: null, hasMore: false };
  }
}

/**
 * Add a comment to a post
 * @param postId Post ID
 * @param text Comment text
 * @param userId User ID
 */
export async function addComment(postId: string, text: string, userId: string): Promise<void> {
  try {
    // TODO: Implement comment endpoints when available
    console.warn('[feedService.addComment] Not yet implemented in REST API');
    throw new Error('addComment - Not yet implemented in REST API');
  } catch (error) {
    console.error('[feedService.addComment] Error:', error);
    throw error;
  }
}

/**
 * Delete a comment
 * @param commentId Comment ID
 */
export async function deleteComment(commentId: string): Promise<void> {
  try {
    // TODO: Implement comment endpoints when available
    console.warn('[feedService.deleteComment] Not yet implemented in REST API');
    throw new Error('deleteComment - Not yet implemented in REST API');
  } catch (error) {
    console.error('[feedService.deleteComment] Error:', error);
    throw error;
  }
}

/**
 * Create a new feed post
 * @param postData Post data
 * @returns Post ID
 */
export async function createFeedPost(postData: any): Promise<string> {
  try {
    // TODO: Implement feed post creation when available
    console.warn('[feedService.createFeedPost] Not yet implemented in REST API');
    throw new Error('createFeedPost - Not yet implemented in REST API');
  } catch (error) {
    console.error('[feedService.createFeedPost] Error:', error);
    throw error;
  }
}

