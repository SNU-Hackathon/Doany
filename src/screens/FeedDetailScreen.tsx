// Feed detail screen showing a single post with full comments section
// Allows users to view and add comments, see full media, and interact with the post

import { Ionicons } from '@expo/vector-icons';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { BaseScreen, ErrorState, LoadingState } from '../components';
import FeedCard from '../components/feed/FeedCard';
import { useAuth } from '../hooks/useAuth';
import {
  addComment,
  deleteComment,
  fetchComments,
  getFeedPost,
  getUserReaction
} from '../services/feedService';
import { FeedComment, FeedPost, FeedReaction } from '../types/feed';

interface FeedDetailScreenProps {
  postId: string;
  onBack?: () => void;
}

export default function FeedDetailScreen({ postId, onBack }: FeedDetailScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [userReaction, setUserReaction] = useState<FeedReaction | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    try {
      setError(null);
      const postData = await getFeedPost(postId);
      
      if (!postData) {
        setError('게시물을 찾을 수 없습니다.');
        return;
      }

      setPost(postData);

      if (user) {
        const reaction = await getUserReaction(postId, user.uid);
        setUserReaction(reaction);
      }
    } catch (err) {
      console.error('[FEED:detail:load:error]', err);
      setError('게시물을 불러오는 중 문제가 발생했습니다.');
    }
  }, [postId, user]);

  const loadComments = useCallback(async (isRefresh = false) => {
    if (!isRefresh && (loadingMore || !hasMore)) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
        setCursor(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const result = await fetchComments(
        postId,
        isRefresh ? undefined : cursor || undefined
      );

      if (isRefresh) {
        setComments(result.items);
      } else {
        setComments(prev => [...prev, ...result.items]);
      }

      setCursor(result.cursor);
      setHasMore(result.hasMore);

    } catch (err) {
      console.error('[FEED:comments:load:error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [postId, cursor, hasMore, loadingMore]);

  useEffect(() => {
    const init = async () => {
      await loadPost();
      await loadComments(true);
    };
    init();
  }, []);

  const handleRefresh = async () => {
    await Promise.all([loadPost(), loadComments(true)]);
  };

  const handleLoadMoreComments = () => {
    if (!loadingMore && hasMore) {
      loadComments(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      Alert.alert('로그인 필요', '댓글을 작성하려면 로그인이 필요합니다.');
      return;
    }

    if (!commentText.trim()) {
      return;
    }

    try {
      setSubmittingComment(true);

      await addComment(
        postId,
        user.uid,
        user.displayName,
        undefined, // TODO: Add user avatar
        commentText.trim()
      );

      setCommentText('');
      
      // Reload comments
      await loadComments(true);
      
      // Update post comment count
      if (post) {
        setPost({ ...post, commentCount: post.commentCount + 1 });
      }

    } catch (err) {
      console.error('[FEED:comment:submit:error]', err);
      Alert.alert('오류', '댓글 작성 중 문제가 발생했습니다.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    Alert.alert(
      '댓글 삭제',
      '이 댓글을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(postId, commentId, user.uid);
              
              // Remove comment from local state
              setComments(prev => prev.filter(c => c.id !== commentId));
              
              // Update post comment count
              if (post) {
                setPost({ ...post, commentCount: post.commentCount - 1 });
              }
            } catch (err) {
              console.error('[FEED:comment:delete:error]', err);
              Alert.alert('오류', '댓글 삭제 중 문제가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  const formatCommentDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    
    return date.toLocaleDateString('ko-KR');
  };

  const renderComment = ({ item }: { item: FeedComment }) => {
    const isOwnComment = user?.uid === item.userId;

    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Avatar */}
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#2F6BFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
              {(item.userName || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Comment content */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>
                  {item.userName || 'User'}
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {formatCommentDate(item.createdAt)}
                </Text>
              </View>

              {isOwnComment && (
                <TouchableOpacity onPress={() => handleDeleteComment(item.id)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={{ fontSize: 14, color: '#374151', marginTop: 4, lineHeight: 20 }}>
              {item.text}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !post) {
    return <LoadingState message="Loading post..." fullScreen />;
  }

  if (error || !post) {
    return (
      <ErrorState
        title="게시물을 찾을 수 없습니다"
        message={error || '삭제되었거나 존재하지 않는 게시물입니다.'}
        actionLabel="돌아가기"
        onAction={onBack}
        fullScreen
      />
    );
  }

  return (
    <BaseScreen
      title="게시물"
      showBackButton={!!onBack}
      onBackPress={onBack}
      backgroundColor="#F6F7FB"
      keyboardAvoidingView
      scrollable={false}
      contentPadding={false}
    >

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <FeedCard
            post={post}
            userReaction={userReaction}
            currentUserId={user?.uid}
            onReactionChange={loadPost}
          />
        }
        renderItem={renderComment}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2F6BFF"
          />
        }
        onEndReached={handleLoadMoreComments}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center' }}>
                아직 댓글이 없습니다.{'\n'}첫 댓글을 남겨보세요!
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#2F6BFF" />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {/* Comment input */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingHorizontal: 16,
          paddingVertical: 12,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="댓글을 입력하세요..."
            placeholderTextColor="#9CA3AF"
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              fontSize: 14,
              color: '#0F172A',
            }}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || submittingComment}
            style={{
              backgroundColor: commentText.trim() ? '#2F6BFF' : '#E5E7EB',
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {submittingComment ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={commentText.trim() ? '#FFFFFF' : '#9CA3AF'}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BaseScreen>
  );
}

