// Feed-related type definitions for community sharing feature
// Enables users to share verified quest achievements with the community

/**
 * Visibility options for feed posts
 * - public: Visible to all users
 * - anonymous: Visible to all but author info is hidden
 * - friends: Visible only to friends (future feature)
 */
export type Visibility = 'public' | 'anonymous' | 'friends';

/**
 * Media type for feed posts
 */
export interface FeedMedia {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
}

/**
 * Verification badges shown on feed posts
 */
export interface FeedVerification {
  photo?: boolean;
  location?: boolean;
  time?: boolean;
}

/**
 * Main feed post document
 * Stored in: feedPosts/{postId}
 */
export interface FeedPost {
  id: string;
  userId: string;
  userName?: string;        // Cached for display
  userAvatar?: string;      // Cached for display
  goalId?: string;
  goalTitle?: string;       // Goal title
  questId?: string;
  title?: string;           // Quest title
  description?: string;     // Description
  caption?: string;         // User's custom message
  media?: FeedMedia[];
  verification?: FeedVerification;
  visibility?: Visibility;
  timestamp?: Date;         // For backwards compatibility
  createdAt?: Date | number;
  updatedAt?: Date | number;
  likes?: number;           // Likes count
  likeCount?: number;
  didILike?: boolean;       // Did current user like this
  trustCount?: number;      // ✅ trust votes
  comments?: number;        // Comments count
  commentCount?: number;
  saveCount?: number;
  school?: string;          // For filtering by school
  isDeleted?: boolean;
}

/**
 * User reactions to feed posts (likes, trust, saves)
 * Stored in: feedReactions/{postId}_{userId}
 * One document per user per post
 */
export interface FeedReaction {
  id: string;               // Format: ${postId}_${userId}
  postId: string;
  userId: string;
  liked?: boolean;
  trusted?: boolean;        // ✅ trust vote
  saved?: boolean;
  createdAt?: Date | number;
  updatedAt: Date | number;
}

/**
 * Comments on feed posts
 * Stored in: feedComments/{postId}/comments/{commentId}
 */
export interface FeedComment {
  id: string;
  postId: string;
  userId: string;
  userName?: string;        // Cached for display
  userAvatar?: string;      // Cached for display
  text: string;
  createdAt: Date | number;
  updatedAt?: Date | number;
  isDeleted?: boolean;
}

/**
 * Parameters for creating a new feed post
 */
export interface CreateFeedPostParams {
  userId: string;
  userName?: string;
  userAvatar?: string;
  goalId: string;
  questId?: string;
  title: string;
  caption?: string;
  media: FeedMedia[];
  verification: FeedVerification;
  visibility: Visibility;
  school?: string;
}

/**
 * Filter options for feed queries
 */
export interface FeedFilter {
  school?: string;
  followingOnly?: boolean;
}

/**
 * Paginated feed response
 */
export interface FeedPage {
  items: FeedPost[];
  cursor: any;              // Last document snapshot for pagination
  hasMore: boolean;
}

/**
 * Paginated comments response
 */
export interface CommentsPage {
  items: FeedComment[];
  cursor: any;
  hasMore: boolean;
}

