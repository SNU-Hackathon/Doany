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
 * Goal type (목표 유형)
 */
export type GoalType = 'schedule' | 'frequency' | 'milestone';

/**
 * Goal의 반복 일정 구조
 * e.g. { "type": "daily", "time": "21:00" }
 */
export interface ScheduleSpec {
  /** 일정의 반복 타입 */
  type: 'daily' | 'weekly' | 'monthly' | 'custom';

  /** 실행 시간 (선택적) — daily일 경우 필수 */
  time?: string; // "21:00" 형태 (24h format)

  /** 주별 반복 시 요일 목록 */
  daysOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];

  /** 커스텀 스케줄일 경우 특정 날짜 리스트 */
  dates?: string[]; // "2025-10-08" 등

  /** 반복 횟수 제한 (optional) */
  repeatCount?: number;

  /** 주기적 반복 간격 (예: 매 2일마다, 3주마다 등) */
  interval?: number;

  /** 기타 설명 (AI 생성 시 참고용) */
  note?: string;
}

/**
 * Goal의 빈도 기반 구조
 * e.g. { "period": "weekly", "times": 3 }
 */
export interface FrequencySpec {
  /** 기준 주기 단위 */
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';

  /** 주기 내 수행 횟수 */
  times: number;

  /** 반복 시작일 */
  startAt?: string; // "2025-10-01"

  /** 반복 종료일 */
  endAt?: string;   // "2025-10-31"

  /** 유연성(엄격도) - ex: 최소 달성률 */
  flexibility?: {
    minRate?: number; // 0.8 → 최소 80% 수행 시 달성 인정
  };

  /** AI가 생성할 때 메모용 설명 */
  note?: string;
}

/**
 * Goal의 단계(마일스톤) 기반 구조
 * e.g. { "steps": [ { "title": "Step 1", "targetValue": 700 } ] }
 */
export interface MilestoneSpec {
  /** 마일스톤(단계) 목록 */
  steps: Array<{
    /** 단계 ID (optional: client-side만 사용) */
    milestoneId?: string;

    /** 단계 이름 (예: '기초 완성', '중급 달성') */
    title: string;

    /** 목표값이 있는 경우 (예: 점수, 체중 등) */
    targetValue?: number | string;

    /** 이 단계의 설명 또는 조건 */
    description?: string;

    /** 시작 시점 */
    startAt?: string; // ISO date string e.g. "2025-10-01"

    /** 완료 시점 (optional) */
    endAt?: string;

    /** 현재 달성 여부 */
    achieved?: boolean;

    /** 달성 일자 */
    achievedAt?: string;

    /** 관련 Proof (사진/문서 등) */
    proof?: {
      proofId?: string;
      url?: string;
      description?: string;
      type?: 'photo' | 'video' | 'text' | 'document';
    };
  }>;

  /** 전체 단계 개수 (optional redundancy) */
  totalSteps?: number;

  /** 현재 진행 중인 단계 index (0부터 시작) */
  currentStepIndex?: number;

  /** 전체 목표의 정량적 목표 (예: "총 점수 900") */
  overallTarget?: number | string;

  /** 유연성 또는 보상 구조 */
  config?: {
    /** 각 단계 완료 시 보상 포인트 등 */
    rewardPerStep?: number;

    /** 실패 허용 개수 */
    maxFails?: number;
  };

  /** AI 생성용 메모 */
  note?: string;
}

/**
 * Verification method
 */
export type VerificationMethod = 'camera' | 'screenShot' | 'manual';

/**
 * Proof type
 */
export type ProofType = 'photo' | 'video' | 'pdf' | 'manual';

/**
 * Vote value
 */
export type VoteValue = 'yes' | 'no';

// ============================================================================
// Auth Types
// ============================================================================

/**
 * Auth provider types
 */
export type AuthProvider = 'password' | 'google';

/**
 * Login with password
 */
export interface LoginPasswordRequest {
  provider: 'password';
  email: string;
  password: string;
}

/**
 * Login with OAuth (Google)
 */
export interface LoginOAuthRequest {
  provider: 'google';
  code: string;
  redirectUri: string;
}

/**
 * Login request (union type)
 */
export type LoginRequest = LoginPasswordRequest | LoginOAuthRequest;

/**
 * Login response (per API v1.3 spec)
 */
export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  userId: string;
}

/**
 * Legacy auth response (for backwards compatibility)
 * @deprecated Use LoginResponse instead
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType?: 'Bearer';
  expiresIn?: number;
  userId?: string;
  user?: {
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
 * Goal category types (for UI display)
 */
export type GoalCategory =
  | 'health fitness'
  | 'mental health'
  | 'nutrition'
  | 'sleep'
  | 'self care'
  | 'study'
  | 'language learning'
  | 'career dev'
  | 'creative'
  | 'reading'
  | 'time mgmt'
  | 'habit building'
  | 'project mgmt'
  | 'focus'
  | 'friends family'
  | 'networking'
  | 'volunteer'
  | 'finance'
  | 'career'
  | 'business'
  | 'travel'
  | 'sports'
  | 'music'
  | 'gaming'
  | 'cooking'
  | 'eco'
  | 'donation'
  | 'learning community'
  | 'spirituality'
  | 'personal'
  | 'custom';

/**
 * Goal list item (summary view)
 * 명세서: GET /goals/me/{userId} 응답
 */
export interface GoalListItem {
  goalId: number;
  title: string;
  progress: string; // e.g. "9/16"
  state: 'onTrack' | 'complete' | 'fail';
  startAt: string; // "2025-10-03"
  endAt: string; // "2025-10-30"
  tag: string; // e.g. "exercise&health"
  description?: string;
  category?: GoalCategory;
  goalType?: GoalType;
  visibility?: GoalVisibility;
  likes?: number;
  isEditable?: boolean;
  iconType?: string;
  progressCurrent?: number;
  progressTotal?: number;
  createdAt?: number | string;
  updatedAt?: number | string;
}

/**
 * Goal list response
 * 명세서: GET /goals/me/{userId} 응답
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
 * 명세서: GET /goals/quests/{goalId} 응답
 */
export interface GoalDetail {
  /** 기본 식별자 */
  goalId: string;
  title: string;
  description?: string;
  tags?: string[];

  /** 목표 유형 - 어떤 스펙을 쓸지 결정 */
  goalType?: GoalType;

  /** 일정 기반 목표 (e.g. 매일 9시 운동) */
  schedule?: ScheduleSpec;

  /** 빈도 기반 목표 (e.g. 주 3회 운동) */
  frequency?: FrequencySpec;

  /** 단계 기반 목표 (e.g. 3단계 다이어트 플랜) */
  milestone?: MilestoneSpec;

  /** 개별 세션(Quest) 정보 — schedule/frequency 공통 */
  quests?: Array<{
    questId?: string;
    date: string; // ISO date string: "2025-10-08"
    time?: string; // optional time string
    description?: string;
    state?: QuestState; // 'onTrack' | 'complete' | 'fail'
    completedAt?: number | string;
    method?: VerificationMethod;
    url?: string; // proof image/video URL
  }>;
  
  // 추가 필드들
  visibility?: GoalVisibility;
  state?: GoalState;
  userId?: string;
  startAt?: string;
  endAt?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
}

/**
 * Create goal request (POST /goals)
 * 명세서: 세 가지 goalType에 따라 다른 필드 구조
 */
export interface CreateGoalRequestBase {
  title: string;
  description?: string;
  tags?: string[];
  startAt?: string; // "2025-10-12"
  endAt?: string; // "2025-10-29"
}

/**
 * Schedule 타입 목표 생성 요청
 */
export interface CreateScheduleGoalRequest extends CreateGoalRequestBase {
  goalType: 'schedule';
  quests: Array<{
    date: string; // "2025-10-12"
    time?: string; // "07:00"
    description?: string;
    verificationMethod?: VerificationMethod;
  }>;
}

/**
 * Frequency 타입 목표 생성 요청
 */
export interface CreateFrequencyGoalRequest extends CreateGoalRequestBase {
  goalType: 'frequency';
  period: 'day' | 'week' | 'month' | 'year'; // "week"
  numbers: number; // 주 4회
  quests: Array<{
    unit: number; // 1, 2, 3...
    description?: string;
    verificationMethod?: VerificationMethod;
  }>;
}

/**
 * Milestone 타입 목표 생성 요청
 */
export interface CreateMilestoneGoalRequest extends CreateGoalRequestBase {
  goalType: 'milestone';
  quests: Array<{
    title: string;
    targetValue?: number | string;
    description?: string;
  }>;
  totalSteps?: number;
  currentStepIndex?: number;
  overallTarget?: number | string;
  config?: {
    rewardPerStep?: number;
    maxFails?: number;
  };
}

/**
 * Create goal request (union type)
 */
export type CreateGoalRequest = 
  | CreateScheduleGoalRequest 
  | CreateFrequencyGoalRequest 
  | CreateMilestoneGoalRequest;

/**
 * Create goal response
 * 명세서: POST /goals 응답 200
 */
export interface CreateGoalResponse {
  goalId: string;
  createdAt: number;
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

