/**
 * components/CameraCapture.tsx
 * Full-screen camera overlay with card alignment frame — mirrors web CameraCapture.tsx
 * Uses absolute-positioned View and BackHandler to bypass native Android Modal bugs.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onCapture: (uri: string) => void;
  onClose: () => void;
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const corners: Record<string, object> = {
    tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
    tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
    bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
    br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  };
  return <View style={[styles.corner, corners[pos]]} />;
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const [facing, setFacing] = React.useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Handle hardware back button on Android
  useEffect(() => {
    const backAction = () => {
      onClose();
      return true; // prevent default behavior (exit app)
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [onClose]);

  if (!permission?.granted) {
    requestPermission();
    return null;
  }

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      />

      {/* Dim + alignment frame */}
      <View style={styles.overlay}>
        <View style={styles.dimTop} />
        <View style={styles.middleRow}>
          <View style={styles.dimSide} />
          <View style={styles.frame}>
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
            <Text style={styles.frameLabel}>Align card within frame</Text>
          </View>
          <View style={styles.dimSide} />
        </View>
        <View style={styles.dimBottom} />
      </View>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topLabel}>Scan Card</Text>
        <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={styles.iconBtn}>
          <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <View style={styles.placeholderBtn} />
        <TouchableOpacity onPress={capture} style={styles.shutterOuter} activeOpacity={0.8}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={styles.flipBtn}>
          <Ionicons name="refresh" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Hold steady · Good lighting gives better results</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    zIndex: 10000,
  },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  dimTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  middleRow: { flexDirection: 'row', height: 230 },
  dimSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  frame: {
    width: 300, height: 190, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#a78bfa' },
  frameLabel: {
    color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
  },
  dimBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  topLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 48, paddingHorizontal: 48, paddingTop: 24,
    backgroundColor: '#000',
  },
  placeholderBtn: { width: 52, height: 52 },
  shutterOuter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
    shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  flipBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    position: 'absolute', bottom: 148, left: 0, right: 0, zIndex: 20,
    textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12,
  },
});
