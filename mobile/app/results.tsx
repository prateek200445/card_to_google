/**
 * app/results.tsx — Extracted results with export panel
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { CardResult } from '@/lib/gemini';
import { extractedResults } from '@/lib/store';
import ResultCard from '@/components/ResultCard';
import ExportPanel from '@/components/ExportPanel';

export default function ResultsScreen() {
  const router = useRouter();
  const [results, setResults] = useState<CardResult[]>([]);
  const [showFloat, setShowFloat] = useState(false);
  useEffect(() => {
    setResults([...extractedResults]);
  }, []);

  const doneCount = results.filter((r) => !r.error).length;
  const failedCount = results.filter((r) => r.error).length;

  const handleChange = (idx: number, updated: CardResult) => {
    setResults((prev) => prev.map((r, i) => (i === idx ? updated : r)));
  };

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    // Show after scrolling past the summary header and statistics (~120px)
    if (y > 120) {
      if (!showFloat) setShowFloat(true);
    } else {
      if (showFloat) setShowFloat(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBrand} onPress={() => router.replace('/')}>
          <View style={styles.navIcon}>
            <Ionicons name="flash" size={18} color="#fff" />
          </View>
          <Text style={styles.navTitle}>CardScan AI</Text>
        </TouchableOpacity>
        <View style={styles.navActions}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.navBtn}>
            <Ionicons name="refresh" size={16} color={Colors.onSurfaceVariant} />
            <Text style={styles.navBtnText}>New</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactsBtn} onPress={() => router.push('/contacts')}>
            <Ionicons name="book" size={16} color="#fff" />
            <Text style={styles.contactsBtnText}>Contacts</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryTitle}>Extracted Results</Text>
            <Text style={styles.summarySub}>{doneCount} cards extracted successfully</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: results.length, color: Colors.onSurface },
            { label: 'Success', value: doneCount, color: '#059669' },
            { label: 'Failed', value: failedCount, color: '#dc2626' },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Export panel */}
        <ExportPanel results={results} />

        {/* Result cards */}
        <View style={styles.cardGrid}>
          {results.map((r, i) => (
            <ResultCard
              key={i}
              result={r}
              index={i}
              onChange={(updated) => handleChange(i, updated)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Floating Scan Another Card Bubble */}
      {showFloat && (
        <TouchableOpacity
          style={styles.floatingBubble}
          activeOpacity={0.95}
          onPress={() => router.replace({ pathname: '/', params: { openCamera: 'true' } })}
        >
          <Ionicons name="scan" size={18} color="#fff" style={styles.bubbleIcon} />
          <Text style={styles.floatingBubbleText}>Scan Another Card</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 18,
    backgroundColor: 'rgba(253,251,247,0.95)',
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  navBtnText: { fontSize: 14, fontWeight: '600', color: Colors.onSurfaceVariant },
  contactsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.onSurface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  contactsBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  content: { padding: 16, paddingBottom: 96 },
  summaryRow: { marginBottom: 16 },
  summaryTitle: { fontSize: 24, fontWeight: '800', color: Colors.onSurface },
  summarySub: { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.onSurfaceVariant, marginTop: 2, letterSpacing: 0.5 },
  cardGrid: { gap: 14, marginTop: 8 },

  floatingBubble: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    gap: 8,
  },
  bubbleIcon: {
    marginRight: 2,
  },
  floatingBubbleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
