/**
 * Tests for mock resolver to ensure response shapes match types
 */

import { describe, expect, it } from 'vitest';
import type {
    FeedGoalsResponse,
    GoalDetail,
    GoalListResponse,
    HealthResponse,
    SwipeProofItem,
    UserMe,
} from '../../api/types';
import { resolveMock } from '../resolver';

describe('Mock Resolver', () => {
  describe('System endpoints', () => {
    it('should return valid health response', async () => {
      const result = await resolveMock<HealthResponse>('GET', '/system/health');

      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('time');
      expect(typeof result.ok).toBe('boolean');
      expect(typeof result.time).toBe('number');
    });
  });

  describe('User endpoints', () => {
    it('should return valid user profile', async () => {
      const result = await resolveMock<UserMe>('GET', '/users/me');

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
      expect(typeof result.userId).toBe('string');
      expect(typeof result.name).toBe('string');
    });
  });

  describe('Goal endpoints', () => {
    it('should return paginated goals list', async () => {
      const result = await resolveMock<GoalListResponse>('GET', '/me/goals');

      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);

      const firstGoal = result.items[0];
      expect(firstGoal).toHaveProperty('goalId');
      expect(firstGoal).toHaveProperty('title');
      expect(firstGoal).toHaveProperty('createdAt');
    });

    it('should return goal detail with quests', async () => {
      const result = await resolveMock<GoalDetail>('GET', '/me/goals/goal-123');

      expect(result).toHaveProperty('goalId');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('quests');
      expect(Array.isArray(result.quests)).toBe(true);

      if (result.quests && result.quests.length > 0) {
        const firstQuest = result.quests[0];
        expect(firstQuest).toHaveProperty('questId');
        expect(firstQuest).toHaveProperty('goalId');
        expect(firstQuest).toHaveProperty('date');
      }
    });

    it('should return create goal response', async () => {
      const result = await resolveMock('POST', '/goals', {
        title: 'Test Goal',
      });

      expect(result).toHaveProperty('goalId');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('createdAt');
    });
  });

  describe('Feed endpoints', () => {
    it('should return paginated feed', async () => {
      const result = await resolveMock<FeedGoalsResponse>('GET', '/feed/goals');

      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);

      if (result.items.length > 0) {
        const firstItem = result.items[0];
        expect(firstItem).toHaveProperty('goalId');
        expect(firstItem).toHaveProperty('userId');
        expect(firstItem).toHaveProperty('title');
        expect(firstItem).toHaveProperty('likes');
        expect(firstItem).toHaveProperty('didILike');
        expect(typeof firstItem.didILike).toBe('boolean');
      }
    });

    it('should return like toggle response', async () => {
      const result = await resolveMock('POST', '/feed/goals/goal-123/likes/me');

      expect(result).toHaveProperty('goalId');
      expect(result).toHaveProperty('liked');
      expect(result).toHaveProperty('likes');
      expect(typeof result.liked).toBe('boolean');
      expect(typeof result.likes).toBe('number');
    });
  });

  describe('Swipe endpoints', () => {
    it('should return swipe proofs', async () => {
      const result = await resolveMock('GET', '/swipe/proofs');

      // Result can be array, single object, or paginated
      const normalized = Array.isArray(result)
        ? result
        : result.items
        ? result.items
        : [result];

      expect(Array.isArray(normalized)).toBe(true);

      if (normalized.length > 0) {
        const firstProof = normalized[0] as SwipeProofItem;
        expect(firstProof).toHaveProperty('proofId');
        expect(firstProof).toHaveProperty('questId');
        expect(firstProof).toHaveProperty('goalId');
        expect(firstProof).toHaveProperty('url');
      }
    });

    it('should return vote response', async () => {
      const result = await resolveMock(
        'POST',
        '/swipe/proofs/goal-123/votes',
        {
          vote: 'yes',
          serveId: 'serve-123',
        }
      );

      expect(result).toHaveProperty('proofId');
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveProperty('yes');
      expect(result.stats).toHaveProperty('no');
      expect(typeof result.stats.yes).toBe('number');
      expect(typeof result.stats.no).toBe('number');
    });
  });

  describe('Proof endpoints', () => {
    it('should return proof detail', async () => {
      const result = await resolveMock('GET', '/me/proofs/proof-789');

      expect(result).toHaveProperty('proofId');
      expect(result).toHaveProperty('questId');
      expect(result).toHaveProperty('goalId');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('votes');
      expect(result.votes).toHaveProperty('yes');
      expect(result.votes).toHaveProperty('no');
    });

    it('should return proof creation response', async () => {
      const result = await resolveMock(
        'POST',
        '/goals/goal-123/quests/quest-456/proofs',
        {
          url: 'https://example.com/proof.jpg',
          type: 'photo',
        }
      );

      expect(result).toHaveProperty('proofId');
      expect(result).toHaveProperty('questId');
      expect(result).toHaveProperty('goalId');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('createdAt');
    });
  });

  describe('Error handling', () => {
    it('should return safe fallback for unknown endpoint', async () => {
      const result = await resolveMock('GET', '/unknown/endpoint');

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
    });
  });
});

