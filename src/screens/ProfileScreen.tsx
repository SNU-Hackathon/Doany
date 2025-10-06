// Profile screen for user details and settings

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { getCurrentLanguage, Language, setLanguage } from '../services/userPrefs';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getCurrentLanguage());

  const handleLanguageChange = async (language: Language) => {
    try {
      await setLanguage(language);
      setCurrentLanguage(language);
      setLanguageModalVisible(false);
      // No need to manually refresh - i18n will trigger re-render
    } catch (error) {
      Alert.alert('Error', 'Failed to change language');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out');
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 90 }} // Add bottom padding for lowered tab bar
      >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {/* User Info Card */}
        <View className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <View className="items-center mb-4">
            <View className="bg-blue-100 rounded-full w-20 h-20 items-center justify-center mb-3">
              <Ionicons name="person" size={40} color="#3B82F6" />
            </View>
            <Text className="text-2xl font-bold text-gray-800">
              {user.displayName}
            </Text>
            <Text className="text-gray-600 mt-1">
              {user.email}
            </Text>
          </View>

          {/* Stats */}
          <View className="flex-row justify-around border-t border-gray-200 pt-4">
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">
                {user.points}
              </Text>
              <Text className="text-gray-600 text-sm">{t('profile.points')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                ${user.depositBalance}
              </Text>
              <Text className="text-gray-600 text-sm">{t('profile.balance')}</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View className="bg-white rounded-lg mb-6 shadow-sm">
          {/* Language Selector */}
          <TouchableOpacity 
            className="flex-row items-center p-4 border-b border-gray-100"
            onPress={() => setLanguageModalVisible(true)}
          >
            <View className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center mr-4">
              <Ionicons name="language-outline" size={20} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold">{t('profile.language')}</Text>
              <Text className="text-gray-500 text-sm">
                {currentLanguage === 'ko' ? t('profile.korean') : t('profile.english')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center p-4 border-b border-gray-100"
            onPress={() => Alert.alert('Coming Soon', 'Settings will be implemented soon!')}
          >
            <View className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center mr-4">
              <Ionicons name="settings-outline" size={20} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold">{t('profile.settings')}</Text>
              <Text className="text-gray-500 text-sm">{t('profile.app_preferences')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center p-4 border-b border-gray-100"
            onPress={() => Alert.alert('Coming Soon', 'Statistics will be implemented soon!')}
          >
            <View className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center mr-4">
              <Ionicons name="analytics-outline" size={20} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold">{t('profile.statistics')}</Text>
              <Text className="text-gray-500 text-sm">{t('profile.view_progress')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center p-4 border-b border-gray-100"
            onPress={() => Alert.alert('Coming Soon', 'Help section will be implemented soon!')}
          >
            <View className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center mr-4">
              <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold">{t('profile.help')}</Text>
              <Text className="text-gray-500 text-sm">{t('profile.get_support')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center p-4"
            onPress={() => Alert.alert('Coming Soon', 'About section will be implemented soon!')}
          >
            <View className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center mr-4">
              <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold">{t('profile.about')}</Text>
              <Text className="text-gray-500 text-sm">{t('profile.app_info')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View className="bg-white rounded-lg mb-6 shadow-sm">
          <TouchableOpacity 
            className="flex-row items-center p-4 border-b border-gray-100"
            onPress={() => Alert.alert('Coming Soon', 'Account management will be implemented soon!')}
          >
            <View className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center mr-4">
              <Ionicons name="person-outline" size={20} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold">{t('profile.account')}</Text>
              <Text className="text-gray-500 text-sm">{t('profile.manage_account')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center p-4"
            onPress={() => Alert.alert('Coming Soon', 'Privacy settings will be implemented soon!')}
          >
            <View className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center mr-4">
              <Ionicons name="shield-outline" size={20} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold">{t('profile.privacy')}</Text>
              <Text className="text-gray-500 text-sm">{t('profile.manage_privacy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          className="bg-red-600 rounded-lg p-4 mb-8 flex-row items-center justify-center"
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Ionicons 
            name="log-out-outline" 
            size={20} 
            color="white" 
          />
          <Text className="text-white font-bold text-lg ml-2">
            {signingOut ? t('profile.signing_out') : t('profile.sign_out')}
          </Text>
        </TouchableOpacity>

        {/* App Info */}
        <View className="items-center mb-8">
          <Text className="text-gray-500 text-sm">{t('profile.version')} 1.0.0</Text>
          <Text className="text-gray-400 text-xs mt-1">
            {t('profile.member_since')} {user.createdAt.toLocaleDateString()}
          </Text>
        </View>
      </View>
    </ScrollView>

    {/* Language Selection Modal */}
    <Modal
      visible={languageModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setLanguageModalVisible(false)}
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
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>
            {t('profile.select_language')}
          </Text>

          <TouchableOpacity
            onPress={() => handleLanguageChange('ko')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              backgroundColor: currentLanguage === 'ko' ? '#EFF6FF' : '#F9FAFB',
              borderRadius: 12,
              borderWidth: currentLanguage === 'ko' ? 2 : 1,
              borderColor: currentLanguage === 'ko' ? '#2F6BFF' : '#E5E7EB',
              marginBottom: 12,
            }}
          >
            <Ionicons
              name={currentLanguage === 'ko' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={currentLanguage === 'ko' ? '#2F6BFF' : '#6B7280'}
            />
            <Text
              style={{
                marginLeft: 12,
                fontSize: 16,
                fontWeight: currentLanguage === 'ko' ? '600' : '500',
                color: currentLanguage === 'ko' ? '#2F6BFF' : '#374151',
              }}
            >
              {t('profile.korean')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleLanguageChange('en')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              backgroundColor: currentLanguage === 'en' ? '#EFF6FF' : '#F9FAFB',
              borderRadius: 12,
              borderWidth: currentLanguage === 'en' ? 2 : 1,
              borderColor: currentLanguage === 'en' ? '#2F6BFF' : '#E5E7EB',
              marginBottom: 20,
            }}
          >
            <Ionicons
              name={currentLanguage === 'en' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={currentLanguage === 'en' ? '#2F6BFF' : '#6B7280'}
            />
            <Text
              style={{
                marginLeft: 12,
                fontSize: 16,
                fontWeight: currentLanguage === 'en' ? '600' : '500',
                color: currentLanguage === 'en' ? '#2F6BFF' : '#374151',
              }}
            >
              {t('profile.english')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setLanguageModalVisible(false)}
            style={{
              padding: 12,
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </SafeAreaView>
  );
}
