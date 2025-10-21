// Home Screen - Swipe evaluation for proofs
// Design: Apple-inspired clean interface with swipe gestures

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

interface VoteHistory {
  proofId: string;
  vote: 'yes' | 'no';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVoting, setIsVoting] = useState(false);
  const [voteHistory, setVoteHistory] = useState<VoteHistory[]>([]);

  const proofs = homeProofsData as Proof[];
  const currentProof = proofs[currentIndex];
  const hasMoreProofs = currentIndex < proofs.length;

  const handleVote = useCallback(async (vote: 'yes' | 'no') => {
    if (!currentProof || isVoting) return;

    setIsVoting(true);

    // Mock API call - would be: PATCH /swipe/proofs/{proofId}?vote=yes|no
    console.log(`[HomeScreen] Vote ${vote} for proof:`, currentProof.proofId);
    
    // Save vote history
    setVoteHistory(prev => [...prev, { proofId: currentProof.proofId, vote }]);
    
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

  const handleUndo = useCallback(() => {
    if (currentIndex > 0 && voteHistory.length > 0) {
      // Remove last vote from history
      setVoteHistory(prev => prev.slice(0, -1));
      // Go back to previous proof
      setCurrentIndex(prev => prev - 1);
      setIsVoting(false);
      console.log('[HomeScreen] Undo to previous proof');
    }
  }, [currentIndex, voteHistory.length]);

  const handleRefresh = useCallback(() => {
    setCurrentIndex(0);
    setIsVoting(false);
    setVoteHistory([]);
  }, []);

  const handleNotificationPress = useCallback(() => {
    console.log('[HomeScreen] Notification pressed');
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <AppHeader
          showProfile
          profileImage={undefined}
          userName={user?.name || 'Lee Seo June 님'}
          welcomeMessage="Welcome back,"
          showNotification
          onNotificationPress={handleNotificationPress}
        />

        {/* Main Content */}
        <View style={{ flex: 1 }}>
          {isVoting ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          ) : hasMoreProofs && currentProof ? (
            <SwipeCard
              key={currentProof.proofId}
              proof={currentProof}
              onVoteYes={handleVoteYes}
              onVoteNo={handleVoteNo}
              onUndo={currentIndex > 0 ? handleUndo : undefined}
              canUndo={currentIndex > 0 && voteHistory.length > 0}
            />
          ) : (
            // Empty State
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 24,
                  padding: 32,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <View
                  style={{
                    width: 80,
                    height: 80,
                    backgroundColor: '#EEF2FF',
                    borderRadius: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="checkmark-done" size={40} color="#4F46E5" />
                </View>
                
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: '#111827',
                    marginBottom: 8,
                    textAlign: 'center',
                  }}
                >
                  모든 인증을 평가했어요!
                </Text>
                
                <Text
                  style={{
                    fontSize: 15,
                    color: '#6B7280',
                    textAlign: 'center',
                    marginBottom: 24,
                    lineHeight: 22,
                  }}
                >
                  더 이상 평가할 인증이 없어요.{'\n'}새로운 인증이 올라오면 알려드릴게요.
                </Text>

                <TouchableOpacity
                  onPress={handleRefresh}
                  style={{
                    backgroundColor: '#4F46E5',
                    borderRadius: 16,
                    paddingHorizontal: 32,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#4F46E5',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '700',
                      fontSize: 16,
                      marginLeft: 8,
                    }}
                  >
                    다시 보기
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Stats */}
              <View
                style={{
                  marginTop: 32,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                }}
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>
                    {voteHistory.length}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                    평가 완료
                  </Text>
                </View>
                
                <View style={{ width: 1, height: 40, backgroundColor: '#E5E7EB' }} />
                
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#10B981' }}>
                    {voteHistory.filter(v => v.vote === 'yes').length}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                    승인
                  </Text>
                </View>
                
                <View style={{ width: 1, height: 40, backgroundColor: '#E5E7EB' }} />
                
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#EF4444' }}>
                    {voteHistory.filter(v => v.vote === 'no').length}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                    거절
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}