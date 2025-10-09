/**
 * Feed Service - REST API Stub
 * 
 * TODO: Migrate to use REST API from src/api/feed.ts
 * This is a temporary stub to avoid compilation errors
 */

import { FeedPage, FeedPost } from '../types/feed';

export async function fetchFeedPage(options?: any): Promise<FeedPage> {
  console.warn('[feedService] Using legacy stub - migrate to REST API');
  // TODO: Use getFeedGoals from src/api/feed.ts
  return {
    items: [],
    cursor: null,
    hasMore: false,
  };
}

export async function getFeedPost(postId: string): Promise<FeedPost | null> {
  console.warn('[feedService] Using legacy stub - migrate to REST API');
  // TODO: Implement feed detail endpoint in REST API
  return null;
}

export async function getUserReaction(postId: string, userId: string): Promise<any> {
  console.warn('[feedService] Using legacy stub - migrate to REST API');
  // TODO: Use feed endpoints from src/api/feed.ts
  return null;
}

export async function fetchComments(postId: string, cursor?: any): Promise<any> {
  console.warn('[feedService] Using legacy stub - migrate to REST API');
  // TODO: Implement comment endpoints in REST API
  return { items: [], cursor: null, hasMore: false };
}

export async function addComment(postId: string, text: string, userId: string): Promise<void> {
  console.warn('[feedService] Using legacy stub - migrate to REST API');
  // TODO: Implement comment endpoints in REST API
  throw new Error('addComment - Not yet migrated to REST API');
}

export async function deleteComment(commentId: string): Promise<void> {
  console.warn('[feedService] Using legacy stub - migrate to REST API');
  // TODO: Implement comment endpoints in REST API
  throw new Error('deleteComment - Not yet migrated to REST API');
}

export async function createFeedPost(postData: any): Promise<string> {
  console.warn('[feedService] Using legacy stub - migrate to REST API');
  // TODO: Implement feed post creation in REST API
  throw new Error('createFeedPost - Not yet migrated to REST API');
}

