import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestGenerationRequest } from '../../types/quest';
import { QuestGeneratorService } from '../questGenerator';

// Mock all external dependencies
vi.mock('../ai', () => ({
  AIService: {
    generateGoalSpec: vi.fn(),
    generateText: vi.fn(),
  }
}));

// Mock environment variables
process.env.EXPO_PUBLIC_OPENAI_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_OPENAI_PROXY_URL = 'https://api.openai.com/v1';

vi.mock('../../utils/structuredLogging', () => ({
  generateRequestId: vi.fn(() => 'test-request-id'),
  logAIRequest: vi.fn(),
  logAIResponse: vi.fn(),
  PerformanceTimer: class {
    constructor() {}
    end() {}
  }
}));

vi.mock('../../utils/languageDetection', () => ({
  getLanguageAwareSystemPrompt: vi.fn((prompt) => prompt),
  getLocaleConfig: vi.fn(() => ({ language: 'ko', locale: 'ko-KR' }))
}));

describe('QuestGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Frequency Quest Generation', () => {
    it('should generate 6 quests for 2 weeks with 3 times per week', async () => {
      // Arrange
      const request: QuestGenerationRequest = {
        goalId: 'test-goal-123',
        goalTitle: 'go to the gym',
        goalDescription: 'Exercise regularly at the gym',
        goalType: 'frequency',
        duration: {
          startDate: '2025-01-06', // Monday
          endDate: '2025-01-19'    // Sunday (2 weeks later)
        },
        schedule: {
          weekdays: [],
          time: '',
          location: 'Gym',
          frequency: 3
        },
        verificationMethods: ['manual'],
        targetLocation: {
          name: 'Gym',
          coordinates: {
            lat: 37.5665,
            lng: 126.9780
          }
        }
      };

      // Mock AI response to return proper quest structure
      const mockAIResponse = JSON.stringify([
        {
          title: "go to the gym - 1주차 1회차",
          description: "1주차 첫 번째 헬스장 운동 세션을 수행합니다",
          type: "frequency",
          weekNumber: 1,
          verificationRules: [
            {
              type: "manual",
              required: true,
              config: {}
            }
          ]
        },
        {
          title: "go to the gym - 1주차 2회차",
          description: "1주차 두 번째 헬스장 운동 세션을 수행합니다",
          type: "frequency",
          weekNumber: 1,
          verificationRules: [
            {
              type: "manual",
              required: true,
              config: {}
            }
          ]
        },
        {
          title: "go to the gym - 1주차 3회차",
          description: "1주차 세 번째 헬스장 운동 세션을 수행합니다",
          type: "frequency",
          weekNumber: 1,
          verificationRules: [
            {
              type: "manual",
              required: true,
              config: {}
            }
          ]
        },
        {
          title: "go to the gym - 2주차 1회차",
          description: "2주차 첫 번째 헬스장 운동 세션을 수행합니다",
          type: "frequency",
          weekNumber: 2,
          verificationRules: [
            {
              type: "manual",
              required: true,
              config: {}
            }
          ]
        },
        {
          title: "go to the gym - 2주차 2회차",
          description: "2주차 두 번째 헬스장 운동 세션을 수행합니다",
          type: "frequency",
          weekNumber: 2,
          verificationRules: [
            {
              type: "manual",
              required: true,
              config: {}
            }
          ]
        },
        {
          title: "go to the gym - 2주차 3회차",
          description: "2주차 세 번째 헬스장 운동 세션을 수행합니다",
          type: "frequency",
          weekNumber: 2,
          verificationRules: [
            {
              type: "manual",
              required: true,
              config: {}
            }
          ]
        }
      ]);

      // Act - This will trigger fallback generation since AI is not properly configured
      const result = await QuestGeneratorService.generateQuestsFromGoal(request);

      // Assert
      expect(result.quests).toHaveLength(6);
      
      // Check that we have 3 quests for each week
      const week1Quests = result.quests.filter(q => q.weekNumber === 1);
      const week2Quests = result.quests.filter(q => q.weekNumber === 2);
      
      expect(week1Quests).toHaveLength(3);
      expect(week2Quests).toHaveLength(3);
      
      // Check that each week has ordinal sequences 1, 2, 3
      const week1Titles = week1Quests.map(q => q.title);
      const week2Titles = week2Quests.map(q => q.title);
      
      expect(week1Titles).toContain('go to the gym - 1주차 1회차');
      expect(week1Titles).toContain('go to the gym - 1주차 2회차');
      expect(week1Titles).toContain('go to the gym - 1주차 3회차');
      
      expect(week2Titles).toContain('go to the gym - 2주차 1회차');
      expect(week2Titles).toContain('go to the gym - 2주차 2회차');
      expect(week2Titles).toContain('go to the gym - 2주차 3회차');
      
      // Check quest structure
      result.quests.forEach((quest, index) => {
        expect(quest.id).toBeDefined();
        expect(quest.goalId).toBe('test-goal-123');
        expect(quest.title).toContain('go to the gym');
        expect(quest.type).toBe('frequency');
        expect(quest.status).toBe('pending');
        expect(quest.weekNumber).toBeDefined();
        expect(quest.verificationRules).toBeDefined();
        expect(quest.verificationRules).toHaveLength(1);
        expect(quest.verificationRules![0].type).toBe('manual');
        expect(quest.createdAt).toBeDefined();
      });
    });

    it('should generate fallback quests when AI fails', async () => {
      // Arrange
      const request: QuestGenerationRequest = {
        goalId: 'test-goal-456',
        goalTitle: 'go to the gym',
        goalDescription: 'Exercise regularly at the gym',
        goalType: 'frequency',
        duration: {
          startDate: '2025-01-06', // Monday
          endDate: '2025-01-19'    // Sunday (2 weeks later)
        },
        schedule: {
          weekdays: [],
          time: '',
          location: 'Gym',
          frequency: 3
        },
        verificationMethods: ['manual'],
        targetLocation: {
          name: 'Gym',
          coordinates: {
            lat: 37.5665,
            lng: 126.9780
          }
        }
      };

      // Act - This will trigger fallback generation since AI is not properly configured

      // Act
      const result = await QuestGeneratorService.generateQuestsFromGoal(request);

      // Assert
      expect(result.quests).toHaveLength(6); // Should still generate 6 quests via fallback
      
      // Check fallback quest structure
      const week1Quests = result.quests.filter(q => q.weekNumber === 1);
      const week2Quests = result.quests.filter(q => q.weekNumber === 2);
      
      expect(week1Quests).toHaveLength(3);
      expect(week2Quests).toHaveLength(3);
      
      // Check fallback quest titles
      week1Quests.forEach((quest, index) => {
        expect(quest.title).toBe(`go to the gym - 1주차 ${index + 1}회차`);
        expect(quest.description).toBe(`1주차 ${index + 1}번째 go to the gym 세션을 수행합니다`);
      });
      
      week2Quests.forEach((quest, index) => {
        expect(quest.title).toBe(`go to the gym - 2주차 ${index + 1}회차`);
        expect(quest.description).toBe(`2주차 ${index + 1}번째 go to the gym 세션을 수행합니다`);
      });
    });

    it('should handle different frequency values correctly', async () => {
      // Test with 5 times per week for 1 week
      const request: QuestGenerationRequest = {
        goalId: 'test-goal-789',
        goalTitle: 'daily exercise',
        goalDescription: 'Exercise every weekday',
        goalType: 'frequency',
        duration: {
          startDate: '2025-01-06', // Monday
          endDate: '2025-01-12'    // Sunday (1 week)
        },
        schedule: {
          weekdays: [],
          time: '',
          location: 'Home',
          frequency: 5
        },
        verificationMethods: ['manual'],
        targetLocation: undefined
      };

      // Mock AI service to throw error to test fallback
      const { AIService } = await import('../ai');
      vi.mocked(AIService.generateGoalSpec).mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const result = await QuestGeneratorService.generateQuestsFromGoal(request);

      // Assert
      expect(result.quests).toHaveLength(5); // 1 week × 5 times per week
      
      const week1Quests = result.quests.filter(q => q.weekNumber === 1);
      expect(week1Quests).toHaveLength(5);
      
      // Check that we have quests 1 through 5
      week1Quests.forEach((quest, index) => {
        expect(quest.title).toBe(`daily exercise - 1주차 ${index + 1}회차`);
      });
    });
  });

  describe('Quest Structure Validation', () => {
    it('should create quests with proper structure', async () => {
      const request: QuestGenerationRequest = {
        goalId: 'test-goal-structure',
        goalTitle: 'test goal',
        goalDescription: 'test description',
        goalType: 'frequency',
        duration: {
          startDate: '2025-01-06',
          endDate: '2025-01-12'
        },
        schedule: {
          weekdays: [],
          time: '',
          location: 'Test Location',
          frequency: 2
        },
        verificationMethods: ['manual', 'location'],
        targetLocation: {
          name: 'Test Location',
          coordinates: {
            lat: 37.5665,
            lng: 126.9780
          }
        }
      };

      // Mock AI service to throw error to test fallback
      const { AIService } = await import('../ai');
      vi.mocked(AIService.generateGoalSpec).mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const result = await QuestGeneratorService.generateQuestsFromGoal(request);

      // Assert
      expect(result.quests).toHaveLength(2);
      
      result.quests.forEach(quest => {
        // Check required fields
        expect(quest.id).toBeDefined();
        expect(quest.goalId).toBe('test-goal-structure');
        expect(quest.title).toBeDefined();
        expect(quest.description).toBeDefined();
        expect(quest.type).toBe('frequency');
        expect(quest.status).toBe('pending');
        expect(quest.weekNumber).toBe(1);
        expect(quest.verificationRules).toBeDefined();
        expect(quest.createdAt).toBeDefined();
        
        // Check that undefined fields are removed
        expect(quest.scheduledDate).toBeUndefined(); // Should be undefined for frequency type
        
        // Check verification rules
        expect(quest.verificationRules).toHaveLength(2);
        expect(quest.verificationRules![0].type).toBe('manual');
        expect(quest.verificationRules![1].type).toBe('location');
      });
    });
  });
});
