// Feed screen displaying community posts with infinite scroll
// Shows verified quest achievements shared by users

import { Ionicons } from '@expo/vector-icons';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '../components/common/EmptyState';
import SkeletonList from '../components/common/SkeletonList';
import FeedCard from '../components/feed/FeedCard';
import { useAuth } from '../hooks/useAuth';
import { fetchFeedPage, getUserReaction } from '../services/feedService';
import { FeedPost, FeedReaction } from '../types/feed';

type FilterType = 'all' | 'following' | 'school';

export default function FeedScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [reactions, setReactions] = useState<Map<string, FeedReaction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (!isRefresh && (loadingMore || !hasMore)) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
        setCursor(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      setError(null);

      const result = await fetchFeedPage(
        isRefresh ? undefined : cursor || undefined,
        filter === 'school' ? { school: 'My School' } : undefined // TODO: Get actual school from user profile
      );

      if (isRefresh) {
        setPosts(result.items);
      } else {
        setPosts(prev => [...prev, ...result.items]);
      }

      setCursor(result.cursor);
      setHasMore(result.hasMore);

      // Load user reactions for new posts
      if (user) {
        const newReactions = new Map(reactions);
        for (const post of result.items) {
          const reaction = await getUserReaction(post.id, user.uid);
          if (reaction) {
            newReactions.set(post.id, reaction);
          }
        }
        setReactions(newReactions);
      }

    } catch (err) {
      console.error('[FEED:load:error]', err);
      setError('피드를 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, filter, user, reactions]);

  useEffect(() => {
    loadFeed(true);
  }, [filter]);

  const handleRefresh = () => {
    loadFeed(true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadFeed(false);
    }
  };

  const handleReactionChange = () => {
    // Optionally reload reactions or update locally
  };

  const handleNavigateToDetail = (post: FeedPost) => {
    // TODO: Navigate to FeedDetailScreen
    console.log('[FEED:navigate:detail]', post.id);
  };

  const renderFilterButton = (type: FilterType, label: string) => {
    const isActive = filter === type;
    return (
      <TouchableOpacity
        onPress={() => setFilter(type)}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: isActive ? '#2F6BFF' : '#F3F4F6',
          marginRight: 8,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: isActive ? '#FFFFFF' : '#6B7280',
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading && posts.length === 0) {
    return <SkeletonList count={5} type="feed" />;
  }

  if (error && posts.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="연결 실패"
        message={error}
        actionLabel="다시 시도"
        onAction={handleRefresh}
      />
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <EmptyState
        icon="megaphone-outline"
        title="아직 공유된 성취가 없어요"
        message="첫 번째로 성취를 공유해보세요!"
        actionLabel="퀘스트 완료하기"
        onAction={() => {
          // TODO: Navigate to goals/quests screen
          console.log('[FEED:navigate:create]');
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F7FB' }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#0F172A' }}>
            피드
          </Text>
          <TouchableOpacity>
            <Ionicons name="notifications-outline" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Filter tabs */}
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {renderFilterButton('all', '전체')}
          {renderFilterButton('following', '팔로잉')}
          {renderFilterButton('school', '우리 학교')}
        </View>
      </View>

      {/* Feed list */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard
            post={item}
            userReaction={reactions.get(item.id)}
            currentUserId={user?.uid}
            onPress={() => handleNavigateToDetail(item)}
            onReactionChange={handleReactionChange}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2F6BFF"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#2F6BFF" />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      />
    </View>
  );
}

