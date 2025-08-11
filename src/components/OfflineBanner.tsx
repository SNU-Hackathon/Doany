// Offline banner component for showing network status

import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useState } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';

interface OfflineBannerProps {
  isVisible?: boolean;
  onRetry?: () => void;
}

export default function OfflineBanner({ isVisible, onRetry }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));
  const [showRetryButton, setShowRetryButton] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || state.isInternetReachable === false;
      setIsOffline(offline);
      
      if (offline) {
        console.log('[OfflineBanner] Device went offline');
        // Show retry button after 3 seconds
        setTimeout(() => setShowRetryButton(true), 3000);
      } else {
        console.log('[OfflineBanner] Device came online');
        setShowRetryButton(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const shouldShow = isVisible !== undefined ? isVisible : isOffline;
    
    if (shouldShow) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: -100,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [isVisible, isOffline, slideAnim]);

  const handleRetry = () => {
    console.log('[OfflineBanner] Retry requested');
    if (onRetry) {
      onRetry();
    }
    setShowRetryButton(false);
  };

  const shouldShow = isVisible !== undefined ? isVisible : isOffline;

  if (!shouldShow) {
    return null;
  }

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
      className="bg-orange-500 px-4 py-3 flex-row items-center justify-between"
    >
      <View className="flex-row items-center flex-1">
        <Ionicons name="wifi-outline" size={20} color="#FFFFFF" />
        <Text className="text-white font-medium ml-2 flex-1">
          {isOffline ? 'You appear to be offline' : 'Connection issue, retrying...'}
        </Text>
      </View>
      
      {showRetryButton && onRetry && (
        <TouchableOpacity
          onPress={handleRetry}
          className="bg-white bg-opacity-20 px-3 py-1 rounded"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-sm">Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Hook to use offline banner
export function useOfflineBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');

  const showOfflineBanner = (message: string = 'Connection issue, retrying...') => {
    setBannerMessage(message);
    setShowBanner(true);
  };

  const hideOfflineBanner = () => {
    setShowBanner(false);
  };

  const OfflineBannerComponent = () => (
    <OfflineBanner
      isVisible={showBanner}
      onRetry={() => {
        hideOfflineBanner();
        // Trigger any retry logic here
      }}
    />
  );

  return {
    showOfflineBanner,
    hideOfflineBanner,
    OfflineBannerComponent,
    isShowingBanner: showBanner
  };
}
