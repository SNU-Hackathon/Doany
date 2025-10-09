/**
 * DoAny API v1.3 TypeScript Types
 * 
 * Type definitions matching the API specification exactly.
 * All optional fields are marked as optional to match the spec.
 */

// ============================================================================
// Common/Utility Types
// ============================================================================

/**
 * Generic paginated response
 */
export interface Paged<T> {
  page: number;
  pageSize: number;
  total?: number;
  items: T[];
}

/**
 * Goal visibility options
 */
export type GoalVisibility = 'public' | 'friends' | 'private';

/**
 * Goal/Quest state
 */
export type GoalState = 'complete' | 'fail' | 'onTrack';
export type QuestState = 'complete' | 'fail' | 'onTrack';

/**
 * Quest/Goal scheduling method
 */
export type ScheduleMethod = 'schedule' | 'frequency';

/**
 * Verification method
 */
export type VerificationMethod = 'camera' | 'screenShot';

/**
 * Proof type
 */
export type ProofType = 'photo' | 'video' | 'pdf';

/**
 * Vote value
 */
export type VoteValue = 'yes' | 'no';

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    name: string;
    email?: string;
  };
}

// ============================================================================
// User Types
// ============================================================================

export interface UserMe {
  userId: string;
  name: string;
  email?: string;
  streak?: number;
  badges?: string[];
  swipeStats?: {
    totalVotes?: number;
    accuracy?: number;
  };
  createdAt: number | string;
  updatedAt: number | string;
}

// ============================================================================
// Goal Types
// ============================================================================

/**
 * Goal list item (summary view)
 */
export interface GoalListItem {
  goalId: string;
  title: string;
  description?: string;
  tags?: string[];
  method?: ScheduleMethod;
  visibility?: GoalVisibility;
  state?: GoalState;
  likes?: number;
  startAt?: number | string;
  endAt?: number | string;
  createdAt: number | string;
  updatedAt?: number | string;
}

/**
 * Goal list response
 */
export interface GoalListResponse extends Paged<GoalListItem> {}

/**
 * Quest detail (nested in GoalDetail)
 */
export interface QuestDetail {
  questId: string;
  goalId: string;
  date: string; // ISO date or timestamp
  time?: string;
  description?: string;
  state?: QuestState;
  completedAt?: number | string;
  method?: VerificationMethod;
  proof?: ProofSummary; // Nested proof if expanded
}

/**
 * Proof summary (nested in quest)
 */
export interface ProofSummary {
  proofId: string;
  url?: string;
  description?: string;
  type?: ProofType;
  votes?: {
    yes: number;
    no: number;
  };
  createdAt?: number | string;
  updatedAt?: number | string;
}

/**
 * Goal detail (expanded view)
 */
export interface GoalDetail {
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  tags?: string[];
  method?: ScheduleMethod;
  visibility?: GoalVisibility;
  state?: GoalState;
  likes?: number;
  didILike?: boolean;
  startAt?: number | string;
  endAt?: number | string;
  createdAt: number | string;
  updatedAt?: number | string;
  quests?: QuestDetail[]; // Present if expand=quests
}

/**
 * Create goal request
 */
export interface CreateGoalRequest {
  title: string;
  description?: string;
  tags?: string[];
  method?: ScheduleMethod;
  visibility?: GoalVisibility;
  startAt?: number | string;
  endAt?: number | string;
  schedule?: {
    frequency?: string; // e.g., "daily", "weekly"
    daysOfWeek?: number[]; // 0=Sunday, 6=Saturday
    times?: string[]; // e.g., ["09:00", "18:00"]
  };
}

/**
 * Create goal response
 */
export interface CreateGoalResponse {
  goalId: string;
  title: string;
  description?: string;
  visibility?: GoalVisibility;
  state?: GoalState;
  createdAt: number | string;
}

/**
 * Patch goal request
 */
export interface PatchGoalRequest {
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: GoalVisibility;
  state?: GoalState;
  startAt?: number | string;
  endAt?: number | string;
}

// ============================================================================
// Quest Types
// ============================================================================

/**
 * Patch quest request
 */
export interface PatchQuestRequest {
  state?: QuestState;
  completedAt?: number | string;
  description?: string;
}

/**
 * Patch quest response
 */
export interface PatchQuestResponse {
  questId: string;
  goalId: string;
  state?: QuestState;
  completedAt?: number | string;
  updatedAt: number | string;
}

// ============================================================================
// Proof Types
// ============================================================================

/**
 * Post proof request
 */
export interface PostProofRequest {
  url: string;
  description?: string;
  type?: ProofType;
}

/**
 * Post proof response
 */
export interface PostProofResponse {
  proofId: string;
  questId: string;
  goalId: string;
  url: string;
  description?: string;
  type?: ProofType;
  createdAt: number | string;
}

/**
 * Proof detail
 */
export interface ProofDetail {
  proofId: string;
  questId: string;
  goalId: string;
  userId: string;
  url: string;
  description?: string;
  type?: ProofType;
  votes?: {
    yes: number;
    no: number;
  };
  createdAt: number | string;
  updatedAt: number | string;
}

// ============================================================================
// Feed Types
// ============================================================================

/**
 * Feed item (goal with additional feed context)
 */
export interface FeedItem {
  goalId: string;
  userId: string;
  userName?: string;
  title: string;
  description?: string;
  tags?: string[];
  visibility?: GoalVisibility;
  state?: GoalState;
  likes: number;
  didILike: boolean;
  createdAt: number | string;
  updatedAt?: number | string;
  // Optional expanded data
  recentProofs?: ProofSummary[];
  comments?: CommentSummary[];
}

/**
 * Comment summary
 */
export interface CommentSummary {
  commentId: string;
  authorId: string;
  authorName?: string;
  content: string;
  createdAt: number | string;
  updatedAt?: number | string;
}

/**
 * Feed goals response
 */
export interface FeedGoalsResponse extends Paged<FeedItem> {}

/**
 * Like toggle response
 */
export interface LikeToggleResponse {
  goalId: string;
  liked: boolean; // true if liked, false if unliked
  likes: number; // Updated like count
}

/**
 * My likes item
 */
export interface MyLikeItem {
  goalId: string;
  title: string;
  description?: string;
  userId: string;
  userName?: string;
  likedAt: number | string;
}

/**
 * My likes response
 */
export interface MyLikesResponse extends Paged<MyLikeItem> {}

// ============================================================================
// Swipe Types
// ============================================================================

/**
 * Swipe proof item
 */
export interface SwipeProofItem {
  proofId: string;
  questId: string;
  goalId: string;
  userId: string;
  userName?: string;
  goalTitle?: string;
  url: string;
  description?: string;
  type?: ProofType;
  votes?: {
    yes: number;
    no: number;
  };
  createdAt: number | string;
  serveId?: string; // Session identifier for this serve
}

/**
 * Swipe proofs response
 * Can be either a paginated list or a single item (normalize to array)
 */
export type SwipeProofsResponse = Paged<SwipeProofItem> | SwipeProofItem[] | SwipeProofItem;

/**
 * Vote request
 */
export interface VoteRequest {
  vote: VoteValue;
  serveId: string; // From SwipeProofItem.serveId
}

/**
 * Vote response
 */
export interface VoteResponse {
  proofId: string;
  stats: {
    yes: number;
    no: number;
  };
  didCountTowardQuorum?: boolean;
}

// ============================================================================
// System Types
// ============================================================================

export interface HealthResponse {
  ok: boolean;
  time: number;
  version?: string;
}

