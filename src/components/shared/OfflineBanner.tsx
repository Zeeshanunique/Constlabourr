import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from '../../i18n';

export function OfflineBanner() {
  const { isOnline, isChecking, refreshConnectivity } = useNetworkStatus();
  const { language } = useTranslation();
  const [showRestored, setShowRestored] = useState(false);
  const prevOnlineRef = useRef(isOnline);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // If transitioning from offline -> online, show brief green badge
    if (!prevOnlineRef.current && isOnline) {
      setShowRestored(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowRestored(false));
      }, 2500);

      return () => clearTimeout(timer);
    } else if (!isOnline) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  if (isOnline && !showRestored) {
    return null;
  }

  const isRestoredBanner = isOnline && showRestored;

  const offlineText =
    language === 'hi'
      ? 'आप ऑफ़लाइन हैं • सहेजा गया डेटा दिखाया जा रहा है'
      : language === 'bn'
      ? 'আপনি অফলাইনে আছেন • সংরক্ষিত ডেটা দেখানো হচ্ছে'
      : 'You are offline • Showing cached data';

  const restoredText =
    language === 'hi'
      ? 'इंटरनेट फिर से जुड़ गया'
      : language === 'bn'
      ? 'ইন্টারনেট সংযোগ ফিরে এসেছে'
      : 'Internet connection restored';

  const retryText = language === 'hi' ? 'पुनः प्रयास' : language === 'bn' ? 'পুনরায় চেষ্টা' : 'Retry';

  return (
    <Animated.View
      style={[
        styles.banner,
        isRestoredBanner ? styles.restoredBanner : styles.offlineBanner,
        { opacity: fadeAnim },
      ]}
    >
      <View style={styles.leftRow}>
        <MaterialIcons
          name={isRestoredBanner ? 'check-circle' : 'cloud-off'}
          size={16}
          color={isRestoredBanner ? '#15803D' : '#D97706'}
        />
        <Text
          style={[
            styles.bannerText,
            isRestoredBanner ? styles.restoredText : styles.offlineText,
          ]}
          numberOfLines={1}
        >
          {isRestoredBanner ? restoredText : offlineText}
        </Text>
      </View>

      {!isRestoredBanner && (
        <TouchableOpacity
          onPress={refreshConnectivity}
          disabled={isChecking}
          style={styles.retryButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isChecking ? (
            <ActivityIndicator size="small" color="#D97706" />
          ) : (
            <Text style={styles.retryButtonText}>{retryText}</Text>
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
    zIndex: 9999,
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  restoredBanner: {
    backgroundColor: '#DCFCE7',
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  offlineText: {
    color: '#92400E',
  },
  restoredText: {
    color: '#166534',
  },
  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  retryButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
});
