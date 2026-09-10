/**
 * components/ExportPanel.tsx
 * Export buttons: Google Sheets, Excel, Save to Contacts
 * Mirrors web ExportPanel.tsx
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Colors } from '@/constants/colors';
import { CardResult } from '@/lib/gemini';
import { appendToSheet } from '@/lib/sheets';
import { exportToExcel } from '@/lib/excel';

interface Props {
  results: CardResult[];
}

export default function ExportPanel({ results }: Props) {
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  const validResults = results.filter((r) => !r.error);

  const handleSheets = async () => {
    setSheetsLoading(true);
    setSheetsUrl(null);
    try {
      const url = await appendToSheet(validResults, remarks);
      setSheetsUrl(url);
      Alert.alert('✓ Success', 'Data appended to Google Sheets!', [
        { text: 'Open Sheet', onPress: () => Linking.openURL(url) },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to push to Google Sheets');
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      await exportToExcel(validResults, remarks);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Excel export failed');
    } finally {
      setExcelLoading(false);
    }
  };

  const handleContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your contacts.');
      return;
    }

    let saved = 0;
    for (const r of validResults) {
      await Contacts.addContactAsync({
        contactType: Contacts.ContactTypes.Person,
        name: r.name || r.company || 'Unknown',
        firstName: r.name.split(' ')[0] || '',
        lastName: r.name.split(' ').slice(1).join(' ') || '',
        company: r.company,
        jobTitle: r.job_title,
        phoneNumbers: r.phones.map((p) => ({ number: p, label: 'work' })),
        emails: r.emails.map((e) => ({ email: e, label: 'work' })),
        addresses: r.address
          ? [{ street: r.address, city: r.city, label: 'work' }]
          : [],
        note: remarks || '',
      });
      saved++;
    }
    Alert.alert('✓ Saved', `${saved} contact${saved > 1 ? 's' : ''} added to your phone contacts.`);
  };

  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Export Results</Text>
        <Text style={styles.panelSub}>{validResults.length} of {results.length} cards ready</Text>
      </View>

      {/* Remarks */}
      <View style={styles.remarksWrap}>
        <View style={styles.remarksLabelRow}>
          <Ionicons name="chatbox-outline" size={13} color={Colors.primary} />
          <Text style={styles.remarksLabel}>REMARKS</Text>
        </View>
        <TextInput
          style={styles.remarksInput}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Add notes about this batch…"
          placeholderTextColor={Colors.onSurfaceVariant}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        {/* Excel */}
        <TouchableOpacity
          style={[styles.btn, styles.excelBtn]}
          onPress={handleExcel}
          disabled={excelLoading || validResults.length === 0}
          activeOpacity={0.85}
        >
          {excelLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="download-outline" size={18} color="#fff" />}
          <Text style={styles.btnText}>Download Excel</Text>
        </TouchableOpacity>

        {/* Google Sheets */}
        <TouchableOpacity
          style={[styles.btn, styles.sheetsBtn]}
          onPress={handleSheets}
          disabled={sheetsLoading || validResults.length === 0}
          activeOpacity={0.85}
        >
          {sheetsLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="logo-google" size={18} color="#fff" />}
          <Text style={styles.btnText}>Push to Sheets</Text>
        </TouchableOpacity>

        {/* Contacts */}
        <TouchableOpacity
          style={[styles.btn, styles.contactsBtn]}
          onPress={handleContacts}
          disabled={validResults.length === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.btnText}>Save to Contacts</Text>
        </TouchableOpacity>
      </View>

      {/* Sheets link after success */}
      {sheetsUrl && (
        <TouchableOpacity style={styles.sheetsLink} onPress={() => Linking.openURL(sheetsUrl)}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
          <Text style={styles.sheetsLinkText}>Appended! Tap to open sheet</Text>
          <Ionicons name="open-outline" size={14} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
    marginBottom: 20,
  },
  panelHeader: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceContainer + '15',
  },
  panelTitle: { fontSize: 15, fontWeight: '800', color: Colors.onSurface },
  panelSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },

  remarksWrap: { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  remarksLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  remarksLabel: { fontSize: 10, fontWeight: '700', color: Colors.onSurfaceVariant, letterSpacing: 0.8 },
  remarksInput: {
    borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainer + '30', minHeight: 72,
  },

  buttons: { padding: 14, gap: 10 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 30,
  },
  btnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  excelBtn: { backgroundColor: '#059669' },
  sheetsBtn: { backgroundColor: Colors.primary },
  contactsBtn: { backgroundColor: Colors.secondary },

  sheetsLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginBottom: 14,
    backgroundColor: '#eef2ff', borderRadius: 12, padding: 12,
  },
  sheetsLinkText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.primary },
});
