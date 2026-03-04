import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function NetworkBanner() {
  const quality = useNetworkStatus();
  const translateY = useRef(new Animated.Value(-60)).current;
  const insets = useSafeAreaInsets();

  const visible = quality !== 'online';
  const isOffline = quality === 'offline';

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : -60,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [visible]);

  const bgColor = isOffline ? '#D32F2F' : '#E65100';
  const icon = isOffline ? 'cloud-offline-outline' : 'cellular-outline';
  const label = isOffline ? 'No internet connection' : 'Poor connection';

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: bgColor,
          // Place below status bar using safe area inset
          top: insets.top + 8,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Ionicons name={icon as any} size={13} color="#fff" />
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginHorizontal: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
