// Modal component for creating new goals with optimistic UI and performance optimizations

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Categories } from '../constants';
import { CreateGoalProvider, useCreateGoal } from '../features/createGoal/state';
import { AIGoalDraft, mergeAIGoal, updateDraftWithDates, validateAIGoal } from '../features/goals/aiDraft';
import { useAuth } from '../hooks/useAuth';
import { AIService } from '../services/ai';
import { GoalService } from '../services/goalService';
import { getPlaceDetails } from '../services/places';
import { CreateGoalForm, GoalDuration, GoalFrequency, TargetLocation, VerificationType } from '../types';
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
  
  // Debug navigation state
  useEffect(() => {
    console.log('[NAV] available screens:', navigation.getState()?.routeNames);
  }, [navigation]);
  
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
  // Pre-schedule verification confirmation
  const [showVerificationConfirm, setShowVerificationConfirm] = useState(false);
  const [aiAnalyzedMethods, setAiAnalyzedMethods] = useState<VerificationType[]>([] as any);
  const [aiMandatoryMethods, setAiMandatoryMethods] = useState<VerificationType[]>([] as any);
  const [aiVerificationSummary, setAiVerificationSummary] = useState('');

  // Utility: check if verification methods provide objective proof beyond manual
  const isVerificationSufficient = (methods: VerificationType[]) => {
    const objective: VerificationType[] = ['location', 'time', 'photo', 'screentime'] as any;
    return (methods || []).some((m) => (objective as any).includes(m));
  };

  // Reusable: analyze and open verification plan modal
  const analyzeAndOpenVerificationPlan = async () => {
    try {
      const promptSource = rememberedPrompt || aiPrompt || aiDraft.title || formData.title || '';
      const { methods, mandatory, usedFallback } = await AIService.analyzeVerificationMethods({
        prompt: promptSource,
        targetLocationName: formData.targetLocation?.name || (aiDraft as any).targetLocation?.name,
        placeId: (aiDraft as any).targetLocation?.placeId,
        locale: 'ko-KR',
        timezone: 'Asia/Seoul'
      });
      const allowed: VerificationType[] = ['location','time','screentime','photo','manual'] as any;
      const cleanMethods = (methods || []).filter((m: any) => (allowed as any).includes(m)) as VerificationType[];
      const cleanMandatory = (mandatory || []).filter((m: any) => (allowed as any).includes(m)) as VerificationType[];
      if (!cleanMethods.length || !isVerificationSufficient(cleanMethods)) {
        Alert.alert('Unsupported Goal', 'This goal cannot be created because it cannot be sufficiently verified with the available methods.');
        return;
      }
      if (usedFallback) {
        Alert.alert('AI Notice', 'AI 분석 실패 → heuristic fallback 사용됨. 개발 로그를 확인하세요.');
        console.warn('[AI] analyzeVerificationMethods used heuristic fallback');
      }
      setAiAnalyzedMethods(cleanMethods as any);
      setAiMandatoryMethods(cleanMandatory as any);
      const summaryResp = await AIService.explainSuccessCriteria({
        title: aiDraft.title || formData.title,
        verificationMethods: cleanMethods as any,
        weeklyWeekdays: [], weeklyTimeSettings: {}, includeDates: [], excludeDates: [],
        targetLocationName: formData.targetLocation?.name || (aiDraft as any).targetLocation?.name
      } as any);
      setAiVerificationSummary(summaryResp.summary);
      setShowVerificationConfirm(true);
    } catch {
      Alert.alert('AI Error', 'Failed to analyze verification methods. Please try again.');
    }
  };
  const [selectedCategory, setSelectedCategory] = useState(0); // 0 for all
  const [filteredExamples, setFilteredExamples] = useState<string[]>(AIService.getExamplePrompts());
  const [weeklyScheduleData, setWeeklyScheduleData] = useState<{
    weekdays: Set<number>;
    timeSettings: { [key: string]: string[] };
  }>({ weekdays: new Set(), timeSettings: {} });
  

  

  // Prevent duplicate AI verification application
  const aiVerificationAppliedRef = useRef(false);

  // State for location picker
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerSelectedLocation, setPickerSelectedLocation] = useState<TargetLocation | null>(null);
  const [pickerMarkers, setPickerMarkers] = useState<Array<{ lat: number; lng: number; title?: string }>>([]);
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
  const handleWeeklyScheduleChange = useCallback((weekdays: Set<number>, timeSettings: { [key: string]: string[] }) => {
    console.log('[CreateGoalModal] Weekly schedule change received:', { weekdays: Array.from(weekdays), timeSettings });
    setWeeklyScheduleData({ weekdays, timeSettings });
    // Keep a simple flag on form data; detailed schedule will be saved later alongside this state
    setFormData(prev => ({ 
      ...prev, 
      needsWeeklySchedule: weekdays.size > 0,
      weeklyWeekdays: Array.from(weekdays),
      weeklySchedule: timeSettings
    }));
    // Enforce mandatory method based on weekly schedule selection
    setFormData(prev => {
      const selectedDays = Array.from(weekdays);
      const hasAnyTimes = selectedDays.some(d => (timeSettings?.[d] || []).length > 0);
      const hasDayWithoutTimes = selectedDays.some(d => !(timeSettings?.[d]) || (timeSettings?.[d] || []).length === 0);

      const nextLocked = new Set([...(prev.lockedVerificationMethods || [])]);
      const nextSelected = new Set([...(prev.verificationMethods || [])]);

      if (weekdays.size === 0) {
        // No weekly schedule -> remove forced time/manual locks
        nextLocked.delete('time' as any);
        nextLocked.delete('manual' as any);
      } else if (hasAnyTimes && hasDayWithoutTimes) {
        // Mixed: some days have times, some don't -> lock both
        nextLocked.add('time' as any);
        nextLocked.add('manual' as any);
        nextSelected.add('time' as any);
        nextSelected.add('manual' as any);
      } else if (hasAnyTimes && !hasDayWithoutTimes) {
        // All selected days have times -> lock time only
        nextLocked.add('time' as any);
        nextLocked.delete('manual' as any);
        nextSelected.add('time' as any);
      } else {
        // No times but weekdays selected -> lock manual only
        nextLocked.add('manual' as any);
        nextLocked.delete('time' as any);
        nextSelected.add('manual' as any);
      }

      return {
        ...prev,
        lockedVerificationMethods: Array.from(nextLocked) as any,
        verificationMethods: Array.from(nextSelected) as any
      };
    });
    if (aiDraft.title) {
      setAiDraft(prev => ({ ...prev, needsWeeklySchedule: weekdays.size > 0 }));
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

  // Confirm verification plan: apply locks and proceed
  const handleConfirmVerificationPlan = () => {
    // Merge selected + lock mandatory
    setFormData(prev => {
      const merged = new Set([...(prev.verificationMethods || []), ...aiAnalyzedMethods as any, ...aiMandatoryMethods as any]);
      const locked = new Set([...(prev.lockedVerificationMethods || []), ...aiMandatoryMethods as any]);
      // Client-side guard: if targetLocation exists, force-add and lock location
      const hasTargetLoc = !!(prev.targetLocation && (prev.targetLocation.placeId || prev.targetLocation.name));
      if (hasTargetLoc) {
        merged.add('location' as any);
        locked.add('location' as any);
      }
      return {
        ...prev,
        verificationMethods: Array.from(merged) as any,
        lockedVerificationMethods: Array.from(locked) as any,
      };
    });
    setShowVerificationConfirm(false);
    setAppState('READY_TO_REVIEW');
    goToStep(1);
  };

  // Ensure AI mandatory verification methods are selected and locked
  const ensureAIMandatoryVerifications = useCallback(async () => {
    try {
      setAiVerificationLoading(true);
      const promptSource = rememberedPrompt || aiPrompt || aiDraft.title || formData.title || '';
      if (!promptSource) return;
      const { methods, mandatory } = await AIService.analyzeVerificationMethods(promptSource);
      setFormData(prev => {
        const merged = new Set([...(prev.verificationMethods || []), ...(methods || []), ...(mandatory || [])]);
        const locked = new Set([...(prev.lockedVerificationMethods || []), ...(mandatory || [])]);
        // If we already have a place, ensure 'location' is selected (locking already handled by mandatory)
        const loc = prev.targetLocation || aiDraft.targetLocation;
        const hasPlaceInfo = !!(loc && ((loc as any).placeId || (loc as any).name));
        if (hasPlaceInfo) {
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
    } catch (e) {
      // Ignore AI failure, keep current
      console.warn('[CreateGoalModal] analyzeVerificationMethods failed, skipping lock');
    } finally {
      setAiVerificationLoading(false);
    }
  }, [rememberedPrompt, aiPrompt, aiDraft.title, aiDraft.verificationMethods, aiDraft.targetLocation, formData.title]);

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
    setWeeklyScheduleData({ weekdays: new Set(), timeSettings: {} });
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

  // Next request from Schedule with AI gating
  const handleRequestNextFromSchedule = () => {
    if (!scheduleReady) {
      Alert.alert('Schedule Needed', (blockingReasons && blockingReasons.length) ? blockingReasons.join('\n') : 'Please add schedule days on the calendar.');
      return;
    }
    goToStep(2);
  };

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
    actions.reset();
    setAppState('IDLE');
  };

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
        aiResult = await AIService.generateGoalFromText(aiPrompt.trim());
        setAiContext({
          conversationHistory: [
            { role: 'user', content: aiPrompt.trim() }
          ],
          partialGoal: aiResult
        });
        // Prefill any available schedule/method hints into form even before full validation
        applyAIToFormPartial(mergeAIGoal(aiDraft, aiResult));
      } else {
        // Follow-up refinement
        console.log('[CreateGoalModal] AI refinement');
        aiResult = await AIService.continueGoalRefinement(aiContext, aiPrompt.trim());
        setAiContext((prev: any) => ({
          ...prev,
          conversationHistory: [
            ...prev.conversationHistory,
            { role: 'user', content: aiPrompt.trim() },
            { role: 'assistant', content: JSON.stringify(aiResult) }
          ],
          partialGoal: aiResult
        }));
        applyAIToFormPartial(mergeAIGoal(aiDraft, aiResult));
      }

      console.log('[CreateGoalModal] AI result:', aiResult);

      // Merge AI result into draft
      const updatedDraft = mergeAIGoal(aiDraft, aiResult);
      setAiDraft(updatedDraft);

      // Validate and determine next state
      const validation = validateAIGoal(updatedDraft);
      console.log('[CreateGoalModal] Validation result:', validation);

      if (validation.needsDatePicker) {
        // Proceed by confirming verification plan first; schedule will be set in step 2
        setFollowUpQuestion('');
        try {
          const promptSource = rememberedPrompt || aiPrompt || updatedDraft.title || aiDraft.title || formData.title || '';
          const { methods, mandatory } = await AIService.analyzeVerificationMethods(promptSource);
          const allowed: VerificationType[] = ['location','time','screentime','photo','manual'] as any;
          const cleanMethods = (methods || []).filter((m: any) => (allowed as any).includes(m));
          const cleanMandatory = (mandatory || []).filter((m: any) => (allowed as any).includes(m));
          if (!cleanMethods.length) {
            Alert.alert('Unsupported Goal', 'This goal cannot be verified with the available methods. Please refine your goal.');
            setLoading(false);
            setAppState('IDLE');
            console.timeEnd('[CreateGoalModal] AI Generation');
            return;
          }
          setAiAnalyzedMethods(cleanMethods as any);
          setAiMandatoryMethods(cleanMandatory as any);
          const summaryResp = await AIService.explainSuccessCriteria({
            title: updatedDraft.title || formData.title,
            verificationMethods: cleanMethods as any,
            weeklyWeekdays: [], weeklyTimeSettings: {}, includeDates: [], excludeDates: [],
            targetLocationName: formData.targetLocation?.name || (aiDraft as any).targetLocation?.name
          } as any);
          setAiVerificationSummary(summaryResp.summary);
          setShowVerificationConfirm(true);
        } catch {
          setAiAnalyzedMethods([] as any);
          setAiMandatoryMethods([] as any);
          setAiVerificationSummary('');
          setShowVerificationConfirm(true);
        }
      } else if (validation.missingFields && validation.missingFields.length > 0) {
        if (validation.missingFields.includes('targetLocation')) {
          setFollowUpQuestion(validation.followUpQuestion || 'Please select a location for your goal.');
          setAppState('NEEDS_LOCATION');
        } else {
          setFollowUpQuestion('');
          setAppState('READY_TO_REVIEW');
          goToStep(1);
        }
      } else {
        // All fields complete: analyze verification and confirm before proceeding
        await analyzeAndOpenVerificationPlan();
      }

      // Clear AI prompt after processing
      setAiPrompt('');

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
    // Block save if schedule is not ready per AI evaluation
    const readyEval = AIService.evaluateScheduleReadiness({
      startDateISO: formData.duration?.startDate || aiDraft.startDate || undefined,
      endDateISO: formData.duration?.endDate || aiDraft.duration?.endDate || undefined,
      weeklyWeekdays: formData.weeklyWeekdays || [],
      includeDates: formData.includeDates || [],
      excludeDates: formData.excludeDates || [],
      verificationMethods: formData.verificationMethods as any,
      targetLocationName: formData.targetLocation?.name,
    });
    if (!readyEval.ready) {
      Alert.alert('Schedule Needed', (readyEval.reasons && readyEval.reasons.length) ? readyEval.reasons.join('\n') : 'Please add schedule days on the calendar.');
      actions.setStep(1);
      return;
    }
    if (!user) {
      Alert.alert('Error', 'You must be signed in to create goals.');
      return;
    }

    console.time('[CreateGoalModal] Goal Creation - Single Phase');
    try {
      setAppState('SAVING');
      setLoading(true);

      // Build payload with safe defaults
      const goalData = {
        ...formData,
        title: (formData.title && formData.title.trim()) || aiDraft.title || 'New Goal',
        category: formData.category || 'Personal',
        frequency: formData.frequency || { count: 1, unit: 'per_day' },
        duration: formData.duration || { type: 'weeks', value: 2 },
        verificationMethods: (formData.verificationMethods?.length ? formData.verificationMethods : ['manual']) as any,
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Ensure schedule-related fields are present
        needsWeeklySchedule: formData.needsWeeklySchedule,
        weeklySchedule: formData.weeklySchedule,
        weeklyWeekdays: formData.weeklyWeekdays,
        includeDates: formData.includeDates,
        excludeDates: formData.excludeDates,
      };

      console.log('[CreateGoalModal] Saving goal (single phase):', goalData);
      // Fire-and-forget save to avoid blocking the UI
      GoalService.createGoal(goalData)
        .then(() => console.log('[CreateGoalModal] Goal saved successfully'))
        .catch((err) => {
          console.error('[CreateGoalModal] Goal creation failed (background):', err);
          Alert.alert('Error', 'Failed to create goal in background. Please check your connection.');
        })
        .finally(() => {
          console.timeEnd('[CreateGoalModal] Goal Creation - Single Phase');
        });

      if (mountedRef.current) {
        setAppState('SAVED_OPTIMISTIC');
        setLoading(false);
        handleClose();
        onGoalCreated();
      }
    } catch (error) {
      console.error('[CreateGoalModal] Goal creation failed:', error);
      Alert.alert('Error', 'Failed to create goal. Please try again.');
      if (mountedRef.current) {
        setLoading(false);
        setAppState('READY_TO_REVIEW');
      }
    } finally {
      // timing ended in the background finally for accuracy
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
        <View className="mb-3">
          <Text className="text-blue-700 text-xs mb-2">Selected:</Text>
          <View className="flex-row flex-wrap gap-2">
            {aiDraft.startDate && (
              <View className="bg-blue-100 rounded-full px-3 py-1">
                <Text className="text-blue-800 text-xs font-semibold">
                  Start: {new Date(aiDraft.startDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            {aiDraft.duration?.endDate && (
              <View className="bg-blue-100 rounded-full px-3 py-1">
                <Text className="text-blue-800 text-xs font-semibold">
                  End: {new Date(aiDraft.duration.endDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            {aiDraft.duration?.type && aiDraft.duration?.value && (
              <View className="bg-green-100 rounded-full px-3 py-1">
                <Text className="text-green-800 text-xs font-semibold">
                  Duration: {aiDraft.duration.value} {aiDraft.duration.type}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

        <TextInput
          className="bg-white rounded-lg px-3 py-3 border border-blue-200 text-gray-900"
          placeholder={"Describe your goal (e.g., 'Go to the gym 3 times a week')"}
          placeholderTextColor="#9CA3AF"
          value={aiPrompt}
          onChangeText={setAiPrompt}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 80 }}
          editable={!loading}
        />

        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        <TouchableOpacity
          onPress={() => {
            if (loading) return;
            if (appState === 'IDLE') {
              handleAiGeneration();
            } else {
              goToStep(1);
            }
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
            {loading ? 'Generating...' : (appState === 'IDLE' ? 'Generate with AI' : 'Next: Schedule')}
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
        <View className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Text className="text-blue-700 text-sm">Analyzing verification methods with AI...</Text>
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
        onIncludeExcludeChange={(inc, exc) => setFormData(prev => ({ ...prev, includeDates: inc, excludeDates: exc }))}
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
      <View className="mb-3">
        <Text className="text-gray-700 font-semibold mb-2">Target Location</Text>
        {formData.targetLocation ? (
          <View className="bg-white rounded-lg p-3 border border-gray-300">
            <Text className="text-gray-800 font-medium">{formData.targetLocation.name}</Text>
            {formData.targetLocation.address && (
              <Text className="text-gray-600 text-sm mt-1">{formData.targetLocation.address}</Text>
            )}
            <Text className="text-gray-500 text-xs mt-1">
              {formData.targetLocation.lat.toFixed(6)}, {formData.targetLocation.lng.toFixed(6)}
            </Text>
          </View>
        ) : (
          <Text className="text-gray-500 italic">Not set</Text>
        )}
      </View>

      {/* Location Action Buttons */}
      <View className="flex-row space-x-3">
        <TouchableOpacity
          className="flex-1 bg-blue-500 rounded-lg p-3 flex-row items-center justify-center"
          onPress={openLocationPicker}
        >
          <Ionicons name="search" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">Search</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          className="flex-1 bg-green-500 rounded-lg p-3 flex-row items-center justify-center"
          onPress={handleUseCurrentLocation}
        >
          <Ionicons name="location" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">Current Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderManualFormSection = () => (
    <View>
      {/* Review Header */}
      <View className="mb-6">
        <Text className="text-xl font-bold text-gray-800 mb-2">Review Your Goal</Text>
        <Text className="text-gray-600">Review and confirm your goal details before saving</Text>
      </View>

      {/* Basic Information */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-700 font-semibold text-lg">Basic Information</Text>
          <TouchableOpacity 
            onPress={() => actions.setStep(0)}
            className="flex-row items-center px-3 py-1 bg-blue-50 rounded-lg"
          >
            <Ionicons name="create-outline" size={16} color="#2563EB" />
            <Text className="text-blue-600 text-sm ml-1">Edit</Text>
          </TouchableOpacity>
        </View>
        
        <View className="bg-white rounded-lg p-4 border border-gray-200">
          <Text className="text-gray-800 font-medium text-lg mb-2">{formData.title || 'Not set'}</Text>
          {formData.description && (
            <Text className="text-gray-600 mb-2">{formData.description}</Text>
          )}
          <Text className="text-gray-500 text-sm">Category: {formData.category}</Text>
        </View>
      </View>

      {/* Schedule Information */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-700 font-semibold text-lg">Schedule</Text>
          <TouchableOpacity 
            onPress={() => actions.setStep(1)}
            className="flex-row items-center px-3 py-1 bg-blue-50 rounded-lg"
          >
            <Ionicons name="create-outline" size={16} color="#2563EB" />
            <Text className="text-blue-600 text-sm ml-1">Edit</Text>
          </TouchableOpacity>
        </View>
        
        <View className="bg-white rounded-lg p-4 border border-gray-200">
          {/* Duration/Frequency removed per request */}
          {formData.startDate && (
            <Text className="text-gray-800">
              <Text className="font-medium">Start Date:</Text> {new Date(formData.startDate).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {/* Verification Methods */}
      <View className="mb-6">
        <Text className="text-gray-700 font-semibold text-lg mb-3">Verification Methods</Text>
        <View className="flex-row flex-wrap gap-2">
          {formData.verificationMethods.length > 0 ? (
            formData.verificationMethods.map((method) => (
              <View key={method} className="px-3 py-2 bg-blue-100 rounded-lg">
                <Text className="text-blue-800 text-sm font-medium">
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-gray-500 italic">No verification methods selected</Text>
          )}
        </View>
      </View>

      {/* Verification Plan Summary */}
      <View className="mb-6">
        <Text className="text-gray-700 font-semibold text-lg mb-3">Verification Plan Summary</Text>
        <View className="bg-white rounded-lg p-4 border border-gray-200">
          {/* One-line AI summary if available */}
          {aiSuccessCriteria ? (
            <Text className="text-gray-800 mb-3">{aiSuccessCriteria}</Text>
          ) : (
            <Text className="text-gray-500 mb-3">Summary will appear based on your configured methods and schedule.</Text>
          )}

          {/* Methods with lock indicators */}
          <View className="mb-3">
            <Text className="text-gray-700 font-semibold mb-2">Methods</Text>
            <View className="flex-row flex-wrap gap-2">
              {(formData.verificationMethods || []).map((m) => {
                const locked = (formData.lockedVerificationMethods || []).includes(m as any);
                return (
                  <View key={m} className={`px-3 py-1 rounded-full flex-row items-center ${locked ? 'bg-blue-800' : 'bg-blue-100'}`}>
                    {locked && <Ionicons name="lock-closed" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                    <Text className={`${locked ? 'text-white' : 'text-blue-800'} text-xs font-semibold`}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Schedule overview */}
          <View>
            <Text className="text-gray-700 font-semibold mb-2">Schedule</Text>
            {formData.duration?.startDate || formData.duration?.endDate ? (
              <Text className="text-gray-700 text-sm mb-1">
                {formData.duration?.startDate ? `Start: ${new Date(formData.duration.startDate).toLocaleDateString()}` : ''}
                {formData.duration?.endDate ? `  End: ${new Date(formData.duration.endDate).toLocaleDateString()}` : ''}
              </Text>
            ) : (
              <Text className="text-gray-500 text-sm mb-1">Duration not set</Text>
            )}
            {(formData.weeklyWeekdays && formData.weeklyWeekdays.length > 0) ? (
              <View>
                {(formData.weeklyWeekdays || []).sort().map((d) => {
                  const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                  const times = (formData.weeklySchedule as any)?.[d] || [];
                  const timeText = Array.isArray(times) && times.length > 0 ? (times as string[]).join(', ') : 'No time set';
                  return (
                    <Text key={d} className="text-gray-700 text-sm">{dayShort[d]}: {timeText}</Text>
                  );
                })}
              </View>
            ) : (
              <Text className="text-gray-500 text-sm">Weekly schedule not set</Text>
            )}
          </View>
        </View>
      </View>

      {/* Full Plan Overview - consolidate every relevant detail */}
      <View className="mb-6">
        <Text className="text-gray-700 font-semibold text-lg mb-3">Full Plan Overview</Text>
        <View className="bg-white rounded-lg p-4 border border-gray-200">
          {/* Goal info */}
          <Text className="text-gray-800 text-sm mb-1"><Text className="font-semibold">Goal:</Text> {formData.title || 'Not set'}</Text>
          {!!formData.description && (
            <Text className="text-gray-600 text-xs mb-2">{formData.description}</Text>
          )}

          {/* Verification methods and mandatory */}
          <View className="mt-2">
            <Text className="text-gray-800 text-sm font-semibold mb-1">Verification Methods</Text>
            <View className="flex-row flex-wrap gap-2">
              {(formData.verificationMethods || []).map((m) => (
                <View key={m} className="px-2 py-1 rounded-full bg-blue-100">
                  <Text className="text-blue-800 text-xs font-semibold">{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                </View>
              ))}
              {(formData.verificationMethods || []).length === 0 && (
                <Text className="text-gray-500 text-xs">None</Text>
              )}
            </View>
            <Text className="text-gray-700 text-xs mt-2"><Text className="font-semibold">Mandatory (Locked):</Text> {(formData.lockedVerificationMethods || []).length > 0 ? (formData.lockedVerificationMethods as any).map((m: string) => m.charAt(0).toUpperCase() + m.slice(1)).join(', ') : 'None'}</Text>
          </View>

          {/* Target Location */}
          <View className="mt-3">
            <Text className="text-gray-800 text-sm font-semibold mb-1">Target Location</Text>
            {formData.targetLocation ? (
              <View>
                <Text className="text-gray-800 text-sm">{formData.targetLocation.name}</Text>
                {!!formData.targetLocation.address && (
                  <Text className="text-gray-600 text-xs">{formData.targetLocation.address}</Text>
                )}
                <Text className="text-gray-500 text-xs">{formData.targetLocation.lat?.toFixed(6)}, {formData.targetLocation.lng?.toFixed(6)}</Text>
              </View>
            ) : (
              <Text className="text-gray-500 text-xs">Not set</Text>
            )}
          </View>

          {/* Frequency */}
          <View className="mt-3">
            <Text className="text-gray-800 text-sm font-semibold mb-1">Frequency</Text>
            <Text className="text-gray-700 text-sm">{formData.frequency?.count || 0} per {formData.frequency?.unit?.replace('per_', '') || 'day'}</Text>
          </View>

          {/* Duration */}
          <View className="mt-3">
            <Text className="text-gray-800 text-sm font-semibold mb-1">Duration</Text>
            {formData.duration?.startDate || formData.duration?.endDate ? (
              <Text className="text-gray-700 text-sm">
                {formData.duration?.startDate ? `Start: ${new Date(formData.duration.startDate).toLocaleDateString()}` : ''}
                {formData.duration?.endDate ? `  End: ${new Date(formData.duration.endDate).toLocaleDateString()}` : ''}
              </Text>
            ) : (
              <Text className="text-gray-500 text-sm">Not set</Text>
            )}
          </View>

          {/* Weekly Schedule */}
          <View className="mt-3">
            <Text className="text-gray-800 text-sm font-semibold mb-1">Weekly Schedule</Text>
            {(formData.weeklyWeekdays && formData.weeklyWeekdays.length > 0) ? (
              <View>
                {(formData.weeklyWeekdays || []).sort().map((d) => {
                  const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                  const times = (formData.weeklySchedule as any)?.[d] || [];
                  const timeText = Array.isArray(times) && times.length > 0 ? (times as string[]).join(', ') : 'No time set';
                  return (
                    <Text key={d} className="text-gray-700 text-sm">{dayShort[d]}: {timeText}</Text>
                  );
                })}
              </View>
            ) : (
              <Text className="text-gray-500 text-sm">Not set</Text>
            )}
          </View>

          {/* Per-day overrides */}
          <View className="mt-3">
            <Text className="text-gray-800 text-sm font-semibold mb-1">Per-day Overrides</Text>
            <Text className="text-gray-700 text-xs">Included dates: {(formData.includeDates || []).length}</Text>
            {(formData.includeDates || []).slice(0, 8).map((ds, i) => (
              <Text key={`inc-${i}`} className="text-gray-600 text-xs">• {ds}</Text>
            ))}
            {(formData.includeDates || []).length > 8 && (
              <Text className="text-gray-500 text-xs">…and {(formData.includeDates || []).length - 8} more</Text>
            )}
            <Text className="text-gray-700 text-xs mt-2">Excluded dates: {(formData.excludeDates || []).length}</Text>
            {(formData.excludeDates || []).slice(0, 8).map((ds, i) => (
              <Text key={`exc-${i}`} className="text-gray-600 text-xs">• {ds}</Text>
            ))}
            {(formData.excludeDates || []).length > 8 && (
              <Text className="text-gray-500 text-xs">…and {(formData.excludeDates || []).length - 8} more</Text>
            )}
          </View>
        </View>
      </View>

      {/* Target Location */}
      {formData.verificationMethods.includes('location') && (
        <View className="mb-6">
          <Text className="text-gray-700 font-semibold text-lg mb-3">Target Location</Text>
          
          {/* Target Location Display with Map Preview */}
          {formData.targetLocation ? (
            <View className="bg-white rounded-lg p-4 border border-gray-200 mb-3">
              <Text className="text-gray-800 font-medium text-lg mb-2">{formData.targetLocation.name}</Text>
              {formData.targetLocation.address && (
                <Text className="text-gray-600 text-sm mb-2">{formData.targetLocation.address}</Text>
              )}
              
              {/* Map Preview */}
              <View className="h-32 bg-gray-100 rounded-lg overflow-hidden mb-3">
                <MapPreview 
                  location={formData.targetLocation}
                  onPress={() => {
                    openLocationPicker();
                  }}
                />
              </View>
              
              <Text className="text-gray-500 text-xs">
                Coordinates: {formData.targetLocation.lat.toFixed(6)}, {formData.targetLocation.lng.toFixed(6)}
              </Text>
            </View>
          ) : (
            <View className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-3">
              <Text className="text-gray-500 italic text-center">No location selected</Text>
            </View>
          )}

          {/* Location Action Buttons */}
          <View className="flex-row space-x-3">
            <TouchableOpacity
              className="flex-1 bg-blue-500 rounded-lg p-3 flex-row items-center justify-center"
              onPress={openLocationPicker}
            >
              <Ionicons name="search" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Search</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="flex-1 bg-green-500 rounded-lg p-3 flex-row items-center justify-center"
              onPress={handleUseCurrentLocation}
            >
              <Ionicons name="location" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Current Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Back button to go to previous step */}
      <View className="mb-6">
        <TouchableOpacity 
          className="bg-gray-200 rounded-lg p-3 flex-row items-center justify-center"
          onPress={() => actions.setStep(1)}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={16} color="#374151" />
          <Text className="text-gray-800 font-semibold ml-2">Back</Text>
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
            onIncludeExcludeChange={(inc, exc) => setFormData(prev => ({ ...prev, includeDates: inc, excludeDates: exc }))}
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
          />
        );
      case 'location':
        return renderLocationSection();
      case 'manualForm':
        return renderManualFormSection();
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
      case 1: // Schedule
        sections.push({ type: 'datePicker', key: 'date-picker-section' });
        break;
      case 2: // Review
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

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="pageSheet" 
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-gray-50">
        {/* Pre-schedule verification confirmation modal */}
        <Modal visible={showVerificationConfirm} transparent animationType="fade" onRequestClose={() => setShowVerificationConfirm(false)}>
          <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View className="bg-white mx-6 rounded-2xl p-4 shadow-lg border border-gray-200" style={{ minWidth: 300 }}>
              <Text className="text-center text-lg font-semibold text-gray-800 mb-3">Verification Plan</Text>
              {!!aiVerificationSummary && (
                <Text className="text-gray-700 text-sm mb-3 text-center">{aiVerificationSummary}</Text>
              )}
              <Text className="text-gray-800 text-sm font-semibold mb-2">Methods:</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {aiAnalyzedMethods.map((m) => (
                  <View key={m as any} className="px-3 py-1 rounded-full bg-blue-100">
                    <Text className="text-blue-800 text-xs font-semibold">{String(m)[0].toUpperCase() + String(m).slice(1)}</Text>
                  </View>
                ))}
              </View>
              {aiMandatoryMethods.length > 0 && (
                <Text className="text-red-600 text-xs mb-2">Mandatory: {aiMandatoryMethods.map(m => String(m)[0].toUpperCase() + String(m).slice(1)).join(', ')}</Text>
              )}
              <View className="flex-row space-x-3 mt-2">
                <TouchableOpacity onPress={() => setShowVerificationConfirm(false)} className="flex-1 bg-gray-200 rounded-lg py-3">
                  <Text className="text-gray-700 font-medium text-center">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmVerificationPlan} className="flex-1 bg-blue-600 rounded-lg py-3">
                  <Text className="text-white font-medium text-center">OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* Header with dynamic Save button */}
        <View className="bg-white border-b border-gray-200 px-4 py-4 pt-12">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-800">Create Goal</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || state.step !== 2}
              className={`px-4 py-2 rounded-lg ${
                loading || state.step !== 2
                  ? 'bg-gray-400' 
                  : 'bg-blue-600'
              }`}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-semibold">
                  {appState === 'SAVING' ? 'Saving...' : 'Save Goal'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Stepper Progress - Fixed position for all steps */}
          <View className="flex-row items-center justify-center mb-6">
            {STEPS.map((step, index) => (
              <TouchableOpacity
                key={step.id}
                onPress={() => goToStep(index)}
                disabled={index > state.step}
                className="flex-row items-center"
              >
                <View className="flex-col items-center">
                  <View className={`w-10 h-10 rounded-full items-center justify-center ${
                    index <= state.step ? 'bg-blue-600' : 'bg-gray-300'
                  }`}>
                    <Text className={`text-sm font-semibold ${
                      index <= state.step ? 'text-white' : 'text-gray-600'
                    }`}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text className="text-gray-600 text-xs mt-2 text-center" numberOfLines={1}>
                    {step.title}
                  </Text>
                </View>
                {/* Add spacing between steps */}
                {index < STEPS.length - 1 && <View className="w-16" />}
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Thin progress bar below stepper - 3 connected bars without circles */}
          <View className="flex-row items-center justify-center mb-6">
            <View className="flex-row items-center">
              {[0, 1, 2].map((stepIndex) => (
                <React.Fragment key={stepIndex}>
                  <View className={`w-20 h-1 ${
                    stepIndex <= state.step ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                  {stepIndex < 2 && (
                    <View className={`w-1 h-1 mx-1 rounded-full ${
                      stepIndex < state.step ? 'bg-blue-600' : 'bg-gray-300'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>

        {/* Background task progress indicator */}
        {backgroundTaskProgress && (
          <View className="bg-blue-50 border-b border-blue-200 px-4 py-2">
            <Text className="text-blue-700 text-sm text-center">{backgroundTaskProgress}</Text>
          </View>
        )}
        {state.step === 1 && aiVerificationLoading && (
          <View className="bg-blue-50 border-b border-blue-200 px-4 py-2">
            <Text className="text-blue-700 text-sm text-center">Analyzing verification methods with AI...</Text>
          </View>
        )}

        {/* Main content using FlatList to avoid VirtualizedList nesting */}
        <FlatList
          data={getSections()}
          renderItem={renderSection}
          keyExtractor={(item) => item.key}
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
        <View className="flex-1 bg-white">
          {/* Drag handle */}
          <View className="items-center pt-3 pb-2 bg-blue-600">
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' }} />
            <Text className="text-white font-semibold text-lg mt-2">Select Location</Text>
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
            placeholder="Search places (e.g., GymBox, Starbucks)"
            currentLocation={pickerSelectedLocation ? {
              name: pickerSelectedLocation.name,
              latitude: pickerSelectedLocation.lat,
              longitude: pickerSelectedLocation.lng,
              address: pickerSelectedLocation.address,
              placeId: pickerSelectedLocation.placeId
            } : null}
          />

          {/* Confirm */}
          <View className="p-4">
            <TouchableOpacity
              className="bg-blue-600 rounded-lg py-3 flex-row items-center justify-center"
              onPress={handlePickerConfirm}
              disabled={!pickerSelectedLocation}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Confirm Location</Text>
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