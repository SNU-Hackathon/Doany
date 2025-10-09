// Modal component for creating new goals with optimistic UI and performance optimizations

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// import { LocationSearch } from '../components'; // Commented out to avoid web build issues
import { FrequencyTarget, ScheduleWhen } from '../components/createGoal';
import { Categories } from '../constants';
import { classifyGoalTypeFromTitle, computeVerificationPlan, CreateGoalState as CreateGoalFeatureState, GoalType, INITIAL_CREATE_GOAL_STATE, RULE_TIPS, useCreateGoal, validateFrequencyDraft } from '../features/createGoal';
import ScheduleFlow from '../features/createGoal/ScheduleFlow';
import { AIGoalDraft, mergeAIGoal, parseGoalSpec, updateDraftWithDates, validateAIGoal } from '../features/goals/aiDraft';
import { useAIWithRetry } from '../hooks/useAIWithRetry';
import { useAuth } from '../hooks/useAuth';
import { useBurstyCallPrevention, useDuplicateRequestTelemetry } from '../hooks/useBurstyCallPrevention';
import { AIService } from '../services/ai';
import { CalendarEventService } from '../services/calendarEventService';
import { GoalService } from '../services/goalService';
import { getPlaceDetails } from '../services/places';
import { CreateGoalForm, GoalDuration, GoalFrequency, GoalSpec, TargetLocation, ValidationResult, VerificationType } from '../types';
import { getLocaleConfig } from '../utils/languageDetection';
import { toIndexKeyMap } from '../utils/schedule';
import {
  generateRequestId,
  getLoggingSessionId,
  logStorage,
  logUserAction,
  logValidation,
  PerformanceTimer,
  setLoggingUserId
} from '../utils/structuredLogging';
import { toast } from '../utils/toast';
import QuestPreview from './QuestPreview';
import SimpleDatePicker, { DateSelection } from './SimpleDatePicker';
import ToastContainer from './ToastContainer';

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
}

// Use new chatbot interface
import ChatbotCreateGoal from './chatbot/ChatbotCreateGoal';

// Legacy step definitions (kept for compatibility)
const STEPS = [
  { id: 'chatbot', title: 'Goal Creation', description: 'Create goal with AI assistant' }
];

function CreateGoalModalContent({ visible, onClose, onGoalCreated }: CreateGoalModalProps) {
  
  // Use new chatbot interface - simplified implementation
  if (visible) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <ChatbotCreateGoal 
          onGoalCreated={(goalData) => {
            console.log('[CreateGoalModal] Goal created:', goalData);
            onGoalCreated();
          }}
          onClose={onClose}
        />
      </Modal>
    );
  }
  
  return null;
}

function CreateGoalModalContentLegacy({ visible, onClose, onGoalCreated }: CreateGoalModalProps) {
  // Performance tracking
  console.time('[CreateGoalModal] Component Mount');
  
  const { user } = useAuth();
  
  // Set up logging session
  useEffect(() => {
    if (user?.id) {
      setLoggingUserId(user.id);
    }
  }, [user?.id]);
  
  // Log modal open
  useEffect(() => {
    if (visible) {
      logUserAction({
        action: 'modal_open',
        message: 'CreateGoalModal opened',
        context: {
          sessionId: getLoggingSessionId(),
          userId: user?.id,
        },
      });
    }
  }, [visible, user?.id]);
  const navigation = useNavigation<any>();
  const { state, actions } = useCreateGoal();
  
  // Local state for AI type badge
  const [aiBadgeState, setAiBadgeState] = useState<CreateGoalFeatureState>(INITIAL_CREATE_GOAL_STATE);

  // Form data state
  const [formData, setFormData] = useState<CreateGoalForm>({
    title: '',
    description: '',
    category: Categories[0],
    type: 'frequency', // 기본값 설정
    verificationMethods: [],
    frequency: { count: 1, unit: 'per_day' },
    duration: {
      type: 'range',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    targetLocation: undefined,
    milestones: undefined,
    lockedVerificationMethods: [],
    weeklyWeekdays: [],
    weeklySchedule: {},
    calendarEvents: []
  });

  // AI retry hook for robust error handling
  const aiRetry = useAIWithRetry({
    debounceMs: 800,
    maxRetries: 2,
    retryDelayMs: 1000,
  });

  // Quest preview loading state
  const [questPreviewLoading, setQuestPreviewLoading] = useState(false);

  // Bursty call prevention hooks
  const burstyCallPrevention = useBurstyCallPrevention({
    debounceMs: 600,
    maxRetries: 2,
    retryDelayMs: 1000
  });

  // Removed debounced AI classification - only trigger on button press

  const telemetry = useDuplicateRequestTelemetry();

  // Removed auto-classification function - AI only runs on button press

  // This function will be defined later after other variables

  // Schema validation state
  const [isSchemaValid, setIsSchemaValid] = useState(false);
  const [schemaValidationErrors, setSchemaValidationErrors] = useState<string[]>([]);

  // Validate form data against schema
  const validateFormSchema = useCallback(() => {
    const errors: string[] = [];

    // Basic validation
    if (!formData.title || formData.title.trim().length === 0) {
      errors.push('목표 제목을 입력해주세요');
    }

    if (!formData.category) {
      errors.push('카테고리를 선택해주세요');
    }

    if (!formData.duration?.startDate || !formData.duration?.endDate) {
      errors.push('시작일과 종료일을 설정해주세요');
    }

    // Type-specific validation
    if (aiBadgeState.type === 'frequency') {
      if (!formData.frequency?.count || formData.frequency.count <= 0) {
        errors.push('주간 목표 횟수를 설정해주세요');
      }
    }

    if (aiBadgeState.type === 'schedule') {
      if (!formData.weeklyWeekdays || formData.weeklyWeekdays.length === 0) {
        errors.push('요일을 선택해주세요');
      }
    }

    if (aiBadgeState.type === 'milestone') {
      if (!formData.milestones?.milestones || formData.milestones.milestones.length === 0) {
        errors.push('마일스톤 정보를 설정해주세요');
      }
    }

    setSchemaValidationErrors(errors);
    setIsSchemaValid(errors.length === 0);
    
    // Log validation result
    logValidation({
      validationType: 'form_schema',
      passed: errors.length === 0,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0 ? 'Form validation passed' : 'Form validation failed',
    });
    
    return errors.length === 0;
  }, [formData, aiBadgeState.type]);

  // Validate schema when form data changes
  useEffect(() => {
    validateFormSchema();
  }, [validateFormSchema]);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showWhyTooltip, setShowWhyTooltip] = useState(false);
  const [showRulePreview, setShowRulePreview] = useState(false);
  
  // Debug navigation state
  useEffect(() => {
    try {
      const state = navigation.getState();
      if (state?.routeNames) {
        console.log('[NAV] available screens:', state.routeNames);
      }
    } catch (error) {
      console.log('[NAV] Navigation not ready yet:', error.message);
    }
  }, [navigation]);

  // AI classification effect
  useEffect(() => {
    if (aiBadgeState.title.length > 0) {
      const guess = classifyGoalTypeFromTitle(aiBadgeState.title);
      console.log('[CreateGoal] AI guess ->', guess);
      setAiBadgeState(prev => ({
        ...prev,
        aiGuess: guess,
        type: prev.typeLockedByUser ? prev.type : guess // 사용자가 직접 고정한 경우만 유지
      }));
    }
  }, [aiBadgeState.title]);

  // Type-aware validation computation
  const getTypeAwareValidation = () => {
    const type = aiDraft?.type || aiBadgeState.type;
    
    if (type === 'frequency') {
      // Always allow frequency goals to proceed - validation is done at save time
      const warnings = [];
      
      // Check if period was defaulted
      const today = new Date();
      const defaultStart = today.toISOString().split('T')[0];
      const defaultEnd = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      if (aiDraft?.schedule?.startDate === defaultStart && aiDraft?.schedule?.endDate === defaultEnd) {
        warnings.push('Using a default 7-day window starting today');
      }
      
      return {
        ok: true, // Always allow to proceed
        issues: [], // No blocking issues
        warnings
      };
    }
    
    if (type === 'milestone') {
      // Always allow milestone goals to proceed - validation is done at save time
      return {
        ok: true, // Always allow to proceed
        issues: [], // No blocking issues
        warnings: []
      };
    }
    
    // Schedule type - always allow to proceed
    if (type === 'schedule') {
      // Always allow schedule goals to proceed - validation is done at save time
      return {
        ok: true, // Always allow to proceed
        issues: [], // No blocking issues
        warnings: []
      };
    }
    
    // Fallback - always allow to proceed
    return {
      ok: true, // Always allow to proceed
      issues: [], // No blocking issues
      warnings: []
    };
  };
  
  const validation = getTypeAwareValidation();
  const { ok, issues, warnings } = validation;
  
  // AI 단계(step===0)에서는 issues를 표시하지 않음 (Verification Plan이 대체)
  const showIssues = state.step === 2; // Review에서만 표시

  // Log validation issues for debugging - disabled to avoid unnecessary logs
  useEffect(() => {
    if (showIssues && __DEV__) {
      const type = aiDraft?.type || aiBadgeState.type;
      // Only log warnings, not blocking issues since we allow all goals to proceed
      if (warnings.length > 0) {
        console.log('[Review] type=', type, 'warnings=', warnings);
      }
    }
  }, [warnings, showIssues, aiBadgeState.type]);

  // Helper function to get classification reasons
  const getClassificationReasons = (title: string, type: GoalType): string[] => {
    const t = title.toLowerCase();
    const reasons: string[] = [];
    
    if (type === 'frequency') {
      if (/(times\s+per\s+(week|day|month))/.test(t)) reasons.push("Detected 'times per week/day/month'");
      if (/(\bper\s+week\b)/.test(t)) reasons.push("Found 'per week'");
      if (/(\bweekly\b)/.test(t)) reasons.push("Found 'weekly'");
    } else if (type === 'milestone') {
      if (/(milestone|phase|stage)/.test(t)) reasons.push("Detected 'milestone/phase/stage'");
      if (/\b(project|goal|skill)\s+(completion|achievement)/.test(t)) reasons.push("Found 'project/goal/skill completion'");
      if (/\b(kickoff|mid|finish|final)\b/.test(t)) reasons.push("Found milestone keywords");
    } else if (type === 'schedule') {
      if (/\b(mon|tue|wed|thu|fri|sat|sun)\b/.test(t)) reasons.push("Detected day names");
      if (/\b\d{1,2}:\d{2}\b/.test(t)) reasons.push("Found time format");
      if (/\b(am|pm)\b/.test(t)) reasons.push("Found AM/PM");
    }
    
    if (reasons.length === 0) {
      reasons.push("Default classification based on general goal pattern");
    }
    
    return reasons;
  };
  
  // Location data is now handled via navigation params in the Search button
  
  // State machine states with optimistic UI
  type CreateGoalState = 'IDLE' | 'GENERATING' | 'NEEDS_INFO' | 'NEEDS_DATES' | 'NEEDS_LOCATION' | 'READY_TO_REVIEW' | 'SAVING' | 'SAVED_OPTIMISTIC' | 'BACKGROUND_PROCESSING';
  
  const [appState, setAppState] = useState<CreateGoalState>('IDLE');
  const [loading, setLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiContext, setAiContext] = useState<any>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [aiDraft, setAiDraft] = useState<AIGoalDraft>({});
  const [rememberedPrompt, setRememberedPrompt] = useState(''); // Remember the original AI prompt
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [backgroundTaskProgress, setBackgroundTaskProgress] = useState<string>('');
  const [aiVerificationLoading, setAiVerificationLoading] = useState<boolean>(false);
  const [aiSuccessCriteria, setAiSuccessCriteria] = useState<string>('');
  const [scheduleReady, setScheduleReady] = useState<boolean>(true);
  const [blockingReasons, setBlockingReasons] = useState<string[]>([]);
  // GoalSpec verification methods and summary
  const [aiAnalyzedMethods, setAiAnalyzedMethods] = useState<VerificationType[]>([] as any);
  const [aiMandatoryMethods, setAiMandatoryMethods] = useState<VerificationType[]>([] as any);
  const [aiVerificationSummary, setAiVerificationSummary] = useState('');

  // GoalSpec compiler & plan state (Step 0)
  const [goalSpec, setGoalSpec] = useState<GoalSpec | null>(null);
  const [goalSpecLoading, setGoalSpecLoading] = useState<boolean>(false);
  const [showSpecPlanModal, setShowSpecPlanModal] = useState<boolean>(false);
  const [specFollowUpQuestion, setSpecFollowUpQuestion] = useState<string>('');
  const [specFollowUpAnswer, setSpecFollowUpAnswer] = useState<string>('');
  
  // Methods selection state for verification plan modal
  const [planSelectedMethods, setPlanSelectedMethods] = useState<{[key: string]: boolean}>({
    time: false,
    location: false,
    photo: false,
    manual: false
  });

  // Schedule validator state (Step 2)
  const [scheduleValidation, setScheduleValidation] = useState<ValidationResult | null>(null);
  const [scheduleValidating, setScheduleValidating] = useState<boolean>(false);
  const scheduleValidateInFlight = useRef(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showScheduleFixes, setShowScheduleFixes] = useState<boolean>(false);
  const [lastValidationResult, setLastValidationResult] = useState<{ isCompatible: boolean; issues: string[] } | null>(null);
  const [scheduleValidationResult, setScheduleValidationResult] = useState<ValidationResult | null>(null);

  // Utility: check if verification methods provide objective proof beyond manual
  const isVerificationSufficient = (methods: VerificationType[]) => {
    const objective: VerificationType[] = ['location', 'time', 'photo', 'screentime'] as any;
    return (methods || []).some((m) => (objective as any).includes(m));
  };

  // AI generation handler for "Generate with AI" button
  const handleAiGoalGeneration = useCallback(async () => {
    if (!aiPrompt.trim()) {
      toast.error('목표를 입력해주세요');
      return;
    }

    console.log('[AI.INPUT]', {
      prompt: aiPrompt,
      locale: 'ko-KR',
      timezone: 'Asia/Seoul'
    });

    try {
      setLoading(true);
      
      // Use AI service to classify and extract goal spec
      const goalSpec = await AIService.compileGoalSpec({
        prompt: aiPrompt.trim(),
        title: formData.title,
        targetLocationName: formData.targetLocation?.name,
        locale: 'ko-KR',
        timezone: 'Asia/Seoul'
      });
      
      console.log('[AI.OUTPUT]', {
        type: goalSpec.type,
        title: goalSpec.title,
        frequency: goalSpec.frequency,
        schedule: goalSpec.schedule,
        milestone: goalSpec.milestone,
        verification: goalSpec.verification
      });
      
      // Update formData with AI classification results
      const updatedFormData: CreateGoalForm = {
        ...formData,
        title: goalSpec.title || aiPrompt.trim(),
        type: goalSpec.type || 'frequency',
        frequency: goalSpec.frequency ? {
          count: goalSpec.frequency.targetPerWeek || 3,
          unit: 'per_week'
        } : { count: 3, unit: 'per_week' },
        verificationMethods: goalSpec.verification?.signals || ['manual'],
        targetLocation: goalSpec.schedule?.events?.[0]?.locationName ? {
          name: goalSpec.schedule.events[0].locationName,
          lat: goalSpec.schedule.events[0].lat || 0,
          lng: goalSpec.schedule.events[0].lng || 0
        } : formData.targetLocation,
        // Schedule 타입일 때 weeklySchedule과 weeklyWeekdays 설정
        weeklySchedule: goalSpec.type === 'schedule' && goalSpec.schedule?.events ? 
          goalSpec.schedule.events.reduce((acc, event) => {
            const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const fullDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayIndex = dayNames.indexOf(event.dayOfWeek);
            if (dayIndex !== -1) {
              const fullDayName = fullDayNames[dayIndex];
              acc[fullDayName] = [event.time];
            }
            return acc;
          }, {} as Record<string, string[]>) : formData.weeklySchedule,
        weeklyWeekdays: goalSpec.type === 'schedule' && goalSpec.schedule?.events ?
          goalSpec.schedule.events.map(event => {
            const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            return dayNames.indexOf(event.dayOfWeek);
          }).filter(index => index !== -1) : formData.weeklyWeekdays
      };
      
      console.log('[SPEC.FINAL]', {
        title: updatedFormData.title,
        type: updatedFormData.type,
        frequency: updatedFormData.frequency,
        verificationMethods: updatedFormData.verificationMethods
      });
      
      setFormData(updatedFormData);
      
      // Show verification plan modal for user confirmation (stay in AI step)
      setShowSpecPlanModal(true);
      // Don't change app state yet - wait for user confirmation
      
    } catch (error) {
      console.error('[CreateGoalModal] AI goal classification failed:', error);
      toast.error('AI 분석에 실패했습니다. 기본값으로 설정합니다.');
      
      // Fallback to basic defaults
      setFormData(prev => ({
        ...prev,
        title: aiPrompt.trim(),
        type: 'frequency',
        frequency: { count: 3, unit: 'per_week' }
      }));
      
      actions.setStep(1);
    } finally {
      setLoading(false);
    }
  }, [aiPrompt, formData, toast, actions.setStep]);

  // Post-process GoalSpec/analyze results to enforce verification requirements
  const postProcessVerificationMethods = (
    spec: GoalSpec | null, 
    currentMethods: VerificationType[], 
    currentMandatory: VerificationType[],
    userText: string = ''
  ) => {
    let methods = [...currentMethods];
    let mandatory = [...currentMandatory];
    let issues: string[] = [];
    let missingFields: string[] = [];
    let followUpQuestion: string = '';

    // Check location mode and requirements
    const loc = spec?.verification?.constraints?.location;
    
    if (loc?.mode === 'movement') {
      // never ask for place; do not add missingFields: 'targetLocation'
      console.log('[PostProcess] Movement goal detected - no place name required');
      // Ensure location stays in mandatory methods
      if (!mandatory.includes('location' as any)) {
        mandatory.push('location' as any);
      }
    } else if (loc?.mode === 'geofence') {
      // For geofence mode, treat location as satisfied if ANY of these exist:
      // - goalSpec.verification.constraints.location.name
      // - goalSpec.verification.constraints.location.placeId  
      // - formData.targetLocation?.name
      const hasPlace = !!(loc?.name || loc?.placeId || formData?.targetLocation?.name);
      
      if (!hasPlace) {
        // add missingFields ['targetLocation'] and set a single follow-up question
        missingFields.push('targetLocation');
        if (!followUpQuestion) {
          followUpQuestion = 'Please provide the place name for location verification.';
        }
        console.log('[PostProcess] Added location to mandatory due to missing place info');
      } else {
        console.log('[PostProcess] Geofence location satisfied with existing place info');
      }
      
      // Ensure location stays in mandatory methods
      if (!mandatory.includes('location' as any)) {
        mandatory.push('location' as any);
      }
    } else if (loc && !methods.includes('location' as any)) {
      // If location constraint exists but not in methods/mandatory: add it
      methods.push('location' as any);
      mandatory.push('location' as any);
      console.log('[PostProcess] Added location method due to location constraint');
    }

    // Check if goal type looks digital from GoalSpec constraints or user text
    const hasScreentimeConstraints = !!(spec?.verification?.constraints?.screentime);
    const userTextLooksDigital = /\b(app|apps|screen|digital|coding|IDE|browser|social media|focus timer|study app|watching videos)\b/i.test(userText);
    
    if ((hasScreentimeConstraints || userTextLooksDigital) && !methods.includes('screentime' as any)) {
      methods.push('screentime' as any);
      mandatory.push('screentime' as any);
      console.log('[PostProcess] Added screentime method due to digital goal type');
      
      // If no bundleIds in constraints, flag for UI selection
      if (!spec?.verification?.constraints?.screentime?.bundleIds?.length) {
        issues.push('App selection required for screentime verification');
      }
    }

    // Enforce sufficiency = at least one of ['location','photo','screentime'] in both methods and mandatory
    const objectiveMethods = ['location', 'photo', 'screentime'];
    const hasObjectiveMethod = methods.some(m => objectiveMethods.includes(m));
    const hasObjectiveMandatory = mandatory.some(m => objectiveMethods.includes(m));
    const sufficiency = hasObjectiveMethod && hasObjectiveMandatory;

    return {
      methods: methods as VerificationType[],
      mandatory: mandatory as VerificationType[],
      sufficiency,
      issues,
      missingFields,
      followUpQuestion
    };
  };

  // Single validator function for schedule validation
  async function validateScheduleAndMaybeProceed({ 
    onSuccess, 
    checkScheduleReady = true, 
    checkSufficiency = true,
    checkGoalSpec = true
  }: { 
    onSuccess: () => void;
    checkScheduleReady?: boolean;
    checkSufficiency?: boolean;
    checkGoalSpec?: boolean;
  }) {
    // Check if this request is still valid (cancellation logic)
    if (scheduleValidateInFlight.current || scheduleValidating) return;
    scheduleValidateInFlight.current = true;
    setScheduleValidating(true);
    try {
      // Pre-validation checks (moved from calling functions)
      if (checkScheduleReady && !scheduleReady) {
        Alert.alert('Schedule Needed', (blockingReasons && blockingReasons.length) ? blockingReasons.join('\n') : 'Please add schedule days on the calendar.');
        return;
      }

      // Remove insufficient verification blocking - let Verification Plan handle it
      // The ensureVerificationSignals function will ensure signals are never empty

      if (checkGoalSpec && (!goalSpec || !goalSpec.schedule)) {
        Alert.alert('AI Error', 'GoalSpec is missing. Please go back and regenerate.');
        actions.setStep(0);
        return;
      }

      // 1) build weeklyWeekdays and weeklyTimeSettings (number-key map)
      const weeklyTimeSettings = toIndexKeyMap(formData.weeklySchedule || {});
      const weeklyWeekdays = formData.weeklyWeekdays || [];

      // 2) Enhanced pre-check with partial week consideration and complete week validation
      const requiredCount = goalSpec?.schedule?.countRule?.count ?? 1;
      const enforcePartialWeeks = goalSpec?.schedule?.enforcePartialWeeks ?? false;
      const effectiveDays = weeklyWeekdays.filter(d => (weeklyTimeSettings[d] || []).length > 0);
      
      // For partial weeks, allow more flexible validation
      if (enforcePartialWeeks) {
        // Check if the pattern can potentially satisfy the requirement
        const totalSessions = effectiveDays.reduce((sum, day) => sum + (weeklyTimeSettings[day] || []).length, 0);
        const minSessionsPerWeek = Math.min(...effectiveDays.map(day => (weeklyTimeSettings[day] || []).length));
        
        if (effectiveDays.length === 0) {
          Alert.alert(
            'Schedule Needed',
            'Please select at least one day with scheduled times for your goal.'
          );
          return;
        }
        
        // For partial weeks, ensure the pattern can reach the required count
        if (totalSessions < requiredCount) {
          Alert.alert(
            'Insufficient Schedule Pattern',
            `Your goal requires ${requiredCount} sessions per week, but your selected pattern provides ${totalSessions} total sessions. Please add more times or days.`
          );
          return;
        }
      } else {
        // Standard validation for full weeks
        if (effectiveDays.length < requiredCount) {
          Alert.alert(
            'Insufficient Schedule',
            `Your goal requires ${requiredCount} sessions per week, but you only have ${effectiveDays.length} days with scheduled times. Please add more days or times.`
          );
          return;
        }
      }

      // 3) Enhanced validation: check schedule compatibility with CalendarEvents
      // Use existing calendar events from formData
      const latestCalendarEvents = formData.calendarEvents || [];

      // Log validation attempt for debugging
      console.log(`[Schedule] Validating with ${latestCalendarEvents.length} calendar events`);

      if (!goalSpec) {
        Alert.alert('Error', 'Goal specification is missing. Please try again.');
        return;
      }

      // Use the latest events for validation
      const result = AIService.validateGoalByCalendarEvents(
        latestCalendarEvents,
        goalSpec,
        formData.duration?.startDate || new Date().toISOString(),
        formData.duration?.endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      );

      setScheduleValidation(result || null);

      if (!result?.isCompatible) {
        // Enhanced error handling for partial weeks and complete week validation
        if (enforcePartialWeeks && result?.issues) {
          // Filter out issues that are acceptable for partial weeks
          const acceptableIssues = result.issues.filter(issue => 
            !issue.includes('Weekly pattern provides') && 
            !issue.includes('Selected schedule provides')
          );
          
          if (acceptableIssues.length === 0) {
            // All issues are acceptable for partial weeks, proceed
            setScheduleValidation(null);
            onSuccess();
            return;
          }
        }
        
        // Store validation result and show fixes modal
        setScheduleValidationResult(result);
        if (result.fixes) {
          setShowScheduleFixes(true);
        } else {
          // Show enhanced alert with partial week and complete week context
          let message = 'Schedule validation failed:\n\n';
          message += result.issues.join('\n');
          
          if (enforcePartialWeeks) {
            message += '\n\nNote: Partial weeks are allowed for this goal, but some constraints still need to be satisfied.';
          }
          
          message += '\n\nNote: Only complete weeks (7 days) are used for validation. Incomplete weeks at the start or end of your goal period are excluded.';
          
          Alert.alert('Schedule Incompatible', message);
        }
        return;
      }

      // OK → 진행
      setScheduleValidation(null);
      console.log('[Schedule] Validation successful - proceeding to next step');
      onSuccess();
    } catch (err) {
      console.error('[Schedule] validation error', err);
      
      // Enhanced error logging for debugging
      if (err instanceof Error) {
        console.error('[Schedule] Error details:', {
          message: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        });
      }
      
      Alert.alert('Validation error', 'Failed to validate schedule. Please try again.');
    } finally {
      scheduleValidateInFlight.current = false;
      setScheduleValidating(false);
    }
  }

  // Apply Fixes handler
  const handleApplyFixes = () => {
    if (!scheduleValidationResult?.fixes) return;

    const fixes = scheduleValidationResult.fixes;
    
    // Update formData with fixes
    setFormData(prev => {
      const next = { ...prev };
      
      // Merge weeklyWeekdays (array) - ensure it's a valid array
      if (fixes.weeklyWeekdays && Array.isArray(fixes.weeklyWeekdays)) {
        next.weeklyWeekdays = [...fixes.weeklyWeekdays]; // Create a fresh copy
      }
      
      // Merge weeklyTimeSettings into weeklySchedule (string-keyed map)
      if (fixes.weeklyTimeSettings && typeof fixes.weeklyTimeSettings === 'object') {
        const merged = { ...(prev.weeklySchedule || {}) };
        
        // Convert number keys (0..6) to string keys for formData.weeklySchedule
        Object.entries(fixes.weeklyTimeSettings).forEach(([k, v]) => {
          const stringKey = String(k); // Ensure string key for formData.weeklySchedule
          merged[stringKey] = Array.isArray(v) ? [...v] : []; // Create fresh array copies
        });
        
        next.weeklySchedule = merged;
      }
      
      return next;
    });

    // Update weeklyScheduleData (UI state: weekdays Set + timeSettings)
    if (fixes.weeklyWeekdays || fixes.weeklyTimeSettings) {
      setWeeklyScheduleData(prev => {
        const updated = { ...prev };
        
        // Update weekdays Set with fresh copy
        if (fixes.weeklyWeekdays && Array.isArray(fixes.weeklyWeekdays)) {
          updated.weekdays = fixes.weeklyWeekdays;
        }
        
        // Update timeSettings (convert number-key to string-key for UI compatibility)
        if (fixes.weeklyTimeSettings && typeof fixes.weeklyTimeSettings === 'object') {
          const convertedTimeSettings: { [key: string]: string[] } = {};
          Object.entries(fixes.weeklyTimeSettings).forEach(([k, v]) => {
            const stringKey = String(k); // Convert to string key for UI state
            convertedTimeSettings[stringKey] = Array.isArray(v) ? [...v] : []; // Create fresh array copies
          });
          updated.timeSettings = { ...prev.timeSettings, ...convertedTimeSettings };
        }
        
        return updated;
      });
    }

    // 🔑 반드시 결과/모달/로딩 리셋
    setShowScheduleFixes(false);
    setScheduleValidationResult(null);
    scheduleValidateInFlight.current = false;
    setScheduleValidating(false);
  };

  const [selectedCategory, setSelectedCategory] = useState(0); // 0 for all
  const [filteredExamples, setFilteredExamples] = useState<string[]>(AIService.getExamplePrompts());
  const [weeklyScheduleData, setWeeklyScheduleData] = useState<{
    weekdays: number[];
    timeSettings: { [key: string]: string[] };
  }>({ weekdays: [], timeSettings: {} });

  // --- Centralized enforcement for forced verification methods (time/manual) ---
  type TimeManualFlags = { hasTime: boolean; hasManual: boolean };

  /**
   * Detects presence of time-based and non-time (manual) schedules from
   * both weekly schedule UI state and calendarEvents.
   */
  const detectTimeManualFlags = (draft: {
    weeklyWeekdays?: number[];
    weeklySchedule?: { [key: string]: string[] } | undefined;
    calendarEvents?: { date?: string; time?: string }[];
  }): TimeManualFlags => {
    const ws = draft.weeklySchedule || {};
    const ww = draft.weeklyWeekdays || [];
    const ce = draft.calendarEvents || [];


    // time-present: any calendar event with a non-empty time
    const calHasTime = ce.some(e => !!(e?.time && e.time.trim() !== ''));
    // manual-present: any calendar event without a time (only if there are events)
    const calHasManual = ce.length > 0 && ce.some(e => !e?.time || e.time.trim() === '');
    
    // If there are calendar events, determine based on their time content
    // If all events have time -> hasTime = true, hasManual = false
    // If all events have no time -> hasTime = false, hasManual = true  
    // If mixed -> hasTime = true, hasManual = true
    if (ce.length > 0) {
      const eventsWithTime = ce.filter(e => !!(e?.time && e.time.trim() !== '')).length;
      const eventsWithoutTime = ce.filter(e => !e?.time || e.time.trim() === '').length;
      
    }

    // weekly schedule based detection
    const weeklyHasTime = Object.values(ws).some(v => Array.isArray(v) && v.some(t => t && String(t).trim() !== ''));
    const weeklyHasManual = ww.some(d => {
      const arr = (ws as any)[d];
      return !Array.isArray(arr) || arr.length === 0; // selected day with no times
    });

    const result = {
      hasTime: calHasTime || weeklyHasTime,
      hasManual: calHasManual || weeklyHasManual,
    };


    return result;
  };

  /**
   * Merge forced methods into formData (idempotent).
   * - Adds 'time' when hasTime is true
   * - Adds 'manual' when hasManual is true
   * - Removes neither if false (user may still keep them voluntarily)
   */
  const withForcedVerification = (prev: any, flags: TimeManualFlags) => {

    const nextSelected = new Set([...(prev.verificationMethods || [])]);
    const nextLocked = new Set([...(prev.lockedVerificationMethods || [])]);

    if (flags.hasTime) {
      nextSelected.add('time' as any);
      nextLocked.add('time' as any);
    }
    if (flags.hasManual) {
      nextSelected.add('manual' as any);
      nextLocked.add('manual' as any);
    }

    const result = {
      ...prev,
      verificationMethods: Array.from(nextSelected),
      lockedVerificationMethods: Array.from(nextLocked),
    };


    return result;
  };
  // --- End centralized enforcement helpers ---
  

  // Prevent duplicate AI verification application
  const aiVerificationAppliedRef = useRef(false);

  // State for location picker
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerSelectedLocation, setPickerSelectedLocation] = useState<TargetLocation | null>(null);
  const [pickerMarkers, setPickerMarkers] = useState<{ lat: number; lng: number; title?: string }[]>([]);
  const detailsFetchSeqRef = useRef(0);
  const detailsCacheRef = useRef<Record<string, { lat: number; lng: number; title?: string }>>({});

  // Helper: fetch details for a set of placeIds (caching to minimize quota)
  const ensureDetailsFor = useCallback(async (placeIds: string[]) => {
    const missing = placeIds.filter((id) => !detailsCacheRef.current[id]);
    if (missing.length === 0) return;
    const seq = ++detailsFetchSeqRef.current;
    const promises = missing.map(async (id) => {
      try {
        const d = await getPlaceDetails(id, ''); // Removed pickerSessionToken
        detailsCacheRef.current[id] = { lat: d.lat, lng: d.lng, title: d.name };
      } catch {}
    });
    await Promise.all(promises);
    if (seq !== detailsFetchSeqRef.current) return; // outdated
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          // setPickerCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); // Removed pickerCenter
        }
      } catch {}
    };
    if (showLocationPicker) init();
    return () => { cancelled = true; };
  }, [showLocationPicker]);

  // Handle weekly schedule changes
  const handleWeeklyScheduleChange = useCallback((weekdays: number[], timeSettings: { [key: string]: string[] }) => {
    console.log('[CreateGoalModal] Weekly schedule change received:', { weekdays, timeSettings });
    setWeeklyScheduleData({ weekdays, timeSettings });
    // Keep a simple flag on form data; detailed schedule will be saved later alongside this state
    setFormData(prev => ({ 
      ...prev, 
      needsWeeklySchedule: weekdays.length > 0,
      weeklyWeekdays: weekdays,
      weeklySchedule: timeSettings
    }));
    // Enforce mandatory method(s) based on weekly schedule & selected weekdays
    setFormData(prev => {
      const flags = detectTimeManualFlags({
        weeklyWeekdays: weekdays,
        weeklySchedule: timeSettings,
        calendarEvents: prev.calendarEvents,
      });
      return withForcedVerification(
        {
          ...prev,
          lockedVerificationMethods: (prev.lockedVerificationMethods || []).filter((m: any) => m !== 'time' && m !== 'manual'),
        },
        flags
      );
    });
    if (aiDraft.title) {
      setAiDraft(prev => ({ ...prev, needsWeeklySchedule: weekdays.length > 0 }));
    }
  }, [aiDraft.title]);

  

  // Refs for cleanup
  const mountedRef = useRef(true);
  const optimisticGoalId = useRef<string | null>(null);


  // Goal type: single source of truth
  const goalType = (state as any).goalType ?? (formData as any).goalType ?? aiBadgeState.type ?? 'frequency';
  const isFrequency = goalType === 'frequency';
  
  // Debug logging
  console.log('[CreateGoalModal] goalType debug:', {
    stateGoalType: (state as any).goalType,
    formDataGoalType: (formData as any).goalType,
    aiBadgeStateType: aiBadgeState.type,
    finalGoalType: goalType,
    isFrequency
  });

  // Sync aiBadgeState.type with formData.type
  useEffect(() => {
    if (aiBadgeState.type && formData.type !== aiBadgeState.type) {
      console.log('[CreateGoalModal] Syncing type:', aiBadgeState.type);
      setFormData(prev => ({ ...prev, type: aiBadgeState.type }));
    }
  }, [aiBadgeState.type]);

  // Defer AI evaluation until after initial mount so formData is defined
  useEffect(() => {
    let cancelled = false;
    const evalNow = async () => {
      const ctx = {
        title: formData.title || aiDraft.title,
        verificationMethods: formData.verificationMethods as any,
        weeklyWeekdays: formData.weeklyWeekdays,
        weeklyTimeSettings: formData.weeklySchedule,
        includeDates: formData.includeDates,
        excludeDates: formData.excludeDates,
        targetLocationName: formData.targetLocation?.name,
      };
      try {
        const res = await AIService.explainSuccessCriteria(ctx as any);
        if (!cancelled) setAiSuccessCriteria(res.summary);
      } catch {}
      const readyEval = AIService.evaluateScheduleReadiness({
        startDateISO: formData.duration?.startDate || aiDraft.startDate || undefined,
        endDateISO: formData.duration?.endDate || aiDraft.duration?.endDate || undefined,
        weeklyWeekdays: formData.weeklyWeekdays || [],
        includeDates: formData.includeDates || [],
        excludeDates: formData.excludeDates || [],
        verificationMethods: formData.verificationMethods as any,
        targetLocationName: formData.targetLocation?.name,
        calendarEvents: formData.calendarEvents || [],
        goalType: aiBadgeState.type, // goal type 추가
      });
      if (!cancelled) {
        setScheduleReady(readyEval.ready);
        setBlockingReasons(readyEval.reasons);
      }
    };
    evalNow();
    return () => { cancelled = true; };
  }, [formData, aiDraft]);

  // Safety navigation effect: only auto-jump from AI (step 0) to Schedule (step 1)
  useEffect(() => {
    if ((appState === 'READY_TO_REVIEW' || appState === 'NEEDS_DATES') && state.step === 0) {
      // Before moving to Schedule step, ensure AI data is in formData
      if (aiDraft.title && (!formData.title || formData.title === '')) {
        console.log('[CreateGoalModal] Updating formData with AI draft before Schedule step');
        updateFormFromAI(aiDraft);
      } else if (aiDraft.frequency && aiDraft.frequency.count && (!formData.frequency || !formData.frequency.count)) {
        // Also update frequency if AI has extracted it but formData doesn't have it
        console.log('[CreateGoalModal] Updating formData frequency with AI draft before Schedule step');
        updateFormFromAI(aiDraft);
      }
      actions.setStep(1);
    }
  }, [appState, state.step, aiDraft.title, formData.title]);



  // Ensure AI mandatory verification methods are selected and locked from GoalSpec
  const ensureAIMandatoryVerifications = useCallback(async () => {
    try {
      setAiVerificationLoading(true);
      // Use stored GoalSpec data instead of re-analyzing
      if (goalSpec && goalSpec.verification) {
        const methods = Array.isArray(goalSpec.verification.methods) ? goalSpec.verification.methods : [];
        const mandatory = Array.isArray(goalSpec.verification.mandatory) ? goalSpec.verification.mandatory : [];
        
      setFormData(prev => {
          const merged = new Set([...(prev.verificationMethods || []), ...methods, ...mandatory]);
          const locked = new Set([...(prev.lockedVerificationMethods || []), ...mandatory]);
          // Client-side guard: if targetLocation exists, force-add and lock location
          const hasTargetLoc = !!(prev.targetLocation && (prev.targetLocation.placeId || prev.targetLocation.name));
          if (hasTargetLoc) {
          merged.add('location' as any);
          locked.add('location' as any);
        }
        return { 
          ...prev, 
          verificationMethods: Array.from(merged) as any, 
          lockedVerificationMethods: Array.from(locked) as any 
        };
      });
      aiVerificationAppliedRef.current = true;
      }
    } catch (e) {
      // Ignore AI failure, keep current
      console.warn('[CreateGoalModal] ensureAIMandatoryVerifications failed:', e);
    } finally {
      setAiVerificationLoading(false);
    }
  }, [goalSpec]);

  // Ensure AI methods are applied whenever we land on Schedule step
  useEffect(() => {
    if (state.step === 1 && !aiVerificationAppliedRef.current) {
      ensureAIMandatoryVerifications();
    }
  }, [state.step, ensureAIMandatoryVerifications]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.timeEnd('[CreateGoalModal] Component Mount');
    };
  }, []);

  // Step navigation functions using context
  const resetScheduleState = useCallback(() => {
    // Clear schedule-related form fields
    setFormData(prev => ({
      ...prev,
      duration: { type: 'weeks', value: 2 },
      startDate: undefined,
      endDate: undefined,
      needsWeeklySchedule: false,
      weeklyWeekdays: [],
      weeklySchedule: {},
      includeDates: [],
      excludeDates: [],
      // Clear AI-generated schedule specifications
      schedule: undefined,
      // Remove schedule-derived locks (time/manual) while keeping other methods intact
      lockedVerificationMethods: (prev.lockedVerificationMethods || []).filter(m => m !== 'time' && m !== 'manual') as any,
    }));
    // Clear AI draft schedule hints
    setAiDraft(prev => ({
      ...prev,
      startDate: undefined,
      duration: undefined,
      needsWeeklySchedule: false,
      weeklySchedule: undefined,
    }));
    // Clear local weekly schedule UI cache
    setWeeklyScheduleData({ weekdays: [], timeSettings: {} });
  }, []);

  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < STEPS.length) {
      console.log('[Stepper] Moving to step:', stepIndex, STEPS[stepIndex].title);
      actions.setStep(stepIndex);
      
      // Update app state based on the step we're moving to
      switch (stepIndex) {
        case 0: // AI Assistant
          setAppState('IDLE');
          setShowDatePicker(false);
          // Clear follow-up question and reset AI state when returning to AI Assistant
          setFollowUpQuestion('');
          setLoading(false);
          // Restore the remembered prompt when returning to AI Assistant
          if (rememberedPrompt) {
            setAiPrompt(rememberedPrompt);
          }
          // Reset schedule when returning to AI for regeneration
          resetScheduleState();
          break;
        case 1: // Schedule
          setAppState('NEEDS_DATES');
          setShowDatePicker(true);
          // Auto-select and lock AI-mandatory verification methods when entering Schedule
          aiVerificationAppliedRef.current = false; // allow re-apply on entering step
          ensureAIMandatoryVerifications();
          break;
        case 2: // Review
          setAppState('READY_TO_REVIEW');
          setShowDatePicker(false);
          break;
      }
    }
  };

  const nextStep = () => {
    if (state.step < STEPS.length - 1) {
      const nextStepIndex = state.step + 1;
      actions.setStep(nextStepIndex);
      
      // Update app state based on the next step
      switch (nextStepIndex) {
        case 1: // Schedule
          setAppState('NEEDS_DATES');
          setShowDatePicker(true);
          aiVerificationAppliedRef.current = false; // allow re-apply on entering step
          ensureAIMandatoryVerifications();
          break;
        case 2: // Review
          setAppState('READY_TO_REVIEW');
          setShowDatePicker(false);
          break;
      }
    }
  };

  // Clear stale validation errors when inputs change
  const clearValidationErrors = useCallback(() => {
    setScheduleValidation(null);
    setScheduleValidationResult(null);
    setShowScheduleFixes(false);
  }, []);

  // Sync weekly schedule changes to calendar events
  const syncWeeklyScheduleToCalendar = useCallback(async () => {
    if (!formData.duration?.startDate || !formData.duration?.endDate) return;
    
    // Weekly schedule conversion removed - using calendar events directly
    console.log('[CreateGoalModal] Weekly schedule processing completed');
  }, [formData.weeklyWeekdays, formData.weeklySchedule, formData.duration?.startDate, formData.duration?.endDate]);

  // Watch for input changes and clear stale errors
  useEffect(() => {
    clearValidationErrors();
    // Also clear last validation result to re-enable Next button
    setLastValidationResult(null);
  }, [
    formData.weeklyWeekdays,
    formData.weeklySchedule,
    formData.includeDates,
    formData.excludeDates,
    formData.duration?.startDate,
    formData.duration?.endDate,
    clearValidationErrors
  ]);

  // Sync weekly schedule to calendar events when schedule changes
  useEffect(() => {
    if (formData.weeklyWeekdays && formData.weeklyWeekdays.length > 0) {
      syncWeeklyScheduleToCalendar();
    }
  }, [formData.weeklyWeekdays, formData.weeklySchedule, syncWeeklyScheduleToCalendar]);

  // Integration Test Scenario: "오류 → 수정 → Next" 시나리오
  // 
  // 시나리오 1: 스케줄 오류 발생 → 수정 → Next 성공
  // 1. 사용자가 부족한 스케줄로 Next 클릭
  // 2. validateGoalByCalendarEvents에서 오류 반환
  // 3. showScheduleFixes 모달 표시
  // 4. 사용자가 handleApplyFixes로 수정사항 적용
  // 5. clearValidationErrors로 오류 상태 초기화
  // 6. 다시 Next 클릭 시 정상 진행
  //
  // 시나리오 2: 비동기 경쟁 상태 방지
  // 1. 사용자가 빠르게 Next를 여러 번 클릭
  // 2. scheduleValidateInFlight로 중복 요청 방지
  // 3. 이전 요청은 자동 취소
  //
  // 시나리오 3: 입력 변경 시 stale error 방지
  // 1. validation 오류 발생 후
  // 2. 사용자가 weeklyWeekdays, weeklySchedule 등 변경
  // 3. useEffect로 자동으로 오류 상태 초기화
  // 4. 최신 데이터로 validation 재시도 가능
  //
  // 시나리오 4: CalendarEvent 기반 검증 흐름
  // 1. onNext 호출 시 최신 formData로 CalendarEvent 생성
  // 2. validateGoalByCalendarEvents()에 전달하여 검증
  // 3. sliceCompleteWeeks()로 완전 주만 대상으로 검증
  // 4. 빈도/요일/시간 제약 조건 검증
  // 5. 검증 실패 시 구체적인 오류 메시지와 수정 제안

  // Next request from Schedule with AI gating
  const handleRequestNextFromSchedule = useCallback(async () => {
    console.log('[CreateGoalModal] handleRequestNextFromSchedule called, aiDraft.type:', aiDraft?.type);
    
    if (scheduleValidating || scheduleValidateInFlight.current) {
      console.log('[CreateGoalModal] 스케줄 검증 중복 요청 차단');
      return;
    }

    const type = aiDraft?.type;
    if (!type) {
      console.log('[CreateGoalModal] No aiDraft.type, returning');
      return;
    }

    if (type === 'frequency') {
      console.log('[CreateGoalModal] Frequency path: before period ensure with draft snippet', {
        frequency: aiDraft.frequency,
        schedule: aiDraft.schedule
      });
      
      // Ensure period exists for frequency goals
      const today = new Date();
      const startDate = aiDraft.schedule?.startDate || today.toISOString().split('T')[0];
      const endDate = aiDraft.schedule?.endDate || new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Update aiDraft with period if missing
      if (!aiDraft.schedule?.startDate || !aiDraft.schedule?.endDate) {
        setAiDraft(prev => ({
          ...prev,
          schedule: {
            ...prev.schedule,
            startDate,
            endDate
          }
        }));
      }
      
      console.log('[CreateGoalModal] Frequency path: period ensured with startDate/endDate', { startDate, endDate });
      console.log('[CreateGoalModal] Frequency path: period ensured and skipping calendar validation');
      
      const ok = validateFrequencyDraft(aiDraft);
      if (!ok) {
        console.warn('[CreateGoalModal] Frequency validation failed');
        return;
      }
      goToStep(2); // Review step
      return;
    }

    if (type === 'milestone') {
      console.log('[CreateGoalModal] Partner path: skip calendar validation');
      goToStep(2); // Review step
      return;
    }

    setScheduleValidating(true);
    scheduleValidateInFlight.current = true;
    setValidationErrors([]);

    try {
      console.log('[CreateGoalModal] === 스케줄 검증 시작 ===');
      console.log('[CreateGoalModal] 검증 대상:', {
        startDate: formData.duration?.startDate,
        endDate: formData.duration?.endDate,
        weeklyWeekdays: formData.weeklyWeekdays,
        weeklySchedule: formData.weeklySchedule,
        includeDates: formData.includeDates,
        excludeDates: formData.excludeDates
      });

      if (!goalSpec) {
        console.log('[CreateGoalModal] GoalSpec이 없어 검증 스킵');
        setScheduleValidating(false);
        scheduleValidateInFlight.current = false;
        return;
      }

      // CalendarEvent로 변환
      const allEvents = formData.calendarEvents || [];
      console.log('[CreateGoalModal] Calendar events for validation:', {
        totalCount: allEvents.length
      });

      // 검증 실행
      console.log('[CreateGoalModal] AIService.validateGoalByCalendarEvents 호출');
      
      // 날짜 형식 검증 및 기본값 설정
      const startDate = formData.duration?.startDate;
      const endDate = formData.duration?.endDate;
      
      if (!startDate || !endDate) {
        console.log('[CreateGoalModal] 시작일 또는 종료일이 없어 검증 스킵');
        setScheduleValidating(false);
        scheduleValidateInFlight.current = false;
        return;
      }
      
      // 날짜 형식 검증 (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        console.log('[CreateGoalModal] 잘못된 날짜 형식:', { startDate, endDate });
        setValidationErrors(['날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 사용해주세요.']);
        setShowValidationModal(true);
        setScheduleValidating(false);
        scheduleValidateInFlight.current = false;
        return;
      }
      
      const result = AIService.validateGoalByCalendarEvents(
        allEvents,
        goalSpec,
        startDate,
        endDate,
        aiBadgeState.type // goal type 전달
      );

      console.log('[CreateGoalModal] === 검증 결과 ===');
      console.log('[CreateGoalModal] 호환성:', result.isCompatible);
      console.log('[CreateGoalModal] 완전 주 수:', result.completeWeekCount);
      console.log('[CreateGoalModal] 검증 상세:', result.validationDetails);
      
      if (result.issues.length > 0) {
        console.log('[CreateGoalModal] 실패 사유 요약:', result.issues);
      }

      // Store validation result for UI state management
      setLastValidationResult({
        isCompatible: result.isCompatible,
        issues: result.issues
      });

      if (result.isCompatible) {
        console.log('[CreateGoalModal] 검증 성공 - 다음 단계로 진행');
        console.log('[CreateGoalModal] ✅ 사용자 피드백: Next 버튼 활성화, 3. Schedule로 진행');
        goToStep(2);
      } else {
        console.log('[CreateGoalModal] 검증 실패 - 오류 모달 표시');
        console.log('[CreateGoalModal] ❌ 사용자 피드백: Next 버튼 비활성화, 오류 배너 표시, 수정 요구');
        setValidationErrors(result.issues);
        setShowValidationModal(true);
      }

    } catch (error) {
      console.error('[CreateGoalModal] 검증 중 오류:', error);
      setValidationErrors(['검증 중 오류가 발생했습니다.']);
      setShowValidationModal(true);
    } finally {
      console.log('[CreateGoalModal] === 스케줄 검증 완료 ===');
      setScheduleValidating(false);
      scheduleValidateInFlight.current = false;
    }
  }, [scheduleValidating, goalSpec, formData, goToStep]);

  const prevStep = () => {
    if (state.step > 0) {
      const prevStepIndex = state.step - 1;
      actions.setStep(prevStepIndex);
      
      // Update app state based on the previous step
      switch (prevStepIndex) {
        case 0: // AI Assistant
          setAppState('IDLE');
          setShowDatePicker(false);
          break;
        case 1: // Schedule
          setAppState('NEEDS_DATES');
          setShowDatePicker(true);
          break;
      }
    }
  };

  // Step validation
  const canProceedToNext = (): boolean => {
    switch (state.step) {
      case 0: // AI
        return !!(aiDraft.title && aiDraft.title.trim().length > 0);
      case 1: // Schedule
        return !!(formData.duration.startDate && formData.duration.value && formData.duration.value > 0);
      case 2: // Review
        return true;
      default:
        return false;
    }
  };

  // Step completion
  const markStepComplete = (stepId: string, data: any) => {
    // Store data in context state
    switch (stepId) {
      case 'basic':
        actions.setBasic(data);
        break;
      case 'schedule':
        actions.setSchedule(data);
        break;
      case 'verification':
        actions.setVerification(data);
        break;
      case 'targetLocation':
        actions.setTargetLocation(data);
        break;
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: Categories[0],
      type: 'frequency', // 기본값 설정
      verificationMethods: [],
      frequency: { count: 1, unit: 'per_day' },
      duration: {
        type: 'weeks',
        value: 2,
        startDate: new Date().toISOString(),
      },
      notes: '',
      verificationType: 'manual',
      timeFrame: 'daily',
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    setAiPrompt('');
    setAiContext(null);
    setFollowUpQuestion('');
    setAiDraft({});
    
    // AI Badge State 완전 초기화
    setAiBadgeState({
      title: '',
      type: 'frequency', // 기본값으로 frequency 설정
      aiGuess: undefined,
      typeLockedByUser: false,
      perWeek: 3,
      period: undefined,
      methods: { manual: false, location: false, photo: false },
      milestones: undefined,
      step: 0 // step 속성 추가
    });
    
    // 모든 모달 상태 초기화
    setShowTypeSelector(false);
    setShowSpecPlanModal(false);
    setShowScheduleFixes(false);
    setShowLocationPicker(false);
    setShowDatePicker(false);
    
    // GoalSpec 관련 상태 초기화
    setGoalSpec(null);
    setGoalSpecLoading(false);
    setSpecFollowUpQuestion('');
    setSpecFollowUpAnswer('');
    setAiAnalyzedMethods([]);
    setAiMandatoryMethods([]);
    setAiVerificationSummary('');
    
    actions.reset();
    setAppState('IDLE');
  };

  // 모달이 열릴 때마다 완전 초기화
  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);

  // Debounced AI generation function
  const handleAiGenerationDebounced = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;

    await burstyCallPrevention.executeRequest(
      async (signal: AbortSignal, requestId: string) => {
        console.time('[CreateGoalModal] AI Generation');
        console.log('[CreateGoalModal] Starting AI generation:', prompt);

        // Log AI generation start
        logUserAction({
          action: 'ai_generate_click',
          message: 'User clicked AI generate button (debounced)',
          context: {
            promptLength: prompt.trim().length,
            requestId,
            sessionId: getLoggingSessionId(),
          },
        });

        return await executeAiGeneration(prompt, signal, requestId);
      },
      {
        promptLength: prompt.trim().length,
        sessionId: getLoggingSessionId(),
      }
    );
  }, [burstyCallPrevention]);

  // Core AI generation logic
  const executeAiGeneration = async (prompt: string, signal: AbortSignal, requestId: string) => {
    if (!prompt.trim()) return;

    // Check if request was aborted
    if (signal.aborted) {
      console.log('[CreateGoalModal] Request aborted before starting');
      return;
    }

    // Log AI generation click
    logUserAction({
      action: 'ai_generate_click',
      message: 'User clicked AI generate button',
      context: {
        promptLength: prompt.trim().length,
        requestId,
        sessionId: getLoggingSessionId(),
      },
    });

    // Remember the prompt for future reference
    setRememberedPrompt(prompt.trim());

    try {
      setAppState('GENERATING');
      setLoading(true);
      setFollowUpQuestion('');

      let aiResult: any;
      if (!aiContext) {
        // Initial generation
        console.log('[CreateGoalModal] Initial AI generation');
        console.log('[CreateGoalModal] AI input:', prompt.trim());
        
        // Check if request was aborted
        if (signal.aborted) {
          console.log('[CreateGoalModal] Request aborted during initial generation');
          return;
        }
        
        // Step 0: Compile GoalSpec first (semantic-first)
        try {
          setGoalSpecLoading(true);
          
          // Detect language and get appropriate locale configuration
          const localeConfig = getLocaleConfig(prompt.trim());
          
          const spec = await AIService.compileGoalSpec({
            prompt: prompt.trim(),
            title: aiDraft.title || formData.title,
            targetLocationName: (aiDraft as any)?.targetLocation?.name || formData.targetLocation?.name,
            placeId: (aiDraft as any)?.targetLocation?.placeId || formData.targetLocation?.placeId,
            locale: localeConfig.locale,
            timezone: localeConfig.timezone
          });
          console.log('[CreateGoalModal] LLM raw response:', spec);
          
          // Parse and coerce the GoalSpec
          const parsedSpec = parseGoalSpec(JSON.stringify(spec));
          console.log('[CreateGoalModal] Coerced type:', parsedSpec.type);
          
          // Validate GoalSpec BEFORE showing success message
          if (!spec || typeof spec !== 'object' || !spec.verification) {
            Alert.alert('AI Error', 'Failed to parse GoalSpec. Please refine your input.');
            setGoalSpecLoading(false);
            setAppState('IDLE');
            return;
          }
          
          // Additional validation based on goal type
          if (parsedSpec.type === 'schedule' && !spec.schedule) {
            Alert.alert('AI Error', 'Schedule goal requires schedule information. Please refine your input.');
            setGoalSpecLoading(false);
            setAppState('IDLE');
            return;
          }
          
          if (parsedSpec.type === 'frequency' && !spec.frequency) {
            Alert.alert('AI Error', 'Frequency goal requires frequency information. Please refine your input.');
            setGoalSpecLoading(false);
            setAppState('IDLE');
            return;
          }
          
          // Set AI draft with processed spec
          setAiDraft(parsedSpec);
          
          // Show success message only after validation passes
          toast.success('목표가 성공적으로 생성되었습니다');
          console.log("[CreateGoalModal] showing plan with:", { type: parsedSpec?.type, signals: parsedSpec?.verification?.signals });
          
          // Update AI badge state with processed spec
          setAiBadgeState(prev => ({
            ...prev,
            type: parsedSpec?.type || 'frequency',
            title: parsedSpec?.title || aiPrompt.trim(),
            perWeek: parsedSpec?.frequency?.count || 3,
            period: parsedSpec?.duration ? {
              startMs: new Date(parsedSpec.duration.startDate || '').getTime(),
              endMs: new Date(parsedSpec.duration.endDate || '').getTime()
            } : undefined,
            methods: {
              manual: parsedSpec?.verification?.signals?.includes('manual') || false,
              location: parsedSpec?.verification?.signals?.includes('location') || false,
              photo: parsedSpec?.verification?.signals?.includes('photo') || false
            }
          }));
          setGoalSpec(spec as GoalSpec);
          
          // Update formData with schedule information from GoalSpec
          setFormData(prev => ({
            ...prev,
            schedule: {
              countRule: spec.schedule?.countRule,
              timeWindows: (spec.schedule?.timeWindows || []) as any,
              weekdayConstraints: spec.schedule?.weekdayConstraints || [],
              weekBoundary: spec.schedule?.weekBoundary || 'startWeekday',
              enforcePartialWeeks: spec.schedule?.enforcePartialWeeks || false
            }
          }));
          
          // Post-process verification methods to enforce requirements
          const initialMethods = Array.isArray(spec.verification?.methods) ? spec.verification.methods : [];
          const initialMandatory = Array.isArray(spec.verification?.mandatory) ? spec.verification.mandatory : [];
          const processed = postProcessVerificationMethods(spec as any, initialMethods, initialMandatory, aiPrompt.trim());
          
          // Update the spec with processed methods
          spec.verification.methods = processed.methods;
          spec.verification.mandatory = processed.mandatory;
          spec.verification.sufficiency = processed.sufficiency;
          
          // Show processed results to user
          setAiAnalyzedMethods(processed.methods);
          setAiMandatoryMethods(processed.mandatory);
          setAiVerificationSummary(spec.verification?.rationale || '');
          
          // Remove sufficiency check - let Verification Plan handle it
          // The ensureVerificationSignals function ensures signals are never empty

          // Handle missing fields from post-processing
          if (processed.missingFields && processed.missingFields.length > 0) {
            // Update the spec with missing fields
            if (!spec.missingFields) spec.missingFields = [];
            spec.missingFields = [...new Set([...spec.missingFields, ...processed.missingFields])];
            
            // Set follow-up question if provided
            if (processed.followUpQuestion) {
              setSpecFollowUpQuestion(processed.followUpQuestion);
            }
          }

          // Follow-up if disambiguation needed
          if (spec.schedule?.requiresDisambiguation && spec.schedule?.followUpQuestion) {
            setSpecFollowUpQuestion(spec.schedule.followUpQuestion);
          } else if (!processed.followUpQuestion) {
            setSpecFollowUpQuestion('');
          }
          setShowSpecPlanModal(true);
        } catch (e) {
          toast.error('AI 생성에 실패했습니다. 다시 시도해주세요.');
          setAppState('IDLE');
          return;
        } finally {
          setGoalSpecLoading(false);
        }
        return; // Stop legacy flow; proceed after user confirms plan
      } else {
        // Follow-up refinement
        console.log('[CreateGoalModal] AI refinement');
        // Refinement: recompile GoalSpec with user follow-up (if any) concatenated
        const refinementText = specFollowUpAnswer ? `${aiPrompt.trim()}\n\nAnswer: ${specFollowUpAnswer}` : aiPrompt.trim();
        try {
          setGoalSpecLoading(true);
          
          // Detect language and get appropriate locale configuration
          const localeConfig = getLocaleConfig(refinementText);
          
          const spec = await AIService.compileGoalSpec({
            prompt: refinementText,
            title: aiDraft.title || formData.title,
            targetLocationName: (aiDraft as any)?.targetLocation?.name || formData.targetLocation?.name,
            placeId: (aiDraft as any)?.targetLocation?.placeId || formData.targetLocation?.placeId,
            locale: localeConfig.locale,
            timezone: localeConfig.timezone
          });
          
          // Parse and validate the refined GoalSpec
          const parsedSpec = parseGoalSpec(JSON.stringify(spec));
          
          // Validate GoalSpec BEFORE proceeding
          if (!spec || typeof spec !== 'object' || !spec.verification) {
            Alert.alert('AI Error', 'Failed to parse GoalSpec. Please refine your input.');
            setGoalSpecLoading(false);
            setAppState('IDLE');
            return;
          }
          
          // Additional validation based on goal type
          if (parsedSpec.type === 'schedule' && !spec.schedule) {
            Alert.alert('AI Error', 'Schedule goal requires schedule information. Please refine your input.');
            setGoalSpecLoading(false);
            setAppState('IDLE');
            return;
          }
          
          if (parsedSpec.type === 'frequency' && !spec.frequency) {
            Alert.alert('AI Error', 'Frequency goal requires frequency information. Please refine your input.');
            setGoalSpecLoading(false);
            setAppState('IDLE');
            return;
          }
          setGoalSpec(spec as GoalSpec);
          
          // Update formData with schedule information from GoalSpec
          setFormData(prev => ({
            ...prev,
            schedule: {
              countRule: spec.schedule?.countRule,
              timeWindows: (spec.schedule?.timeWindows || []) as any,
              weekdayConstraints: spec.schedule?.weekdayConstraints || [],
              weekBoundary: spec.schedule?.weekBoundary || 'startWeekday',
              enforcePartialWeeks: spec.schedule?.enforcePartialWeeks || false
            }
          }));
          
          // Post-process verification methods to enforce requirements
          const initialMethods = Array.isArray(spec.verification?.methods) ? spec.verification.methods : [];
          const initialMandatory = Array.isArray(spec.verification?.mandatory) ? spec.verification.mandatory : [];
          const processed = postProcessVerificationMethods(spec as any, initialMethods, initialMandatory, refinementText);
          
          // Update the spec with processed methods
          spec.verification.methods = processed.methods;
          spec.verification.mandatory = processed.mandatory;
          spec.verification.sufficiency = processed.sufficiency;
          
          // Show processed results to user
          setAiAnalyzedMethods(processed.methods);
          setAiMandatoryMethods(processed.mandatory);
          setAiVerificationSummary(spec.verification?.rationale || '');
          
          // Remove sufficiency check - let Verification Plan handle it
          // The ensureVerificationSignals function ensures signals are never empty

          // Handle missing fields from post-processing
          if (processed.missingFields && processed.missingFields.length > 0) {
            // Update the spec with missing fields
            if (!spec.missingFields) spec.missingFields = [];
            spec.missingFields = [...new Set([...spec.missingFields, ...processed.missingFields])];
            
            // Set follow-up question if provided
            if (processed.followUpQuestion) {
              setSpecFollowUpQuestion(processed.followUpQuestion);
            }
          }
          
          if (spec.schedule?.requiresDisambiguation && spec.schedule?.followUpQuestion) {
            setSpecFollowUpQuestion(spec.schedule.followUpQuestion);
          } else if (!processed.followUpQuestion) {
            setSpecFollowUpQuestion('');
          }
          setShowSpecPlanModal(true);
        } catch (e) {
          toast.error('AI 개선에 실패했습니다. 다시 시도해주세요.');
          setAppState('IDLE');
          return;
        } finally {
          setGoalSpecLoading(false);
        }
        return; // Stop legacy flow; proceed after user confirms plan
      }


    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[CreateGoalModal] AI generation aborted');
        return;
      }
      
      console.error('[CreateGoalModal] AI generation failed:', error);
      toast.error('AI 어시스턴트에 문제가 발생했습니다. 수동으로 목표를 생성할 수 있습니다.');
      
      // Record failed request in telemetry
      telemetry.recordRequest(requestId, Date.now() - Date.now(), false);
    } finally {
      setLoading(false);
      console.timeEnd('[CreateGoalModal] AI Generation');
    }
  };

  // Legacy handleAiGeneration for backward compatibility
  const handleAiGeneration = useCallback(() => {
    if (!aiPrompt.trim()) return;
    handleAiGenerationDebounced(aiPrompt.trim());
  }, [aiPrompt, handleAiGenerationDebounced]);

  // Update form data from AI draft
  const updateFormFromAI = (draft: AIGoalDraft) => {
    console.time('[CreateGoalModal] Form Update from AI');
    console.log('[CreateGoalModal] updateFormFromAI called with draft:', {
      title: draft.title,
      type: draft.type,
      verificationMethods: draft.verificationMethods,
      duration: draft.duration,
      frequency: draft.frequency,
      weeklyWeekdays: (draft as any).weeklyWeekdays,
      weeklySchedule: (draft as any).weeklySchedule
    });
    
    const updatedForm: CreateGoalForm = {
      ...formData,
      title: draft.title || formData.title,
      description: draft.notes || formData.description,
      category: draft.category || formData.category,
      verificationMethods: draft.verificationMethods || formData.verificationMethods,
      frequency: (draft.frequency && draft.frequency.count) ? {
        count: draft.frequency.count,
        unit: draft.frequency.unit || 'per_week'
      } as GoalFrequency : formData.frequency,
      duration: (draft.duration && draft.duration.type) ? draft.duration as GoalDuration : formData.duration,
      notes: draft.notes || formData.notes,
      targetLocation: draft.targetLocation ? {
        name: draft.targetLocation.name || '',
        placeId: draft.targetLocation.placeId,
        lat: draft.targetLocation.lat || 0,
        lng: draft.targetLocation.lng || 0,
        address: draft.targetLocation.name || '',
      } : formData.targetLocation,
      // Add missing schedule-related fields
      weeklyWeekdays: (draft as any).weeklyWeekdays || formData.weeklyWeekdays,
      weeklySchedule: (draft as any).weeklySchedule || formData.weeklySchedule,
      type: draft.type || formData.type,
    };

    // If any place info exists, ensure 'location' is selected and locked
    const hasPlaceInfo = !!(draft.targetLocation || formData.targetLocation);
    if (hasPlaceInfo) {
      const vm = new Set([...(updatedForm.verificationMethods || []), 'location' as any]);
      const locked = new Set([...(updatedForm.lockedVerificationMethods || []), 'location' as any]);
      (updatedForm as any).verificationMethods = Array.from(vm);
      (updatedForm as any).lockedVerificationMethods = Array.from(locked);
    }

    // Apply AI mandatoryVerificationMethods generally
    if ((draft as any).mandatoryVerificationMethods?.length) {
      const mandatorySet = new Set([...(updatedForm.lockedVerificationMethods || []), ...((draft as any).mandatoryVerificationMethods || [])]);
      const vmSet = new Set([...(updatedForm.verificationMethods || []), ...((draft as any).mandatoryVerificationMethods || [])]);
      (updatedForm as any).lockedVerificationMethods = Array.from(mandatorySet);
      (updatedForm as any).verificationMethods = Array.from(vmSet);
    }

    // Update legacy fields for backward compatibility
    if (draft.verificationMethods && draft.verificationMethods.length > 0) {
      updatedForm.verificationType = draft.verificationMethods[0];
    }

    if (draft.duration) {
      if (draft.duration.startDate) {
        updatedForm.startDate = new Date(draft.duration.startDate);
      }
      if (draft.duration.endDate) {
        updatedForm.endDate = new Date(draft.duration.endDate);
      } else if (draft.duration.type && draft.duration.value) {
        const startDate = new Date(draft.duration.startDate || Date.now());
        const daysToAdd = draft.duration.type === 'days' ? draft.duration.value :
                         draft.duration.type === 'weeks' ? draft.duration.value * 7 :
                         draft.duration.value * 30;
        updatedForm.endDate = new Date(startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }
    }

    // Map AI weekly schedule representations into form fields for prefill
    if ((draft as any).weeklySchedule && Object.keys((draft as any).weeklySchedule).length > 0) {
      const nameToIndex: Record<string, number> = {
        sunday: 0, sun: 0,
        monday: 1, mon: 1,
        tuesday: 2, tue: 2, tues: 2,
        wednesday: 3, wed: 3,
        thursday: 4, thu: 4, thurs: 4,
        friday: 5, fri: 5,
        saturday: 6, sat: 6
      };
      const weekly = (draft as any).weeklySchedule as Record<string, string>;
      const dayIndices = new Set<number>();
      const timeMap: any = {};
      Object.entries(weekly).forEach(([dayName, timeStr]) => {
        const idx = nameToIndex[(dayName || '').toLowerCase()];
        if (idx !== undefined) {
          dayIndices.add(idx);
          const t = (timeStr || '').trim();
          if (t) {
            timeMap[idx] = Array.isArray(timeMap[idx]) ? timeMap[idx] : [];
            if (!timeMap[idx].includes(t)) timeMap[idx].push(t);
          }
        }
      });
      (updatedForm as any).weeklyWeekdays = Array.from(dayIndices);
      (updatedForm as any).weeklySchedule = timeMap;
    }
    if ((draft as any).weeklyWeekdays && (draft as any).weeklyTimeSettings) {
      (updatedForm as any).weeklyWeekdays = (draft as any).weeklyWeekdays;
      (updatedForm as any).weeklySchedule = (draft as any).weeklyTimeSettings;
    }

    console.log('[CreateGoalModal] updateFormFromAI - Updated form:', {
      title: updatedForm.title,
      weeklyWeekdays: updatedForm.weeklyWeekdays,
      weeklySchedule: updatedForm.weeklySchedule,
      duration: updatedForm.duration,
      verificationMethods: updatedForm.verificationMethods,
      type: updatedForm.type
    });
    
    setFormData(updatedForm);
    console.timeEnd('[CreateGoalModal] Form Update from AI');
  };

  // Apply partial AI info even when validation is not complete (prefill methods, duration, weekly)
  const applyAIToFormPartial = (draft: AIGoalDraft) => {
    setFormData(prev => {
      const next: any = { ...prev };
      if (draft.title && !next.title) next.title = draft.title;
      if (draft.duration && draft.duration.startDate && draft.duration.endDate) {
        next.duration = draft.duration as any;
      }
      if (draft.verificationMethods && draft.verificationMethods.length) {
        const merged = new Set([...(next.verificationMethods || []), ...draft.verificationMethods as any]);
        next.verificationMethods = Array.from(merged);
      }
      if ((draft as any).mandatoryVerificationMethods?.length) {
        const locked = new Set([...(next.lockedVerificationMethods || []), ...((draft as any).mandatoryVerificationMethods as any)]);
        next.lockedVerificationMethods = Array.from(locked);
      }
      if ((draft as any).weeklySchedule && Object.keys((draft as any).weeklySchedule).length > 0) {
        const nameToIndex: Record<string, number> = {
          sunday: 0, sun: 0,
          monday: 1, mon: 1,
          tuesday: 2, tue: 2, tues: 2,
          wednesday: 3, wed: 3,
          thursday: 4, thu: 4, thurs: 4,
          friday: 5, fri: 5,
          saturday: 6, sat: 6
        };
        const weekly = (draft as any).weeklySchedule as Record<string, string>;
        const dayIndices = new Set<number>();
        const timeMap: any = {};
        Object.entries(weekly).forEach(([dayName, timeStr]) => {
          const idx = nameToIndex[(dayName || '').toLowerCase()];
          if (idx !== undefined) {
            dayIndices.add(idx);
            const t = (timeStr || '').trim();
            if (t) {
              timeMap[idx] = Array.isArray(timeMap[idx]) ? timeMap[idx] : [];
              if (!timeMap[idx].includes(t)) timeMap[idx].push(t);
            }
          }
        });
        next.weeklyWeekdays = Array.from(dayIndices);
        next.weeklySchedule = timeMap;
      }
      if ((draft as any).weeklyWeekdays && (draft as any).weeklyTimeSettings) {
        next.weeklyWeekdays = (draft as any).weeklyWeekdays;
        next.weeklySchedule = (draft as any).weeklyTimeSettings;
      }
      return next;
    });
  };

  // Handle location selection
  const handleLocationSelected = (location: TargetLocation) => {
    console.time('[CreateGoalModal] Location Selection');
    
    setFormData(prev => {
      const nextSelected = new Set([...(prev.verificationMethods || []), 'location' as any]);
      const nextLocked = new Set([...(prev.lockedVerificationMethods || []), 'location' as any]);
      return {
        ...prev,
        targetLocation: location,
        verificationMethods: Array.from(nextSelected) as any,
        lockedVerificationMethods: Array.from(nextLocked) as any
      };
    });

    // Update AI draft as well
    const updatedDraft = mergeAIGoal(aiDraft, {
      targetLocation: {
        name: location.name,
        placeId: location.placeId,
        lat: location.lat,
        lng: location.lng,
      }
    });
    setAiDraft(updatedDraft);

    // Re-validate and transition state
    const validation = validateAIGoal(updatedDraft);
    if (!validation.missingFields || validation.missingFields.length === 0) {
      updateFormFromAI(updatedDraft);
      setAppState('READY_TO_REVIEW');
    }
    
    console.timeEnd('[CreateGoalModal] Location Selection');
  };

  // Robust navigation to LocationPicker at root level
  const openLocationPicker = useCallback(() => {
    // Open in-app overlay modal instead of navigating (ensures it appears above RN Modal)
    console.log('[CreateGoalModal] Opening location picker with LocationSearch component');
    setPickerSelectedLocation(formData.targetLocation || null);
    setShowLocationPicker(true);
  }, [formData.targetLocation]);

  const closeLocationPicker = useCallback(() => setShowLocationPicker(false), []);

  const handlePickerConfirm = useCallback(() => {
    if (!pickerSelectedLocation) {
      Alert.alert('No Location Selected', 'Please select a location first.');
      return;
    }
    setFormData(prev => ({ ...prev, targetLocation: pickerSelectedLocation }));
    setShowLocationPicker(false);
  }, [pickerSelectedLocation]);

  // Handle current location selection
  const handleUseCurrentLocation = async () => {
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Denied',
          'Location permission is required to use your current location.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      
      // Create current location object
      const currentLocation: TargetLocation = {
        name: 'Current Location',
        lat: latitude,
        lng: longitude,
      };

      // Update form data
      setFormData(prev => {
        const nextSelected = new Set([...(prev.verificationMethods || []), 'location' as any]);
        const nextLocked = new Set([...(prev.lockedVerificationMethods || []), 'location' as any]);
        return {
          ...prev,
          targetLocation: currentLocation,
          verificationMethods: Array.from(nextSelected) as any,
          lockedVerificationMethods: Array.from(nextLocked) as any
        };
      });

      console.log('[CreateGoalModal] Current location set:', currentLocation);
    } catch (error) {
      console.error('[CreateGoalModal] Current location error:', error);
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    }
  };

  // Handle date selection
  const handleDateSelection = (selection: DateSelection) => {
    console.time('[CreateGoalModal] Date Selection');
    console.log('[CreateGoalModal] Date selection:', selection);

    const updatedDraft = updateDraftWithDates(aiDraft, selection);
    setAiDraft(updatedDraft);

    // Re-validate after date selection
    const validation = validateAIGoal(updatedDraft);
    console.log('[CreateGoalModal] After date selection validation:', validation);

    if (validation.needsDatePicker) {
      // Still need more date info, keep showing picker (handled in Schedule)
      setFollowUpQuestion('');
    } else if (validation.missingFields && validation.missingFields.length > 0) {
      setShowDatePicker(false);
      if (validation.missingFields.includes('targetLocation')) {
        setFollowUpQuestion('Please select a location for your goal.');
        setAppState('NEEDS_LOCATION');
      } else {
        setFollowUpQuestion('');
        setAppState('READY_TO_REVIEW');
        actions.setStep(1);
      }
    } else {
      // All fields complete
      setShowDatePicker(false);
      updateFormFromAI(updatedDraft);
      setAppState('READY_TO_REVIEW');
    }
    
    console.timeEnd('[CreateGoalModal] Date Selection');
  };

  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
    setAppState('NEEDS_INFO');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Optimistic goal submission with two-phase creation
  const handleSubmit = async () => {
    if (!user) return;
    
    const storageTimer = new PerformanceTimer('goal_storage', generateRequestId());
    
    try {
      setLoading(true);
      
      // Prepare goal data for creation
      
      // Pre-submission validation
      const goalType = formData.type || aiDraft.type || 'frequency';
      if (goalType === 'frequency') {
        const targetPerWeek = formData.frequency?.count || aiDraft.frequency?.count || aiBadgeState.perWeek || 3;
        if (!targetPerWeek || targetPerWeek <= 0) {
          Alert.alert('Validation Error', 'Frequency goal must have a valid target per week (greater than 0).');
          setLoading(false);
          return;
        }
      }
      
      if (goalType === 'milestone') {
        const hasMilestones = !!(formData.milestones?.milestones && formData.milestones.milestones.length > 0);
        if (!hasMilestones) {
          // Auto-generate default milestones if none exist
          setFormData(prev => ({
            ...prev,
            milestones: {
              milestones: [
                { key: 'kickoff', label: 'Kickoff' },
                { key: 'mid', label: 'Mid Review' },
                { key: 'finish', label: 'Completion' }
              ],
              totalDuration: 8
            }
          }));
        }
      }

      // Ensure mandatory verification aligns with presence of time/non-time schedules (both can apply)
      const flags = detectTimeManualFlags({
        weeklyWeekdays: formData.weeklyWeekdays,
        weeklySchedule: formData.weeklySchedule,
        calendarEvents: formData.calendarEvents,
      });
      const currentMethods = new Set(formData.verificationMethods || []);
      const currentLocked  = new Set(formData.lockedVerificationMethods || []);
      if (flags.hasTime) {
        currentMethods.add('time' as any);
        currentLocked.add('time' as any);
      }
      if (flags.hasManual) {
        currentMethods.add('manual' as any);
        currentLocked.add('manual' as any);
      }
      const updatedFormData = {
        ...formData,
        verificationMethods: Array.from(currentMethods),
        lockedVerificationMethods: Array.from(currentLocked),
        // Ensure minimum required data
        title: formData.title || aiDraft.title || 'New Goal',
        type: formData.type || aiDraft.type || 'frequency',
        successRate: formData.successRate || 80,
        duration: formData.duration || aiDraft.duration || {
          type: 'weeks',
          value: 2,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      };
      // Create goal using the updated form data (with forced methods)
      console.log('[CreateGoalModal] Creating goal with data:', {
        title: updatedFormData.title,
        duration: updatedFormData.duration,
        weeklyWeekdays: updatedFormData.weeklyWeekdays,
        verificationMethods: updatedFormData.verificationMethods,
        frequency: updatedFormData.frequency,
        category: updatedFormData.category,
        type: updatedFormData.type,
        successRate: (updatedFormData as any).successRate
      });
      
      const goalData = {
        ...updatedFormData,
        userId: user.id,
        duration: {
          type: formData.duration?.type || updatedFormData.duration?.type || 'range',
          startDate: formData.duration?.startDate || updatedFormData.duration?.startDate || new Date().toISOString().split('T')[0],
          endDate: formData.duration?.endDate || updatedFormData.duration?.endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          value: formData.duration?.value || updatedFormData.duration?.value || 2
        }
      } as CreateGoalForm & { userId: string };
      console.log('[CreateGoalModal] Full goal data to save:', goalData);
      console.log('[CreateGoalModal] Key fields for debugging:', {
        title: goalData.title,
        type: goalData.type,
        verificationMethods: goalData.verificationMethods,
        weeklyWeekdays: goalData.weeklyWeekdays,
        weeklySchedule: goalData.weeklySchedule,
        duration: goalData.duration,
        frequency: goalData.frequency,
        successRate: goalData.successRate,
        targetLocation: goalData.targetLocation
      });
      
      console.log('[CreateGoalModal] AI Draft state:', {
        title: aiDraft.title,
        type: aiDraft.type,
        verificationMethods: aiDraft.verificationMethods,
        duration: aiDraft.duration,
        frequency: aiDraft.frequency
      });
      
      console.log('[CreateGoalModal] FormData state:', {
        title: formData.title,
        type: formData.type,
        verificationMethods: formData.verificationMethods,
        duration: formData.duration,
        frequency: formData.frequency
      });
      
      const goalId = await GoalService.createGoal(goalData);
      console.log('[CreateGoalModal] Goal created with ID:', goalId);

      // Use existing calendar events from formData
      try {
        const allEvents = formData.calendarEvents || [];
        
        if (allEvents.length > 0) {
          await CalendarEventService.createCalendarEvents(goalId, allEvents);
          console.log(`[CreateGoalModal] Created ${allEvents.length} calendar events for goal ${goalId}`);
        }
      } catch (error) {
        console.warn('[CreateGoalModal] Failed to create calendar events:', error);
        // Continue without calendar events - goal creation is more important
      }

      // Log successful storage
      const duration = storageTimer.end(true, { 
        operation: 'goal_creation',
        success: true 
      });
      
      logStorage({
        operation: 'goal_creation',
        durationMs: duration,
        success: true,
        recordCount: 1,
        message: 'Goal created successfully',
      });
      
      logUserAction({
        action: 'save_success',
        message: 'Goal saved successfully',
        success: true,
        context: {
          sessionId: getLoggingSessionId(),
          goalType: aiBadgeState.type,
        },
      });

      // Close modal and notify parent
      onGoalCreated();
      onClose();
      
    } catch (error: any) {
      console.error('[CreateGoalModal] Error creating goal:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create goal. Please try again.';
      let errorTitle = 'Error';
      
      if (error.message?.includes('Invalid frequency goal')) {
        errorTitle = 'Validation Error';
        errorMessage = 'Frequency goal must have a valid target per week (greater than 0).';
      } else if (error.message?.includes('Invalid partner goal')) {
        errorTitle = 'Validation Error';
        errorMessage = 'Partner goal must have partner information.';
      } else if (error.code === 'permission-denied') {
        errorTitle = 'Permission Error';
        errorMessage = 'You do not have permission to create goals. Please check your account.';
      } else if (error.code === 'unavailable') {
        errorTitle = 'Network Error';
        errorMessage = 'Service is temporarily unavailable. Please check your internet connection.';
      } else if (error.message?.includes('Cannot read property')) {
        errorTitle = 'Data Error';
        errorMessage = 'Some required data is missing. Please refresh and try again.';
      }
      
      Alert.alert(errorTitle, errorMessage);
      
      // Log failed storage
      const duration = storageTimer.end(false, { 
        operation: 'goal_creation',
        error: error.message 
      });
      
      logStorage({
        operation: 'goal_creation',
        durationMs: duration,
        success: false,
        errorCode: 'STORAGE_ERROR',
        message: 'Goal creation failed',
      });
      
      logUserAction({
        action: 'save_failed',
        message: 'Goal save failed',
        success: false,
        context: {
          sessionId: getLoggingSessionId(),
          error: error.message,
        },
      });
    } finally {
      setLoading(false);
    }
  };
 
  // Background creation removed for reliability during development

  // Form sections as separate components for FlatList
  const renderAISection = () => (
    <View style={{ marginBottom: 24, backgroundColor: '#E0E7FF', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#C7D2FE' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <View style={{ backgroundColor: '#6366F1', borderRadius: 8, padding: 8, marginRight: 12 }}>
          <Text style={{ fontSize: 16 }}>🤖</Text>
        </View>
        <Text style={{ color: '#1F2937', fontWeight: '700', fontSize: 18 }}>AI Goal Assistant</Text>
      </View>

      {/* Only show selected dates when not in AI Assistant step */}
      {state.step !== 0 && (aiDraft.startDate || aiDraft.duration) && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: '#1d4ed8', fontSize: 12, marginBottom: 8 }}>Selected:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {aiDraft.startDate && (
              <View style={{ backgroundColor: '#dbeafe', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: '#1e40af', fontSize: 12, fontWeight: '600' }}>
                  Start: {new Date(aiDraft.startDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            {aiDraft.duration?.endDate && (
              <View style={{ backgroundColor: '#dbeafe', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: '#1e40af', fontSize: 12, fontWeight: '600' }}>
                  End: {new Date(aiDraft.duration.endDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            {aiDraft.duration?.type && aiDraft.duration?.value && (
              <View style={{ backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: '#166534', fontSize: 12, fontWeight: '600' }}>
                  Duration: {aiDraft.duration.value} {aiDraft.duration.type}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

        <TextInput
          style={{ 
            backgroundColor: '#F9FAFB', 
            borderRadius: 12, 
            paddingHorizontal: 16, 
            paddingVertical: 16, 
            borderWidth: 1, 
            borderColor: '#E5E7EB', 
            color: '#111827', 
            minHeight: 100,
            fontSize: 16
          }}
          placeholder={"Describe your goal (e.g., 'Go to the gym 3 times a week')"}
          placeholderTextColor="#9CA3AF"
          value={aiPrompt}
          onChangeText={(text: string) => {
            setAiPrompt(text);
            setAiBadgeState(prev => ({ ...prev, title: text }));
            // Removed auto AI generation - only trigger on button press
          }}
          multiline
          textAlignVertical="top"
          editable={!loading}
        />

        <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
        <TouchableOpacity
          onPress={() => {
            if (loading) return;
              handleAiGoalGeneration();
          }}
          disabled={loading || burstyCallPrevention.isInFlight || (appState === 'IDLE' && !aiPrompt.trim())}
          style={{
            flex: 1,
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: loading || burstyCallPrevention.isInFlight || (appState === 'IDLE' && !aiPrompt.trim()) ? '#9CA3AF' : '#3B82F6'
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
            {loading || burstyCallPrevention.isInFlight ? 'Generating...' : 'Generate with AI'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setAppState('READY_TO_REVIEW');
            actions.setStep(1);
          }}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: '#3B82F6',
            borderWidth: 1,
            borderColor: '#3B82F6'
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Manual</Text>
        </TouchableOpacity>
      </View>

      {/* Example prompts - horizontal scroll with categories */}
      {appState === 'IDLE' && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 14, color: '#2563eb', marginBottom: 12, fontWeight: '600' }}>
            💡 Recommended goal examples (tap to insert)
          </Text>
          
          {/* Category tabs */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            {['All', 'Health', 'Learning', 'Work', 'Development', 'Finance'].map((category, index) => (
              <TouchableOpacity
                key={category}
                onPress={() => {
                  // Filter examples by category
                  const categoryExamples = {
                    'All': AIService.getExamplePrompts(),
                    'Health': AIService.getExamplePrompts().slice(0, 8),
                    'Learning': AIService.getExamplePrompts().slice(8, 16),
                    'Work': AIService.getExamplePrompts().slice(16, 24),
                    'Development': AIService.getExamplePrompts().slice(24, 32),
                    'Finance': AIService.getExamplePrompts().slice(32, 40)
                  };
                  setSelectedCategory(index);
                  setFilteredExamples(categoryExamples[category as keyof typeof categoryExamples]);
                }}
                style={{
                  backgroundColor: selectedCategory === index ? '#2563eb' : '#e5e7eb',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: selectedCategory === index ? '#2563eb' : '#d1d5db'
                }}
              >
                <Text style={{
                  color: selectedCategory === index ? 'white' : '#6b7280',
                  fontSize: 12,
                  fontWeight: selectedCategory === index ? '600' : '500'
                }}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Example prompts horizontal scroll */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 120 }}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            {(filteredExamples.length > 0 ? filteredExamples : AIService.getExamplePrompts()).map((example: string, index: number) => (
              <TouchableOpacity
                key={index}
                onPress={() => setAiPrompt(example)}
                style={{
                  backgroundColor: '#dbeafe',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  marginRight: 12,
                  borderWidth: 1,
                  borderColor: '#93c5fd',
                  minWidth: 140,
                  maxWidth: 180
                }}
              >
                <Text 
                  style={{ 
                    color: '#1e40af', 
                    fontSize: 12, 
                    fontWeight: '500',
                    textAlign: 'center',
                    lineHeight: 16
                  }}
                  numberOfLines={3}
                >
                  {example}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderDatePickerSection = () => (
    <View style={{ marginBottom: 24 }}>
      {aiVerificationLoading && (
        <View style={{ marginBottom: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, padding: 12 }}>
          <Text style={{ color: '#1d4ed8', fontSize: 14 }}>Analyzing verification methods with AI...</Text>
        </View>
      )}
        <SimpleDatePicker
          goalType={goalType}
          weeklyTarget={weeklyTarget}
          onWeeklyTargetChange={setWeeklyTarget}
          ranges={aiDraft.startDate && aiDraft.duration?.endDate 
            ? [{ start: new Date(aiDraft.startDate), end: new Date(aiDraft.duration.endDate) }] 
            : []}
          onRangesChange={(ranges) => {
            if (ranges.length > 0) {
              const range = ranges[0];
              const startDate = range.start.toISOString().slice(0,10);
              const endDate = range.end.toISOString().slice(0,10);
              // Update AI draft
              setAiDraft(prev => ({ 
                ...prev, 
                startDate,
                duration: { ...prev.duration, endDate } 
              }));
              // Also mirror to formData
              setFormData(prev => ({ 
                ...prev, 
                duration: { ...prev.duration, startDate, endDate } 
              }));
            }
          }}
        onNavigateToStep={goToStep}
        onWeeklyScheduleChange={handleWeeklyScheduleChange}
        includeDates={formData.includeDates}
        excludeDates={formData.excludeDates}
        onIncludeExcludeChange={(inc: string[], exc: string[]) => setFormData(prev => ({ ...prev, includeDates: inc, excludeDates: exc }))}
        // Pass initial weekly schedule to show persistence
        initialSelectedWeekdays={formData.weeklyWeekdays}
        initialWeeklyTimeSettings={formData.weeklySchedule}
        goalSpec={goalSpec}
        calendarEvents={formData.calendarEvents || []}
        onCalendarEventsChange={(events) => {
          setFormData(prev => {
            const flags = detectTimeManualFlags({
              weeklyWeekdays: prev.weeklyWeekdays,
              weeklySchedule: prev.weeklySchedule,
              calendarEvents: events,
            });
            return withForcedVerification({ ...prev, calendarEvents: events }, flags);
          });
        }}
      />
    </View>
  );

  const renderLocationSection = () => (
    <View style={{
      marginBottom: 24,
      backgroundColor: '#fffbeb',
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: '#fcd34d'
    }}>
      <Text style={{ color: '#b45309', marginBottom: 12, fontSize: 14 }}>{followUpQuestion}</Text>
      
      {/* Target Location Display */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: '#374151', fontWeight: '600', marginBottom: 8 }}>Target Location</Text>
        {formData.targetLocation ? (
          <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#d1d5db' }}>
            <Text style={{ color: '#1f2937', fontWeight: '500' }}>{formData.targetLocation.name}</Text>
            {formData.targetLocation.address && (
              <Text style={{ color: '#4b5563', fontSize: 14, marginTop: 4 }}>{formData.targetLocation.address}</Text>
            )}
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              {formData.targetLocation.lat?.toFixed(6) || 'N/A'}, {formData.targetLocation.lng?.toFixed(6) || 'N/A'}
            </Text>
          </View>
        ) : (
          <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Not set</Text>
        )}
      </View>

      {/* Location Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          onPress={openLocationPicker}
        >
          <Ionicons name="search" size={20} color="white" />
          <Text style={{ color: 'white', fontWeight: '600', marginLeft: 8 }}>Search</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#10b981', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          onPress={handleUseCurrentLocation}
        >
          <Ionicons name="location" size={20} color="white" />
          <Text style={{ color: 'white', fontWeight: '600', marginLeft: 8 }}>Current Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Type-specific sections based on aiDraft.type (final type after verification plan)
  const renderTypeSpecificSections = () => {
    if (state.step === 0) return null; // AI 단계에서는 절대 렌더하지 않음

    console.log("[CreateGoalModal] Rendering type-specific section for:", aiDraft.type, "at step:", state.step);

    // Schedule 단계(step 1)에서는 타입에 관계없이 Schedule UI를 보여줌
    if (state.step === 1) {
      return renderScheduleSection();
    }

    // 다른 단계에서는 타입에 따라 렌더링
    if (!aiDraft.type) return null;
    
    switch (aiDraft.type) {
      case 'frequency':
        return renderFrequencySection();
      case 'milestone':
        return renderMilestoneSection();
      default:
        return null;
    }
  };

  // Weekly target state
  const weeklyTarget = (formData as any).weeklyTarget ?? (formData as any).weeklyMinimum ?? 3;
  const setWeeklyTarget = (v: number) =>
    setFormData(prev => ({ ...prev, weeklyTarget: v, weeklyMinimum: v }));

  // Verification Methods: 타입별 whitelist
  const ALLOWED: Record<'frequency'|'schedule', string[]> = {
    frequency: ['manual','location','photo'],
    schedule:  ['manual','location','photo','time','screentime'],
  };
  const allowed = ALLOWED[isFrequency ? 'frequency' : 'schedule'];
  
  // Filter selected methods to only include allowed ones
  let selectedMethods = (formData.verificationMethods ?? []).filter(m => allowed.includes(m as any));
  if ((formData.verificationMethods ?? []).length !== selectedMethods.length) {
    // One-time correction if there's a mismatch
    setFormData(prev => ({ ...prev, verificationMethods: selectedMethods }));
  }

  const toggleVerification = (m: 'manual'|'location'|'photo'|'time'|'screentime') => {
    const next = selectedMethods.includes(m as any)
      ? selectedMethods.filter(x => x !== m)
      : [...selectedMethods, m as any];
    setFormData(prev => ({ ...prev, verificationMethods: next }));
  };

  const renderVerificationSection = () => (
    <View className="mb-6">
      <Text className="text-lg font-semibold text-gray-800 mb-4">Verification Methods</Text>
      
      {allowed.map((method) => (
        <TouchableOpacity
          key={method}
          onPress={() => toggleVerification(method as any)}
          className="flex-row items-center py-3 px-4 bg-white rounded-lg border border-gray-300 mb-2"
        >
          <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
            selectedMethods.includes(method as any)
              ? 'border-blue-500 bg-blue-500' 
              : 'border-gray-300 bg-white'
          }`}>
            {selectedMethods.includes(method as any) && (
              <Text className="text-white text-xs font-bold">✓</Text>
            )}
          </View>
          <Text className="text-gray-700 text-base capitalize">
            {method}
          </Text>
        </TouchableOpacity>
      ))}
      
      <Text className="text-xs text-gray-500 mt-2 italic">
        Select one or more methods to verify your progress
      </Text>
    </View>
  );

  const renderScheduleSection = () => (
    <View className="mb-6">
      <Text className="text-lg font-semibold text-gray-800 mb-4">Schedule</Text>
      
      {/* When Section */}
      <ScheduleWhen
        times={aiBadgeState.times || []}
        onChange={(times) => setAiBadgeState(prev => ({ ...prev, times }))}
      />

      {/* Verification Methods */}
      <View className="mb-5">
        <Text className="text-base font-medium text-gray-700 mb-3">Verification Methods</Text>
        
        {['manual', 'location', 'photo'].map((method) => (
          <TouchableOpacity
            key={method}
            onPress={() => {
              setAiBadgeState(prev => ({
                ...prev,
                methods: {
                  ...prev.methods,
                  [method]: !prev.methods[method as keyof typeof prev.methods]
                }
              }));
            }}
            className="flex-row items-center py-3 px-4 bg-white rounded-lg border border-gray-300 mb-2"
          >
            <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
              aiBadgeState.methods[method as keyof typeof aiBadgeState.methods] 
                ? 'border-blue-500 bg-blue-500' 
                : 'border-gray-300 bg-white'
            }`}>
              {aiBadgeState.methods[method as keyof typeof aiBadgeState.methods] && (
                <Text className="text-white text-xs font-bold">✓</Text>
              )}
            </View>
            <Text className="text-gray-700 text-base capitalize">
              {method}
            </Text>
          </TouchableOpacity>
        ))}
        
        <Text className="text-xs text-gray-500 mt-2 italic">
          Need Time and either (Manual + Location) or Photo
        </Text>
      </View>

      {/* Optional Milestone Toggle */}
      <View className="mb-5">
        <TouchableOpacity
          onPress={() => {
            setAiBadgeState(prev => ({
              ...prev,
              milestones: prev.milestones ? undefined : { 
                milestones: [
                  { key: 'kickoff', label: 'Kickoff' },
                  { key: 'mid', label: 'Mid Review' },
                  { key: 'finish', label: 'Completion' }
                ],
                totalDuration: 8
              }
            }));
          }}
          className="flex-row items-center py-3 px-4 bg-white rounded-lg border border-gray-300"
        >
          <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
            aiBadgeState.milestones 
              ? 'border-blue-500 bg-blue-500' 
              : 'border-gray-300 bg-white'
          }`}>
            {aiBadgeState.milestones && (
              <Text className="text-white text-xs font-bold">✓</Text>
            )}
          </View>
          <Text className="text-gray-700 text-base">
            Use milestone tracking
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFrequencySection = () => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>Frequency</Text>
      
      {/* Target Section */}
      <FrequencyTarget
        perWeek={aiDraft.frequency?.count || aiBadgeState.perWeek || 3}
        period={aiDraft.duration ? {
          startMs: new Date(aiDraft.duration.startDate || '').getTime(),
          endMs: new Date(aiDraft.duration.endDate || '').getTime()
        } : aiBadgeState.period}
        onPerWeekChange={(perWeek) => {
          setAiBadgeState(prev => ({ ...prev, perWeek }));
          setAiDraft(prev => ({ ...prev, frequency: { ...prev.frequency, count: perWeek } }));
        }}
        onPeriodChange={(period) => {
          setAiBadgeState(prev => ({ ...prev, period }));
          if (period) {
            setAiDraft(prev => ({
              ...prev,
              duration: {
                startDate: new Date(period.startMs).toISOString().split('T')[0],
                endDate: new Date(period.endMs).toISOString().split('T')[0]
              }
            }));
          }
        }}
      />

      {/* Verification Methods */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151', marginBottom: 12 }}>Verification Methods</Text>
        
        {['manual', 'location', 'photo'].map((method) => {
          const isManual = method === 'manual';
          const isChecked = aiBadgeState.methods[method as keyof typeof aiBadgeState.methods];
          
          return (
            <TouchableOpacity
              key={method}
              onPress={() => {
                if (isManual) {
                  // Show toast for manual
                  console.warn('[CreateGoal] Manual is required for frequency goals');
                  Alert.alert('Manual Required', 'Manual is required for frequency goals');
                  return;
                }
                setAiBadgeState(prev => ({
                  ...prev,
                  methods: {
                    ...prev.methods,
                    [method]: !prev.methods[method as keyof typeof prev.methods]
                  }
                }));
              }}
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: isManual ? '#f3f4f6' : 'white',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isManual ? '#9ca3af' : '#d1d5db',
                marginBottom: 8,
                opacity: isManual ? 0.6 : 1
              }}
            >
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: isChecked ? '#3b82f6' : '#d1d5db',
                backgroundColor: isChecked ? '#3b82f6' : 'white',
                marginRight: 12,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {isChecked && (
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                )}
              </View>
              <Text style={{ 
                color: '#374151', 
                fontSize: 16,
                textTransform: 'capitalize'
              }}>
                {method} {isManual && '(Required)'}
              </Text>
            </TouchableOpacity>
          );
        })}
        
        <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>
          Need Manual plus either Location or Photo
        </Text>
      </View>
    </View>
  );

  const renderMilestoneSection = () => (
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>Milestone Goal</Text>
        
        {/* Milestone configuration will be added later */}
        <Text style={{ color: '#6b7280', fontSize: 14 }}>
          Milestone goals are automatically configured with default milestones (Kickoff/Mid/Finish)
        </Text>
        
        {/* Period Section */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151', marginBottom: 12 }}>Period</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Start Date</Text>
              <TouchableOpacity
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: 8, 
                  borderWidth: 1, 
                  borderColor: '#d1d5db',
                  paddingHorizontal: 12,
                  paddingVertical: 8
                }}
              >
                <Text style={{ color: '#374151' }}>
                  {aiBadgeState.period?.startMs ? new Date(aiBadgeState.period.startMs).toLocaleDateString() : 'Select start date'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>End Date</Text>
              <TouchableOpacity
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: 8, 
                  borderWidth: 1, 
                  borderColor: '#d1d5db',
                  paddingHorizontal: 12,
                  paddingVertical: 8
                }}
              >
                <Text style={{ color: '#374151' }}>
                  {aiBadgeState.period?.endMs ? new Date(aiBadgeState.period.endMs).toLocaleDateString() : 'Select end date'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Milestone Section */}
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
          Default milestones will be auto-generated: Kickoff, Mid Review, Completion
        </Text>

        {/* Helper text */}
        <Text style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
          This goal will be tracked through discrete milestones.
        </Text>
      </View>
    );

  const renderValidationSummary = () => {
    const type = aiDraft?.type || aiBadgeState.type;
    
    return (
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>Summary & Warnings</Text>
        
        {/* Type-specific summary */}
        {type === 'frequency' && (
          <View style={{ 
            backgroundColor: '#f8fafc', 
            borderRadius: 8, 
            padding: 16, 
            borderWidth: 1, 
            borderColor: '#e2e8f0',
            marginBottom: 12
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 }}>
              Frequency Goal
            </Text>
            <Text style={{ fontSize: 13, color: '#64748b' }}>
              Target: {aiDraft?.frequency?.count || aiDraft?.frequency?.targetPerWeek || 0} times per week
            </Text>
            <Text style={{ fontSize: 13, color: '#64748b' }}>
              Period: {aiDraft?.schedule?.startDate} to {aiDraft?.schedule?.endDate}
            </Text>
          </View>
        )}
        
        {type === 'milestone' && (
          <View style={{ 
            backgroundColor: '#f8fafc', 
            borderRadius: 8, 
            padding: 16, 
            borderWidth: 1, 
            borderColor: '#e2e8f0',
            marginBottom: 12
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 }}>
              Milestone Goal
            </Text>
            <Text style={{ fontSize: 13, color: '#64748b' }}>
              Milestones: {aiBadgeState.milestones?.milestones?.length || 3} configured
            </Text>
          </View>
        )}
        
        {/* Warnings (non-blocking) */}
        {warnings.length > 0 && (
          <View style={{ 
            backgroundColor: '#fef3c7', 
            borderRadius: 8, 
            padding: 16, 
            borderWidth: 1, 
            borderColor: '#fbbf24',
            marginBottom: 12
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400e', marginBottom: 8 }}>
              ℹ️ Information
            </Text>
            {warnings.map((warning: string, index: number) => (
              <Text key={index} style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>
                • {warning}
              </Text>
            ))}
          </View>
        )}
        
        {/* Blocking errors */}
        {!ok ? (
          <View style={{ 
            backgroundColor: '#fef2f2', 
            borderRadius: 8, 
            padding: 16, 
            borderWidth: 1, 
            borderColor: '#fecaca' 
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#dc2626', marginBottom: 8 }}>
              Insufficient Verification
            </Text>
            <View style={{ marginLeft: 8 }}>
              {issues.map((issue: string, index: number) => (
                <Text key={index} style={{ fontSize: 13, color: '#dc2626', marginBottom: 4 }}>
                  • {issue}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ 
            backgroundColor: '#f0fdf4', 
            borderRadius: 8, 
            padding: 16, 
            borderWidth: 1, 
            borderColor: '#bbf7d0' 
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#16a34a' }}>
              All set
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderManualFormSection = () => (
    <View>
      {/* Review Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 }}>AI 퀘스트 미리보기</Text>
        <Text style={{ color: '#4b5563' }}>목표에 맞는 퀘스트들이 AI에 의해 생성되었습니다</Text>
      </View>


      {/* Quest Preview */}
      <QuestPreview 
        goalData={{
          ...formData,
          type: formData.type || aiBadgeState.type || 'frequency',
          // Ensure frequency information from AI draft is used if available
          frequency: (aiDraft.frequency && aiDraft.frequency.count) ? {
            count: aiDraft.frequency.count,
            unit: aiDraft.frequency.unit || 'per_week'
          } : formData.frequency
        }} 
        userId={user?.id || 'test_user'}
        onLoadingChange={setQuestPreviewLoading}
      />
      
      {/* Debug logging for QuestPreview goalData */}
      {(() => {
        console.log('[CreateGoalModal] QuestPreview goalData debug:', {
          formDataTitle: formData.title,
          formDataFrequency: formData.frequency,
          aiDraftFrequency: aiDraft?.frequency,
          aiDraftTitle: aiDraft?.title,
          finalFrequency: (aiDraft.frequency && aiDraft.frequency.count) ? {
            count: aiDraft.frequency.count,
            unit: aiDraft.frequency.unit || 'per_week'
          } : formData.frequency,
          aiBadgeState: aiBadgeState,
          allFormDataKeys: Object.keys(formData)
        });
        return null;
      })()}
      
      {/* Debug logging for QuestPreview data */}
      {(() => {
        console.log('[CreateGoalModal] QuestPreview goalData:', {
          title: formData.title,
          type: formData.type || aiBadgeState.type || 'frequency',
          formDataFrequency: formData.frequency,
          aiDraftFrequency: aiDraft?.frequency,
          finalFrequency: (aiDraft.frequency && aiDraft.frequency.count) ? {
            count: aiDraft.frequency.count,
            unit: aiDraft.frequency.unit || 'per_week'
          } : formData.frequency,
          aiBadgeState: aiBadgeState,
          allKeys: Object.keys(formData)
        });
        return null;
      })()}






      {/* Back button to go to previous step */}
      <View style={{ marginBottom: 24 }}>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => goToStep(1)}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={16} color="#374151" />
          <Text style={{ color: '#2563eb', fontWeight: '600', marginLeft: 8 }}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render function for FlatList sections
  const renderSection = ({ item }: { item: any }) => {
    switch (item.type) {
      case 'ai':
        return renderAISection();
      case 'schedule':
        return renderScheduleSection();
      case 'verification':
        return renderVerificationSection();
      case 'datePicker':
        return (
          <SimpleDatePicker
              goalType={goalType}
              weeklyTarget={weeklyTarget}
              onWeeklyTargetChange={setWeeklyTarget}
              ranges={formData.duration?.startDate && formData.duration?.endDate 
                ? [{ start: new Date(formData.duration.startDate), end: new Date(formData.duration.endDate) }] 
                : []}
              onRangesChange={(ranges) => {
                if (ranges.length > 0) {
                  const range = ranges[0];
                  const startDate = range.start.toISOString().slice(0,10);
                  const endDate = range.end.toISOString().slice(0,10);
                  setFormData(prev => ({ 
                    ...prev, 
                    duration: { ...prev.duration, startDate, endDate } 
                  }));
                }
              }}
              onNavigateToStep={goToStep}
              onWeeklyScheduleChange={handleWeeklyScheduleChange}
              includeDates={formData.includeDates}
              excludeDates={formData.excludeDates}
              onIncludeExcludeChange={(inc: string[], exc: string[]) => setFormData(prev => ({ ...prev, includeDates: inc, excludeDates: exc }))}
              goalTitle={formData.title || aiDraft.title}
              goalRawText={rememberedPrompt || aiPrompt}
              aiSuccessCriteria={aiSuccessCriteria}
              blockingReasons={blockingReasons}
              initialSelectedWeekdays={formData.weeklyWeekdays}
              initialWeeklyTimeSettings={formData.weeklySchedule}
              targetLocation={formData.targetLocation}
              onOpenLocationPicker={openLocationPicker}
              onUseCurrentLocation={handleUseCurrentLocation}
              goalSpec={goalSpec}
              calendarEvents={formData.calendarEvents || []}
              onCalendarEventsChange={(events) => {
                setFormData(prev => {
                  const flags = detectTimeManualFlags({
                    weeklyWeekdays: prev.weeklyWeekdays,
                    weeklySchedule: prev.weeklySchedule,
                    calendarEvents: events,
                  });
                  return withForcedVerification({ ...prev, calendarEvents: events }, flags);
                });
              }}
            />
        );
      case 'frequency':
        return (
          <View>
            <SimpleDatePicker
              goalType={goalType}
              weeklyTarget={weeklyTarget}
              onWeeklyTargetChange={setWeeklyTarget}
              ranges={formData.duration?.startDate && formData.duration?.endDate 
                ? [{ start: new Date(formData.duration.startDate), end: new Date(formData.duration.endDate) }] 
                : []}
              onRangesChange={(ranges) => {
                if (ranges.length > 0) {
                  const range = ranges[0];
                  const startDate = range.start.toISOString().slice(0,10);
                  const endDate = range.end.toISOString().slice(0,10);
                  setFormData(prev => ({ 
                    ...prev, 
                    duration: { ...prev.duration, startDate, endDate } 
                  }));
                }
              }}
              onNavigateToStep={goToStep}
              onWeeklyScheduleChange={handleWeeklyScheduleChange}
              includeDates={formData.includeDates}
              excludeDates={formData.excludeDates}
              onIncludeExcludeChange={(inc: string[], exc: string[]) => setFormData(prev => ({ ...prev, includeDates: inc, excludeDates: exc }))}
              goalTitle={formData.title || aiDraft.title}
              goalRawText={rememberedPrompt || aiPrompt}
              aiSuccessCriteria={aiSuccessCriteria}
              blockingReasons={blockingReasons}
              initialSelectedWeekdays={formData.weeklyWeekdays}
              initialWeeklyTimeSettings={formData.weeklySchedule}
              targetLocation={formData.targetLocation}
              onOpenLocationPicker={openLocationPicker}
              onUseCurrentLocation={handleUseCurrentLocation}
              goalSpec={goalSpec}
              calendarEvents={formData.calendarEvents || []}
              onCalendarEventsChange={(events) => {
                setFormData(prev => {
                  const flags = detectTimeManualFlags({
                    weeklyWeekdays: prev.weeklyWeekdays,
                    weeklySchedule: prev.weeklySchedule,
                    calendarEvents: events,
                  });
                  return withForcedVerification({ ...prev, calendarEvents: events }, flags);
                });
              }}
              // Frequency Goal용 추가 props
              isFrequencyGoal={true}
              perWeek={aiBadgeState.perWeek || 3}
              onPerWeekChange={(perWeek) => setAiBadgeState(prev => ({ ...prev, perWeek }))}
            />
          </View>
        );
      case 'milestone':
        return (
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>Milestone Goal</Text>
            <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
              Default milestones: Kickoff, Mid Review, Completion
            </Text>
            <Text style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
              Milestones will be automatically configured based on goal duration
            </Text>
          </View>
        );
      case 'location':
        return renderLocationSection();
      case 'manualForm':
        return renderManualFormSection();
      case 'validation':
        return renderValidationSummary();
      default:
        return null;
    }
  };

  // Build sections array based on current state and step
  const getSections = () => {
    const sections = [];

    // Render based on current step, not just appState
    switch (state.step) {
      case 0: // AI Assistant
        sections.push({ type: 'ai', key: 'ai-section' });
        break;
      case 1: // Schedule - handled by ScheduleFlow
        return null; // ScheduleFlow will handle this step
      case 2: // Review
        sections.push({ type: 'validation', key: 'validation-section' });
        sections.push({ type: 'manualForm', key: 'manual-form-section' });
        break;
      default:
        // Fallback to appState-based rendering for backward compatibility
        if (appState === 'IDLE' || appState === 'GENERATING' || appState === 'NEEDS_INFO') {
          sections.push({ type: 'ai', key: 'ai-section' });
        } else if (appState === 'NEEDS_DATES' && showDatePicker) {
          sections.push({ type: 'datePicker', key: 'date-picker-section' });
        } else if (appState === 'NEEDS_LOCATION') {
          sections.push({ type: 'location', key: 'location-section' });
        } else if (appState === 'READY_TO_REVIEW') {
          sections.push({ type: 'manualForm', key: 'manual-form-section' });
        }
        break;
    }

    // Debug: Log sections for Schedule step
    if (state.step === 1) {
      console.log('[Sections@Schedule]', sections.map(s => s.type));
    }

    return sections;
  };

  // Next step handler - must validate schedule before proceeding
  const onNext = useCallback(() => {
    console.log('[CreateGoalModal] onNext called, step:', state.step, 'aiDraft.type:', aiDraft?.type);
    
    // If we're on Review step (step 2), create the goal
    if (state.step === 2) {
      console.log('[CreateGoalModal] On Review step, creating goal...');
      handleSubmit();
      return;
    }
    
    // Otherwise, validate schedule before proceeding to next step
    handleRequestNextFromSchedule();
  }, [state.step, handleRequestNextFromSchedule, handleSubmit, aiDraft?.type]);

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="pageSheet" 
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {/* AI Type Badge */}
        {aiBadgeState.title.length > 0 && aiBadgeState.aiGuess && (
          <View style={{ 
            backgroundColor: '#f3f4f6', 
            paddingHorizontal: 16, 
            paddingVertical: 12, 
            borderBottomWidth: 1, 
            borderBottomColor: '#e5e7eb'
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#374151', fontSize: 14, fontWeight: '500' }}>
                  AI guessed: <Text style={{ fontWeight: '600', color: '#1f2937' }}>{aiBadgeState.aiGuess}</Text>
                </Text>
                <TouchableOpacity 
                  onPress={() => setShowTypeSelector(true)}
                  style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#dbeafe', borderRadius: 12 }}
                >
                  <Text style={{ color: '#1e40af', fontSize: 12, fontWeight: '600' }}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setShowWhyTooltip(true)}
                  style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f3f4f6', borderRadius: 12 }}
                >
                  <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '500' }}>Why?</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Rule Preview */}
            <TouchableOpacity
              onPress={() => setShowRulePreview(!showRulePreview)}
              style={{ 
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: '#e0f2fe',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#b3e5fc'
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#0277bd', fontWeight: '500' }}>
                  Rule Preview
                </Text>
                <Ionicons 
                  name={showRulePreview ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color="#0277bd" 
                />
              </View>
            </TouchableOpacity>
            
            {/* Rule Preview Content */}
            {showRulePreview && (
              <View style={{ 
                marginTop: 8,
                padding: 12,
                backgroundColor: '#f8fafc',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#e2e8f0'
              }}>
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18 }}>
                  {RULE_TIPS[aiBadgeState.type]}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Type Selector Modal */}
        <Modal visible={showTypeSelector} transparent animationType="fade" onRequestClose={() => setShowTypeSelector(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 20, textAlign: 'center' }}>
                Choose Goal Type
              </Text>
              
              {(['schedule', 'frequency', 'partner'] as GoalType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setAiBadgeState(prev => ({ ...prev, type, typeLockedByUser: true }));
                    setShowTypeSelector(false);
                  }}
                  style={{
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    backgroundColor: aiBadgeState.type === type ? '#dbeafe' : '#f9fafb',
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: aiBadgeState.type === type ? '#3b82f6' : '#e5e7eb'
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: aiBadgeState.type === type ? '600' : '500',
                    color: aiBadgeState.type === type ? '#1e40af' : '#374151',
                    textAlign: 'center'
                  }}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                onPress={() => setShowTypeSelector(false)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: '#f3f4f6',
                  marginTop: 8
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#6b7280', textAlign: 'center' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Why Tooltip Modal */}
        <Modal visible={showWhyTooltip} transparent animationType="fade" onRequestClose={() => setShowWhyTooltip(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, marginHorizontal: 20, maxWidth: 300 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 16, textAlign: 'center' }}>
                Why {aiBadgeState.aiGuess}?
              </Text>
              
              <View style={{ marginBottom: 16 }}>
                {getClassificationReasons(aiBadgeState.title, aiBadgeState.aiGuess!).map((reason, index) => (
                  <Text key={index} style={{ color: '#4b5563', fontSize: 14, marginBottom: 8 }}>
                    • {reason}
                  </Text>
                ))}
              </View>
              
              <TouchableOpacity
                onPress={() => setShowWhyTooltip(false)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: '#3b82f6',
                  alignSelf: 'center'
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>
                  Got it
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* GoalSpec Verification Plan Modal */}
        <Modal visible={showSpecPlanModal} transparent animationType="fade" onRequestClose={() => setShowSpecPlanModal(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5, maxWidth: '90%', width: 400 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 }}>Verification Plan</Text>
              
              {/* Type Badge and Description */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ 
                  backgroundColor: aiBadgeState.type === 'schedule' ? '#3B82F6' : 
                                  aiBadgeState.type === 'frequency' ? '#10B981' : 
                                  aiBadgeState.type === 'milestone' ? '#8B5CF6' : '#6B7280',
                  paddingHorizontal: 12, 
                  paddingVertical: 6, 
                  borderRadius: 16, 
                  alignSelf: 'flex-start',
                  marginBottom: 12
                }}>
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
                    {aiBadgeState.type === 'schedule' ? 'Schedule' :
                     aiBadgeState.type === 'frequency' ? 'Frequency' :
                     aiBadgeState.type === 'milestone' ? 'Milestone' : 'Unknown'}
                  </Text>
                </View>
                <Text style={{ color: '#6B7280', fontSize: 14, lineHeight: 20 }}>
                  {aiBadgeState.type === 'schedule' && 'This goal will be tracked on a fixed schedule'}
                  {aiBadgeState.type === 'frequency' && 'This goal will be tracked by weekly frequency'}
                  {aiBadgeState.type === 'milestone' && 'This goal will be tracked through discrete milestones'}
                </Text>
              </View>

              {/* Verification Plan Details */}
              {(() => {
                const plan = computeVerificationPlan(aiBadgeState.type || 'frequency', aiBadgeState);
                return (
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>Methods:</Text>
                    
                    {/* Method Icons Grid */}
                    {aiBadgeState.type === 'milestone' ? (
                      <Text style={{ color: '#EF4444', fontSize: 14, marginBottom: 12 }}>none selected</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                        <TouchableOpacity 
                          style={{ alignItems: 'center' }}
                          onPress={() => {
                            const methodKey = aiBadgeState.type === 'schedule' ? 'time' : 'manual';
                            setPlanSelectedMethods(prev => ({
                              ...prev,
                              [methodKey]: !prev[methodKey]
                            }));
                          }}
                        >
                          <View style={{ 
                            backgroundColor: (() => {
                              const methodKey = aiBadgeState.type === 'schedule' ? 'time' : 'manual';
                              const isSelected = planSelectedMethods[methodKey];
                              const isMandatory = aiBadgeState.type === 'schedule' && methodKey === 'time' || 
                                                 aiBadgeState.type === 'frequency' && methodKey === 'manual';
                              
                              if (isMandatory) {
                                return aiBadgeState.type === 'schedule' ? '#3B82F6' : '#10B981';
                              }
                              return isSelected ? '#DBEAFE' : '#F3F4F6';
                            })(),
                            borderRadius: 20, 
                            padding: 16, 
                            marginBottom: 8 
                          }}>
                            <Text style={{ fontSize: 20 }}>🕐</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#374151' }}>
                            {aiBadgeState.type === 'schedule' ? 'Time' : 'manual'}
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={{ alignItems: 'center' }}
                          onPress={() => {
                            setPlanSelectedMethods(prev => ({
                              ...prev,
                              location: !prev.location
                            }));
                          }}
                        >
                          <View style={{ 
                            backgroundColor: planSelectedMethods.location ? '#DBEAFE' : '#F3F4F6', 
                            borderRadius: 20, 
                            padding: 16, 
                            marginBottom: 8 
                          }}>
                            <Text style={{ fontSize: 20 }}>📍</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#374151' }}>Location</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={{ alignItems: 'center' }}
                          onPress={() => {
                            setPlanSelectedMethods(prev => ({
                              ...prev,
                              photo: !prev.photo
                            }));
                          }}
                        >
                          <View style={{ 
                            backgroundColor: planSelectedMethods.photo ? '#DBEAFE' : '#F3F4F6', 
                            borderRadius: 20, 
                            padding: 16, 
                            marginBottom: 8 
                          }}>
                            <Text style={{ fontSize: 20 }}>📷</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#374151' }}>Photo</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {plan.mandatory.length > 0 && aiBadgeState.type !== 'milestone' && (
                      <Text style={{ color: '#EF4444', fontSize: 14, marginBottom: 12 }}>
                        Mandatory: {aiBadgeState.type === 'schedule' ? 'time' : 
                                    aiBadgeState.type === 'frequency' ? 'manual' : 
                                    plan.mandatory.join(', ')}
                      </Text>
                    )}
                    
                    {/* Information box based on type */}
                    {aiBadgeState.type === 'schedule' && (
                      <View style={{ backgroundColor: '#DBEAFE', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                        <Text style={{ color: '#1E40AF', fontSize: 14, lineHeight: 20 }}>
                          Need Time and either Location or{'\n'}(Manual+Photo)
                        </Text>
                      </View>
                    )}
                    
                    {aiBadgeState.type === 'frequency' && (
                      <View style={{ backgroundColor: '#D1FAE5', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                        <Text style={{ color: '#047857', fontSize: 14, lineHeight: 20 }}>
                          Manual is required and choose Location or{'\n'}Photo; set period & N/Week
                        </Text>
                      </View>
                    )}
                    
                    {aiBadgeState.type === 'milestone' && (
                      <View style={{ backgroundColor: '#E0E7FF', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                        <Text style={{ color: '#3730A3', fontSize: 14, lineHeight: 20 }}>
                          Configure milestones and set duration
                        </Text>
                      </View>
                    )}

                    {/* Removed partner/milestone recommendation - keep verification simple */}
                  </View>
                );
              })()}
              
              {specFollowUpQuestion && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: '#1f2937', fontSize: 14, marginBottom: 4 }}>{specFollowUpQuestion}</Text>
                  
                  <TextInput
                    style={{ backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#d1d5db', color: '#111827' }}
                    placeholder="Type your answer here..."
                    value={specFollowUpAnswer}
                    onChangeText={setSpecFollowUpAnswer}
                    editable={!goalSpecLoading}
                  />
                  
                  {goalSpecLoading && (
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                      <Text style={{ color: '#2563eb', fontSize: 12, marginLeft: 8 }}>Processing your answer...</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setShowSpecPlanModal(false)} style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, paddingVertical: 12 }}>
                <Text style={{ color: '#374151', fontWeight: '500', textAlign: 'center' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={async () => {
                  // Follow-up 질문에 답변이 있는 경우 처리
                  if (specFollowUpQuestion && specFollowUpAnswer.trim()) {
                    try {
                      setGoalSpecLoading(true);
                      
                      // Update formData with user's answer
                      setFormData(prev => ({
                        ...prev,
                        targetLocation: { 
                          ...(prev.targetLocation || {}), 
                          name: specFollowUpAnswer.trim(),
                          lat: prev.targetLocation?.lat || 0,
                          lng: prev.targetLocation?.lng || 0
                        } as TargetLocation
                      }));
                      
                      // Also update aiDraft if it exists
                      if (aiDraft.targetLocation) {
                        setAiDraft(prev => ({
                          ...prev,
                          targetLocation: {
                            ...prev.targetLocation,
                            name: specFollowUpAnswer.trim()
                          }
                        }));
                      }
                      
                      // Recompile GoalSpec with the answer
                      const originalPrompt = rememberedPrompt || aiPrompt;
                      const title = aiDraft.title || formData.title;
                      // Detect language and get appropriate locale configuration
                      const localeConfig = getLocaleConfig(originalPrompt);
                      const timezone = localeConfig.timezone;
                      const locale = localeConfig.locale;
                      
                      const refined = await AIService.compileGoalSpec({
                        prompt: originalPrompt,
                        title,
                        timezone,
                        locale,
                        targetLocationName: specFollowUpAnswer.trim()
                      });
                      
                      if (refined && typeof refined === 'object' && refined.verification && refined.schedule) {
                        setGoalSpec(refined as GoalSpec);
                        
                        // Post-process verification methods
                        const initialMethods = Array.isArray(refined.verification?.methods) ? refined.verification.methods : [];
                        const initialMandatory = Array.isArray(refined.verification?.mandatory) ? refined.verification.mandatory : [];
                        const processed = postProcessVerificationMethods(refined as any, initialMethods, initialMandatory, originalPrompt);
                        
                        // Update the spec with processed methods
                        refined.verification.methods = processed.methods;
                        refined.verification.mandatory = processed.mandatory;
                        refined.verification.sufficiency = processed.sufficiency;
                        
                        // Show processed results to user
                        setAiAnalyzedMethods(processed.methods);
                        setAiMandatoryMethods(processed.mandatory);
                        setAiVerificationSummary(refined.verification?.rationale || '');
                        
                        // Clear follow-up question
                        setSpecFollowUpQuestion('');
                        setSpecFollowUpAnswer('');
                        
                        // Proceed to next step
                        setShowSpecPlanModal(false);
                        actions.setStep(1);
                        return;
                      }
                    } catch (e) {
                      console.error('Follow-up processing error:', e);
                      Alert.alert('AI Error', 'Failed to process your answer. Please try again.');
                    } finally {
                      setGoalSpecLoading(false);
                    }
                    return;
                  }
                  
                  setShowSpecPlanModal(false);
                  
                  // Determine final type based on verification signals
                  const finalType = aiDraft?.type;
                  
                  console.log("[CreateGoalModal] going to SCHEDULE step with finalType=", finalType);
                  
                  // Update AI draft with final type
                  setAiDraft(prev => ({ ...prev, type: finalType }));
                  
                  // Close plan and advance to Schedule step
                  setShowSpecPlanModal(false);
                  actions.setStep(1); // Schedule step

                }}
                style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 12 }}
              >
                <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Schedule Fixes Modal */}
        <Modal visible={showScheduleFixes} transparent animationType="fade" onRequestClose={() => setShowScheduleFixes(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 }}>Schedule Issues</Text>
              
              {scheduleValidationResult?.issues && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#dc2626', marginBottom: 8 }}>Issues:</Text>
                  {scheduleValidationResult.issues.map((issue: string, index: number) => (
                    <Text key={index} style={{ color: '#dc2626', fontSize: 14 }}>• {issue}</Text>
                  ))}
                </View>
              )}

              {scheduleValidationResult?.fixes && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>Suggested fixes:</Text>
                  {scheduleValidationResult.fixes.weeklyWeekdays && (
                    <Text style={{ color: '#1f2937', fontSize: 14 }}>
                      • Use weekdays: {scheduleValidationResult.fixes.weeklyWeekdays.map((d: number) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}
                    </Text>
                  )}
                  {scheduleValidationResult.fixes.weeklyTimeSettings && (
                    <Text style={{ color: '#1f2937', fontSize: 14 }}>• Use suggested time windows</Text>
                  )}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  onPress={() => {
                    setShowScheduleFixes(false);
                    setScheduleValidationResult(null);
                  }} 
                  style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, paddingVertical: 12 }}
                >
                  <Text style={{ color: '#374151', fontWeight: '500', textAlign: 'center' }}>Cancel</Text>
                </TouchableOpacity>
                
                {scheduleValidationResult?.fixes && (
                  <TouchableOpacity 
                    onPress={handleApplyFixes}
                    style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12 }}
                  >
                    <Text style={{ color: 'white', fontWeight: '500', textAlign: 'center' }}>Apply Fixes</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Header with dynamic Save button */}
        <View style={{ backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Create Goal</Text>
            <TouchableOpacity
              onPress={() => {
                if (!isSchemaValid) {
                  toast.error(`목표 저장 실패: ${schemaValidationErrors.join(', ')}`);
                  
                  // Log save attempt with validation failure
                  logUserAction({
                    action: 'save_attempt_failed',
                    message: 'Save attempt failed due to validation errors',
                    success: false,
                    context: {
                      validationErrors: schemaValidationErrors,
                      sessionId: getLoggingSessionId(),
                    },
                  });
                  return;
                }
                
                // Log save attempt
                logUserAction({
                  action: 'save_attempt',
                  message: 'User attempted to save goal',
                  context: {
                    sessionId: getLoggingSessionId(),
                    goalType: aiBadgeState.type,
                  },
                });
                
                console.log('[CreateGoal] payload', aiBadgeState);
                handleSubmit();
              }}
              disabled={loading || state.step !== 2 || !isSchemaValid}
              style={[
                { padding: 12, borderRadius: 8 },
                loading || state.step !== 2 || !isSchemaValid ? { backgroundColor: '#e5e7eb' } : { backgroundColor: '#2563eb' }
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '600' }}>
                  {appState === 'SAVING' ? 'Saving...' : 'Save Goal'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Stepper Progress - Fixed position for all steps */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
            {STEPS.map((step, index) => (
              <TouchableOpacity
                key={step.id}
                onPress={() => goToStep(index)}
                disabled={index > state.step}
                style={[
                  { marginHorizontal: 8 },
                  index <= state.step ? { borderBottomWidth: 2, borderBottomColor: '#2563eb' } : {}
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: index <= state.step ? '600' : '400' }}>
                  {step.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Thin progress bar below stepper - 3 connected bars without circles */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
            {[0, 1, 2].map((stepIndex) => (
              <View
                key={stepIndex}
                style={{
                  width: 20,
                  height: 4,
                  backgroundColor: stepIndex <= state.step ? '#2563eb' : '#e5e7eb',
                  marginHorizontal: 2,
                  borderRadius: 2
                }}
              />
            ))}
          </View>
        </View>

        {/* Background task progress indicator */}
        {backgroundTaskProgress && (
          <View style={{ backgroundColor: '#e5e7eb', padding: 12 }}>
            <Text style={{ color: '#4b5563', fontSize: 14 }}>{backgroundTaskProgress}</Text>
          </View>
        )}
        {state.step === 1 && aiVerificationLoading && (
          <View style={{ backgroundColor: '#e5e7eb', padding: 12 }}>
            <Text style={{ color: '#2563eb', fontSize: 14 }}>Analyzing verification methods with AI...</Text>
          </View>
        )}

        {/* Main content - Schedule step uses ScheduleFlow, others use FlatList */}
        {state.step === 1 ? (
          <ScheduleFlow
            goalType={goalType}
            formData={formData}
            setFormData={setFormData}
            onDone={() => {
              console.log('[CreateGoalModal] ScheduleFlow onDone - current formData:', {
                title: formData.title,
                duration: formData.duration,
                weeklyWeekdays: formData.weeklyWeekdays,
                verificationMethods: formData.verificationMethods,
                type: formData.type
              });
              
              // Ensure AI data is properly merged before going to Review
              console.log('[CreateGoalModal] ScheduleFlow onDone - checking data sync:', {
                aiDraftTitle: aiDraft.title,
                formDataTitle: formData.title,
                aiDraftType: aiDraft.type,
                formDataType: formData.type
              });
              
              if (aiDraft.title && !formData.title) {
                console.log('[CreateGoalModal] Syncing AI data to formData...');
                updateFormFromAI(aiDraft);
              } else {
                console.log('[CreateGoalModal] No AI sync needed or aiDraft.title missing');
              }
              
              actions.setStep(2);
            }}
          />
        ) : (
          <FlatList
            data={getSections()}
            renderItem={renderSection}
            keyExtractor={(item: any) => item.key}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={3}
            windowSize={3}
            removeClippedSubviews={true}
            extraData={{ formData, aiVerificationLoading, stateStep: state.step }}
          />
        )}

        {/* Step Footer - Back/Next buttons (hidden during Schedule step) */}
        {state.step !== 1 && (
          <View style={{ padding: 16, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => goToStep(state.step - 1)}
                disabled={state.step === 0}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={16} color={state.step === 0 ? '#9ca3af' : '#374151'} />
                <Text style={{ color: state.step === 0 ? '#9ca3af' : '#2563eb', fontWeight: '600', marginLeft: 8 }}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ 
                  flex: 1, 
                  backgroundColor: (canProceedToNext() && !questPreviewLoading) ? '#2563eb' : '#9ca3af', 
                  borderRadius: 8, 
                  padding: 12, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
                onPress={onNext}
                disabled={!canProceedToNext() || questPreviewLoading}
                activeOpacity={0.8}
              >
                <Text style={{ color: 'white', fontWeight: '600', marginRight: 8 }}>
                  {state.step === STEPS.length - 1 ? 'Create Goal' : 'Next'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        )}

      {/* Location Picker Overlay Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeLocationPicker}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {/* Drag handle */}
          <View style={{ padding: 16, backgroundColor: '#2563eb' }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' }} />
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginTop: 8 }}>Select Location</Text>
          </View>

          {/* Temporary placeholder - LocationSearch disabled for web compatibility */}
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', textAlign: 'center' }}>
              Location search is temporarily unavailable.
            </Text>
            <TouchableOpacity
              style={{ marginTop: 16, backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
              onPress={() => setShowLocationPicker(false)}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Confirm */}
          <View style={{ padding: 16 }}>
            <TouchableOpacity
              style={{ 
                flex: 1, 
                backgroundColor: pickerSelectedLocation ? '#2563eb' : '#9ca3af', 
                borderRadius: 8, 
                padding: 16, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: 56
              }}
              onPress={() => {
                if (pickerSelectedLocation) {
                  handlePickerConfirm();
                }
              }}
            >
              <Ionicons 
                name={pickerSelectedLocation ? "checkmark" : "location-outline"} 
                size={24} 
                color="#FFFFFF" 
              />
              <Text style={{ 
                color: '#FFFFFF', 
                fontWeight: '700', 
                fontSize: 16,
                marginLeft: 12,
                textAlign: 'center'
              }}>
                {pickerSelectedLocation ? 'Confirm Location' : 'Select a Location First'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </View>
      <ToastContainer position="top" />
      
      {/* Debug telemetry panel (development only) */}
      {/* AI Request Telemetry removed for cleaner UI */}
    </Modal>
  );
}

export default function CreateGoalModal({ visible, onClose, onGoalCreated }: CreateGoalModalProps) {
  return <CreateGoalModalContent visible={visible} onClose={onClose} onGoalCreated={onGoalCreated} />;
}