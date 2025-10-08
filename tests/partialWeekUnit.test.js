// Unit tests for partial week logic
// Can be run with Jest or similar testing framework

describe('Partial Week Logic', () => {
  // Mock AIService for testing
  const mockAIService = {
    evaluateScheduleReadiness: require('../src/services/ai').AIService.evaluateScheduleReadiness,
    validateScheduleAgainstGoalSpec: require('../src/services/ai').AIService.validateScheduleAgainstGoalSpec
  };

  const createGoalSpec = (countRule, weekBoundary = 'startWeekday', enforcePartialWeeks = false) => ({
    title: 'Test Goal',
    verification: {
      methods: ['manual'],
      mandatory: ['manual'],
      sufficiency: true,
      rationale: 'Test goal'
    },
    schedule: {
      countRule,
      weekBoundary,
      enforcePartialWeeks,
      timeWindows: [],
      weekdayConstraints: []
    }
  });

  describe('Case A: Mid-week start with partial first window', () => {
    it('should not enforce threshold on partial first window', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 3,
        unit: 'per_week'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-05', // Friday
        endDateISO: '2024-01-18',   // Two weeks later
        weeklyWeekdays: [1, 3, 5],  // Mon, Wed, Fri
        goalSpec
      });

      expect(result.ready).toBe(true);
      expect(result.reasons).not.toContain('No scheduled days yet.');
    });

    it('should enforce threshold on full windows after partial', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 5,
        unit: 'per_week'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-05', // Friday
        endDateISO: '2024-01-18',   // Two weeks later
        weeklyWeekdays: [1, 3],     // Mon, Wed (only 2 days)
        goalSpec
      });

      expect(result.ready).toBe(false);
      expect(result.reasons.some(r => r.includes('Weekly schedule must provide at least 5'))).toBe(true);
    });
  });

  describe('Case B: Aligned start (Monday)', () => {
    it('should enforce thresholds immediately when no partial weeks', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 3,
        unit: 'per_week'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-01', // Monday
        endDateISO: '2024-01-14',   // Two weeks later
        weeklyWeekdays: [1, 3, 5],  // Mon, Wed, Fri
        goalSpec
      });

      expect(result.ready).toBe(true);
    });

    it('should fail when insufficient schedule from start', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 5,
        unit: 'per_week'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-01', // Monday
        endDateISO: '2024-01-14',   // Two weeks later
        weeklyWeekdays: [1, 3],     // Mon, Wed (only 2 days)
        goalSpec
      });

      expect(result.ready).toBe(false);
    });
  });

  describe('Case C: Short duration (<7 days)', () => {
    it('should always be ready when duration is less than 7 days', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 3,
        unit: 'per_week'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-01', // Monday
        endDateISO: '2024-01-05',   // Friday (5 days)
        weeklyWeekdays: [0, 1, 2, 3, 4, 5, 6], // Every day
        goalSpec
      });

      expect(result.ready).toBe(true);
      expect(result.reasons.some(r => r.includes('Partial weeks do not enforce'))).toBe(true);
    });

    it('should be ready even with insufficient schedule when all windows partial', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 5,
        unit: 'per_week'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-01', // Monday
        endDateISO: '2024-01-03',   // Wednesday (3 days)
        weeklyWeekdays: [1],        // Only Monday
        goalSpec
      });

      expect(result.ready).toBe(true);
    });
  });

  describe('ISO Week boundary', () => {
    it('should use Monday-Sunday alignment for ISO weeks', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 3,
        unit: 'per_week'
      }, 'isoWeek');

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-05', // Friday
        endDateISO: '2024-01-18',   // Two weeks later
        weeklyWeekdays: [1, 3, 5],  // Mon, Wed, Fri
        goalSpec
      });

      expect(result.ready).toBe(true);
    });
  });

  describe('Enforce partial weeks', () => {
    it('should enforce thresholds on partial weeks when enforcePartialWeeks=true', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 3,
        unit: 'per_week'
      }, 'startWeekday', true);

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-05', // Friday
        endDateISO: '2024-01-06',   // Saturday (2 days)
        weeklyWeekdays: [1, 4],     // Mon, Thu (not in this window)
        goalSpec
      });

      expect(result.ready).toBe(false);
    });
  });

  describe('Non-per_week goals', () => {
    it('should use simple schedule check for per_day goals', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 1,
        unit: 'per_day'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-01',
        endDateISO: '2024-01-05',
        weeklyWeekdays: [1], // Only Monday
        goalSpec
      });

      expect(result.ready).toBe(true);
    });

    it('should use simple schedule check for per_month goals', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 12,
        unit: 'per_month'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-01',
        endDateISO: '2024-01-31',
        weeklyWeekdays: [1, 2, 3, 4, 5], // Weekdays
        goalSpec
      });

      expect(result.ready).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle no scheduled days', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 3,
        unit: 'per_week'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-01',
        endDateISO: '2024-01-14',
        weeklyWeekdays: [], // No days scheduled
        goalSpec
      });

      expect(result.ready).toBe(false);
      expect(result.reasons.some(r => r.includes('No scheduled days yet'))).toBe(true);
    });

    it('should handle invalid date ranges', () => {
      const goalSpec = createGoalSpec({
        operator: '>=',
        count: 3,
        unit: 'per_week'
      });

      const result = mockAIService.evaluateScheduleReadiness({
        startDateISO: '2024-01-10',
        endDateISO: '2024-01-05', // End before start
        weeklyWeekdays: [1, 3, 5],
        goalSpec
      });

      expect(result.ready).toBe(false);
      expect(result.reasons.some(r => r.includes('valid duration'))).toBe(true);
    });
  });
});

module.exports = {
  createGoalSpec
};
