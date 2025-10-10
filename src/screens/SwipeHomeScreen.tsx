import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import * as SwipeAPI from '../api/swipe';
import { SwipeProofItem } from '../api/types';
import { useAuth } from '../hooks/useAuth';
import { useSwipeProofs, useVoteMutation } from '../hooks/useSwipe';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SwipeCardProps {
  item: SwipeProofItem;
  onVote: (proofId: string, vote: 'yes' | 'no') => void;
  onSkip: () => void;
  isLastAttempt: boolean;
}

const SwipeCard = React.memo(({ item, onVote, onSkip, isLastAttempt }: SwipeCardProps) => {
  const handleVoteYes = useCallback(() => {
    onVote(item.proofId, 'yes');
  }, [item.proofId, onVote]);

  const handleVoteNo = useCallback(() => {
    onVote(item.proofId, 'no');
  }, [item.proofId, onVote]);

  return (
    <View style={styles.cardContainer}>
      {/* Top Bar - User Info */}
      <View style={styles.topBar}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.userName?.charAt(0) || 'U'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.userName || 'Anonymous'}</Text>
            {item.goalTitle && (
              <Text style={styles.goalTitle}>{item.goalTitle}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Media Content */}
      <View style={styles.mediaContainer}>
        {item.type === 'photo' ? (
          <Image
            source={{ uri: item.url }}
            style={styles.media}
            resizeMode="cover"
            defaultSource={{ uri: 'https://via.placeholder.com/400x600?text=Loading...' }}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="play-circle" size={64} color="#9CA3AF" />
            <Text style={styles.videoText}>Video not implemented yet</Text>
          </View>
        )}
      </View>

      {/* Description */}
      {item.description && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      )}

      {/* Vote Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="thumbs-up" size={16} color="#10B981" />
          <Text style={styles.statText}>{item.votes.yes}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="thumbs-down" size={16} color="#EF4444" />
          <Text style={styles.statText}>{item.votes.no}</Text>
        </View>
        {isLastAttempt && (
          <Text style={styles.lastAttemptText}>Last attempt!</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionButton, styles.noButton]} onPress={handleVoteNo}>
          <Ionicons name="close" size={32} color="#EF4444" />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionButton, styles.yesButton]} onPress={handleVoteYes}>
          <Ionicons name="heart" size={32} color="#10B981" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function SwipeHomeScreen() {
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  
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
      
      // Advance to next card
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({ index: currentIndex + 1, animated: true });
        }
      }, 500);
      
    } catch (error) {
      console.error('[SWIPE:vote:error]', error);
      // Rollback optimistic update
      setVoteAttempts(prev => ({ ...prev, [proofId]: Math.max(0, (prev[proofId] || 0) - 1) }));
      Alert.alert('Error', 'Failed to vote. Please try again.');
    }
  }, [vote, voteAttempts, currentIndex]);

  // Handle skip
  const handleSkip = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  }, [currentIndex]);

  // Render item
  const renderItem = useCallback(({ item, index }: { item: SwipeProofItem; index: number }) => {
    const attempts = voteAttempts[item.proofId] || 0;
    const isLastAttempt = attempts >= 2; // 0, 1, 2 = 3 attempts total
    
    return (
      <SwipeCard
        item={item}
        onVote={handleVote}
        onSkip={handleSkip}
        isLastAttempt={isLastAttempt}
      />
    );
  }, [handleVote, handleSkip, voteAttempts]);

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
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={swipeProofs || []}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="center"
        decelerationRate="fast"
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cardContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  goalTitle: {
    color: '#D1D5DB',
    fontSize: 14,
    marginTop: 2,
  },
  skipButton: {
    padding: 8,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingVertical: 30,
    paddingBottom: 50,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  noButton: {
    backgroundColor: '#FFF',
  },
  yesButton: {
    backgroundColor: '#FFF',
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
