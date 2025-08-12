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
import { Categories } from '../constants';
import { CreateGoalProvider, useCreateGoal } from '../features/createGoal/state';
import { AIGoalDraft, mergeAIGoal, updateDraftWithDates, validateAIGoal } from '../features/goals/aiDraft';
import { useAuth } from '../hooks/useAuth';
import { AIService } from '../services/ai';
import { GoalService } from '../services/goalService';
import { getPlaceDetails, searchPlaces } from '../services/places';
import { CreateGoalForm, GoalDuration, GoalFrequency, TargetLocation } from '../types';
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
  const [selectedCategory, setSelectedCategory] = useState(0); // 0 for all
  const [filteredExamples, setFilteredExamples] = useState<string[]>(AIService.getExamplePrompts());
  const [weeklyScheduleData, setWeeklyScheduleData] = useState<{
    weekdays: Set<number>;
    timeSettings: { [key: string]: string[] };
  }>({ weekdays: new Set(), timeSettings: {} });

  // Location picker overlay state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerPredictions, setPickerPredictions] = useState<{ placeId: string; description: string }[]>([]);
  const [pickerSelectedLocation, setPickerSelectedLocation] = useState<TargetLocation | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearching, setPickerSearching] = useState(false);

  // Handle weekly schedule changes
  const handleWeeklyScheduleChange = useCallback((weekdays: Set<number>, timeSettings: { [key: string]: string[] }) => {
    console.log('[CreateGoalModal] Weekly schedule change received:', { weekdays: Array.from(weekdays), timeSettings });
    setWeeklyScheduleData({ weekdays, timeSettings });
    // Keep a simple flag on form data; detailed schedule will be saved later alongside this state
    setFormData(prev => ({ ...prev, needsWeeklySchedule: weekdays.size > 0 }));
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
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.timeEnd('[CreateGoalModal] Component Mount');
    };
  }, []);

  // Step navigation functions using context
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
          break;
        case 1: // Schedule
          setAppState('NEEDS_DATES');
          setShowDatePicker(true);
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
          break;
        case 2: // Review
          setAppState('READY_TO_REVIEW');
          setShowDatePicker(false);
          break;
      }
    }
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
      }

      console.log('[CreateGoalModal] AI result:', aiResult);

      // Merge AI result into draft
      const updatedDraft = mergeAIGoal(aiDraft, aiResult);
      setAiDraft(updatedDraft);

      // Validate and determine next state
      const validation = validateAIGoal(updatedDraft);
      console.log('[CreateGoalModal] Validation result:', validation);

      if (validation.needsDatePicker) {
        setFollowUpQuestion(validation.followUpQuestion || 'Please select your start date and duration using the calendar below.');
        setAppState('NEEDS_DATES');
        setShowDatePicker(true);
        // Automatically move to Schedule step
        actions.setStep(1);
        // Clear the follow-up question since we're moving to the next step
        setFollowUpQuestion('');
      } else if (validation.missingFields && validation.missingFields.length > 0) {
        if (validation.missingFields.includes('targetLocation')) {
          setFollowUpQuestion(validation.followUpQuestion || 'Please select a location for your goal.');
          setAppState('NEEDS_LOCATION');
        } else {
          setFollowUpQuestion(validation.followUpQuestion || 'Please provide additional information.');
          setAppState('NEEDS_INFO');
        }
      } else {
        // All fields complete, update form and move to review
        updateFormFromAI(updatedDraft);
        setAppState('READY_TO_REVIEW');
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

    setFormData(updatedForm);
    console.timeEnd('[CreateGoalModal] Form Update from AI');
  };

  // Handle location selection
  const handleLocationSelected = (location: TargetLocation) => {
    console.time('[CreateGoalModal] Location Selection');
    
    setFormData(prev => ({
      ...prev,
      targetLocation: location
    }));

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
    setPickerQuery('');
    setPickerPredictions([]);
    setPickerSelectedLocation(formData.targetLocation || null);
    setShowLocationPicker(true);
  }, [formData.targetLocation]);

  const closeLocationPicker = useCallback(() => setShowLocationPicker(false), []);

  const handlePickerSearchChange = useCallback(async (text: string) => {
    setPickerQuery(text);
    if (!text.trim()) {
      setPickerPredictions([]);
      return;
    }
    try {
      setPickerSearching(true);
      const results = await searchPlaces(text.trim());
      setPickerPredictions(results);
    } catch (e) {
      setPickerPredictions([]);
    } finally {
      setPickerSearching(false);
    }
  }, []);

  const handlePickerPredictionSelect = useCallback(async (placeId: string) => {
    try {
      setPickerLoading(true);
      const details = await getPlaceDetails(placeId);
      setPickerSelectedLocation(details);
      setPickerQuery(details.name);
      setPickerPredictions([]);
    } catch (e) {
      Alert.alert('Error', 'Failed to get place details.');
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handlePickerUseCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission Required', 'Please allow location access.');
        return;
      }
      setPickerLoading(true);
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPickerSelectedLocation({ name: 'Current Location', lat: current.coords.latitude, lng: current.coords.longitude });
      setPickerQuery('Current Location');
      setPickerPredictions([]);
    } catch (e) {
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setPickerLoading(false);
    }
  }, []);

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
      setFormData(prev => ({
        ...prev,
        targetLocation: currentLocation
      }));

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
      // Still need more date info, keep showing picker
      setFollowUpQuestion(validation.followUpQuestion || 'Please complete your date selection.');
    } else if (validation.missingFields && validation.missingFields.length > 0) {
      setShowDatePicker(false);
      if (validation.missingFields.includes('targetLocation')) {
        setFollowUpQuestion(validation.followUpQuestion || 'Please select a location for your goal.');
        setAppState('NEEDS_LOCATION');
      } else {
        setFollowUpQuestion(validation.followUpQuestion || 'Please provide additional information.');
        setAppState('NEEDS_INFO');
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
      };

      console.log('[CreateGoalModal] Saving goal (single phase):', goalData);
      await GoalService.createGoal(goalData);

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
      console.timeEnd('[CreateGoalModal] Goal Creation - Single Phase');
    }
  };
 
  // Background creation removed for reliability during development

  // Form sections as separate components for FlatList
  const renderAISection = () => (
    <View style={{ marginBottom: 24, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#BFDBFE' }}>
      <Text style={{ color: '#1D4ED8', fontWeight: '600', marginBottom: 12 }}>🤖 AI Goal Assistant</Text>
      
      {/* Only show follow-up question when not in AI Assistant step */}
      {followUpQuestion && state.step !== 0 && (
        <View className="mb-3 bg-blue-100 rounded-lg p-3">
          <Text className="text-blue-800 text-sm">{followUpQuestion}</Text>
        </View>
      )}

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
        placeholder={
          appState === 'NEEDS_INFO' ? "Answer the question above..." :
          appState === 'IDLE' ? "Describe your goal (e.g., 'Go to the gym 3 times a week')" :
          "Continue describing your goal..."
        }
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
          onPress={handleAiGeneration}
          disabled={loading || !aiPrompt.trim()}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: loading || !aiPrompt.trim() ? '#9CA3AF' : '#2563eb'
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            {loading ? 'Generating...' : appState === 'IDLE' ? 'Generate with AI' : 'Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAppState('READY_TO_REVIEW')}
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
      <SimpleDatePicker
        startDate={aiDraft.startDate || null}
        endDate={aiDraft.duration?.endDate || null}
        onStartDateChange={(date) => {
          // Update AI draft with new start date
          setAiDraft(prev => ({ ...prev, startDate: date }));
        }}
        onEndDateChange={(date) => {
          // Update AI draft with new end date
          setAiDraft(prev => ({ 
            ...prev, 
            duration: { ...prev.duration, endDate: date } 
          }));
        }}
        onNavigateToStep={goToStep}
        onWeeklyScheduleChange={handleWeeklyScheduleChange}
        verificationMethods={formData.verificationMethods}
        onVerificationMethodsChange={(methods) => setFormData(prev => ({ ...prev, verificationMethods: methods }))}
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
        />

      {/* Location Picker Overlay Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeLocationPicker}
      >
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="bg-blue-600 px-4 pt-12 pb-4 flex-row items-center justify-between">
            <TouchableOpacity onPress={closeLocationPicker}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text className="text-white font-semibold text-lg">Select Location</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Search */}
          <View className="p-4 border-b border-gray-200 bg-white">
            <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <Ionicons name="search" size={20} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-gray-900"
                placeholder="Search for a place (e.g., GymBox, Starbucks)"
                placeholderTextColor="#9CA3AF"
                value={pickerQuery}
                onChangeText={handlePickerSearchChange}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {pickerSearching && <ActivityIndicator size="small" color="#3B82F6" />}
            </View>

            <TouchableOpacity
              className="mt-3 bg-green-600 rounded-lg py-3 flex-row items-center justify-center"
              onPress={handlePickerUseCurrentLocation}
              disabled={pickerLoading}
            >
              <Ionicons name="location" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Use Current Location</Text>
            </TouchableOpacity>
          </View>

          {/* Predictions */}
          {pickerPredictions.length > 0 && (
            <View className="bg-white border-b border-gray-200">
              {pickerPredictions.map((p) => (
                <TouchableOpacity
                  key={p.placeId}
                  className="px-4 py-3 border-b border-gray-100"
                  onPress={() => handlePickerPredictionSelect(p.placeId)}
                >
                  <Text className="text-gray-900">{p.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Big Map Preview */}
          <View className="flex-1 m-4 rounded-xl overflow-hidden border border-gray-200">
            <MapPreview location={pickerSelectedLocation || formData.targetLocation || null} onPress={() => {}} />
          </View>

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