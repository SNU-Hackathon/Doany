// Verification method selection component with toggle functionality

import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export type VerificationMethod = 'manual' | 'time' | 'location' | 'photo' | 'screentime';

interface VerificationOption {
  id: VerificationMethod;
  label: string;
  description: string;
  icon: string;
  recommended?: boolean;
  required?: boolean;
}

interface VerificationSelectorProps {
  goalType: 'schedule' | 'frequency' | 'milestone';
  selectedMethods: VerificationMethod[];
  onMethodsChange: (methods: VerificationMethod[]) => void;
  showDescription?: boolean;
  onConfirm?: (methods: VerificationMethod[]) => void; // Add confirm callback
}

const VERIFICATION_OPTIONS: Record<VerificationMethod, VerificationOption> = {
  manual: {
    id: 'manual',
    label: '수동 확인',
    description: '직접 달성 여부를 체크합니다',
    icon: '✋'
  },
  time: {
    id: 'time',
    label: '시간 기반',
    description: '설정된 시간에 자동으로 알림을 받습니다',
    icon: '⏰'
  },
  location: {
    id: 'location',
    label: '위치 기반',
    description: '특정 장소에 도착하면 자동으로 확인됩니다',
    icon: '📍'
  },
  photo: {
    id: 'photo',
    label: '사진 인증',
    description: '사진을 찍어서 달성을 증명합니다',
    icon: '📸'
  },
  screentime: {
    id: 'screentime',
    label: '스크린타임',
    description: '앱 사용 시간을 추적합니다',
    icon: '📱'
  }
};

// Get recommended verification methods based on goal type
function getRecommendedMethods(goalType: 'schedule' | 'frequency' | 'milestone'): VerificationMethod[] {
  switch (goalType) {
    case 'schedule':
      return ['manual', 'time', 'location'];
    case 'frequency':
      return ['manual', 'location'];
    case 'milestone':
      return ['manual'];
    default:
      return ['manual'];
  }
}

// Get available verification methods based on goal type
function getAvailableMethods(goalType: 'schedule' | 'frequency' | 'milestone'): VerificationMethod[] {
  switch (goalType) {
    case 'schedule':
      return ['manual', 'time', 'location', 'photo', 'screentime'];
    case 'frequency':
      return ['manual', 'location', 'photo'];
    case 'milestone':
      return ['manual', 'photo'];
    default:
      return ['manual'];
  }
}

// Check if method is required for goal type
function isMethodRequired(method: VerificationMethod, goalType: 'schedule' | 'frequency' | 'milestone'): boolean {
  // Manual is required for frequency goals
  if (goalType === 'frequency' && method === 'manual') {
    return true;
  }
  return false;
}

export default function VerificationSelector({
  goalType,
  selectedMethods,
  onMethodsChange,
  showDescription = true,
  onConfirm
}: VerificationSelectorProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  const availableMethods = getAvailableMethods(goalType);
  const recommendedMethods = getRecommendedMethods(goalType);

  const toggleMethod = (method: VerificationMethod) => {
    if (isConfirmed) return; // Prevent changes after confirmation
    
    const isRequired = isMethodRequired(method, goalType);
    if (isRequired) return; // Can't toggle required methods

    const isSelected = selectedMethods.includes(method);
    
    if (isSelected) {
      onMethodsChange(selectedMethods.filter(m => m !== method));
    } else {
      onMethodsChange([...selectedMethods, method]);
    }
  };

  const applyRecommended = () => {
    if (isConfirmed) return; // Prevent changes after confirmation
    
    const requiredMethods = availableMethods.filter(method => 
      isMethodRequired(method, goalType)
    );
    const newMethods = [...new Set([...requiredMethods, ...recommendedMethods])];
    onMethodsChange(newMethods);
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    if (onConfirm) {
      onConfirm(selectedMethods);
    }
  };

  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-medium text-gray-700">검증 방법</Text>
        <TouchableOpacity
          onPress={applyRecommended}
          className="bg-blue-50 px-3 py-1 rounded-full"
        >
          <Text className="text-blue-600 text-xs font-medium">추천 설정</Text>
        </TouchableOpacity>
      </View>

      {showDescription && (
        <Text className="text-xs text-gray-500 mb-4">
          목표 달성을 확인할 방법을 선택하세요. 검증 없이도 목표 관리는 가능하지만, 커뮤니티 공유시 검증된 성취만 표시됩니다.
        </Text>
      )}

      <View className="space-y-3">
        {availableMethods.map(methodId => {
          const option = VERIFICATION_OPTIONS[methodId];
          const isSelected = selectedMethods.includes(methodId);
          const isRequired = isMethodRequired(methodId, goalType);
          const isRecommended = recommendedMethods.includes(methodId);

          return (
            <TouchableOpacity
              key={methodId}
              onPress={() => toggleMethod(methodId)}
              disabled={isRequired}
              className={`flex-row items-center p-3 rounded-lg border ${
                isSelected
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white border-gray-300'
              } ${isRequired ? 'opacity-75' : ''}`}
            >
              {/* Toggle */}
              <View className={`w-12 h-6 rounded-full flex-row items-center px-1 mr-3 ${
                isSelected ? 'bg-blue-500' : 'bg-gray-300'
              }`}>
                <View
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    isSelected ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </View>

              {/* Icon */}
              <Text className="text-lg mr-3">{option.icon}</Text>

              {/* Content */}
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-gray-800 font-medium">{option.label}</Text>
                  {isRecommended && (
                    <View className="bg-green-100 px-2 py-1 rounded ml-2">
                      <Text className="text-green-600 text-xs font-medium">추천</Text>
                    </View>
                  )}
                  {isRequired && (
                    <View className="bg-orange-100 px-2 py-1 rounded ml-2">
                      <Text className="text-orange-600 text-xs font-medium">필수</Text>
                    </View>
                  )}
                </View>
                <Text className="text-gray-500 text-sm mt-1">{option.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selection Summary */}
      <View className="mt-4 p-3 bg-gray-50 rounded-lg">
        <Text className="text-sm text-gray-600">
          선택된 검증 방법: {selectedMethods.length === 0 ? '없음' : selectedMethods.join(', ')}
        </Text>
        {selectedMethods.length === 0 && (
          <Text className="text-xs text-gray-500 mt-1">
            검증 없이도 목표를 진행할 수 있습니다.
          </Text>
        )}
      </View>

      {/* Confirm Button */}
      {!isConfirmed && (
        <TouchableOpacity
          onPress={handleConfirm}
          className="mt-4 bg-blue-500 py-3 px-4 rounded-lg"
        >
          <Text className="text-white text-center font-medium">선택 완료</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
