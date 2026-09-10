/**
 * app/contacts.tsx — All contacts from Google Sheet
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Colors } from '@/constants/colors';
import { useContacts } from '@/hooks/useContacts';
import { SheetContact } from '@/lib/sheets';
import { buildVcfFromContacts } from '@/lib/vcf';

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type SortKey = 'latest' | 'name' | 'company';

export default function ContactsScreen() {
  const router = useRouter();
  const { contacts, loading, error, load } = useContacts();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelected(new Set()); }, [sortKey, query]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const matched = contacts
      .map((c, i) => ({ c, i }))
      .filter(({ c }) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.phones.includes(q) ||
        c.emails.toLowerCase().includes(q)
      );

    return matched.sort((a, b) => {
      if (sortKey === 'latest') return b.i - a.i;
      const va = (a.c[sortKey as 'name' | 'company'] || '').toLowerCase();
      const vb = (b.c[sortKey as 'name' | 'company'] || '').toLowerCase();
      return va.localeCompare(vb);
    });
  }, [contacts, query, sortKey]);

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((_, i) => i)));
  };

  const saveSelectedToContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your contacts.');
      return;
    }

    const chosen = [...selected].map((i) => filtered[i].c);
    let saved = 0;
    for (const c of chosen) {
      const phones = c.phones.split(';').map((p) => p.trim()).filter(Boolean);
      const emails = c.emails.split(';').map((e) => e.trim()).filter(Boolean);

      await Contacts.addContactAsync({
        contactType: Contacts.ContactTypes.Person,
        name: c.name || c.company || 'Unknown',
        firstName: c.name.split(' ')[0] || '',
        lastName: c.name.split(' ').slice(1).join(' ') || '',
        company: c.company,
        jobTitle: c.job_title,
        phoneNumbers: phones.map((p) => ({ number: p, label: 'work' })),
        emails: emails.map((e) => ({ email: e, label: 'work' })),
        addresses: c.address
          ? [{ street: c.address, city: c.city, label: 'work' }]
          : [],
        note: c.remarks || '',
      });
      saved++;
    }

    Alert.alert('✓ Saved', `${saved} contact${saved > 1 ? 's' : ''} added to your phone.`);
    setSelected(new Set());
  };

  const shareVcf = async () => {
    const chosen = [...selected].map((i) => filtered[i].c);
    const vcf = buildVcfFromContacts(chosen);
    const path = `${FileSystem.cacheDirectory}contacts_export.vcf`;
    await FileSystem.writeAsStringAsync(path, vcf, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'text/vcard', dialogTitle: 'Share contacts' });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>All Contacts</Text>
        <TouchableOpacity onPress={load} disabled={loading} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color={loading ? Colors.surfaceBorder : Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.onSurfaceVariant} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, company, phone…"
          placeholderTextColor={Colors.onSurfaceVariant}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort pills */}
      <View style={styles.sortRow}>
        {(['latest', 'name', 'company'] as SortKey[]).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setSortKey(k)}
            style={[styles.sortPill, sortKey === k && styles.sortPillActive]}
          >
            <Text style={[styles.sortPillText, sortKey === k && styles.sortPillTextActive]}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.resultCount}>{filtered.length} results</Text>
      </View>

      {/* Select all */}
      {!loading && !error && filtered.length > 0 && (
        <View style={styles.selectAllRow}>
          <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
            <Ionicons
              name={selected.size === filtered.length ? 'checkbox' : 'square-outline'}
              size={22}
              color={selected.size === filtered.length ? Colors.secondary : Colors.onSurfaceVariant}
            />
            <Text style={styles.selectAllText}>
              {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
            </Text>
          </TouchableOpacity>
          {selected.size > 0 && (
            <Text style={styles.selectedCount}>{selected.size} selected</Text>
          )}
        </View>
      )}

      {/* States */}
      {loading && (
        <View style={styles.centered}>
          <Ionicons name="hourglass-outline" size={32} color={Colors.primary} />
          <Text style={styles.stateText}>Loading contacts…</Text>
        </View>
      )}
      {!loading && error && (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={32} color="#dc2626" />
          <Text style={[styles.stateText, { color: '#dc2626' }]}>{error}</Text>
        </View>
      )}
      {!loading && !error && filtered.length === 0 && (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={32} color={Colors.surfaceBorder} />
          <Text style={styles.stateText}>{query ? 'No matches found' : 'No contacts yet'}</Text>
        </View>
      )}

      {/* Contact cards */}
      {!loading && !error && filtered.length > 0 && (
        <ScrollView
          contentContainerStyle={[styles.listContent, selected.size > 0 && { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map(({ c }, i) => {
            const isOpen = expanded === i;
            const isSel = selected.has(i);
            const phones = c.phones.split(';').map((p) => p.trim()).filter(Boolean);
            const emails = c.emails.split(';').map((e) => e.trim()).filter(Boolean);

            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.contactCard,
                  isSel && styles.contactCardSelected,
                  isOpen && styles.contactCardOpen,
                ]}
                onPress={() => setExpanded(isOpen ? null : i)}
                activeOpacity={0.8}
              >
                {/* Select */}
                <TouchableOpacity
                  style={styles.checkboxBtn}
                  onPress={() => toggleSelect(i)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={isSel ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isSel ? Colors.secondary : Colors.onSurfaceVariant}
                  />
                </TouchableOpacity>

                {/* Avatar + info */}
                <View style={styles.contactRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(c.name)}</Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName} numberOfLines={1}>{c.name || 'Unknown'}</Text>
                    {c.job_title ? (
                      <Text style={styles.contactJob} numberOfLines={1}>
                        <Ionicons name="briefcase-outline" size={11} /> {c.job_title}
                      </Text>
                    ) : null}
                    {c.company ? (
                      <Text style={styles.contactCompany} numberOfLines={1}>
                        <Ionicons name="business-outline" size={11} /> {c.company}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {phones[0] ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={12} color="#059669" />
                    <Text style={styles.detailText} numberOfLines={1}>{phones[0]}</Text>
                    {phones.length > 1 && <Text style={styles.extraCount}>+{phones.length - 1}</Text>}
                  </View>
                ) : null}
                {emails[0] ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="mail-outline" size={12} color={Colors.primary} />
                    <Text style={styles.detailText} numberOfLines={1}>{emails[0]}</Text>
                  </View>
                ) : null}

                {isOpen && (
                  <View style={styles.expandedSection}>
                    {phones.slice(1).map((p, j) => (
                      <View key={j} style={styles.detailRow}>
                        <Ionicons name="call-outline" size={12} color="#059669" />
                        <Text style={styles.detailText}>{p}</Text>
                      </View>
                    ))}
                    {emails.slice(1).map((e, j) => (
                      <View key={j} style={styles.detailRow}>
                        <Ionicons name="mail-outline" size={12} color={Colors.primary} />
                        <Text style={styles.detailText}>{e}</Text>
                      </View>
                    ))}
                    {c.address ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={12} color="#d97706" />
                        <Text style={styles.detailText}>{c.address}</Text>
                      </View>
                    ) : null}
                    {c.remarks ? (
                      <View style={[styles.detailRow, { marginTop: 4 }]}>
                        <Ionicons name="chatbox-outline" size={12} color={Colors.secondary} />
                        <Text style={[styles.detailText, { fontStyle: 'italic' }]}>{c.remarks}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                <Text style={styles.tapHint}>{isOpen ? 'tap to collapse' : 'tap to expand'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Action bar when items selected */}
      {selected.size > 0 && (
        <View style={styles.actionBar}>
          <View style={styles.actionBarInfo}>
            <Text style={styles.actionBarTitle}>{selected.size} selected</Text>
            <Text style={styles.actionBarSub}>Save or share as contacts</Text>
          </View>
          <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareVcf} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={saveSelectedToContacts} style={styles.saveBtn}>
            <Ionicons name="person-add-outline" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  nav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  backBtn: { padding: 4, marginRight: 8 },
  navTitle: { flex: 1, fontSize: 21, fontWeight: '800', color: Colors.onSurface },
  refreshBtn: { padding: 4 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 14, color: Colors.onSurface },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  sortPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: '#fff',
  },
  sortPillActive: { backgroundColor: '#eef2ff', borderColor: Colors.primary },
  sortPillText: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant },
  sortPillTextActive: { color: Colors.primary },
  resultCount: { marginLeft: 'auto', fontSize: 11, fontWeight: '600', color: Colors.onSurfaceVariant },

  selectAllRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8,
  },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllText: { fontSize: 14, fontWeight: '700', color: Colors.onSurfaceVariant },
  selectedCount: { fontSize: 14, fontWeight: '700', color: Colors.secondary },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  stateText: { fontSize: 14, fontWeight: '600', color: Colors.onSurfaceVariant },

  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  contactCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  contactCardSelected: { borderColor: Colors.secondary, backgroundColor: '#fdf4ff' },
  contactCardOpen: { borderColor: Colors.primary, backgroundColor: '#f8faff' },
  checkboxBtn: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, paddingRight: 28 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  contactJob: { fontSize: 11, fontWeight: '600', color: Colors.secondary, marginTop: 2 },
  contactCompany: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailText: { fontSize: 12, color: Colors.onSurfaceVariant, flex: 1 },
  extraCount: { fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant },
  expandedSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder },
  tapHint: { fontSize: 10, color: Colors.onSurfaceVariant, textAlign: 'right', marginTop: 6, opacity: 0.4 },

  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.98)', 
    paddingHorizontal: 20, 
    paddingTop: 16, 
    paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 12,
  },
  actionBarInfo: { flex: 1 },
  actionBarTitle: { fontSize: 16, fontWeight: '800', color: Colors.onSurface },
  actionBarSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  clearBtnText: { fontSize: 14, fontWeight: '700', color: Colors.onSurfaceVariant },
  shareBtn: {
    backgroundColor: Colors.secondary, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
