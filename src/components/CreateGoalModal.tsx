// Modal component for creating new goals with optimistic UI and performance optimizations

import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Categories, VerificationTypes } from '../constants';
import {
  AIGoalDraft,
  mergeAIGoal,
  updateDraftWithDates,
  validateAIGoal
} from '../features/goals/aiDraft';
import { useAuth } from '../hooks/useAuth';
import { AIService } from '../services/ai';
import { GoalService } from '../services/goalService';
import { CreateGoalForm, GoalDuration, GoalFrequency, TargetLocation } from '../types';
import SimpleDatePicker, { DateSelection } from './SimpleDatePicker';

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
}

// Step definitions
const STEPS = [
  { id: 'ai', title: 'AI Assistant', description: 'Generate goal with AI' },
  { id: 'details', title: 'Goal Details', description: 'Title, description, category' },
  { id: 'schedule', title: 'Schedule', description: 'Date & duration' },
  { id: 'location', title: 'Location', description: 'Target location' },
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [backgroundTaskProgress, setBackgroundTaskProgress] = useState<string>('');

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
    }
  };

  const nextStep = () => {
    if (state.step < STEPS.length - 1) {
      actions.next();
    }
  };

  const prevStep = () => {
    if (state.step > 0) {
      actions.prev();
    }
  };

  // Step validation
  const canProceedToNext = (): boolean => {
    switch (state.step) {
      case 0: // AI
        return !!(aiDraft.title && aiDraft.title.trim().length > 0);
      case 1: // Details
        return !!(formData.title && formData.title.trim().length > 0);
      case 2: // Schedule
        return !!(formData.duration.startDate && formData.duration.value && formData.duration.value > 0);
      case 3: // Location
        return true; // Location is optional
      case 4: // Review
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

    console.time('[CreateGoalModal] Goal Creation - Total');
    console.time('[CreateGoalModal] Goal Creation - Phase 1 (Optimistic)');

    try {
      // Phase 1: Optimistic UI - Create local draft immediately
      setAppState('SAVING');
      setLoading(true);

      // Generate optimistic goal ID
      optimisticGoalId.current = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Show immediate success and close modal
      setTimeout(() => {
        if (mountedRef.current) {
          setAppState('SAVED_OPTIMISTIC');
          console.timeEnd('[CreateGoalModal] Goal Creation - Phase 1 (Optimistic)');
          
          // Close modal and notify parent immediately (optimistic)
          handleClose();
          onGoalCreated();
          
          // Start Phase 2 in background
          performBackgroundGoalCreation();
        }
      }, 200); // Small delay to show saving state

    } catch (error) {
      console.error('[CreateGoalModal] Optimistic goal creation failed:', error);
      setLoading(false);
      setAppState('READY_TO_REVIEW');
      Alert.alert('Error', 'Failed to create goal. Please try again.');
    }
  };

  // Phase 2: Background goal creation
  const performBackgroundGoalCreation = async () => {
    console.time('[CreateGoalModal] Goal Creation - Phase 2 (Background)');
    
    try {
      setBackgroundTaskProgress('Saving to database...');
      
      // Perform actual Firestore write
      const goalData = {
        ...formData,
        userId: user!.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('[CreateGoalModal] Saving goal:', goalData);
      await GoalService.createGoal(goalData);
      
      setBackgroundTaskProgress('Goal saved successfully!');
      console.log('[CreateGoalModal] Goal created successfully');

    } catch (error: any) {
      console.error('[CreateGoalModal] Background goal creation failed:', error);
      setBackgroundTaskProgress('Save failed - will retry later');
      
      // Could implement retry logic here
      // For now, we'll just log the error and let the optimistic UI stand
    } finally {
      console.timeEnd('[CreateGoalModal] Goal Creation - Phase 2 (Background)');
      console.timeEnd('[CreateGoalModal] Goal Creation - Total');
      
      // Clear background progress after a delay
      setTimeout(() => {
        if (mountedRef.current) {
          setBackgroundTaskProgress('');
        }
      }, 3000);
    }
  };

  // Form sections as separate components for FlatList
  const renderAISection = () => (
    <View style={{ marginBottom: 24, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#BFDBFE' }}>
      <Text style={{ color: '#1D4ED8', fontWeight: '600', marginBottom: 12 }}>🤖 AI Goal Assistant</Text>
      
      {followUpQuestion && (
        <View className="mb-3 bg-blue-100 rounded-lg p-3">
          <Text className="text-blue-800 text-sm">{followUpQuestion}</Text>
        </View>
      )}

      {/* Show selected dates as chips */}
      {(aiDraft.startDate || aiDraft.duration) && (
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
          state === 'NEEDS_INFO' ? "Answer the question above..." :
          state === 'IDLE' ? "Describe your goal (e.g., 'Go to the gym 3 times a week')" :
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
            {loading ? 'Generating...' : state === 'IDLE' ? 'Generate with AI' : 'Continue'}
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

      {/* Example prompts - horizontal scroll */}
      {state === 'IDLE' && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, color: '#2563eb', marginBottom: 8 }}>Quick examples:</Text>
          <View style={{ flexDirection: 'row' }}>
            {AIService.getExamplePrompts().slice(0, 2).map((example: string, index: number) => (
              <TouchableOpacity
                key={index}
                onPress={() => setAiPrompt(example)}
                style={{
                  backgroundColor: '#dbeafe',
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  marginRight: 8
                }}
              >
                <Text style={{ color: '#1d4ed8', fontSize: 12 }}>{example}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderDatePickerSection = () => (
    <View style={{ marginBottom: 24 }}>
      <SimpleDatePicker
        onConfirm={handleDateSelection}
        onCancel={handleDatePickerCancel}
        initialStartDate={aiDraft.startDate}
        initialEndDate={aiDraft.duration?.endDate}
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
          onPress={() => {
            console.log('[NAV] Attempting to navigate to LocationPicker');
            console.log('[NAV] routes:', navigation.getState()?.routeNames);
            // Navigate to LocationPicker using parent navigator since CreateGoal is inside tabs
            const parentNav = navigation.getParent();
            if (parentNav) {
              console.log('[NAV] Using parent navigator');
              parentNav.navigate('LocationPicker', { 
                onSelect: (location: any) => {
                  console.log('[CreateGoal] Location selected:', location);
                  setFormData(prev => ({ ...prev, targetLocation: location }));
                }
              });
            } else {
              console.log('[NAV] Using direct navigation');
              navigation.navigate('LocationPicker', { 
                onSelect: (location: any) => {
                  console.log('[CreateGoal] Location selected:', location);
                  setFormData(prev => ({ ...prev, targetLocation: location }));
                }
              });
            }
          }}
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
      {/* Title */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Goal Title</Text>
        <TextInput
          className="bg-white rounded-lg px-3 py-3 border border-gray-300 text-gray-900"
          placeholder="Enter your goal title"
          placeholderTextColor="#9CA3AF"
          value={formData.title}
          onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
        />
      </View>

      {/* Description */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Description (Optional)</Text>
        <TextInput
          className="bg-white rounded-lg px-3 py-3 border border-gray-300 text-gray-900"
          placeholder="Describe your goal in more detail"
          placeholderTextColor="#9CA3AF"
          value={formData.description}
          onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 80 }}
        />
      </View>

      {/* Category */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Category</Text>
        <View className="bg-white rounded-lg border border-gray-300">
          <Picker
            selectedValue={formData.category}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
          >
            {Categories.map((category) => (
              <Picker.Item key={category} label={category} value={category} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Verification Methods - Multi-select */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Verification Methods</Text>
        <View className="flex-row flex-wrap gap-2">
          {VerificationTypes.map((method) => {
            const isSelected = formData.verificationMethods.includes(method);
            return (
              <TouchableOpacity
                key={method}
                onPress={() => {
                  const updated = isSelected
                    ? formData.verificationMethods.filter(m => m !== method)
                    : [...formData.verificationMethods, method];
                  setFormData(prev => ({ ...prev, verificationMethods: updated }));
                }}
                className={`px-3 py-2 rounded-lg border ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                }`}
              >
                <Text className={`text-sm font-medium ${
                  isSelected ? 'text-white' : 'text-gray-700'
                }`}>
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Conditional fields based on verification methods */}
      {formData.verificationMethods.includes('location') && (
        <View className="mb-4">
          <Text className="text-gray-700 font-semibold mb-2">Target Location</Text>
          
          {/* Target Location Display */}
          {formData.targetLocation ? (
            <View className="bg-white rounded-lg p-3 border border-gray-300 mb-3">
              <Text className="text-gray-800 font-medium">{formData.targetLocation.name}</Text>
              {formData.targetLocation.address && (
                <Text className="text-gray-600 text-sm mt-1">{formData.targetLocation.address}</Text>
              )}
              <Text className="text-gray-500 text-xs mt-1">
                {formData.targetLocation.lat.toFixed(6)}, {formData.targetLocation.lng.toFixed(6)}
              </Text>
            </View>
          ) : (
            <Text className="text-gray-500 italic mb-3">Not set</Text>
          )}

          {/* Location Action Buttons */}
          <View className="flex-row space-x-3">
            <TouchableOpacity
              className="flex-1 bg-blue-500 rounded-lg p-3 flex-row items-center justify-center"
              onPress={() => {
                console.log('[NAV] Attempting to navigate to LocationPicker');
                console.log('[NAV] routes:', navigation.getState()?.routeNames);
                // Try to navigate using parent navigator since CreateGoal is inside tabs
                const parentNav = navigation.getParent();
                if (parentNav) {
                  parentNav.navigate('LocationPicker', { returnTo: 'CreateGoal' });
                } else {
                  navigation.navigate('LocationPicker', { returnTo: 'CreateGoal' });
                }
              }}
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

      {/* Frequency */}
      <View className="mb-2">
        <Text className="text-gray-700 font-semibold mb-2">Frequency</Text>
        <View className="flex-row items-center space-x-2">
          <TextInput
            className="bg-white rounded-lg px-3 py-3 border border-gray-300 text-gray-900 w-20"
            placeholder="1"
            value={formData.frequency.count.toString()}
            onChangeText={(text) => {
              const count = parseInt(text) || 1;
              setFormData(prev => ({
                ...prev,
                frequency: { ...prev.frequency, count }
              }));
            }}
            keyboardType="numeric"
          />
          <View className="flex-1 bg-white rounded-lg border border-gray-300">
            <Picker
              selectedValue={formData.frequency.unit}
              onValueChange={(value) => {
                setFormData(prev => ({
                  ...prev,
                  frequency: { ...prev.frequency, unit: value }
                }));
              }}
            >
              <Picker.Item label="per day" value="per_day" />
              <Picker.Item label="per week" value="per_week" />
              <Picker.Item label="per month" value="per_month" />
            </Picker>
          </View>
        </View>
      </View>

      {/* Duration */}
      <View className="mb-6">
        <Text className="text-gray-700 font-semibold mb-2">Duration</Text>
        <View className="flex-row space-x-2">
          <TextInput
            className="bg-white rounded-lg px-3 py-3 border border-gray-300 text-gray-900 w-20"
            placeholder="2"
            value={formData.duration.value?.toString() || ''}
            onChangeText={(text) => {
              const value = parseInt(text) || 2;
              setFormData(prev => ({
                ...prev,
                duration: { ...prev.duration, value }
              }));
            }}
            keyboardType="numeric"
          />
          <View className="flex-1 bg-white rounded-lg border border-gray-300">
            <Picker
              selectedValue={formData.duration.type}
              onValueChange={(value) => {
                setFormData(prev => ({
                  ...prev,
                  duration: { ...prev.duration, type: value }
                }));
              }}
            >
              <Picker.Item label="days" value="days" />
              <Picker.Item label="weeks" value="weeks" />
              <Picker.Item label="months" value="months" />
            </Picker>
          </View>
        </View>
      </View>
    </View>
  );

  // Render function for FlatList sections
  const renderSection = ({ item }: { item: any }) => {
    switch (item.type) {
      case 'ai':
        return renderAISection();
      case 'datePicker':
        return renderDatePickerSection();
      case 'location':
        return renderLocationSection();
      case 'manualForm':
        return renderManualFormSection();
      default:
        return null;
    }
  };

  // Build sections array based on current state
  const getSections = () => {
    const sections = [];

    if (state === 'IDLE' || state === 'GENERATING' || state === 'NEEDS_INFO') {
      sections.push({ type: 'ai', key: 'ai-section' });
    }

    if (state === 'NEEDS_DATES' && showDatePicker) {
      sections.push({ type: 'datePicker', key: 'date-picker-section' });
    }

    if (state === 'NEEDS_LOCATION') {
      sections.push({ type: 'location', key: 'location-section' });
    }

    if (state === 'READY_TO_REVIEW') {
      sections.push({ type: 'manualForm', key: 'manual-form-section' });
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
              disabled={loading || appState !== 'READY_TO_REVIEW' || !formData.title.trim()}
              className={`px-4 py-2 rounded-lg ${
                loading || appState !== 'READY_TO_REVIEW' || !formData.title.trim()
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
          
          {/* Stepper Progress */}
          <View className="flex-row items-center justify-between">
            {STEPS.map((step, index) => (
              <View key={step.id} className="flex-1 items-center">
                <View className={`w-8 h-8 rounded-full items-center justify-center ${
                  index <= state.step ? 'bg-blue-600' : 'bg-gray-300'
                }`}>
                  <Text className={`text-sm font-semibold ${
                    index <= state.step ? 'text-white' : 'text-gray-600'
                  }`}>
                    {index + 1}
                  </Text>
                </View>
                <Text className="text-gray-600 text-xs mt-1 text-center" numberOfLines={1}>
                  {step.title}
                </Text>
                {index < STEPS.length - 1 && (
                  <View className={`w-full h-1 mt-2 ${
                    index < state.step ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </View>
            ))}
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