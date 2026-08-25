/**
 * app/error.tsx — Unified Premium Error Screen
 * Renders highly polished, animated states for 404, Offline, 500, and Permission Denied.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type ErrorType = '404' | 'offline' | '500' | 'permission';

interface ErrorConfig {
  icon: string;
  iconColor: string;
  glowColor: string;
  title: string;
  subtitle: string;
  primaryActionText: string;
  secondaryActionText: string;
}

export default function ErrorScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [checking, setChecking] = useState(false);

  // Default to 404 if type is not recognized
  const activeType: ErrorType = ['404', 'offline', '500', 'permission'].includes(type || '')
    ? (type as ErrorType)
    : '404';

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Pulse animation for the icon container
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Fade-in entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeType]);

  // Configurations for each error state
  const configs: Record<ErrorType, ErrorConfig> = {
    '404': {
      icon: 'search-outline',
      iconColor: '#4f46e5',
      glowColor: 'rgba(79, 70, 229, 0.1)',
      title: 'Page Not Found',
      subtitle: 'The link you followed might be broken, or the content was deleted. Let\'s get you back on track.',
      primaryActionText: 'Back to Home',
      secondaryActionText: 'Go Back',
    },
    'offline': {
      icon: 'wifi-outline',
      iconColor: '#0b57d0',
      glowColor: 'rgba(11, 87, 208, 0.12)',
      title: 'Connection Lost',
      subtitle: 'It looks like you\'ve disconnected from the internet. Please check your network connection and try again.',
      primaryActionText: 'Try Again',
      secondaryActionText: 'Back to Home',
    },
    '500': {
      icon: 'server-outline',
      iconColor: '#dc2626',
      glowColor: 'rgba(220, 38, 38, 0.1)',
      title: 'System Error (500)',
      subtitle: 'Our servers are experiencing an unexpected issue. Don\'t worry, the problem is on our end, and we\'re already fixing it.',
      primaryActionText: 'Retry Connection',
      secondaryActionText: 'Back to Home',
    },
    'permission': {
      icon: 'lock-closed-outline',
      iconColor: '#d97706',
      glowColor: 'rgba(217, 119, 6, 0.12)',
      title: 'Access Restricted',
      subtitle: 'This is a premium feature. Please upgrade to CardScan Pro to access unlimited sheets, custom fields, and team workspace export.',
      primaryActionText: 'Upgrade to Pro',
      secondaryActionText: 'Go Back',
    },
  };

  const current = configs[activeType];

  const handlePrimaryAction = () => {
    if (activeType === 'offline' || activeType === '500') {
      setChecking(true);
      setTimeout(() => {
        setChecking(false);
        Alert.alert(
          'Status Checked',
          activeType === 'offline' 
            ? 'No internet connection detected. Please verify your settings.' 
            : 'Servers are currently undergoing maintenance. Please try again shortly.',
          [{ text: 'OK' }]
        );
      }, 1500);
    } else if (activeType === 'permission') {
      Alert.alert(
        'CardScan Pro Upgrade',
        'Thank you for your interest! The billing module is loading.',
        [{ text: 'Super!' }]
      );
    } else {
      // 404
      router.replace('/');
    }
  };

  const handleSecondaryAction = () => {
    if (activeType === '404' || activeType === 'permission') {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button (Top Left) */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleSecondaryAction}>
          <Ionicons name="arrow-back" size={20} color="#4b5563" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Animated Icon Ring */}
        <View style={styles.iconContainer}>
          <Animated.View
            style={[
              styles.glowRing,
              {
                backgroundColor: current.glowColor,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <View style={styles.iconWrapper}>
            <Ionicons name={current.icon as any} size={42} color={current.iconColor} />
          </View>
        </View>

        {/* Text Details */}
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>

        {/* Buttons / Actions */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: current.iconColor }]}
            onPress={handlePrimaryAction}
            activeOpacity={0.8}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>{current.primaryActionText}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSecondaryAction} activeOpacity={0.7}>
            <Text style={styles.secondaryBtnText}>{current.secondaryActionText}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 60,
  },
  iconContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  glowRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0b57d0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
    marginBottom: 40,
  },
  actionContainer: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
});
