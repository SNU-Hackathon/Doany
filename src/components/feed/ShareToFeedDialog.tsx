// Dialog component for sharing quest completion to feed
// Shown after successful verification of a quest

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { createFeedPost } from '../../services/feedService';
import { Visibility } from '../../types/feed';

interface ShareToFeedDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  questTitle: string;
  goalId: string;
  questId?: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  photoUrls?: string[];
  hasLocation?: boolean;
  hasTime?: boolean;
  school?: string;
}

export default function ShareToFeedDialog({
  visible,
  onClose,
  onSuccess,
  questTitle,
  goalId,
  questId,
  userId,
  userName,
  userAvatar,
  photoUrls = [],
  hasLocation = false,
  hasTime = false,
  school,
}: ShareToFeedDialogProps) {
  const [shareToFeed, setShareToFeed] = useState(false);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [submitting, setSubmitting] = useState(false);

  const handleShare = async () => {
    if (!shareToFeed) {
      onClose();
      return;
    }

    try {
      setSubmitting(true);

      await createFeedPost({
        userId,
        userName,
        userAvatar,
        goalId,
        questId,
        title: questTitle,
        caption: caption.trim() || undefined,
        media: photoUrls.map(url => ({ url, type: 'image' as const })),
        verification: {
          photo: photoUrls.length > 0,
          location: hasLocation,
          time: hasTime,
        },
        visibility,
        school,
      });

      Alert.alert('공유 완료', '피드에 성취가 공유되었습니다!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('[ShareToFeed:error]', error);
      Alert.alert('공유 실패', '피드 공유 중 문제가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setShareToFeed(false);
    setCaption('');
    setVisibility('public');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 400,
          }}
        >
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#D1FAE5',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="checkmark-circle" size={36} color="#2BB673" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
              퀘스트 완료!
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
              {questTitle}
            </Text>
          </View>

          {/* Share toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#0F172A' }}>
              커뮤니티에 공유
            </Text>
            <Switch
              value={shareToFeed}
              onValueChange={setShareToFeed}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={shareToFeed ? '#2F6BFF' : '#F3F4F6'}
            />
          </View>

          {shareToFeed && (
            <>
              {/* Caption input */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  메시지 (선택)
                </Text>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="성취에 대한 소감을 남겨보세요..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: '#0F172A',
                    textAlignVertical: 'top',
                    minHeight: 80,
                  }}
                />
              </View>

              {/* Visibility selector */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  공개 범위
                </Text>
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setVisibility('public')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: visibility === 'public' ? '#EFF6FF' : '#F9FAFB',
                      borderRadius: 8,
                      borderWidth: visibility === 'public' ? 2 : 1,
                      borderColor: visibility === 'public' ? '#2F6BFF' : '#E5E7EB',
                    }}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={20}
                      color={visibility === 'public' ? '#2F6BFF' : '#6B7280'}
                    />
                    <Text
                      style={{
                        marginLeft: 12,
                        fontSize: 14,
                        fontWeight: visibility === 'public' ? '600' : '500',
                        color: visibility === 'public' ? '#2F6BFF' : '#374151',
                      }}
                    >
                      공개 (모든 사용자)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setVisibility('anonymous')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: visibility === 'anonymous' ? '#EFF6FF' : '#F9FAFB',
                      borderRadius: 8,
                      borderWidth: visibility === 'anonymous' ? 2 : 1,
                      borderColor: visibility === 'anonymous' ? '#2F6BFF' : '#E5E7EB',
                    }}
                  >
                    <Ionicons
                      name="eye-off-outline"
                      size={20}
                      color={visibility === 'anonymous' ? '#2F6BFF' : '#6B7280'}
                    />
                    <Text
                      style={{
                        marginLeft: 12,
                        fontSize: 14,
                        fontWeight: visibility === 'anonymous' ? '600' : '500',
                        color: visibility === 'anonymous' ? '#2F6BFF' : '#374151',
                      }}
                    >
                      익명 (이름 숨김)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Verification badges preview */}
              <View style={{ marginTop: 16, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {photoUrls.length > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#D1FAE5',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 11, marginRight: 4 }}>📸</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>
                      사진 {photoUrls.length}장
                    </Text>
                  </View>
                )}
                {hasLocation && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#D1FAE5',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 11, marginRight: 4 }}>📍</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>위치</Text>
                  </View>
                )}
                {hasTime && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#D1FAE5',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 11, marginRight: 4 }}>⏱</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>시간</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity
              onPress={handleSkip}
              disabled={submitting}
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>
                {shareToFeed ? '취소' : '닫기'}
              </Text>
            </TouchableOpacity>

            {shareToFeed && (
              <TouchableOpacity
                onPress={handleShare}
                disabled={submitting}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: submitting ? '#93C5FD' : '#2F6BFF',
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                    공유하기
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

