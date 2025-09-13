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
import { LocationSearch } from '../components';
import { FrequencyTarget, PartnerPicker, ScheduleWhen } from '../components/createGoal';
import { Categories } from '../constants';
import { classifyGoalTypeFromTitle, computeVerificationPlan, CreateGoalState as CreateGoalFeatureState, CreateGoalProvider, GoalType, INITIAL_CREATE_GOAL_STATE, RULE_TIPS, useCreateGoal, validateCreateView } from '../features/createGoal';
import { AIGoalDraft, mergeAIGoal, updateDraftWithDates, validateAIGoal } from '../features/goals/aiDraft';
import { useAuth } from '../hooks/useAuth';
import { AIService } from '../services/ai';
import { CalendarEventService } from '../services/calendarEventService';
import { GoalService } from '../services/goalService';
import { getPlaceDetails } from '../services/places';
import { CreateGoalForm, GoalDuration, GoalFrequency, GoalSpec, TargetLocation, ValidationResult, VerificationType } from '../types';
import { toIndexKeyMap } from '../utils/schedule';
import MapPreview from './MapPreview';
import SimpleDatePicker, { DateSelection } from './SimpleDatePicker';

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
}

// Step definitions
const STEPS = [
  { id: 'ai', title: 'AI Assistant', description: 'Generate goal with AI' },
  { id: 'schedule', title: 'Schedule', description: 'Date & duration' },
  { id: 'review', title: 'Review', description: 'Final review & save' }
];

function CreateGoalModalContent({ visible, onClose, onGoalCreated }: CreateGoalModalProps) {
  // Performance tracking
  console.time('[CreateGoalModal] Component Mount');
  
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { state, actions } = useCreateGoal();
  
  // Local state for AI type badge
  const [aiBadgeState, setAiBadgeState] = useState<CreateGoalFeatureState>(INITIAL_CREATE_GOAL_STATE);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showWhyTooltip, setShowWhyTooltip] = useState(false);
  const [showRulePreview, setShowRulePreview] = useState(false);
  
  // Debug navigation state
  useEffect(() => {
    console.log('[NAV] available screens:', navigation.getState()?.routeNames);
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

  // Validation computation
  const validation = validateCreateView(aiBadgeState.type, aiBadgeState);
  const { ok, issues } = validation;
  
  // AI 단계(step===0)에서는 issues를 표시하지 않음 (Verification Plan이 대체)
  const showIssues = state.step === 2; // Review에서만 표시

  // Log validation issues for debugging
  useEffect(() => {
    if (!ok && issues.length > 0 && showIssues) {
      console.log('[CreateGoal] Validation issues:', issues);
    }
  }, [ok, issues, showIssues]);

  // Helper function to get classification reasons
  const getClassificationReasons = (title: string, type: GoalType): string[] => {
    const t = title.toLowerCase();
    const reasons: string[] = [];
    
    if (type === 'frequency') {
      if (/(times\s+per\s+(week|day|month))/.test(t)) reasons.push("Detected 'times per week/day/month'");
      if (/(\bper\s+week\b)/.test(t)) reasons.push("Found 'per week'");
      if (/(\bweekly\b)/.test(t)) reasons.push("Found 'weekly'");
    } else if (type === 'partner') {
      if (/(with|by)\s+(friend|coach|partner)/.test(t)) reasons.push("Detected 'with/by friend/coach/partner'");
      if (/\bpartner approval\b/.test(t)) reasons.push("Found 'partner approval'");
      if (/\baccountability\b/.test(t)) reasons.push("Found 'accountability'");
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

      if (checkSufficiency) {
        const currentMethods = formData.verificationMethods || [];
        const currentMandatory = (formData.lockedVerificationMethods || []).concat(aiMandatoryMethods || []);
        const processed = postProcessVerificationMethods(goalSpec, currentMethods, currentMandatory, rememberedPrompt || aiPrompt);
        
        if (!processed.sufficiency) {
          Alert.alert(
            'Insufficient Verification',
            'This goal cannot be sufficiently proven with the authentication methods currently available. (One of Location/Photo/ScreenTime is required.)',
            [{ text: 'OK' }]
          );
          return;
        }
      }

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

  const [formData, setFormData] = useState<CreateGoalForm>({
    title: '',
    description: '',
    category: Categories[0],
    verificationMethods: [],
    frequency: { count: 1, unit: 'per_day' },
    duration: {
      type: 'weeks',
      value: 2,
      startDate: new Date().toISOString(),
    },
    notes: '',
    // Legacy fields for backward compatibility
    verificationType: 'manual',
    timeFrame: 'daily',
    startDate: new Date(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    includeDates: [],
    excludeDates: [],
    calendarEvents: [],
  });


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
      goToStep(1);
    }
  }, [appState, state.step]);



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
    if (scheduleValidating || scheduleValidateInFlight.current) {
      console.log('[CreateGoalModal] 스케줄 검증 중복 요청 차단');
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
      const result = AIService.validateGoalByCalendarEvents(
        allEvents,
        goalSpec,
        formData.duration?.startDate || '',
        formData.duration?.endDate || ''
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
      partner: undefined,
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

  // AI generation with timeout and error handling
  const handleAiGeneration = async () => {
    if (!aiPrompt.trim()) return;

    console.time('[CreateGoalModal] AI Generation');
    console.log('[CreateGoalModal] Starting AI generation:', aiPrompt);

    // Remember the prompt for future reference
    setRememberedPrompt(aiPrompt.trim());

    try {
      setAppState('GENERATING');
      setLoading(true);
      setFollowUpQuestion('');

      let aiResult: any;
      if (!aiContext) {
        // Initial generation
        console.log('[CreateGoalModal] Initial AI generation');
        // Step 0: Compile GoalSpec first (semantic-first)
        try {
          setGoalSpecLoading(true);
          const spec = await AIService.compileGoalSpec({
            prompt: aiPrompt.trim(),
            title: aiDraft.title || formData.title,
            targetLocationName: (aiDraft as any)?.targetLocation?.name || formData.targetLocation?.name,
            placeId: (aiDraft as any)?.targetLocation?.placeId || formData.targetLocation?.placeId,
            locale: 'ko-KR',
            timezone: 'Asia/Seoul'
          });
          if (!spec || typeof spec !== 'object' || !spec.verification || !spec.schedule) {
            Alert.alert('AI Error', 'Failed to parse GoalSpec. Please refine your input.');
            setGoalSpecLoading(false);
            setAppState('IDLE');
            return;
          }
          setGoalSpec(spec);
          
          // Update formData with schedule information from GoalSpec
          setFormData(prev => ({
            ...prev,
            schedule: {
              countRule: spec.schedule?.countRule,
              timeWindows: spec.schedule?.timeWindows,
              weekdayConstraints: spec.schedule?.weekdayConstraints,
              weekBoundary: spec.schedule?.weekBoundary || 'startWeekday',
              enforcePartialWeeks: spec.schedule?.enforcePartialWeeks || false
            }
          }));
          
          // Post-process verification methods to enforce requirements
          const initialMethods = Array.isArray(spec.verification?.methods) ? spec.verification.methods : [];
          const initialMandatory = Array.isArray(spec.verification?.mandatory) ? spec.verification.mandatory : [];
          const processed = postProcessVerificationMethods(spec, initialMethods, initialMandatory, aiPrompt.trim());
          
          // Update the spec with processed methods
          spec.verification.methods = processed.methods;
          spec.verification.mandatory = processed.mandatory;
          spec.verification.sufficiency = processed.sufficiency;
          
          // Show processed results to user
          setAiAnalyzedMethods(processed.methods);
          setAiMandatoryMethods(processed.mandatory);
          setAiVerificationSummary(spec.verification?.rationale || '');
          
          // Check sufficiency before proceeding
          if (!processed.sufficiency) {
            Alert.alert(
              'Insufficient Verification',
              'This goal cannot be sufficiently proven with the authentication methods currently available. (One of Location/Photo/ScreenTime is required.)',
              [{ text: 'OK', onPress: () => { setGoalSpecLoading(false); setAppState('IDLE'); } }]
            );
            return;
          }

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
          Alert.alert('AI Error', 'Failed to compile GoalSpec. Please try again.');
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
          const spec = await AIService.compileGoalSpec({
            prompt: refinementText,
            title: aiDraft.title || formData.title,
            targetLocationName: (aiDraft as any)?.targetLocation?.name || formData.targetLocation?.name,
            placeId: (aiDraft as any)?.targetLocation?.placeId || formData.targetLocation?.placeId,
            locale: 'ko-KR',
            timezone: 'Asia/Seoul'
          });
          if (!spec || typeof spec !== 'object' || !spec.verification || !spec.schedule) {
            Alert.alert('AI Error', 'Failed to parse GoalSpec. Please refine your input.');
            setGoalSpecLoading(false);
            setAppState('IDLE');
            return;
          }
          setGoalSpec(spec);
          
          // Update formData with schedule information from GoalSpec
          setFormData(prev => ({
            ...prev,
            schedule: {
              countRule: spec.schedule?.countRule,
              timeWindows: spec.schedule?.timeWindows,
              weekdayConstraints: spec.schedule?.weekdayConstraints,
              weekBoundary: spec.schedule?.weekBoundary || 'startWeekday',
              enforcePartialWeeks: spec.schedule?.enforcePartialWeeks || false
            }
          }));
          
          // Post-process verification methods to enforce requirements
          const initialMethods = Array.isArray(spec.verification?.methods) ? spec.verification.methods : [];
          const initialMandatory = Array.isArray(spec.verification?.mandatory) ? spec.verification.mandatory : [];
          const processed = postProcessVerificationMethods(spec, initialMethods, initialMandatory, refinementText);
          
          // Update the spec with processed methods
          spec.verification.methods = processed.methods;
          spec.verification.mandatory = processed.mandatory;
          spec.verification.sufficiency = processed.sufficiency;
          
          // Show processed results to user
          setAiAnalyzedMethods(processed.methods);
          setAiMandatoryMethods(processed.mandatory);
          setAiVerificationSummary(spec.verification?.rationale || '');
          
          // Check sufficiency before proceeding
          if (!processed.sufficiency) {
            Alert.alert(
              'Insufficient Verification',
              'This goal cannot be sufficiently proven with the authentication methods currently available. (One of Location/Photo/ScreenTime is required.)',
              [{ text: 'OK', onPress: () => { setGoalSpecLoading(false); setAppState('IDLE'); } }]
            );
            return;
          }

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
          Alert.alert('AI Error', 'Failed to refine GoalSpec. Please try again.');
          setAppState('IDLE');
          return;
        } finally {
          setGoalSpecLoading(false);
        }
        return; // Stop legacy flow; proceed after user confirms plan
      }


    } catch (error: any) {
      console.error('[CreateGoalModal] AI generation failed:', error);
      Alert.alert(
        'AI Assistant Error',
        'The AI assistant encountered an issue. You can still create your goal manually.',
        [
          { text: 'Continue Manually', onPress: () => setAppState('READY_TO_REVIEW') },
          { text: 'Try Again', onPress: () => setAppState('IDLE') }
        ]
      );
    } finally {
      setLoading(false);
      console.timeEnd('[CreateGoalModal] AI Generation');
    }
  };

  // Update form data from AI draft
  const updateFormFromAI = (draft: AIGoalDraft) => {
    console.time('[CreateGoalModal] Form Update from AI');
    
    const updatedForm: CreateGoalForm = {
      ...formData,
      title: draft.title || formData.title,
      description: draft.notes || formData.description,
      category: draft.category || formData.category,
      verificationMethods: draft.verificationMethods || formData.verificationMethods,
      frequency: (draft.frequency && draft.frequency.count) ? draft.frequency as GoalFrequency : formData.frequency,
      duration: (draft.duration && draft.duration.type) ? draft.duration as GoalDuration : formData.duration,
      notes: draft.notes || formData.notes,
      targetLocation: draft.targetLocation ? {
        name: draft.targetLocation.name || '',
        placeId: draft.targetLocation.placeId,
        lat: draft.targetLocation.lat || 0,
        lng: draft.targetLocation.lng || 0,
        address: draft.targetLocation.name || '',
      } : formData.targetLocation,
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
        goToStep(1);
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
    
    try {
      setLoading(true);
      
      // Prepare goal data for creation

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
      };
      // Create goal using the updated form data (with forced methods)
      const goalId = await GoalService.createGoal({
        ...updatedFormData,
        userId: user.id,
      });

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

      // Close modal and notify parent
      onGoalCreated();
      onClose();
      
    } catch (error) {
      console.error('[CreateGoalModal] Error creating goal:', error);
      Alert.alert('Error', 'Failed to create goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };
 
  // Background creation removed for reliability during development

  // Form sections as separate components for FlatList
  const renderAISection = () => (
    <View style={{ marginBottom: 24, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#BFDBFE' }}>
      <Text style={{ color: '#1D4ED8', fontWeight: '600', marginBottom: 12 }}>🤖 AI Goal Assistant</Text>
      
      {/* Follow-up UI removed per request: scheduling handled in 2. Schedule */}

      {/* Only show selected dates when not in AI Assistant step */}
      {state.step !== 0 && (aiDraft.startDate || aiDraft.duration) && (
        <View style={{ marginBottom: 12 }}>
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
          style={{ backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#bfdbfe', color: '#111827', minHeight: 80 }}
          placeholder={"Describe your goal (e.g., 'Go to the gym 3 times a week')"}
          placeholderTextColor="#9CA3AF"
          value={aiPrompt}
          onChangeText={(text: string) => {
            setAiPrompt(text);
            setAiBadgeState(prev => ({ ...prev, title: text }));
          }}
          multiline
          textAlignVertical="top"
          editable={!loading}
        />

        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        <TouchableOpacity
          onPress={() => {
            if (loading) return;
              handleAiGeneration();
          }}
          disabled={loading || (appState === 'IDLE' && !aiPrompt.trim())}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: loading || (appState === 'IDLE' && !aiPrompt.trim()) ? '#9CA3AF' : '#2563eb'
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            {loading ? 'Generating...' : 'Generate with AI'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setAppState('READY_TO_REVIEW');
            goToStep(1);
          }}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#93C5FD'
          }}
        >
          <Text style={{ color: '#2563eb', fontWeight: '600' }}>Manual</Text>
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
        startDate={aiDraft.startDate || null}
        endDate={aiDraft.duration?.endDate || null}
        onStartDateChange={(date) => {
          // Update AI draft with new start date
          setAiDraft(prev => ({ ...prev, startDate: date }));
          // Also mirror to formData duration.startDate
          setFormData(prev => ({ ...prev, duration: { ...prev.duration, startDate: date } }));
        }}
        onEndDateChange={(date) => {
          // Update AI draft with new end date
          setAiDraft(prev => ({ 
            ...prev, 
            duration: { ...prev.duration, endDate: date } 
          }));
          setFormData(prev => ({ ...prev, duration: { ...prev.duration, endDate: date } }));
        }}
        onNavigateToStep={goToStep}
        onWeeklyScheduleChange={handleWeeklyScheduleChange}
        verificationMethods={formData.verificationMethods}
        onVerificationMethodsChange={(methods) => setFormData(prev => ({ ...prev, verificationMethods: methods }))}
        lockedVerificationMethods={formData.lockedVerificationMethods || []}
        includeDates={formData.includeDates}
        excludeDates={formData.excludeDates}
        onIncludeExcludeChange={(inc: string[], exc: string[]) => setFormData(prev => ({ ...prev, includeDates: inc, excludeDates: exc }))}
        // Pass initial weekly schedule to show persistence
        initialSelectedWeekdays={formData.weeklyWeekdays}
        initialWeeklyTimeSettings={formData.weeklySchedule}
        onRequestNext={handleRequestNextFromSchedule}
        goalSpec={goalSpec}
        loading={scheduleValidating}
        validationResult={lastValidationResult}
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
              {formData.targetLocation.lat.toFixed(6)}, {formData.targetLocation.lng.toFixed(6)}
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

  // Type-specific sections based on aiBadgeState.type
  const renderTypeSpecificSections = () => {
    if (!aiBadgeState.type) return null;
    if (state.step === 0) return null; // AI 단계에서는 절대 렌더하지 않음

    switch (aiBadgeState.type) {
      case 'schedule':
        return renderScheduleSection();
      case 'frequency':
        return renderFrequencySection();
      case 'partner':
        return renderPartnerSection();
      default:
        return null;
    }
  };

  const renderScheduleSection = () => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>Schedule</Text>
      
      {/* When Section */}
      <ScheduleWhen
        times={aiBadgeState.times || []}
        onChange={(times) => setAiBadgeState(prev => ({ ...prev, times }))}
      />

      {/* Verification Methods */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151', marginBottom: 12 }}>Verification Methods</Text>
        
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
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: 'white',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#d1d5db',
              marginBottom: 8
            }}
          >
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: aiBadgeState.methods[method as keyof typeof aiBadgeState.methods] ? '#3b82f6' : '#d1d5db',
              backgroundColor: aiBadgeState.methods[method as keyof typeof aiBadgeState.methods] ? '#3b82f6' : 'white',
              marginRight: 12,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {aiBadgeState.methods[method as keyof typeof aiBadgeState.methods] && (
                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
              )}
            </View>
            <Text style={{ 
              color: '#374151', 
              fontSize: 16,
              textTransform: 'capitalize'
            }}>
              {method}
            </Text>
          </TouchableOpacity>
        ))}
        
        <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>
          Need Time and either (Manual + Location) or Photo
        </Text>
      </View>

      {/* Optional Partner Toggle */}
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
          onPress={() => {
            setAiBadgeState(prev => ({
              ...prev,
              partner: prev.partner ? undefined : { status: 'pending' }
            }));
          }}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: 'white',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#d1d5db'
          }}
        >
          <View style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: aiBadgeState.partner ? '#3b82f6' : '#d1d5db',
            backgroundColor: aiBadgeState.partner ? '#3b82f6' : 'white',
            marginRight: 12,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {aiBadgeState.partner && (
              <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
            )}
          </View>
          <Text style={{ color: '#374151', fontSize: 16 }}>
            Require partner approval
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
        perWeek={aiBadgeState.perWeek || 1}
        period={aiBadgeState.period}
        onPerWeekChange={(perWeek) => setAiBadgeState(prev => ({ ...prev, perWeek }))}
        onPeriodChange={(period) => setAiBadgeState(prev => ({ ...prev, period }))}
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

  const renderPartnerSection = () => (
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>Partner Goal</Text>
        
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

        {/* Partner Section */}
        <PartnerPicker
          partner={aiBadgeState.partner}
          onChange={(partner) => setAiBadgeState(prev => ({ ...prev, partner }))}
        />

        {/* Helper text */}
        <Text style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
          This goal will be verified by your partner's approval.
        </Text>
      </View>
    );

  const renderValidationSummary = () => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>Summary & Warnings</Text>
      
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

  const renderManualFormSection = () => (
    <View>
      {/* Review Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 }}>Review Your Goal</Text>
        <Text style={{ color: '#4b5563' }}>Review and confirm your goal details before saving</Text>
      </View>

      {/* Basic Information */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: '#374151', fontWeight: '600', fontSize: 18 }}>Basic Information</Text>
          <TouchableOpacity 
            onPress={() => actions.setStep(0)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#eff6ff', borderRadius: 8 }}
          >
            <Ionicons name="create-outline" size={16} color="#2563EB" />
            <Text style={{ color: '#2563eb', fontSize: 14, marginLeft: 4 }}>Edit</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ color: '#1f2937', fontWeight: '500', fontSize: 18, marginBottom: 8 }}>{formData.title || 'Not set'}</Text>
          {formData.description && (
            <Text style={{ color: '#4b5563', marginBottom: 8 }}>{formData.description}</Text>
          )}
          <Text style={{ color: '#6b7280', fontSize: 14 }}>Category: {formData.category}</Text>
        </View>
      </View>

      {/* Schedule Information */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: '#374151', fontWeight: '600', fontSize: 18 }}>Schedule</Text>
          <TouchableOpacity 
            onPress={() => goToStep(1)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#eff6ff', borderRadius: 8 }}
          >
            <Ionicons name="create-outline" size={16} color="#2563EB" />
            <Text style={{ color: '#2563eb', fontSize: 14, marginLeft: 4 }}>Edit</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          {/* Duration/Frequency removed per request */}
          {formData.startDate && (
            <Text style={{ color: '#1f2937' }}>
              <Text style={{ fontWeight: '500' }}>Start Date:</Text> {new Date(formData.startDate).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {/* Verification Methods */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: '#374151', fontWeight: '600', fontSize: 18, marginBottom: 12 }}>Verification Methods</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {formData.verificationMethods.length > 0 ? (
            formData.verificationMethods.map((method) => (
              <View key={method} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#dbeafe', borderRadius: 8 }}>
                <Text style={{ color: '#1e40af', fontSize: 14, fontWeight: '500' }}>
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>No verification methods selected</Text>
          )}
        </View>
      </View>

      {/* Verification Plan Summary */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: '#374151', fontWeight: '600', fontSize: 18, marginBottom: 12 }}>Verification Plan Summary</Text>
        <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          {/* One-line AI summary if available */}
          {aiSuccessCriteria ? (
            <Text style={{ color: '#1f2937', marginBottom: 12 }}>{aiSuccessCriteria}</Text>
          ) : (
            <Text style={{ color: '#6b7280', marginBottom: 12 }}>Summary will appear based on your configured methods and schedule.</Text>
          )}

          {/* Methods with lock indicators */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#374151', fontWeight: '600', marginBottom: 8 }}>Methods</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(formData.verificationMethods || []).map((m) => {
                const locked = (formData.lockedVerificationMethods || []).includes(m as any);
                return (
                  <View key={m} style={[
                    { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
                    locked ? { backgroundColor: '#1e40af' } : { backgroundColor: '#dbeafe' }
                  ]}>
                    {locked && <Ionicons name="lock-closed" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                    <Text style={[
                      { fontSize: 12, fontWeight: '600' },
                      locked ? { color: 'white' } : { color: '#1e40af' }
                    ]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Schedule overview */}
          <View>
            <Text style={{ color: '#374151', fontWeight: '600', marginBottom: 8 }}>Schedule</Text>
            {formData.duration?.startDate || formData.duration?.endDate ? (
              <Text style={{ color: '#1f2937', fontSize: 14 }}>
                {formData.duration?.startDate ? `Start: ${new Date(formData.duration.startDate).toLocaleDateString()}` : ''}
                {formData.duration?.endDate ? `  End: ${new Date(formData.duration.endDate).toLocaleDateString()}` : ''}
              </Text>
            ) : (
              <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Duration not set</Text>
            )}
            {(formData.weeklyWeekdays && formData.weeklyWeekdays.length > 0) ? (
              <View>
                {(formData.weeklyWeekdays || []).sort().map((d) => {
                  const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                  const times = (formData.weeklySchedule as any)?.[d] || [];
                  const timeText = Array.isArray(times) && times.length > 0 ? (times as string[]).join(', ') : 'No time set';
                  return (
                    <Text key={d} style={{ color: '#1f2937', fontSize: 12 }}>{dayShort[d]}: {timeText}</Text>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Weekly schedule not set</Text>
            )}
          </View>
        </View>
      </View>

      {/* Full Plan Overview - consolidate every relevant detail */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: '#374151', fontWeight: '600', fontSize: 18, marginBottom: 12 }}>Full Plan Overview</Text>
        <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          {/* Goal info */}
          <Text style={{ color: '#1f2937', fontWeight: '500', fontSize: 18, marginBottom: 8 }}><Text style={{ fontWeight: '600' }}>Goal:</Text> {formData.title || 'Not set'}</Text>
          {!!formData.description && (
            <Text style={{ color: '#4b5563', fontSize: 14, marginBottom: 8 }}>{formData.description}</Text>
          )}

          {/* Verification methods and mandatory */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#1f2937', fontWeight: '600', marginBottom: 8 }}>Verification Methods</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(formData.verificationMethods || []).map((m) => {
                const locked = (formData.lockedVerificationMethods || []).includes(m as any);
                return (
                  <View key={m} style={[
                    { 
                      paddingHorizontal: 12, 
                      paddingVertical: 4, 
                      borderRadius: 20, 
                      flexDirection: 'row', 
                      alignItems: 'center' 
                    },
                    locked ? { backgroundColor: '#1e40af' } : { backgroundColor: '#dbeafe' }
                  ]}>
                    {locked && (
                      <Ionicons 
                        name="lock-closed" 
                        size={12} 
                        color="#FFFFFF" 
                        style={{ marginRight: 4 }} 
                      />
                    )}
                    <Text style={[
                      { fontSize: 14, fontWeight: '500' },
                      locked ? { color: 'white' } : { color: '#1e40af' }
                    ]}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </View>
                );
              })}
              {(formData.verificationMethods || []).length === 0 && (
                <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>None</Text>
              )}
            </View>
            {(formData.lockedVerificationMethods || []).length > 0 && (
              <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 8, fontWeight: '500' }}>
                🔒 Locked: {(formData.lockedVerificationMethods as any).map((m: string) => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}
              </Text>
            )}
          </View>

          {/* AI-generated verification description */}
          {(formData.verificationMethods || []).length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: '#1f2937', fontWeight: '600', marginBottom: 8 }}>How Verification Works</Text>
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: '#3b82f6' }}>
                <Text style={{ color: '#1f2937', fontSize: 14, lineHeight: 20 }}>
                  {AIService.generateVerificationDescription({
                    title: formData.title || '',
                    verificationMethods: formData.verificationMethods || [],
                    lockedVerificationMethods: formData.lockedVerificationMethods || [],
                    weeklySchedule: formData.weeklySchedule,
                    calendarEvents: formData.calendarEvents || [],
                    targetLocation: formData.targetLocation,
                    frequency: formData.frequency
                  })}
                </Text>
              </View>
            </View>
          )}

          {/* Target Location */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#1f2937', fontWeight: '600', marginBottom: 8 }}>Target Location</Text>
            {formData.targetLocation ? (
              <View>
                <Text style={{ color: '#1f2937', fontSize: 14 }}>{formData.targetLocation.name}</Text>
                {!!formData.targetLocation.address && (
                  <Text style={{ color: '#4b5563', fontSize: 12, marginTop: 4 }}>{formData.targetLocation.address}</Text>
                )}
                <Text style={{ color: '#6b7280', fontSize: 10 }}>
                  {formData.targetLocation.lat.toFixed(6)}, {formData.targetLocation.lng.toFixed(6)}
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Not set</Text>
            )}
          </View>

          {/* Frequency */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#1f2937', fontWeight: '600', marginBottom: 8 }}>Frequency</Text>
            <Text style={{ color: '#1f2937', fontSize: 14 }}>{formData.frequency?.count || 0} per {formData.frequency?.unit?.replace('per_', '') || 'day'}</Text>
          </View>

          {/* Duration */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#1f2937', fontWeight: '600', marginBottom: 8 }}>Duration</Text>
            {formData.duration?.startDate || formData.duration?.endDate ? (
              <Text style={{ color: '#1f2937', fontSize: 14 }}>
                {formData.duration?.startDate ? `Start: ${new Date(formData.duration.startDate).toLocaleDateString()}` : ''}
                {formData.duration?.endDate ? `  End: ${new Date(formData.duration.endDate).toLocaleDateString()}` : ''}
              </Text>
            ) : (
              <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Not set</Text>
            )}
          </View>

          {/* Weekly Schedule */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#1f2937', fontWeight: '600', marginBottom: 8 }}>Weekly Schedule</Text>
            {(formData.weeklyWeekdays && formData.weeklyWeekdays.length > 0) ? (
              <View>
                {(formData.weeklyWeekdays || []).sort().map((d) => {
                  const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                  const times = (formData.weeklySchedule as any)?.[d] || [];
                  const timeText = Array.isArray(times) && times.length > 0 ? (times as string[]).join(', ') : 'No time set';
                  return (
                    <Text key={d} style={{ color: '#1f2937', fontSize: 12 }}>{dayShort[d]}: {timeText}</Text>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Not set</Text>
            )}
          </View>

          {/* Per-day overrides */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#1f2937', fontWeight: '600', marginBottom: 8 }}>Per-day Overrides</Text>
            <Text style={{ color: '#1f2937', fontSize: 14 }}>Included dates: {(formData.includeDates || []).length}</Text>
            {(formData.includeDates || []).slice(0, 8).map((ds, i) => (
              <Text key={`inc-${i}`} style={{ color: '#4b5563', fontSize: 12 }}>• {ds}</Text>
            ))}
            {(formData.includeDates || []).length > 8 && (
              <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>…and {(formData.includeDates || []).length - 8} more</Text>
            )}
            <Text style={{ color: '#1f2937', fontSize: 12, marginTop: 4 }}>Excluded dates: {(formData.excludeDates || []).length}</Text>
            {(formData.excludeDates || []).slice(0, 8).map((ds, i) => (
              <Text key={`exc-${i}`} style={{ color: '#6b7280', fontStyle: 'italic' }}>• {ds}</Text>
            ))}
            {(formData.excludeDates || []).length > 8 && (
              <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>…and {(formData.excludeDates || []).length - 8} more</Text>
            )}
          </View>
        </View>
      </View>

      {/* Target Location */}
      {formData.verificationMethods.includes('location') && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#374151', fontWeight: '600', fontSize: 18, marginBottom: 12 }}>Target Location</Text>
          
          {/* Target Location Display with Map Preview */}
          {formData.targetLocation ? (
            <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ color: '#1f2937', fontWeight: '500', fontSize: 18, marginBottom: 8 }}>{formData.targetLocation.name}</Text>
              {formData.targetLocation.address && (
                <Text style={{ color: '#4b5563', fontSize: 14, marginTop: 4 }}>{formData.targetLocation.address}</Text>
              )}
              
              {/* Map Preview */}
              <View style={{ marginBottom: 12 }}>
                <MapPreview 
                  location={formData.targetLocation}
                  onPress={() => {
                    openLocationPicker();
                  }}
                />
              </View>
              
              <Text style={{ color: '#6b7280', fontSize: 12 }}>
                Coordinates: {formData.targetLocation.lat.toFixed(6)}, {formData.targetLocation.lng.toFixed(6)}
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 14 }}>No location selected</Text>
            </View>
          )}

          {/* Location Action Buttons */}
          <View style={{ marginTop: 12 }}>
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
      )}

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
      case 'datePicker':
        return (
          <SimpleDatePicker
            startDate={formData.duration?.startDate || null}
            endDate={formData.duration?.endDate || null}
            onStartDateChange={(date) => setFormData(prev => ({ ...prev, duration: { ...prev.duration, startDate: date } }))}
            onEndDateChange={(date) => setFormData(prev => ({ ...prev, duration: { ...prev.duration, endDate: date } }))}
            onNavigateToStep={goToStep}
            onWeeklyScheduleChange={handleWeeklyScheduleChange}
            verificationMethods={formData.verificationMethods}
            onVerificationMethodsChange={(methods) => setFormData(prev => ({ ...prev, verificationMethods: methods }))}
            lockedVerificationMethods={formData.lockedVerificationMethods || []}
            includeDates={formData.includeDates}
            excludeDates={formData.excludeDates}
            onIncludeExcludeChange={(inc: string[], exc: string[]) => setFormData(prev => ({ ...prev, includeDates: inc, excludeDates: exc }))}
            goalTitle={formData.title || aiDraft.title}
            goalRawText={rememberedPrompt || aiPrompt}
            aiSuccessCriteria={aiSuccessCriteria}
            blockingReasons={blockingReasons}
            onRequestNext={handleRequestNextFromSchedule}
            initialSelectedWeekdays={formData.weeklyWeekdays}
            initialWeeklyTimeSettings={formData.weeklySchedule}
            targetLocation={formData.targetLocation}
            onOpenLocationPicker={openLocationPicker}
            onUseCurrentLocation={handleUseCurrentLocation}
            goalSpec={goalSpec}
            loading={scheduleValidating}
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
              startDate={formData.duration?.startDate || null}
              endDate={formData.duration?.endDate || null}
              onStartDateChange={(date) => setFormData(prev => ({ ...prev, duration: { ...prev.duration, startDate: date } }))}
              onEndDateChange={(date) => setFormData(prev => ({ ...prev, duration: { ...prev.duration, endDate: date } }))}
              onNavigateToStep={goToStep}
              onWeeklyScheduleChange={handleWeeklyScheduleChange}
              verificationMethods={formData.verificationMethods}
              onVerificationMethodsChange={(methods) => setFormData(prev => ({ ...prev, verificationMethods: methods }))}
              lockedVerificationMethods={formData.lockedVerificationMethods || []}
              includeDates={formData.includeDates}
              excludeDates={formData.excludeDates}
              onIncludeExcludeChange={(inc: string[], exc: string[]) => setFormData(prev => ({ ...prev, includeDates: inc, excludeDates: exc }))}
              goalTitle={formData.title || aiDraft.title}
              goalRawText={rememberedPrompt || aiPrompt}
              aiSuccessCriteria={aiSuccessCriteria}
              blockingReasons={blockingReasons}
              onRequestNext={handleRequestNextFromSchedule}
              initialSelectedWeekdays={formData.weeklyWeekdays}
              initialWeeklyTimeSettings={formData.weeklySchedule}
              targetLocation={formData.targetLocation}
              onOpenLocationPicker={openLocationPicker}
              onUseCurrentLocation={handleUseCurrentLocation}
              goalSpec={goalSpec}
              loading={scheduleValidating}
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
      case 'partner':
        return (
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>Partner Goal</Text>
            <PartnerPicker
              partner={aiBadgeState.partner}
              onChange={(partner) => setAiBadgeState(prev => ({ ...prev, partner }))}
            />
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
      case 1: // Schedule/Frequency/Partner
        if (aiBadgeState.type === 'schedule') {
          sections.push({ type: 'datePicker', key: 'date-picker-section' });
        } else if (aiBadgeState.type === 'frequency') {
          sections.push({ type: 'frequency', key: 'frequency-section' });
        } else if (aiBadgeState.type === 'partner') {
          sections.push({ type: 'partner', key: 'partner-section' });
        } else {
          // Fallback to datePicker for unknown types
          sections.push({ type: 'datePicker', key: 'date-picker-section' });
        }
        break;
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

    return sections;
  };

  // Next step handler - must validate schedule before proceeding
  const onNext = useCallback(() => {
    // Always validate schedule before proceeding to next step
    handleRequestNextFromSchedule();
  }, [handleRequestNextFromSchedule]);

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
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#dbeafe' }}>
                    <Text style={{ color: '#1e40af', fontSize: 12, fontWeight: '600' }}>
                      {aiBadgeState.type?.toUpperCase() || 'UNKNOWN'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: '#4b5563', fontSize: 14 }}>
                  {aiBadgeState.type === 'schedule' && 'This goal will be tracked on a fixed schedule.'}
                  {aiBadgeState.type === 'frequency' && 'This goal will be tracked by weekly frequency.'}
                  {aiBadgeState.type === 'partner' && 'This goal will be verified by your partner\'s approval.'}
                </Text>
              </View>

              {/* Verification Plan Details */}
              {(() => {
                const plan = computeVerificationPlan(aiBadgeState.type || 'frequency', aiBadgeState);
                return (
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>Methods:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                      {plan.methods.length === 0 ? (
                        <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#f3f4f6' }}>
                          <Text style={{ color: '#6b7280', fontSize: 12 }}>None selected</Text>
                        </View>
                      ) : plan.methods.map(m => (
                        <View key={m} style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#dbeafe' }}>
                          <Text style={{ color: '#1e40af', fontSize: 12, fontWeight: '600' }}>{m}</Text>
                        </View>
                      ))}
                    </View>
                    
                    {plan.mandatory.length > 0 && (
                      <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>
                        Mandatory: {plan.mandatory.join(', ')}
                      </Text>
                    )}
                    
                    {plan.reason && (
                      <View style={{ marginTop: 12, padding: 12, backgroundColor: '#eff6ff', borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' }}>
                        <Text style={{ color: '#1e40af', fontSize: 14 }}>{plan.reason}</Text>
                      </View>
                    )}

                    {/* Partner Recommendation */}
                    {plan.partnerRecommended && aiBadgeState.type !== 'partner' && (
                      <View style={{ marginTop: 16, padding: 12, backgroundColor: '#fef3c7', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b' }}>
                        <Text style={{ color: '#92400e', fontSize: 14, marginBottom: 8 }}>
                          Your current selections may not be sufficient. You can proceed with{' '}
                          <Text style={{ fontWeight: '600' }}>Partner approval</Text> instead.
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setAiBadgeState(prev => ({ ...prev, type: 'partner', typeLockedByUser: true }));
                            setShowSpecPlanModal(false);
                          }}
                          style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#f59e0b', borderRadius: 6, alignSelf: 'flex-start' }}
                        >
                          <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Use Partner instead</Text>
                        </TouchableOpacity>
                      </View>
                    )}
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
                      const timezone = 'Asia/Seoul';
                      const locale = 'ko-KR';
                      
                      const refined = await AIService.compileGoalSpec({
                        prompt: originalPrompt,
                        title,
                        timezone,
                        locale,
                        targetLocationName: specFollowUpAnswer.trim()
                      });
                      
                      if (refined && typeof refined === 'object' && refined.verification && refined.schedule) {
                        setGoalSpec(refined);
                        
                        // Post-process verification methods
                        const initialMethods = Array.isArray(refined.verification?.methods) ? refined.verification.methods : [];
                        const initialMandatory = Array.isArray(refined.verification?.mandatory) ? refined.verification.mandatory : [];
                        const processed = postProcessVerificationMethods(refined, initialMethods, initialMandatory, originalPrompt);
                        
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
                        goToStep(1);
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
                  
                  // AI GoalSpec 처리 로직 (기존 기능 복원)
                  if (goalSpec && aiDraft.title) {
                    try {
                      setGoalSpecLoading(true);
                      
                      // Post-process verification methods to enforce requirements
                      const initialMethods = Array.isArray(goalSpec.verification?.methods) ? goalSpec.verification.methods : [];
                      const initialMandatory = Array.isArray(goalSpec.verification?.mandatory) ? goalSpec.verification.mandatory : [];
                      const processed = postProcessVerificationMethods(goalSpec, initialMethods, initialMandatory, aiPrompt.trim());
                      
                      // Update the spec with processed methods
                      const updatedGoalSpec = {
                        ...goalSpec,
                        verification: {
                          ...goalSpec.verification,
                          methods: processed.methods,
                          mandatory: processed.mandatory,
                          sufficiency: processed.sufficiency
                        }
                      };
                      
                      setGoalSpec(updatedGoalSpec);
                      
                      // Show processed results to user
                      setAiAnalyzedMethods(processed.methods);
                      setAiMandatoryMethods(processed.mandatory);
                      setAiVerificationSummary(updatedGoalSpec.verification?.rationale || '');
                      
                      // Check sufficiency before proceeding
                      if (!processed.sufficiency) {
                        Alert.alert(
                          'Insufficient Verification',
                          'This goal cannot be sufficiently proven with the authentication methods currently available. (One of Location/Photo/ScreenTime is required.)',
                          [{ text: 'OK' }]
                        );
                        return;
                      }

                      // Handle missing fields from post-processing
                      if (processed.missingFields && processed.missingFields.length > 0) {
                        // Update the spec with missing fields
                        if (!updatedGoalSpec.missingFields) updatedGoalSpec.missingFields = [];
                        updatedGoalSpec.missingFields = [...new Set([...updatedGoalSpec.missingFields, ...processed.missingFields])];
                        
                        // Set follow-up question if provided
                        if (processed.followUpQuestion) {
                          setSpecFollowUpQuestion(processed.followUpQuestion);
                          setSpecFollowUpAnswer('');
                          setShowSpecPlanModal(true); // Reopen modal for follow-up
                          return;
                        }
                      }
                      
                      // Proceed only if schedule doesn't require disambiguation
                      if (updatedGoalSpec.schedule?.requiresDisambiguation && updatedGoalSpec.schedule?.followUpQuestion) {
                        setSpecFollowUpQuestion(updatedGoalSpec.schedule.followUpQuestion);
                        setSpecFollowUpAnswer('');
                        setShowSpecPlanModal(true); // Reopen modal for follow-up
                        return;
                      }
                      
                    } catch (e) {
                      console.error('AI GoalSpec processing error:', e);
                      Alert.alert('AI Error', 'Failed to process GoalSpec. Please try again.');
                      return;
                    } finally {
                      setGoalSpecLoading(false);
                    }
                  }
                  
                  // 타입에 맞는 다음 단계로 이동
                  goToStep(1);
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
                console.log('[CreateGoal] payload', aiBadgeState);
                if (ok) {
                  handleSubmit();
                }
              }}
              disabled={loading || state.step !== 2 || !ok}
              style={[
                { padding: 12, borderRadius: 8 },
                loading || state.step !== 2 || !ok ? { backgroundColor: '#e5e7eb' } : { backgroundColor: '#2563eb' }
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

        {/* Main content using FlatList to avoid VirtualizedList nesting */}
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

          {/* Use LocationSearch component instead of custom implementation */}
          <LocationSearch
            onLocationSelect={(location) => {
              console.log('[CreateGoalModal] LocationSearch selected location:', location);
              // Convert Location type to TargetLocation type
              const targetLocation: TargetLocation = {
                name: location.name,
                lat: location.latitude,
                lng: location.longitude,
                address: location.address,
                placeId: location.placeId
              };
              console.log('[CreateGoalModal] Converted to TargetLocation:', targetLocation);
              setPickerSelectedLocation(targetLocation);
              setPickerMarkers([{ lat: targetLocation.lat, lng: targetLocation.lng, title: targetLocation.name }]);
            }}
            placeholder="Search Places"
            currentLocation={pickerSelectedLocation ? {
              name: pickerSelectedLocation.name,
              latitude: pickerSelectedLocation.lat,
              longitude: pickerSelectedLocation.lng,
              address: pickerSelectedLocation.address,
              placeId: pickerSelectedLocation.placeId
            } : null}
          />

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
    </Modal>
  );
}

export default function CreateGoalModal({ visible, onClose, onGoalCreated }: CreateGoalModalProps) {
  return (
    <CreateGoalProvider>
      <CreateGoalModalContent 
        visible={visible} 
        onClose={onClose} 
        onGoalCreated={onGoalCreated} 
      />
    </CreateGoalProvider>
  );
}