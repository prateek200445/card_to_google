/**
 * components/ResultCard.tsx
 * Extracted card with inline field editing — mirrors web ResultCard.tsx
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { CardResult } from '@/lib/gemini';

type EF = 'name' | 'company' | 'address' | 'city' | 'job_title';

interface Props {
  result: CardResult;
  index: number;
  onChange: (updated: CardResult) => void;
}

export default function ResultCard({ result, index, onChange }: Props) {
  const [editing, setEditing] = useState<EF | null>(null);
  const [draft, setDraft] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const startEdit = (f: EF) => {
    setDraft((result[f] as string) || '');
    setEditing(f);
  };
  const commit = () => {
    if (!editing) return;
    onChange({ ...result, [editing]: draft });
    setEditing(null);
  };
  const cancel = () => setEditing(null);

  const pct = Math.round(result.confidence * 100);

  return (
    <View style={[styles.card, result.error && styles.cardError]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
          <Text style={styles.imageName} numberOfLines={1}>{result.image}</Text>
        </View>
        <View style={styles.badges}>
          <View style={styles.methodBadge}>
            <Ionicons name="sparkles" size={10} color={Colors.secondary} />
            <Text style={styles.methodText}>AI</Text>
          </View>
          <View style={[
            styles.confBadge,
            { backgroundColor: pct >= 70 ? '#f0fdf4' : pct >= 40 ? '#fffbeb' : '#fef2f2' },
          ]}>
            <Text style={[
              styles.confText,
              { color: pct >= 70 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626' },
            ]}>{pct}%</Text>
          </View>
        </View>
      </View>

      {result.error ? (
        <View style={styles.errorRow}>
          <Ionicons name="close-circle" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{result.error}</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <InlineField icon="person-outline" label="Name" value={result.name} field="name"
            editing={editing} draft={draft} onStart={startEdit} onChange={setDraft}
            onCommit={commit} onCancel={cancel} />
          <InlineField icon="briefcase-outline" label="Job Title" value={result.job_title} field="job_title"
            editing={editing} draft={draft} onStart={startEdit} onChange={setDraft}
            onCommit={commit} onCancel={cancel} />
          <InlineField icon="business-outline" label="Company" value={result.company} field="company"
            editing={editing} draft={draft} onStart={startEdit} onChange={setDraft}
            onCommit={commit} onCancel={cancel} />

          {/* Emails (read-only) */}
          <View style={styles.fieldRow}>
            <Ionicons name="mail-outline" size={16} color={Colors.primary} style={styles.fieldIcon} />
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              {result.emails.length > 0
                ? result.emails.map((e) => <Text key={e} style={styles.monoValue}>{e}</Text>)
                : <Text style={styles.emptyValue}>Not found</Text>}
            </View>
          </View>

          {/* Phones (read-only) */}
          <View style={styles.fieldRow}>
            <Ionicons name="call-outline" size={16} color={Colors.primary} style={styles.fieldIcon} />
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>PHONE</Text>
              {result.phones.length > 0
                ? result.phones.map((p) => <Text key={p} style={styles.monoValue}>{p}</Text>)
                : <Text style={styles.emptyValue}>Not found</Text>}
            </View>
          </View>

          <InlineField icon="location-outline" label="Address" value={result.address} field="address"
            editing={editing} draft={draft} onStart={startEdit} onChange={setDraft}
            onCommit={commit} onCancel={cancel} multiline />
          <InlineField icon="map-outline" label="City" value={result.city} field="city"
            editing={editing} draft={draft} onStart={startEdit} onChange={setDraft}
            onCommit={commit} onCancel={cancel} />

          {result.raw_text && (
            <TouchableOpacity onPress={() => setShowRaw((s) => !s)} style={styles.rawToggle}>
              <Ionicons name={showRaw ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.onSurfaceVariant} />
              <Text style={styles.rawToggleText}>{showRaw ? 'Hide' : 'Show'} raw OCR text</Text>
            </TouchableOpacity>
          )}
          {showRaw && result.raw_text && (
            <Text style={styles.rawText}>{result.raw_text}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function InlineField({
  icon, label, value, field, editing, draft,
  onStart, onChange, onCommit, onCancel, multiline = false,
}: {
  icon: string; label: string; value: string; field: EF;
  editing: EF | null; draft: string;
  onStart: (f: EF) => void; onChange: (v: string) => void;
  onCommit: () => void; onCancel: () => void; multiline?: boolean;
}) {
  const isEditing = editing === field;
  return (
    <View style={styles.fieldRow}>
      <Ionicons name={icon as any} size={16} color={Colors.primary} style={styles.fieldIcon} />
      <View style={styles.fieldContent}>
        <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
        {isEditing ? (
          <View>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={onChange}
              multiline={multiline}
              style={[styles.editInput, multiline && { height: 72 }]}
              onSubmitEditing={multiline ? undefined : onCommit}
            />
            <View style={styles.editActions}>
              <TouchableOpacity onPress={onCommit} style={styles.commitBtn}>
                <Ionicons name="checkmark" size={14} color="#059669" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Ionicons name="close" size={14} color="#dc2626" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.valueRow}>
            <Text style={value ? styles.fieldValue : styles.emptyValue} numberOfLines={multiline ? 0 : 1}>
              {value || 'Not found'}
            </Text>
            {editing === null && (
              <TouchableOpacity onPress={() => onStart(field)} style={styles.editBtn}>
                <Ionicons name="create-outline" size={13} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardError: { borderColor: '#fecaca' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceContainer + '20',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  indexBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center',
  },
  indexText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  imageName: { fontSize: 11, color: Colors.onSurfaceVariant, flex: 1 },
  badges: { flexDirection: 'row', gap: 6 },
  methodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#e9d5ff',
  },
  methodText: { fontSize: 10, fontWeight: '700', color: Colors.secondary },
  confBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  confText: { fontSize: 10, fontWeight: '800' },

  body: { padding: 14, gap: 12 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  errorText: { fontSize: 13, color: '#dc2626', flex: 1 },

  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldIcon: { marginTop: 14 },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 9, fontWeight: '700', color: Colors.onSurfaceVariant, letterSpacing: 0.8, marginBottom: 2 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: Colors.onSurface },
  monoValue: { fontSize: 13, color: Colors.onSurface, fontFamily: 'monospace', marginTop: 1 },
  emptyValue: { fontSize: 13, color: Colors.onSurfaceVariant, fontStyle: 'italic' },
  valueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  editBtn: { padding: 4 },

  editInput: {
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: Colors.onSurface,
    backgroundColor: '#f8faff',
  },
  editActions: { flexDirection: 'row', gap: 6, marginTop: 6 },
  commitBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f0fdf4' },
  cancelBtn: { padding: 6, borderRadius: 8, backgroundColor: '#fef2f2' },

  rawToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rawToggleText: { fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant },
  rawText: {
    fontSize: 11, color: Colors.onSurfaceVariant, fontFamily: 'monospace',
    backgroundColor: Colors.surfaceContainer, borderRadius: 10, padding: 10, marginTop: 6,
    lineHeight: 16,
  },
});
