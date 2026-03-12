import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  PhotoFile,
} from 'react-native-vision-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing } from '@/components/theme';

export default function CameraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const [capturing, setCapturing] = useState(false);
  const [useUltraWide, setUseUltraWide] = useState(true);

  // Try ultra-wide first, fall back to wide
  const ultraWideDevice = useCameraDevice('back', {
    physicalDevices: ['ultra-wide-angle-camera'],
  });
  const wideDevice = useCameraDevice('back', {
    physicalDevices: ['wide-angle-camera'],
  });

  const device = useUltraWide && ultraWideDevice ? ultraWideDevice : wideDevice;
  const hasUltraWide = !!ultraWideDevice;

  const handlePermission = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        'Camera Permission',
        'Camera access is required. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  }, [requestPermission]);

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permText}>Camera access is required to take photos.</Text>
        <TouchableOpacity style={styles.btn} onPress={handlePermission}>
          <Text style={styles.btnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permText}>No camera device found.</Text>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto({
        flash: 'off',
      });
      router.replace({
        pathname: `/da/${id}/record-new`,
        params: { tempUri: `file://${photo.path}` },
      });
    } catch (e: any) {
      Alert.alert('Capture Error', e.message ?? 'Failed to take photo');
      setCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        photo={true}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.daLabel}>{id}</Text>
          {hasUltraWide ? (
            <TouchableOpacity
              style={styles.lensBtn}
              onPress={() => setUseUltraWide(prev => !prev)}
            >
              <Text style={styles.lensText}>{useUltraWide ? '0.5x' : '1x'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>

        {/* Capture button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.shutterOuter, capturing && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={capturing}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: { flex: 1, width: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cancelBtn: { padding: spacing.sm },
  cancelText: { color: '#fff', fontSize: 16 },
  daLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Courier New',
  },
  lensBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    width: 50,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lensText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBar: {
    paddingBottom: spacing.xl + spacing.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: spacing.lg,
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },
  shutterDisabled: { opacity: 0.5 },
  permText: { color: '#fff', fontSize: 16, textAlign: 'center', padding: spacing.lg },
  btn: {
    backgroundColor: colors.accent,
    padding: spacing.md,
    borderRadius: 10,
    margin: spacing.lg,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
