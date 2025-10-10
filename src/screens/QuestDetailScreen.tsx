// Quest Detail Screen
// Shows individual quest details and verification options

import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { QuestService } from '../services/questService';
import { Quest } from '../types/quest';
import { toast } from '../utils/toast';

type QuestDetailScreenRouteProp = RouteProp<{ QuestDetail: { questId: string } }, 'QuestDetail'>;
type QuestDetailScreenNavigationProp = StackNavigationProp<{ QuestDetail: { questId: string } }, 'QuestDetail'>;

interface QuestDetailScreenProps {
  route: QuestDetailScreenRouteProp;
  navigation: QuestDetailScreenNavigationProp;
}

export default function QuestDetailScreen({ route, navigation }: QuestDetailScreenProps) {
  const { questId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [quest, setQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadQuest = useCallback(async () => {
    if (!questId || !user) return;
    
    try {
      setError(null);
      setLoading(true);
      
      const questData = await QuestService.getQuestById(questId, user.id);
      
      if (!questData) {
        setError('퀀스트를 찾을 수 없습니다');
        return;
      }
      
      setQuest(questData);
      
    } catch (error) {
      console.error('[QuestDetail] Error loading quest:', error);
      setError('퀀스트를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [questId, user]);

  useEffect(() => {
    loadQuest();
  }, [loadQuest]);

  const handlePhotoVerification = useCallback(async () => {
    if (!user || !quest) return;
    
    try {
      setVerifying(true);
      
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '카메라 권한이 필요합니다');
        return;
      }
      
      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        // TODO: Implement photo verification logic
        // For now, just mark as completed
        await QuestService.updateQuestStatus(questId, 'completed', user.id, {
          completedAt: new Date().toISOString(),
          note: '사진으로 인증 완료'
        });
        
        toast.success('퀀스트가 완료되었습니다!');
        
        // Reload quest data
        await loadQuest();
      }
      
    } catch (error) {
      console.error('[QuestDetail] Photo verification error:', error);
      toast.error('인증 중 오류가 발생했습니다');
    } finally {
      setVerifying(false);
    }
  }, [quest, questId, user, loadQuest]);

  const handleManualVerification = useCallback(async () => {
    if (!user || !quest) return;
    
    try {
      setVerifying(true);
      
      Alert.alert(
        '수동 인증',
        '이 퀀스트를 완료했다고 확인하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '완료',
            onPress: async () => {
              await QuestService.updateQuestStatus(questId, 'completed', user.id, {
                completedAt: new Date().toISOString(),
                note: '수동 인증 완료'
              });
              
              toast.success('퀀스트가 완료되었습니다!');
              await loadQuest();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('[QuestDetail] Manual verification error:', error);
      toast.error('인증 중 오류가 발생했습니다');
    } finally {
      setVerifying(false);
    }
  }, [quest, questId, user, loadQuest]);

  const handleLocationVerification = useCallback(async () => {
    if (!user || !quest) return;
    
    try {
      setVerifying(true);
      
      // TODO: Implement location verification logic
      // For now, just mark as completed
      await QuestService.updateQuestStatus(questId, 'completed', user.id, {
        completedAt: new Date().toISOString(),
        note: '위치 인증 완료'
      });
      
      toast.success('퀀스트가 완료되었습니다!');
      await loadQuest();
      
    } catch (error) {
      console.error('[QuestDetail] Location verification error:', error);
      toast.error('인증 중 오류가 발생했습니다');
    } finally {
      setVerifying(false);
    }
  }, [quest, questId, user, loadQuest]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'failed': return '#EF4444';
      case 'pending': return '#F59E0B';
      case 'skipped': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'completed': return '완료';
      case 'failed': return '실패';
      case 'pending': return '대기';
      case 'skipped': return '건너뜀';
      default: return '알 수 없음';
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>퀀스트를 불러오는 중...</Text>
      </View>
    );
  }

  if (error || !quest) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error || '퀀스트를 찾을 수 없습니다'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadQuest}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>퀀스트 상세</Text>
        
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quest Header */}
        <View style={styles.questHeader}>
          <View style={styles.questTitleContainer}>
            <Text style={styles.questTitle}>{quest.title}</Text>
            {quest.description && (
              <Text style={styles.questDescription}>{quest.description}</Text>
            )}
          </View>
          
          <View style={styles.statusBadge}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(quest.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(quest.status) }]}>
              {getStatusText(quest.status)}
            </Text>
          </View>
        </View>

        {/* Quest Metadata */}
        <View style={styles.metadataContainer}>
          <View style={styles.metadataItem}>
            <Ionicons name="calendar" size={20} color="#6B7280" />
            <Text style={styles.metadataLabel}>예정일</Text>
            <Text style={styles.metadataValue}>
              {quest.scheduledDate ? formatDate(quest.scheduledDate) : '미정'}
            </Text>
          </View>
          
          {quest.weekNumber && (
            <View style={styles.metadataItem}>
              <Ionicons name="repeat" size={20} color="#6B7280" />
              <Text style={styles.metadataLabel}>주차</Text>
              <Text style={styles.metadataValue}>{quest.weekNumber}주차</Text>
            </View>
          )}
          
          {quest.metadata?.sequence && (
            <View style={styles.metadataItem}>
              <Ionicons name="list" size={20} color="#6B7280" />
              <Text style={styles.metadataLabel}>단계</Text>
              <Text style={styles.metadataValue}>{quest.metadata.sequence}단계</Text>
            </View>
          )}
          
          {quest.completedAt && (
            <View style={styles.metadataItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.metadataLabel}>완료일</Text>
              <Text style={styles.metadataValue}>{formatDate(quest.completedAt)}</Text>
            </View>
          )}
        </View>

        {/* Verification Rules */}
        {quest.verificationRules.length > 0 && (
          <View style={styles.verificationContainer}>
            <Text style={styles.sectionTitle}>인증 방법</Text>
            
            {quest.verificationRules.map((rule, index) => (
              <View key={index} style={styles.verificationRule}>
                <Ionicons 
                  name={
                    rule.type === 'photo' ? 'camera' :
                    rule.type === 'location' ? 'location' :
                    rule.type === 'time' ? 'time' :
                    rule.type === 'partner' ? 'people' : 'checkmark'
                  } 
                  size={20} 
                  color={rule.required ? '#111827' : '#6B7280'} 
                />
                <Text style={[
                  styles.verificationText,
                  { color: rule.required ? '#111827' : '#6B7280' }
                ]}>
                  {rule.type === 'photo' ? '사진 인증' :
                   rule.type === 'location' ? '위치 인증' :
                   rule.type === 'time' ? '시간 인증' :
                   rule.type === 'partner' ? '파트너 인증' : '수동 인증'}
                  {rule.required ? ' (필수)' : ' (선택)'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {quest.status === 'pending' && (
          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>인증하기</Text>
            
            {quest.verificationRules.map((rule, index) => {
              if (rule.type === 'photo') {
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.actionButton, styles.photoButton]}
                    onPress={handlePhotoVerification}
                    disabled={verifying}
                  >
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>사진으로 인증</Text>
                  </TouchableOpacity>
                );
              }
              
              if (rule.type === 'location') {
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.actionButton, styles.locationButton]}
                    onPress={handleLocationVerification}
                    disabled={verifying}
                  >
                    <Ionicons name="location" size={24} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>위치로 인증</Text>
                  </TouchableOpacity>
                );
              }
              
              if (rule.type === 'manual') {
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.actionButton, styles.manualButton]}
                    onPress={handleManualVerification}
                    disabled={verifying}
                  >
                    <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>수동 인증</Text>
                  </TouchableOpacity>
                );
              }
              
              return null;
            })}
          </View>
        )}

        {/* Completion Info */}
        {quest.status === 'completed' && quest.completedAt && (
          <View style={styles.completionContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={styles.completionTitle}>퀀스트 완료!</Text>
            <Text style={styles.completionDate}>
              {formatDate(quest.completedAt)}에 완료되었습니다
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  headerButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  
  // Content styles
  content: {
    flex: 1,
    padding: 16,
  },
  
  // Quest header styles
  questHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  questTitleContainer: {
    marginBottom: 16,
  },
  
  questTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  
  questDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Metadata styles
  metadataContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  metadataLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
    marginRight: 8,
    minWidth: 60,
  },
  
  metadataValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  
  // Verification styles
  verificationContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  
  verificationRule: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  verificationText: {
    fontSize: 14,
    marginLeft: 12,
  },
  
  // Actions styles
  actionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  
  photoButton: {
    backgroundColor: '#3B82F6',
  },
  
  locationButton: {
    backgroundColor: '#10B981',
  },
  
  manualButton: {
    backgroundColor: '#F59E0B',
  },
  
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  // Completion styles
  completionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  completionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 12,
    marginBottom: 8,
  },
  
  completionDate: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  
  // Loading and error styles
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
