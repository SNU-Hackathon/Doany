// Home Screen - Swipe evaluation for proofs
// No group sections - only swipe cards with gesture + button voting

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppHeader from '../components/AppHeader';
import SwipeCard from '../components/SwipeCard';
import { useAuth } from '../hooks/useAuth';
import homeProofsData from '../mocks/homeProofs.json';

interface Proof {
  proofId: string;
  goalId: string;
  user: {
    displayName: string;
    tier: string;
    avatarUrl: string;
  };
  description: string;
  media: {
    type: 'photo' | 'video';
    url: string;
    width: number;
    height: number;
  };
  tags: string[];
  createdAt: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVoting, setIsVoting] = useState(false);

  const proofs = homeProofsData as Proof[];
  const currentProof = proofs[currentIndex];
  const hasMoreProofs = currentIndex < proofs.length;

  const handleVote = useCallback(async (vote: 'yes' | 'no') => {
    if (!currentProof || isVoting) return;

    setIsVoting(true);

    // Mock API call - would be: PATCH /swipe/proofs/{proofId}?vote=yes|no
    console.log(`[HomeScreen] Vote ${vote} for proof:`, currentProof.proofId);
    
    // Check if it's the last proof
    const isLastProof = currentIndex === proofs.length - 1;
    
    if (isLastProof) {
      // Mock API call - would be: PATCH /swipe/swipe-complete/proofs/{proofId}
      console.log('[HomeScreen] Last proof completed:', currentProof.proofId);
    }

    // Simulate network delay
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setIsVoting(false);
    }, 400);
  }, [currentProof, currentIndex, proofs.length, isVoting]);

  const handleVoteYes = useCallback(() => {
    handleVote('yes');
  }, [handleVote]);

  const handleVoteNo = useCallback(() => {
    handleVote('no');
  }, [handleVote]);

  const handleSkip = useCallback(() => {
    console.log('[HomeScreen] Skip proof:', currentProof?.proofId);
    setCurrentIndex((prev) => prev + 1);
  }, [currentProof]);

  const handleRefresh = useCallback(() => {
    setCurrentIndex(0);
    setIsVoting(false);
  }, []);

  const handleNotificationPress = useCallback(() => {
    console.log('[HomeScreen] Notification pressed');
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <AppHeader
          showProfile
          profileImage={undefined}
          userName={user?.name || 'Lee Seo June'}
          welcomeMessage="Welcome back,"
          showNotification
          onNotificationPress={handleNotificationPress}
        />

        {/* Main Content */}
        <View className="flex-1">
          {isVoting ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          ) : hasMoreProofs && currentProof ? (
            <SwipeCard
              key={currentProof.proofId}
              proof={currentProof}
              onVoteYes={handleVoteYes}
              onVoteNo={handleVoteNo}
              onSkip={handleSkip}
            />
          ) : (
            // Empty State
            <View className="flex-1 items-center justify-center px-8">
              <View
                className="bg-white rounded-3xl p-8 items-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-4">
                  <Ionicons name="checkmark-done" size={40} color="#4F46E5" />
                </View>
                
                <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
                  모든 인증을 평가했어요!
                </Text>
                
                <Text className="text-base text-gray-500 text-center mb-6">
                  더 이상 평가할 인증이 없어요.{'\n'}새로운 인증이 올라오면 알려드릴게요.
                </Text>

                <TouchableOpacity
                  onPress={handleRefresh}
                  className="bg-blue-600 rounded-2xl px-8 py-4"
                  activeOpacity={0.75}
                  style={{
                    shadowColor: '#4F46E5',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  <View className="flex-row items-center">
                    <Ionicons name="refresh" size={20} color="white" />
                    <Text className="text-white font-bold text-base ml-2">
                      다시 보기
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Stats */}
              <View className="mt-8 flex-row items-center justify-center" style={{ gap: 16 }}>
                <View className="items-center">
                  <Text className="text-2xl font-bold text-gray-900">
                    {proofs.length}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-1">평가 완료</Text>
                </View>
                
                <View className="w-px h-10 bg-gray-200" />
                
                <View className="items-center">
                  <Text className="text-2xl font-bold text-green-600">
                    {Math.floor(proofs.length * 0.7)}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-1">승인</Text>
                </View>
                
                <View className="w-px h-10 bg-gray-200" />
                
                <View className="items-center">
                  <Text className="text-2xl font-bold text-red-600">
                    {proofs.length - Math.floor(proofs.length * 0.7)}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-1">거절</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

