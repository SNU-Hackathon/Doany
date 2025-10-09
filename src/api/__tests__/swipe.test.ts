/**
 * Tests for Swipe API vote path fallback logic
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the HTTP client
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../../lib/http', () => ({
  httpClient: {
    get: mockGet,
    post: mockPost,
  },
}));

// Mock the config
const mockConfig = {
  baseURL: 'https://13.209.220.97:8080/api',
  useMocks: false,
  votePathMode: 'auto' as 'auto' | 'goal' | 'proof',
};

vi.mock('../../config/api', () => ({
  apiConfig: mockConfig,
}));

describe('Swipe API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.votePathMode = 'auto';
  });

  describe('voteOnProof - vote path modes', () => {
    it('should use goal path when mode is "goal"', async () => {
      mockConfig.votePathMode = 'goal';
      mockPost.mockResolvedValueOnce({
        proofId: 'proof-123',
        stats: { yes: 10, no: 1 },
      });

      const { voteOnProof } = await import('../swipe');

      await voteOnProof({
        goalId: 'goal-123',
        proofId: 'proof-456',
        body: { vote: 'yes', serveId: 'serve-123' },
      });

      expect(mockPost).toHaveBeenCalledWith('/swipe/proofs/goal-123/votes', {
        vote: 'yes',
        serveId: 'serve-123',
      });
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('should use proof path when mode is "proof"', async () => {
      mockConfig.votePathMode = 'proof';
      mockPost.mockResolvedValueOnce({
        proofId: 'proof-456',
        stats: { yes: 10, no: 1 },
      });

      const { voteOnProof } = await import('../swipe');

      await voteOnProof({
        goalId: 'goal-123',
        proofId: 'proof-456',
        body: { vote: 'yes', serveId: 'serve-123' },
      });

      expect(mockPost).toHaveBeenCalledWith('/swipe/proofs/proof-456/votes', {
        vote: 'yes',
        serveId: 'serve-123',
      });
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('should try goal path first in auto mode', async () => {
      mockConfig.votePathMode = 'auto';
      mockPost.mockResolvedValueOnce({
        proofId: 'proof-456',
        stats: { yes: 10, no: 1 },
      });

      const { voteOnProof } = await import('../swipe');

      await voteOnProof({
        goalId: 'goal-123',
        proofId: 'proof-456',
        body: { vote: 'yes', serveId: 'serve-123' },
      });

      // Should call goal path
      expect(mockPost).toHaveBeenCalledWith('/swipe/proofs/goal-123/votes', {
        vote: 'yes',
        serveId: 'serve-123',
      });
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('should fallback to proof path on 404 in auto mode', async () => {
      mockConfig.votePathMode = 'auto';

      // First call (goal path) returns 404
      mockPost.mockRejectedValueOnce({
        response: { status: 404 },
      });

      // Second call (proof path) succeeds
      mockPost.mockResolvedValueOnce({
        proofId: 'proof-456',
        stats: { yes: 10, no: 1 },
      });

      const { voteOnProof } = await import('../swipe');

      const result = await voteOnProof({
        goalId: 'goal-123',
        proofId: 'proof-456',
        body: { vote: 'yes', serveId: 'serve-123' },
      });

      // Should try goal path first
      expect(mockPost).toHaveBeenNthCalledWith(1, '/swipe/proofs/goal-123/votes', {
        vote: 'yes',
        serveId: 'serve-123',
      });

      // Should fallback to proof path
      expect(mockPost).toHaveBeenNthCalledWith(2, '/swipe/proofs/proof-456/votes', {
        vote: 'yes',
        serveId: 'serve-123',
      });

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(result.stats.yes).toBe(10);
    });

    it('should throw error if goalId missing in goal mode', async () => {
      mockConfig.votePathMode = 'goal';

      const { voteOnProof } = await import('../swipe');

      await expect(
        voteOnProof({
          proofId: 'proof-456',
          body: { vote: 'yes', serveId: 'serve-123' },
        })
      ).rejects.toThrow('goalId is required');
    });

    it('should throw error if proofId missing in proof mode', async () => {
      mockConfig.votePathMode = 'proof';

      const { voteOnProof } = await import('../swipe');

      await expect(
        voteOnProof({
          goalId: 'goal-123',
          body: { vote: 'yes', serveId: 'serve-123' },
        })
      ).rejects.toThrow('proofId is required');
    });
  });

  describe('getSwipeProofs - response normalization', () => {
    it('should return array as-is', async () => {
      const mockProofs = [
        { proofId: 'proof-1', goalId: 'goal-1' },
        { proofId: 'proof-2', goalId: 'goal-2' },
      ];

      mockGet.mockResolvedValueOnce(mockProofs);

      const { getSwipeProofs } = await import('../swipe');
      const result = await getSwipeProofs();

      expect(result).toEqual(mockProofs);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should normalize paginated response to array', async () => {
      const mockPaginated = {
        page: 1,
        pageSize: 10,
        total: 2,
        items: [
          { proofId: 'proof-1', goalId: 'goal-1' },
          { proofId: 'proof-2', goalId: 'goal-2' },
        ],
      };

      mockGet.mockResolvedValueOnce(mockPaginated);

      const { getSwipeProofs } = await import('../swipe');
      const result = await getSwipeProofs();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].proofId).toBe('proof-1');
    });

    it('should normalize single object to array', async () => {
      const mockSingle = { proofId: 'proof-1', goalId: 'goal-1' };

      mockGet.mockResolvedValueOnce(mockSingle);

      const { getSwipeProofs } = await import('../swipe');
      const result = await getSwipeProofs();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].proofId).toBe('proof-1');
    });
  });
});

