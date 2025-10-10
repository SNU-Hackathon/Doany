import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SwipeAPI from '../api/swipe';
import { SwipeProofItem } from '../api/types';
import { useAuth } from '../hooks/useAuth';
import { useSwipeProofs, useVoteMutation } from '../hooks/useSwipe';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Safe wrapper for useBottomTabBarHeight
function useSafeBottomTabBarHeight(): number {
  try {
    return useBottomTabBarHeight();
  } catch (error) {
    // Fallback to platform-specific default heights
    return Platform.OS === 'ios' ? 83 : 56;
  }
}

interface SwipeCardProps {
  item: SwipeProofItem;
  onVote: (proofId: string, vote: 'yes' | 'no') => void;
  onSkip: () => void;
  isLastAttempt: boolean;
  cardHeight: number;
}

const SwipeCard = React.memo(({ item, onVote, onSkip, isLastAttempt, cardHeight }: SwipeCardProps) => {
  const handleVoteYes = useCallback(() => {
    onVote(item.proofId, 'yes');
  }, [item.proofId, onVote]);

  const handleVoteNo = useCallback(() => {
    onVote(item.proofId, 'no');
  }, [item.proofId, onVote]);

  // Format timestamp
  const formatTimestamp = (timestamp: number | string) => {
    try {
      const date = new Date(typeof timestamp === 'number' ? timestamp : Number(timestamp));
      if (isNaN(date.getTime())) return '2025-10-04 18:00';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch {
      return '2025-10-04 18:00';
    }
  };

  return (
    <View style={[styles.cardContainer, { height: cardHeight, width: SCREEN_WIDTH - 32 }]}>
      {/* Top Bar - User Info (스크린샷과 정확히 일치) */}
      <View style={styles.topBar}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#9CA3AF" />
          </View>
          <Text style={styles.userName}>{item.userName || '익명 사용자'}</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lv.6</Text>
        </View>
      </View>

      {/* Goal Description (스크린샷과 정확히 일치) */}
      <View style={styles.goalSection}>
        <Ionicons name="flag" size={20} color="#3B82F6" />
        <Text style={styles.goalText}>{item.goalTitle || '하루 3km 러닝하기'}</Text>
      </View>

      {/* Main Image (스크린샷과 정확히 일치) */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.url || 'https://picsum.photos/400/600' }}
          style={styles.mainImage}
          resizeMode="cover"
        />
      </View>

      {/* Bottom Section (스크린샷과 정확히 일치) */}
      <View style={styles.bottomSection}>
        <Text style={styles.hashtagText}>{item.description || 'No description'}</Text>
        <Text style={styles.timestamp}>{item.createdAt ? formatTimestamp(item.createdAt) : '2025-10-04 18:00'}</Text>
      </View>

      {/* Action Buttons (스크린샷과 정확히 일치) */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={handleVoteNo}
        >
          <Ionicons name="close" size={24} color="#EF4444" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.skipButton]}
          onPress={onSkip}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#6B7280" />
          <View style={styles.chatDot} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleVoteYes}
        >
          <Ionicons name="checkmark" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function SwipeHomeScreen() {
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  
  // Safe area and layout hooks
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const [groupHeaderH, setGroupHeaderH] = useState(0);
  
  // Calculate available card height dynamically
  const CARD_OUTER_MARGIN = 16;
  const availableCardHeight = Math.max(
    320, // 최소 높이 보호
    SCREEN_HEIGHT - insets.top - insets.bottom - tabBarHeight - groupHeaderH - CARD_OUTER_MARGIN - 12
  );
  
  // API hooks
  const { 
    data: swipeProofs, 
    isLoading: loading, 
    error, 
    refetch 
  } = useSwipeProofs({ page: 1, pageSize: 10 });
  
  const { vote, isLoading: voting } = useVoteMutation();
  
  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voteAttempts, setVoteAttempts] = useState<Record<string, number>>({});

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    setCurrentIndex(0);
    setVoteAttempts({});
  }, [refetch]);

  // Handle voting
  const handleVote = useCallback(async (proofId: string, voteValue: 'yes' | 'no') => {
    try {
      const currentAttempts = voteAttempts[proofId] || 0;
      const newAttempts = currentAttempts + 1;
      
      // Update local state optimistically
      setVoteAttempts(prev => ({ ...prev, [proofId]: newAttempts }));
      
      // Call API
      await vote({
        proofId,
        body: {
          vote: voteValue,
          serveId: `serve-${Date.now()}`,
        },
      });
      
      // If this was the last attempt, call complete endpoint
      if (newAttempts >= 3) {
        try {
          await SwipeAPI.completeProofVoting(proofId, `serve-${Date.now()}`);
          console.log(`[SWIPE] Completed voting for ${proofId}`);
        } catch (completeError) {
          console.error('[SWIPE:complete:error]', completeError);
          // Don't block UI for complete errors
        }
      }
      
      // Advance to next card (세로 스와이프)
      setTimeout(() => {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        if (flatListRef.current && nextIndex < (swipeProofs?.length || 0)) {
          flatListRef.current.scrollToIndex({ 
            index: nextIndex, 
            animated: true,
            viewPosition: 0
          });
        }
      }, 300);
      
    } catch (error) {
      console.error('[SWIPE:vote:error]', error);
      // Rollback optimistic update
      setVoteAttempts(prev => ({ ...prev, [proofId]: Math.max(0, (prev[proofId] || 0) - 1) }));
      Alert.alert('Error', 'Failed to vote. Please try again.');
    }
  }, [vote, voteAttempts, currentIndex]);

  // Handle skip (세로 스와이프)
  const handleSkip = useCallback(() => {
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    if (flatListRef.current && nextIndex < (swipeProofs?.length || 0)) {
      flatListRef.current.scrollToIndex({ 
        index: nextIndex, 
        animated: true,
        viewPosition: 0
      });
    }
  }, [currentIndex, swipeProofs]);

  // Render item
  const renderItem = useCallback(({ item, index }: { item: SwipeProofItem; index: number }) => {
    const attempts = voteAttempts[item.proofId] || 0;
    const isLastAttempt = attempts >= 2; // 0, 1, 2 = 3 attempts total
    
    return (
      <View style={{ height: availableCardHeight }}>
        <SwipeCard
          item={item}
          onVote={handleVote}
          onSkip={handleSkip}
          isLastAttempt={isLastAttempt}
          cardHeight={availableCardHeight}
        />
      </View>
    );
  }, [handleVote, handleSkip, voteAttempts, availableCardHeight]);

  // Key extractor
  const keyExtractor = useCallback((item: SwipeProofItem) => item.proofId, []);

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="heart-outline" size={80} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>No more proofs to swipe</Text>
      <Text style={styles.emptySubtitle}>
        Check back later for more goal achievements!
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#EF4444" />
          <Text style={styles.emptyTitle}>Failed to load proofs</Text>
          <Text style={styles.emptySubtitle}>
            Please check your connection and try again.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.refreshButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="hourglass-outline" size={80} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Loading proofs...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Group Header (스크린샷과 정확히 일치) */}
      <View 
        style={styles.groupHeader}
        onLayout={(e) => setGroupHeaderH(e.nativeEvent.layout.height + 20)}
      >
        <View style={styles.groupInfo}>
          <View style={styles.groupIcon}>
            <Ionicons name="people" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.groupName}>Lee Seo June's Group</Text>
        </View>
        <View style={styles.groupMembers}>
          {[1, 2, 3, 4].map((index) => (
            <View key={index} style={[styles.memberPlaceholder, index === 1 && styles.activeMember]} />
          ))}
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={20} color="#6B7280" />
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      {/* Main Swipe Area */}
      <View style={styles.swipeContainer}>
        <FlatList
          ref={flatListRef}
          data={swipeProofs || []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          pagingEnabled
          horizontal={false}
          showsVerticalScrollIndicator={false}
          snapToInterval={availableCardHeight}
          snapToAlignment="center"
          decelerationRate="fast"
          getItemLayout={(data, index) => ({
            length: availableCardHeight,
            offset: availableCardHeight * index,
            index,
          })}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 12 }}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.y / availableCardHeight);
            setCurrentIndex(index);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  groupMembers: {
    flexDirection: 'row',
    marginRight: 16,
  },
  memberPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  activeMember: {
    borderColor: '#3B82F6',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  swipeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  cardContainer: {
    // width and height are set dynamically via inline style
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    justifyContent: 'space-between',
    padding: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  levelBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  levelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  goalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  imageContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  hashtagText: {
    fontSize: 14,
    color: '#6B7280',
  },
  timestamp: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  videoPlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  videoText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 16,
  },
  descriptionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  description: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 6,
    fontWeight: '600',
  },
  lastAttemptText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rejectButton: {
    // 빨간색 X 버튼
  },
  skipButton: {
    position: 'relative',
    // 중앙 채팅 버튼
  },
  acceptButton: {
    // 파란색 체크 버튼
  },
  chatDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
  },
  emptySubtitle: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  refreshButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
