// Profile screen for user details and settings

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

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
              <Text className="text-gray-600 text-sm">Points</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                ${user.depositBalance}
              </Text>
              <Text className="text-gray-600 text-sm">Balance</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View className="bg-white rounded-lg mb-6 shadow-sm">
          <TouchableOpacity 
            className="flex-row items-center p-4 border-b border-gray-100"
            onPress={() => Alert.alert('Coming Soon', 'Settings will be implemented soon!')}
          >
            <View className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center mr-4">
              <Ionicons name="settings-outline" size={20} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold">Settings</Text>
              <Text className="text-gray-500 text-sm">App preferences and notifications</Text>
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
              <Text className="text-gray-800 font-semibold">Statistics</Text>
              <Text className="text-gray-500 text-sm">View your goal progress over time</Text>
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
              <Text className="text-gray-800 font-semibold">Help & Support</Text>
              <Text className="text-gray-500 text-sm">Get help and contact support</Text>
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
              <Text className="text-gray-800 font-semibold">About</Text>
              <Text className="text-gray-500 text-sm">App version and information</Text>
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
              <Text className="text-gray-800 font-semibold">Account Settings</Text>
              <Text className="text-gray-500 text-sm">Manage your account details</Text>
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
              <Text className="text-gray-800 font-semibold">Privacy & Security</Text>
              <Text className="text-gray-500 text-sm">Manage privacy and security settings</Text>
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
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </Text>
        </TouchableOpacity>

        {/* App Info */}
        <View className="items-center mb-8">
          <Text className="text-gray-500 text-sm">Doany v1.0.0</Text>
          <Text className="text-gray-400 text-xs mt-1">
            Member since {user.createdAt.toLocaleDateString()}
          </Text>
        </View>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}
