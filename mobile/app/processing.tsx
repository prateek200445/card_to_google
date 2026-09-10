/**
 * app/processing.tsx — Live per-card extraction progress
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useExtract } from '@/hooks/useExtract';
import { pendingImages, setExtractedResults } from '@/lib/store';

const STATUS_CONFIG = {
  queued: { icon: 'time-outline', color: Colors.onSurfaceVariant, bg: Colors.surfaceContainer, label: 'Queued' },
  processing: { icon: 'scan-outline', color: Colors.primary, bg: '#eef2ff', label: 'Extracting…', pulse: true },
  done: { icon: 'checkmark-circle', color: '#059669', bg: '#f0fdf4', label: 'Done' },
  failed: { icon: 'close-circle', color: '#dc2626', bg: '#fef2f2', label: 'Failed' },
} as const;

export default function ProcessingScreen() {
  const router = useRouter();
  const { extract, progress, isRunning, results, doneCount, failedCount } = useExtract();
  const didStart = useRef(false);

  useEffect(() => {
    if (didStart.current) return;
    didStart.current = true;

    if (pendingImages.length === 0) {
      router.replace('/');
      return;
    }

    extract(pendingImages).then((res) => {
      setExtractedResults(res);
      setTimeout(() => {
        router.replace('/results');
      }, 800);
    });
  }, []);

  const total = progress.length;
  const finished = doneCount + failedCount;
  const pct = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="flash" size={18} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>CardScan AI</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Processing your cards</Text>
        <Text style={styles.subtitle}>CardScan AI is reading each card — sit tight</Text>

        {/* Progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Processing {total} card{total !== 1 ? 's' : ''}</Text>
            <Text style={styles.progressCount}>{finished} / {total}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <View style={styles.progressStats}>
            <Text style={styles.statDone}>✓ {doneCount} done</Text>
            {failedCount > 0 && <Text style={styles.statFailed}>✗ {failedCount} failed</Text>}
            <Text style={styles.statRemain}>{total - finished} remaining</Text>
          </View>
        </View>

        {/* Per-card list */}
        <View style={styles.cardList}>
          {progress.map((p, i) => {
            const cfg = STATUS_CONFIG[p.status];
            return (
              <View key={i} style={[styles.cardItem, { backgroundColor: cfg.bg }]}>
                <View style={styles.cardItemLeft}>
                  {p.status === 'processing' ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
                  )}
                  <View style={styles.cardItemInfo}>
                    <Text style={styles.cardItemName} numberOfLines={1}>{p.label}</Text>
                    <Text style={[styles.cardItemStatus, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                {p.result && !p.result.error && (
                  <Text style={styles.cardItemConfidence}>
                    {Math.round(p.result.confidence * 100)}%
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    backgroundColor: 'rgba(253,251,247,0.95)',
  },
  headerIcon: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.onSurface },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.onSurface, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.onSurfaceVariant, marginBottom: 24 },

  progressCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    marginBottom: 20,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: Colors.onSurfaceVariant },
  progressCount: { fontSize: 14, fontWeight: '800', color: Colors.onSurface },
  progressTrack: { height: 10, backgroundColor: Colors.surfaceContainer, borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 5 },
  progressStats: { flexDirection: 'row', gap: 16 },
  statDone: { fontSize: 12, fontWeight: '700', color: '#059669' },
  statFailed: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  statRemain: { fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant },

  cardList: { gap: 8 },
  cardItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  cardItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardItemInfo: { flex: 1 },
  cardItemName: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  cardItemStatus: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  cardItemConfidence: { fontSize: 11, fontWeight: '800', color: '#059669' },
});
