/**
 * Optimistic update helpers for likes and voting
 * 
 * Apply UI changes immediately, then rollback on server error
 */

import { FeedItem, SwipeProofItem, VoteValue } from '../api/types';

/**
 * Apply optimistic like/unlike to a feed item
 * 
 * @param item Original feed item
 * @param shouldLike True to like, false to unlike
 * @returns Updated item with optimistic changes
 */
export function toggleLikeLocally(
  item: FeedItem,
  shouldLike: boolean
): FeedItem {
  return {
    ...item,
    didILike: shouldLike,
    likes: item.likes + (shouldLike ? 1 : -1),
  };
}

/**
 * Apply optimistic vote to a swipe proof
 * 
 * @param proof Original proof item
 * @param vote Vote value (yes/no)
 * @returns Updated proof with optimistic vote
 */
export function applyVoteLocally(
  proof: SwipeProofItem,
  vote: VoteValue
): SwipeProofItem {
  const currentVotes = proof.votes || { yes: 0, no: 0 };

  return {
    ...proof,
    votes: {
      yes: currentVotes.yes + (vote === 'yes' ? 1 : 0),
      no: currentVotes.no + (vote === 'no' ? 1 : 0),
    },
  };
}

/**
 * Rollback optimistic like update
 * 
 * @param item Item with optimistic changes
 * @param wasLiked Original liked state
 * @returns Item with rollback applied
 */
export function rollbackLike(item: FeedItem, wasLiked: boolean): FeedItem {
  return {
    ...item,
    didILike: wasLiked,
    likes: item.likes + (wasLiked ? 1 : -1),
  };
}

/**
 * Rollback optimistic vote update
 * 
 * @param proof Proof with optimistic changes
 * @param vote Vote that was applied
 * @returns Proof with rollback applied
 */
export function rollbackVote(
  proof: SwipeProofItem,
  vote: VoteValue
): SwipeProofItem {
  const currentVotes = proof.votes || { yes: 0, no: 0 };

  return {
    ...proof,
    votes: {
      yes: currentVotes.yes - (vote === 'yes' ? 1 : 0),
      no: currentVotes.no - (vote === 'no' ? 1 : 0),
    },
  };
}

/**
 * Generic optimistic mutation wrapper
 * 
 * @example
 * ```typescript
 * const newItem = await withOptimisticUpdate(
 *   item,
 *   (item) => ({ ...item, likes: item.likes + 1 }),
 *   () => likeGoal(item.goalId)
 * );
 * ```
 */
export async function withOptimisticUpdate<T>(
  item: T,
  optimisticTransform: (item: T) => T,
  serverMutation: () => Promise<any>
): Promise<T> {
  const optimisticItem = optimisticTransform(item);

  try {
    await serverMutation();
    return optimisticItem;
  } catch (error) {
    // On error, return original item (rollback)
    console.error('[optimistic] Mutation failed, rolling back:', error);
    return item;
  }
}

