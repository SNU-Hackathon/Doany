// Feed detail screen showing a single post with full comments section
// Allows users to view and add comments, see full media, and interact with the post
//
// NOTE: Simplified version using REST API
// Comments functionality to be implemented when backend endpoints are available

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { BaseScreen, ErrorState, LoadingState } from '../components';
import FeedCard from '../components/feed/FeedCard';
import { useAuth } from '../hooks/useAuth';
import { useLikeMutations } from '../hooks/useFeed';
import { FeedPost } from '../types/feed';

interface FeedDetailScreenProps {
  postId: string;
  onBack?: () => void;
}

export default function FeedDetailScreen({ postId, onBack }: FeedDetailScreenProps) {
  const { user } = useAuth();
  const { toggleLike } = useLikeMutations();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // TODO: Implement feed detail endpoint in API
      // For now, show placeholder
      setPost({
        id: postId,
        userId: user?.id || '',
        userName: user?.name || 'Anonymous',
        goalTitle: 'Sample Goal',
        description: 'This is a sample feed post',
        timestamp: new Date(),
        likes: 0,
        comments: 0,
        media: [],
      } as FeedPost);

    } catch (err) {
      console.error('[FEED:detail:load:error]', err);
      setError('게시물을 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [postId, user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPost();
    setRefreshing(false);
  }, [loadPost]);

  const handleLike = useCallback(async () => {
    if (!post) return;

    try {
      const didILike = post.didILike || false;
      await toggleLike(postId, didILike);
      
      // Update local state optimistically
      setPost({
        ...post,
        didILike: !didILike,
        likes: post.likes + (didILike ? -1 : 1),
      });
    } catch (err) {
      console.error('[FEED:detail:like:error]', err);
      Alert.alert('오류', '좋아요 처리 중 문제가 발생했습니다.');
    }
  }, [post, postId, toggleLike]);

  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim() || !user) return;

    try {
      // TODO: Implement comment endpoint in API
      Alert.alert('알림', '댓글 기능은 곧 추가될 예정입니다.');
      setCommentText('');
    } catch (err) {
      console.error('[FEED:detail:comment:error]', err);
      Alert.alert('오류', '댓글 작성 중 문제가 발생했습니다.');
    }
  }, [commentText, user]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  if (loading) {
    return (
      <BaseScreen title="게시물" onBack={onBack}>
        <LoadingState />
      </BaseScreen>
    );
  }

  if (error || !post) {
    return (
      <BaseScreen title="게시물" onBack={onBack}>
        <ErrorState
          message={error || '게시물을 찾을 수 없습니다.'}
          onRetry={loadPost}
        />
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title="게시물" onBack={onBack} contentPadding={false}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Feed Post Card */}
        <View className="px-4 py-4">
          <FeedCard 
            post={post} 
            onLike={handleLike}
            onComment={() => {
              // Focus comment input
            }}
          />
        </View>

        {/* Comments Section */}
        <View className="px-4 py-4 bg-gray-50">
          <Text className="text-base font-bold mb-4">
            댓글 {post.comments || 0}
          </Text>

          {/* Comment Input */}
          {user && (
            <View className="bg-white rounded-xl p-3 mb-4 flex-row items-center border border-gray-200">
              <TextInput
                className="flex-1 text-sm"
                placeholder="댓글을 입력하세요..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={handleSubmitComment}
                disabled={!commentText.trim()}
                className={`ml-2 ${commentText.trim() ? 'opacity-100' : 'opacity-50'}`}
              >
                <Ionicons name="send" size={24} color="#2563EB" />
              </TouchableOpacity>
            </View>
          )}

          {/* Comments List Placeholder */}
          <View className="items-center justify-center py-8">
            <Text className="text-gray-400 text-center">
              댓글 기능은 곧 추가될 예정입니다
            </Text>
          </View>
        </View>
      </ScrollView>
    </BaseScreen>
  );
}
