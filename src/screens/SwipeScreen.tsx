// Swipe screen for viewing other users' quest completions from the feed
// Shows completed quests with photos that were shared to the feed

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { fetchFeedPage } from '../services/feedService';
import { FeedPost } from '../types/feed';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SwipeScreen() {
  const { user } = useAuth();
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch feed posts
  const fetchPosts = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch public feed posts with photos
      const feedPage = await fetchFeedPage();
      
      // Filter posts with photos only
      const postsWithPhotos = feedPage.items.filter(post => 
        post.media && post.media.length > 0
      );
      
      setFeedPosts(postsWithPhotos);
    } catch (error) {
      console.error('[SWIPE:fetch:error]', error);
      setFeedPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 16, color: '#6B7280', fontSize: 14 }}>
          피드를 불러오는 중...
        </Text>
      </View>
    );
  }

  if (feedPosts.length === 0) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        contentContainerStyle={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <View style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: '#E0E7FF',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24
          }}>
            <Ionicons name="images-outline" size={56} color="#3B82F6" />
          </View>
          
          <Text style={{ 
            fontSize: 20, 
            fontWeight: '700', 
            color: '#111827', 
            marginBottom: 12,
            textAlign: 'center'
          }}>
            아직 공유된 퀘스트가 없어요
          </Text>
          
          <Text style={{ 
            fontSize: 14, 
            color: '#6B7280', 
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 24
          }}>
            다른 사용자들이 퀘스트를 완료하고{'\n'}
            피드에 공유하면 여기에 표시됩니다
          </Text>

          <TouchableOpacity 
            onPress={handleRefresh}
            style={{
              backgroundColor: '#3B82F6',
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
              새로고침
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ 
        paddingHorizontal: 20, 
        paddingTop: 56, 
        paddingBottom: 16, 
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827' }}>
            스와이프
          </Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Ionicons name="refresh-outline" size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          다른 사람들의 퀘스트 완료 기록을 확인해보세요
        </Text>
      </View>

      {/* Feed Posts */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {feedPosts.map((post, index) => (
          <View 
            key={post.id}
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              marginBottom: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3
            }}
          >
            {/* User Header */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F3F4F6'
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#E0E7FF',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12
              }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#3B82F6' }}>
                  {post.userName?.charAt(0) || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
                  {post.visibility === 'anonymous' ? '익명' : post.userName || '사용자'}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  {(() => {
                    const date = post.createdAt instanceof Date 
                      ? post.createdAt 
                      : (post.createdAt as any).toDate 
                      ? (post.createdAt as any).toDate() 
                      : new Date();
                    return date.toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                  })()}
                </Text>
              </View>
              {/* Verification badges */}
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {post.verification.photo && (
                  <View style={{
                    backgroundColor: '#D1FAE5',
                    borderRadius: 8,
                    padding: 6
                  }}>
                    <Ionicons name="camera" size={16} color="#059669" />
                  </View>
                )}
                {post.verification.location && (
                  <View style={{
                    backgroundColor: '#DBEAFE',
                    borderRadius: 8,
                    padding: 6
                  }}>
                    <Ionicons name="location" size={16} color="#2563EB" />
                  </View>
                )}
                {post.verification.time && (
                  <View style={{
                    backgroundColor: '#FEF3C7',
                    borderRadius: 8,
                    padding: 6
                  }}>
                    <Ionicons name="time" size={16} color="#D97706" />
                  </View>
                )}
              </View>
            </View>

            {/* Quest Info */}
            <View style={{ padding: 16, paddingTop: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                {post.title}
              </Text>
              {post.caption && (
                <Text style={{ fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 12 }}>
                  {post.caption}
                </Text>
              )}
            </View>

            {/* Photo */}
            {post.media && post.media.length > 0 && post.media[0].url && (
              <Image
                source={{ uri: post.media[0].url }}
                style={{ 
                  width: '100%', 
                  height: SCREEN_WIDTH * 0.75,
                  backgroundColor: '#F3F4F6'
                }}
                resizeMode="cover"
              />
            )}

            {/* Stats */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: '#F3F4F6',
              gap: 20
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="heart-outline" size={22} color="#EF4444" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>
                  {post.likeCount || 0}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#10B981" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>
                  {post.trustCount || 0}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="chatbubble-outline" size={20} color="#3B82F6" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>
                  {post.commentCount || 0}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
