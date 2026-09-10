/**
 * app/index.tsx — Home screen
 * Redesigned to match the CardScan AI custom mockup with initial animated loading splash.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSheetContacts, SheetContact } from '@/lib/sheets';
import { setPendingImages } from '@/lib/store';
import CameraCapture from '@/components/CameraCapture';

const MAX = 25;

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface SelectedImage {
  uri: string;
  name: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [recent, setRecent] = useState<SheetContact[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  
  // Brand Loading States
  const [appLoading, setAppLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing AI pipeline...');

  // Animated values
  const progressVal = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const fadeAppLoad = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation for the loader logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1.0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Animate progress bar in stages
    const animateProgress = () => {
      Animated.sequence([
        Animated.timing(progressVal, {
          toValue: 0.35,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.delay(150),
        Animated.timing(progressVal, {
          toValue: 0.75,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.delay(150),
        Animated.timing(progressVal, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start();
    };

    // Update status labels in sequence
    const t1 = setTimeout(() => setLoadingStatus('Connecting to Google Sheets...'), 600);
    const t2 = setTimeout(() => setLoadingStatus('Syncing offline database...'), 1400);
    const t3 = setTimeout(() => setLoadingStatus('Ready'), 2000);

    animateProgress();

    // Fetch contacts
    getSheetContacts()
      .then((data) => setRecent([...data].reverse().slice(0, 5)))
      .catch(() => setRecent([]))
      .finally(() => {
        setLoadingRecent(false);
        // Wait at least 2300ms for visual progress completion before exit
        setTimeout(() => {
          Animated.timing(fadeAppLoad, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => {
            setAppLoading(false);
          });
        }, 2300);
      });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const { openCamera } = useLocalSearchParams<{ openCamera?: string }>();

  useEffect(() => {
    if (openCamera === 'true') {
      setCameraOpen(true);
      setActiveTab('camera');
      router.setParams({ openCamera: undefined });
    }
  }, [openCamera]);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: MAX - images.length,
    });
    if (!result.canceled) {
      setActiveTab('upload');
      const newImgs = result.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName ?? `card_${Date.now()}_${i}.jpg`,
      }));
      setImages((prev) => [...prev, ...newImgs].slice(0, MAX));
    }
  };

  const handleCameraCapture = (uri: string) => {
    setActiveTab('camera');
    const name = `card_camera_${Date.now()}.jpg`;
    setImages((prev) => [...prev, { uri, name }].slice(0, MAX));
    setCameraOpen(false);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExtract = () => {
    if (images.length === 0) return;
    setPendingImages(images);
    router.push('/processing');
  };

  // ── Bento grid (no images selected yet) ──────────────────────────────────
  const renderBento = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Ionicons name="flash" size={12} color="#0b57d0" />
          <Text style={styles.badgeText}>OCR + AI Pipeline</Text>
        </View>
        <Text style={styles.heroTitle}>Extract contacts{'\n'}<Text style={styles.heroAccent}>instantly.</Text></Text>
        <Text style={styles.heroSub}>
          Select business card photos or snap a picture. CardScan AI extracts names, numbers and emails.
        </Text>
      </View>

      {/* Bento row: Upload + Camera */}
      <View style={styles.bentoRow}>
        {/* Card 1: Upload */}
        <TouchableOpacity style={styles.bentoUpload} onPress={pickImages} activeOpacity={0.85}>
          <View style={styles.bentoIcon}>
            <Ionicons name="cloud-upload-outline" size={26} color="#0b57d0" />
          </View>
          <Text style={styles.bentoTitle}>Upload</Text>
          <Text style={styles.bentoSub}>JPG · PNG</Text>
          <View style={styles.bentoBtn}>
            <Text style={styles.bentoBtnText}>Select Files</Text>
          </View>
        </TouchableOpacity>

        {/* Card 2: Camera */}
        <TouchableOpacity
          style={styles.bentoCam}
          onPress={() => { setCameraOpen(true); setActiveTab('camera'); }}
          activeOpacity={0.85}
        >
          <View style={styles.bentoCamIcon}>
            <Ionicons name="camera-outline" size={26} color="#fff" />
          </View>
          <Text style={styles.bentoCamTitle}>Camera</Text>
          <Text style={styles.bentoCamSub}>Snap a card instantly</Text>
          <View style={styles.bentoCamBtn}>
            <Text style={styles.bentoCamBtnText}>Open Camera</Text>
            <Ionicons name="chevron-forward" size={12} color="#0b57d0" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Card 3: Recent Contacts */}
      <View style={styles.bentoRecent}>
        <View style={styles.recentHeader}>
          <View style={styles.recentTitleRow}>
            <Ionicons name="book-outline" size={16} color="#0b57d0" />
            <Text style={styles.recentTitle}>Recent</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/contacts')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {loadingRecent && (
          <Text style={styles.recentEmpty}>Loading...</Text>
        )}

        {!loadingRecent && recent.length === 0 && (
          <Text style={styles.recentEmpty}>No contacts yet</Text>
        )}

        {!loadingRecent && recent.map((c, i) => {
          return (
            <View key={i} style={i < recent.length - 1 ? styles.recentItemContainer : null}>
              <TouchableOpacity
                style={styles.recentItem}
                onPress={() => router.push('/contacts')}
                activeOpacity={0.7}
              >
                <View style={styles.recentAvatar}>
                  <Text style={styles.recentAvatarText}>{getInitials(c.name)}</Text>
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName} numberOfLines={1}>{c.name || 'Unknown'}</Text>
                  <Text style={styles.recentCompany} numberOfLines={1}>{c.company || 'No Company'}</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Feature pills */}
      <View style={styles.pillsContainer}>
        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Up to 25 cards</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>AI OCR</Text>
          </View>
        </View>
        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Google Sheets</Text>
          </View>
        </View>
      </View>

      {/* Footer links */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Privacy Policy</Text>
        <Text style={styles.footerDot}>·</Text>
        <Text style={styles.footerText}>Terms of Service</Text>
      </View>
    </ScrollView>
  );

  // ── Preview grid (images selected) ───────────────────────────────────────
  const renderPreview = () => (
    <View style={styles.previewWrap}>
      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.previewTitle}>Selected Cards</Text>
          <Text style={styles.previewSub}>{images.length} card{images.length > 1 ? 's' : ''} ready</Text>
        </View>
        <TouchableOpacity onPress={() => setImages([])}>
          <Text style={styles.clearAll}>Clear all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={styles.previewGrid}>
          {images.map((img, idx) => (
            <View key={idx} style={styles.previewItem}>
              <Image source={{ uri: img.uri }} style={styles.previewImg} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(idx)}>
                <Ionicons name="close-circle" size={22} color="#c53030" />
              </TouchableOpacity>
              <View style={styles.cardBadge}>
                <Ionicons name={img.name.startsWith('card_camera_') ? "camera" : "image"} size={12} color="#fff" />
              </View>
            </View>
          ))}

          {images.length < MAX && (
            <TouchableOpacity style={styles.addMore} onPress={pickImages}>
              <Ionicons name="add" size={28} color="#6b7280" />
              <Text style={styles.addMoreText}>Add more</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.extractBtn} onPress={handleExtract} activeOpacity={0.9}>
        <Ionicons name="sparkles" size={18} color="#fff" />
        <Text style={styles.extractBtnText}>Extract {images.length} Card{images.length > 1 ? 's' : ''}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Brand Loading Splash Screen ──────────────────────────────────────────
  const renderLoadingScreen = () => (
    <Animated.View style={[styles.loadingScreen, { opacity: fadeAppLoad }]} pointerEvents={appLoading ? 'auto' : 'none'}>
      <View style={styles.loadingContent}>
        {/* Pulsing Viewfinder logo */}
        <Animated.View style={[styles.loadingLogoGlow, { transform: [{ scale: logoPulse }] }]}>
          <Ionicons name="scan" size={48} color="#0b57d0" />
        </Animated.View>

        {/* Brand Text */}
        <Text style={styles.loadingBrandName}>CardScan AI</Text>
        <Text style={styles.loadingTagline}>Intelligent Card Extraction</Text>

        {/* Progress Bar Track */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressVal.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Status text */}
        <Text style={styles.loadingStatusText}>{loadingStatus}</Text>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {appLoading && renderLoadingScreen()}

      {/* Centered Mockup Navigation */}
      <View style={styles.nav}>
        <TouchableOpacity
          style={styles.navIconLeft}
          onPress={() => Alert.alert('Menu', 'Currently nothing is here. Things will come upon updates.')}
        >
          <Ionicons name="menu" size={28} color="#0b57d0" />
        </TouchableOpacity>
        <Text style={styles.navTitleCenter}>CardScan AI</Text>
        <TouchableOpacity style={styles.navIconRight} onPress={() => router.push('/contacts')}>
          <Ionicons name="person" size={20} color="#0b57d0" />
        </TouchableOpacity>
      </View>

      {images.length === 0 ? renderBento() : renderPreview()}

      {/* Custom Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {activeTab === 'upload' ? (
          <TouchableOpacity style={styles.tabItemActive} activeOpacity={0.9} onPress={() => { setImages([]); setActiveTab('upload'); }}>
            <Ionicons name="cloud-upload" size={18} color="#fff" />
            <Text style={styles.tabTextActive}>Upload</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.tabItem} activeOpacity={0.7} onPress={() => { setImages([]); setActiveTab('upload'); }}>
            <Ionicons name="cloud-upload-outline" size={20} color="#6b7280" />
            <Text style={styles.tabText}>Upload</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'camera' ? (
          <TouchableOpacity style={styles.tabItemActive} activeOpacity={0.9} onPress={() => { setCameraOpen(true); setActiveTab('camera'); }}>
            <Ionicons name="scan" size={18} color="#fff" />
            <Text style={styles.tabTextActive}>Camera</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.tabItem} activeOpacity={0.7} onPress={() => { setCameraOpen(true); setActiveTab('camera'); }}>
            <Ionicons name="scan-outline" size={20} color="#6b7280" />
            <Text style={styles.tabText}>Camera</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/contacts')} activeOpacity={0.7}>
          <Ionicons name="id-card-outline" size={20} color="#6b7280" />
          <Text style={styles.tabText}>Contacts</Text>
        </TouchableOpacity>
      </View>

      {cameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => {
            setCameraOpen(false);
            setImages([]);
            setActiveTab('upload');
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  // Custom navigation
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  navIconLeft: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  navTitleCenter: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0b57d0',
    textAlign: 'center',
    flex: 1,
  },
  navIconRight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 110 },

  // Hero
  hero: { marginBottom: 24 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#0b57d0', letterSpacing: 0.3 },
  heroTitle: { fontSize: 34, fontWeight: '800', color: '#111827', lineHeight: 40, marginBottom: 10 },
  heroAccent: { color: '#0b57d0', fontStyle: 'italic' },
  heroSub: { fontSize: 14, color: '#4b5563', lineHeight: 21 },

  // Bento cards
  bentoRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  bentoUpload: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 200,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  bentoIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bentoTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginBottom: 4 },
  bentoSub: { fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 12 },
  bentoBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#fff',
    width: '100%',
    alignItems: 'center',
  },
  bentoBtnText: { fontSize: 12, fontWeight: '700', color: '#374151' },

  bentoCam: {
    flex: 1,
    backgroundColor: '#0b57d0',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 200,
    shadowColor: '#0b57d0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  bentoCamIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bentoCamTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bentoCamSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  bentoCamBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bentoCamBtnText: { fontSize: 12, fontWeight: '700', color: '#0b57d0' },

  // Recent contacts card
  bentoRecent: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  recentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recentTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  viewAll: { fontSize: 13, fontWeight: '700', color: '#0b57d0' },
  recentEmpty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  recentItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  recentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentAvatarText: { fontSize: 13, fontWeight: '800', color: '#0b57d0' },
  recentInfo: { flex: 1 },
  recentName: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  recentCompany: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Pills
  pillsContainer: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },

  // Footer links
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  footerText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  footerDot: { fontSize: 12, color: '#9ca3af' },

  // Bottom navigation tab bar
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  tabItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0b57d0',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  tabTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabText: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginTop: 4 },

  // Selected images review state - Redesigned to 2-columns
  previewWrap: { flex: 1, padding: 20 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  previewTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  previewSub: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  clearAll: { fontSize: 13, fontWeight: '700', color: '#4b5563' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 180 },
  previewItem: {
    width: '48%',
    aspectRatio: 1.1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  previewImg: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#0b57d0',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  addMore: {
    width: '48%',
    aspectRatio: 1.1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  addMoreText: { fontSize: 12, fontWeight: '600', color: '#4b5563', marginTop: 4 },
  extractBtn: {
    position: 'absolute',
    bottom: 96,
    left: 20,
    right: 20,
    backgroundColor: '#0b57d0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#0b57d0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  extractBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Initial Brand Loading Splash styles
  loadingScreen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f8fafc',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingLogoGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#0b57d0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  loadingBrandName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0b57d0',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  loadingTagline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 48,
  },
  progressTrack: {
    width: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#0b57d0',
  },
  loadingStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
});




