// Feed service for community sharing features
// Handles CRUD operations, reactions, comments, and pagination for feed posts

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    orderBy,
    query,
    QueryDocumentSnapshot,
    runTransaction,
    serverTimestamp,
    startAfter,
    Timestamp,
    where
} from 'firebase/firestore';
import {
    CommentsPage,
    CreateFeedPostParams,
    FeedComment,
    FeedFilter,
    FeedPage,
    FeedPost,
    FeedReaction
} from '../types/feed';
import { db } from './firebase';

const POSTS_PER_PAGE = 10;
const COMMENTS_PER_PAGE = 20;

/**
 * Creates a new feed post from a verified quest completion
 * @param params - Post creation parameters
 * @returns Promise<string> - The created post ID
 */
export async function createFeedPost(params: CreateFeedPostParams): Promise<string> {
  try {
    console.log('[FEED:create] Creating feed post', { 
      userId: params.userId, 
      goalId: params.goalId,
      visibility: params.visibility 
    });

    // Prepare post document
    const postData: Omit<FeedPost, 'id'> = {
      userId: params.userId,
      userName: params.userName,
      userAvatar: params.userAvatar,
      goalId: params.goalId,
      questId: params.questId,
      title: params.title,
      caption: params.caption,
      media: params.media,
      verification: params.verification,
      visibility: params.visibility,
      school: params.school,
      createdAt: serverTimestamp() as Timestamp,
      likeCount: 0,
      trustCount: 0,
      commentCount: 0,
      saveCount: 0,
      isDeleted: false,
    };

    // Create post document
    const postsRef = collection(db, 'feedPosts');
    const docRef = await addDoc(postsRef, postData);

    console.log('[FEED:create:success]', { postId: docRef.id });
    return docRef.id;
  } catch (error) {
    console.error('[FEED:create:error]', error);
    throw new Error(`Failed to create feed post: ${error}`);
  }
}

/**
 * Fetches a paginated list of feed posts
 * @param cursor - Last document snapshot for pagination (optional)
 * @param filter - Filter options (optional)
 * @returns Promise<FeedPage> - Paginated feed posts
 */
export async function fetchFeedPage(
  cursor?: QueryDocumentSnapshot,
  filter?: FeedFilter
): Promise<FeedPage> {
  try {
    console.log('[FEED:fetch] Fetching feed page', { hasCursor: !!cursor, filter });

    const postsRef = collection(db, 'feedPosts');
    
    // Build query
    let q = query(
      postsRef,
      where('visibility', '==', 'public'),
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(POSTS_PER_PAGE + 1) // Fetch one extra to check if there are more
    );

    // Apply school filter if provided
    if (filter?.school) {
      q = query(
        postsRef,
        where('visibility', '==', 'public'),
        where('school', '==', filter.school),
        where('isDeleted', '==', false),
        orderBy('createdAt', 'desc'),
        limit(POSTS_PER_PAGE + 1)
      );
    }

    // Apply cursor for pagination
    if (cursor) {
      q = query(
        postsRef,
        where('visibility', '==', 'public'),
        where('isDeleted', '==', false),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(POSTS_PER_PAGE + 1)
      );
    }

    const snapshot = await getDocs(q);
    
    // Check if there are more posts
    const hasMore = snapshot.docs.length > POSTS_PER_PAGE;
    const docs = hasMore ? snapshot.docs.slice(0, -1) : snapshot.docs;

    const items: FeedPost[] = docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as FeedPost));

    const newCursor = docs.length > 0 ? docs[docs.length - 1] : null;

    console.log('[FEED:fetch:success]', { 
      count: items.length, 
      hasMore,
      hasCursor: !!newCursor 
    });

    return {
      items,
      cursor: newCursor,
      hasMore,
    };
  } catch (error) {
    console.error('[FEED:fetch:error]', error);
    throw new Error(`Failed to fetch feed: ${error}`);
  }
}

/**
 * Fetches a single feed post by ID
 * @param postId - Post ID
 * @returns Promise<FeedPost | null>
 */
export async function getFeedPost(postId: string): Promise<FeedPost | null> {
  try {
    const postRef = doc(db, 'feedPosts', postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      return null;
    }

    return {
      id: postDoc.id,
      ...postDoc.data(),
    } as FeedPost;
  } catch (error) {
    console.error('[FEED:get:error]', error);
    throw new Error(`Failed to get feed post: ${error}`);
  }
}

/**
 * Deletes a feed post (soft delete)
 * @param postId - Post ID
 * @param userId - User ID (must be post owner)
 */
export async function deleteFeedPost(postId: string, userId: string): Promise<void> {
  try {
    const postRef = doc(db, 'feedPosts', postId);
    const postDoc = await getDoc(postRef);

    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const postData = postDoc.data() as FeedPost;
    if (postData.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own posts');
    }

    // Soft delete
    await runTransaction(db, async (transaction) => {
      transaction.update(postRef, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      });
    });

    console.log('[FEED:delete:success]', { postId });
  } catch (error) {
    console.error('[FEED:delete:error]', error);
    throw new Error(`Failed to delete post: ${error}`);
  }
}

/**
 * Toggles a like on a feed post
 * @param postId - Post ID
 * @param userId - User ID
 */
export async function toggleLike(postId: string, userId: string): Promise<boolean> {
  try {
    const reactionId = `${postId}_${userId}`;
    const reactionRef = doc(db, 'feedReactions', reactionId);
    const postRef = doc(db, 'feedPosts', postId);

    let isLiked = false;

    await runTransaction(db, async (transaction) => {
      const reactionDoc = await transaction.get(reactionRef);
      const postDoc = await transaction.get(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      if (reactionDoc.exists()) {
        // Toggle existing reaction
        const currentReaction = reactionDoc.data() as FeedReaction;
        const newLikedState = !currentReaction.liked;
        isLiked = newLikedState;

        transaction.update(reactionRef, {
          liked: newLikedState,
          updatedAt: serverTimestamp(),
        });

        // Update post like count
        const delta = newLikedState ? 1 : -1;
        transaction.update(postRef, {
          likeCount: increment(delta),
        });
      } else {
        // Create new reaction
        isLiked = true;
        const newReaction: Omit<FeedReaction, 'id'> = {
          postId,
          userId,
          liked: true,
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };

        transaction.set(reactionRef, newReaction);
        transaction.update(postRef, {
          likeCount: increment(1),
        });
      }
    });

    console.log('[FEED:like:success]', { postId, userId, isLiked });
    return isLiked;
  } catch (error) {
    console.error('[FEED:like:error]', error);
    throw new Error(`Failed to toggle like: ${error}`);
  }
}

/**
 * Toggles trust (✅) on a feed post
 * @param postId - Post ID
 * @param userId - User ID
 */
export async function toggleTrust(postId: string, userId: string): Promise<boolean> {
  try {
    const reactionId = `${postId}_${userId}`;
    const reactionRef = doc(db, 'feedReactions', reactionId);
    const postRef = doc(db, 'feedPosts', postId);

    let isTrusted = false;

    await runTransaction(db, async (transaction) => {
      const reactionDoc = await transaction.get(reactionRef);
      const postDoc = await transaction.get(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      if (reactionDoc.exists()) {
        // Toggle existing reaction
        const currentReaction = reactionDoc.data() as FeedReaction;
        const newTrustedState = !currentReaction.trusted;
        isTrusted = newTrustedState;

        transaction.update(reactionRef, {
          trusted: newTrustedState,
          updatedAt: serverTimestamp(),
        });

        // Update post trust count
        const delta = newTrustedState ? 1 : -1;
        transaction.update(postRef, {
          trustCount: increment(delta),
        });
      } else {
        // Create new reaction
        isTrusted = true;
        const newReaction: Omit<FeedReaction, 'id'> = {
          postId,
          userId,
          trusted: true,
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };

        transaction.set(reactionRef, newReaction);
        transaction.update(postRef, {
          trustCount: increment(1),
        });
      }
    });

    console.log('[FEED:trust:success]', { postId, userId, isTrusted });
    return isTrusted;
  } catch (error) {
    console.error('[FEED:trust:error]', error);
    throw new Error(`Failed to toggle trust: ${error}`);
  }
}

/**
 * Toggles save (bookmark) on a feed post
 * @param postId - Post ID
 * @param userId - User ID
 */
export async function toggleSave(postId: string, userId: string): Promise<boolean> {
  try {
    const reactionId = `${postId}_${userId}`;
    const reactionRef = doc(db, 'feedReactions', reactionId);
    const postRef = doc(db, 'feedPosts', postId);

    let isSaved = false;

    await runTransaction(db, async (transaction) => {
      const reactionDoc = await transaction.get(reactionRef);
      const postDoc = await transaction.get(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      if (reactionDoc.exists()) {
        // Toggle existing reaction
        const currentReaction = reactionDoc.data() as FeedReaction;
        const newSavedState = !currentReaction.saved;
        isSaved = newSavedState;

        transaction.update(reactionRef, {
          saved: newSavedState,
          updatedAt: serverTimestamp(),
        });

        // Update post save count
        const delta = newSavedState ? 1 : -1;
        transaction.update(postRef, {
          saveCount: increment(delta),
        });
      } else {
        // Create new reaction
        isSaved = true;
        const newReaction: Omit<FeedReaction, 'id'> = {
          postId,
          userId,
          saved: true,
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };

        transaction.set(reactionRef, newReaction);
        transaction.update(postRef, {
          saveCount: increment(1),
        });
      }
    });

    console.log('[FEED:save:success]', { postId, userId, isSaved });
    return isSaved;
  } catch (error) {
    console.error('[FEED:save:error]', error);
    throw new Error(`Failed to toggle save: ${error}`);
  }
}

/**
 * Gets user's reaction to a specific post
 * @param postId - Post ID
 * @param userId - User ID
 * @returns Promise<FeedReaction | null>
 */
export async function getUserReaction(
  postId: string,
  userId: string
): Promise<FeedReaction | null> {
  try {
    const reactionId = `${postId}_${userId}`;
    const reactionRef = doc(db, 'feedReactions', reactionId);
    const reactionDoc = await getDoc(reactionRef);

    if (!reactionDoc.exists()) {
      return null;
    }

    return {
      id: reactionDoc.id,
      ...reactionDoc.data(),
    } as FeedReaction;
  } catch (error) {
    console.error('[FEED:reaction:get:error]', error);
    return null;
  }
}

/**
 * Adds a comment to a feed post
 * @param postId - Post ID
 * @param userId - User ID
 * @param userName - User name (cached)
 * @param userAvatar - User avatar URL (cached)
 * @param text - Comment text
 */
export async function addComment(
  postId: string,
  userId: string,
  userName: string | undefined,
  userAvatar: string | undefined,
  text: string
): Promise<void> {
  try {
    const commentsRef = collection(db, 'feedComments', postId, 'comments');
    const postRef = doc(db, 'feedPosts', postId);

    await runTransaction(db, async (transaction) => {
      const postDoc = await transaction.get(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      // Create comment document
      const commentData: Omit<FeedComment, 'id'> = {
        postId,
        userId,
        userName,
        userAvatar,
        text,
        createdAt: serverTimestamp() as Timestamp,
        isDeleted: false,
      };

      const commentRef = doc(commentsRef);
      transaction.set(commentRef, commentData);

      // Increment comment count
      transaction.update(postRef, {
        commentCount: increment(1),
      });
    });

    console.log('[FEED:comment:add:success]', { postId, userId });
  } catch (error) {
    console.error('[FEED:comment:add:error]', error);
    throw new Error(`Failed to add comment: ${error}`);
  }
}

/**
 * Fetches paginated comments for a post
 * @param postId - Post ID
 * @param cursor - Last document snapshot for pagination (optional)
 * @returns Promise<CommentsPage>
 */
export async function fetchComments(
  postId: string,
  cursor?: QueryDocumentSnapshot
): Promise<CommentsPage> {
  try {
    const commentsRef = collection(db, 'feedComments', postId, 'comments');
    
    let q = query(
      commentsRef,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'asc'),
      limit(COMMENTS_PER_PAGE + 1)
    );

    if (cursor) {
      q = query(
        commentsRef,
        where('isDeleted', '==', false),
        orderBy('createdAt', 'asc'),
        startAfter(cursor),
        limit(COMMENTS_PER_PAGE + 1)
      );
    }

    const snapshot = await getDocs(q);
    
    const hasMore = snapshot.docs.length > COMMENTS_PER_PAGE;
    const docs = hasMore ? snapshot.docs.slice(0, -1) : snapshot.docs;

    const items: FeedComment[] = docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as FeedComment));

    const newCursor = docs.length > 0 ? docs[docs.length - 1] : null;

    return {
      items,
      cursor: newCursor,
      hasMore,
    };
  } catch (error) {
    console.error('[FEED:comment:fetch:error]', error);
    throw new Error(`Failed to fetch comments: ${error}`);
  }
}

/**
 * Deletes a comment (soft delete)
 * @param postId - Post ID
 * @param commentId - Comment ID
 * @param userId - User ID (must be comment owner)
 */
export async function deleteComment(
  postId: string,
  commentId: string,
  userId: string
): Promise<void> {
  try {
    const commentRef = doc(db, 'feedComments', postId, 'comments', commentId);
    const postRef = doc(db, 'feedPosts', postId);

    await runTransaction(db, async (transaction) => {
      const commentDoc = await transaction.get(commentRef);

      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      const commentData = commentDoc.data() as FeedComment;
      if (commentData.userId !== userId) {
        throw new Error('Unauthorized: You can only delete your own comments');
      }

      // Soft delete comment
      transaction.update(commentRef, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      });

      // Decrement comment count
      transaction.update(postRef, {
        commentCount: increment(-1),
      });
    });

    console.log('[FEED:comment:delete:success]', { postId, commentId });
  } catch (error) {
    console.error('[FEED:comment:delete:error]', error);
    throw new Error(`Failed to delete comment: ${error}`);
  }
}

