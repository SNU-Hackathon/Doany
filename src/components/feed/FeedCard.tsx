// Feed card component displaying a single post with media, verification badges, and reactions
// Supports likes, trust votes, comments, saves, and media carousel

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Image, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { toggleLike, toggleSave, toggleTrust } from '../../compat/feedService';
import { FeedPost, FeedReaction } from '../../types/feed';

interface FeedCardProps {
  post: FeedPost;
  userReaction?: FeedReaction | null;
  currentUserId?: string;
  onPress?: () => void;
  onReactionChange?: () => void;
}

export default function FeedCard({
  post,
  userReaction,
  currentUserId,
  onPress,
  onReactionChange,
}: FeedCardProps) {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [localReaction, setLocalReaction] = useState<FeedReaction | null>(userReaction || null);
  const [likesCount, setLikesCount] = useState(post.likeCount);
  const [trustsCount, setTrustsCount] = useState(post.trustCount);
  const [savesCount, setSavesCount] = useState(post.saveCount);

  const isAnonymous = post.visibility === 'anonymous';
  const displayName = isAnonymous ? '익명' : post.userName || 'User';

  const handleLike = async () => {
    if (!currentUserId) {
      Alert.alert('로그인 필요', '좋아요를 하려면 로그인이 필요합니다.');
      return;
    }

    const wasLiked = localReaction?.liked || false;
    
    // Optimistic update
    setLocalReaction(prev => ({ ...prev, liked: !wasLiked } as FeedReaction));
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      const newLikedState = await toggleLike(post.id, currentUserId);
      onReactionChange?.();
    } catch (error) {
      console.error('[FEED:like:error]', error);
      // Revert on error
      setLocalReaction(prev => ({ ...prev, liked: wasLiked } as FeedReaction));
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
      Alert.alert('오류', '좋아요를 처리하는 중 문제가 발생했습니다.');
    }
  };

  const handleTrust = async () => {
    if (!currentUserId) {
      Alert.alert('로그인 필요', '신뢰도 투표를 하려면 로그인이 필요합니다.');
      return;
    }

    const wasTrusted = localReaction?.trusted || false;
    
    // Optimistic update
    setLocalReaction(prev => ({ ...prev, trusted: !wasTrusted } as FeedReaction));
    setTrustsCount(prev => wasTrusted ? prev - 1 : prev + 1);

    try {
      const newTrustedState = await toggleTrust(post.id, currentUserId);
      onReactionChange?.();
    } catch (error) {
      console.error('[FEED:trust:error]', error);
      // Revert on error
      setLocalReaction(prev => ({ ...prev, trusted: wasTrusted } as FeedReaction));
      setTrustsCount(prev => wasTrusted ? prev + 1 : prev - 1);
      Alert.alert('오류', '신뢰도 투표를 처리하는 중 문제가 발생했습니다.');
    }
  };

  const handleSave = async () => {
    if (!currentUserId) {
      Alert.alert('로그인 필요', '저장하려면 로그인이 필요합니다.');
      return;
    }

    const wasSaved = localReaction?.saved || false;
    
    // Optimistic update
    setLocalReaction(prev => ({ ...prev, saved: !wasSaved } as FeedReaction));
    setSavesCount(prev => wasSaved ? prev - 1 : prev + 1);

    try {
      const newSavedState = await toggleSave(post.id, currentUserId);
      onReactionChange?.();
    } catch (error) {
      console.error('[FEED:save:error]', error);
      // Revert on error
      setLocalReaction(prev => ({ ...prev, saved: wasSaved } as FeedReaction));
      setSavesCount(prev => wasSaved ? prev + 1 : prev - 1);
      Alert.alert('오류', '저장을 처리하는 중 문제가 발생했습니다.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${post.title}\n\n${post.caption || ''}`,
      });
    } catch (error) {
      console.error('[FEED:share:error]', error);
    }
  };

  const formatDate = (timestamp: any) => {
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
    
    return date.toLocaleDateString('ko-KR', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.95}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        margin: 16,
        marginTop: 8,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      {/* Header */}
      <View style={{ padding: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {/* Avatar */}
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isAnonymous ? '#E5E7EB' : '#2F6BFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                {isAnonymous ? '?' : displayName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#0F172A' }}>
                  {displayName}
                </Text>
                {post.school && (
                  <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>
                    · {post.school}
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                {formatDate(post.createdAt)}
              </Text>
            </View>
          </View>

          {/* Visibility badge */}
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: isAnonymous ? '#FEF3C7' : '#DBEAFE',
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '600', color: isAnonymous ? '#92400E' : '#1E40AF' }}>
              {isAnonymous ? '익명' : '공개'}
            </Text>
          </View>
        </View>
      </View>

      {/* Title and Caption */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 6 }}>
          {post.title}
        </Text>
        {post.caption && (
          <Text
            style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}
            numberOfLines={3}
          >
            {post.caption}
          </Text>
        )}

        {/* Verification badges */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {post.verification.photo && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: '#D1FAE5', 
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              borderRadius: 6 
            }}>
              <Text style={{ fontSize: 12, marginRight: 4 }}>📸</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>사진</Text>
            </View>
          )}
          {post.verification.location && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: '#D1FAE5', 
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              borderRadius: 6 
            }}>
              <Text style={{ fontSize: 12, marginRight: 4 }}>📍</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>위치</Text>
            </View>
          )}
          {post.verification.time && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: '#D1FAE5', 
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              borderRadius: 6 
            }}>
              <Text style={{ fontSize: 12, marginRight: 4 }}>⏱</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>시간</Text>
            </View>
          )}
        </View>
      </View>

      {/* Media carousel */}
      {post.media.length > 0 && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width
              );
              setCurrentMediaIndex(index);
            }}
          >
            {post.media.map((media, index) => (
              <Image
                key={index}
                source={{ uri: media.url }}
                style={{
                  width: 343, // Approximate card width minus padding
                  height: 257, // 4:3 aspect ratio
                  borderRadius: 12,
                }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Media indicator dots */}
          {post.media.length > 1 && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: 8,
                gap: 6,
              }}
            >
              {post.media.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: index === currentMediaIndex ? '#2F6BFF' : '#D1D5DB',
                  }}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 16,
          gap: 16,
        }}
      >
        {/* Like */}
        <TouchableOpacity
          onPress={handleLike}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons
            name={localReaction?.liked ? 'heart' : 'heart-outline'}
            size={24}
            color={localReaction?.liked ? '#EF4444' : '#6B7280'}
          />
          <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        {/* Trust */}
        <TouchableOpacity
          onPress={handleTrust}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons
            name={localReaction?.trusted ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={24}
            color={localReaction?.trusted ? '#2BB673' : '#6B7280'}
          />
          <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>
            {trustsCount}
          </Text>
        </TouchableOpacity>

        {/* Comments */}
        <TouchableOpacity
          onPress={onPress}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#6B7280" />
          <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>
            {post.commentCount}
          </Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
        >
          <Ionicons
            name={localReaction?.saved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={localReaction?.saved ? '#2F6BFF' : '#6B7280'}
          />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="share-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

