import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, Switch, ActivityIndicator,
  KeyboardAvoidingView, Platform, Linking, Animated, Dimensions,
  Modal, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getRecordById, updateRecord, deleteRecord, getRecordsByDA } from '@/db/recordRepository';
import { getDAByName } from '@/db/daRepository';
import { deletePhoto } from '@/services/photoService';
import { isValidTerminalDesignation } from '@/utils/validators';
import { StructureTypePicker } from '@/components/StructureTypePicker';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FiberRecord, StructureTypeId } from '@/types';
import { colors, spacing, radius } from '@/components/theme';
import { ScreenBackground, BG_COLOR } from '@/components/ScreenBackground';

export default function RecordDetailScreen() {
  const { id: daId, recordId } = useLocalSearchParams<{ id: string; recordId: string }>();
  const router = useRouter();

  // activeId tracks which record is displayed — starts from URL, changes on swipe
  const [activeId, setActiveId] = useState(recordId);
  const [record, setRecord] = useState<FiberRecord | null>(null);
  const [daName, setDaName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [structureType, setStructureType] = useState('');
  const [typeAbbrev, setTypeAbbrev] = useState<StructureTypeId>('HH');
  const [hasSC, setHasSC] = useState(false);
  const [hasTerminal, setHasTerminal] = useState(false);
  const [terminalDes, setTerminalDes] = useState('');
  const [notes, setNotes] = useState('');

  // Dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showZoom, setShowZoom] = useState(false);

  // Swipe navigation state
  const [siblingIds, setSiblingIds] = useState<string[]>([]);
  const translateX = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const scrollRef = useRef<ScrollView>(null);
  const swipingRef = useRef(false);

  // Sync activeId when URL param changes (e.g. navigating from search)
  useEffect(() => { setActiveId(recordId); }, [recordId]);

  // Load record data when activeId changes
  useEffect(() => { loadRecord(activeId); }, [activeId, daId]);

  async function loadRecord(id: string, showSpinner = true) {
    if (showSpinner) setLoading(true);
    const [r, da] = await Promise.all([
      getRecordById(id),
      getDAByName(daId),
    ]);
    if (r) {
      setRecord(r);
      populateEdit(r);
    }
    if (da) {
      setDaName(da.name);
      const siblings = await getRecordsByDA(da.id);
      setSiblingIds(siblings.map(s => s.id));
    }
    setLoading(false);
  }

  function populateEdit(r: FiberRecord) {
    setStructureType(r.structureType);
    setTypeAbbrev(r.typeAbbrev);
    setHasSC(r.hasSC);
    setHasTerminal(r.hasTerminal);
    setTerminalDes(r.terminalDesignation ?? '');
    setNotes(r.notes ?? '');
  }

  const handleSaveEdit = async () => {
    if (!structureType) {
      Alert.alert('Required', 'Please select a structure type.');
      return;
    }
    if (hasTerminal && !isValidTerminalDesignation(terminalDes)) {
      Alert.alert('Invalid Format', 'Terminal designation must be in x.x or x.xx format (e.g. 1.1, 2.13, 10.10).');
      return;
    }
    setSaving(true);
    try {
      await updateRecord(activeId, {
        structureType,
        typeAbbrev,
        hasSC,
        hasTerminal,
        terminalDesignation: hasTerminal ? terminalDes.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      await loadRecord(activeId, false);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePress = async () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!record) return;
    setShowDeleteConfirm(false);
    try {
      await deletePhoto(record.photoPath);
      await deleteRecord(record.id);
      router.back();
    } catch (e: any) {
      Alert.alert('Delete Failed', e.message ?? 'Unknown error');
    }
  };

  const navigateToSibling = useCallback(async (nextId: string, direction: 'left' | 'right') => {
    if (swipingRef.current) return;
    swipingRef.current = true;

    // Preload next record before animating
    const nextRecord = await getRecordById(nextId);
    if (!nextRecord) { swipingRef.current = false; return; }

    const exitValue = direction === 'left' ? -screenWidth : screenWidth;
    const enterValue = direction === 'left' ? screenWidth : -screenWidth;

    // Animate current content off-screen
    Animated.timing(translateX, {
      toValue: exitValue,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Swap data while off-screen
      setRecord(nextRecord);
      populateEdit(nextRecord);
      setActiveId(nextId);
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      // Position on opposite side, then animate in
      translateX.setValue(enterValue);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        swipingRef.current = false;
      });
    });
  }, [screenWidth, translateX]);

  const handleSwipe = useCallback(({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END && !editing) {
      const { translationX: tx, velocityX } = nativeEvent;
      const currentIdx = siblingIds.indexOf(activeId);
      if (currentIdx < 0) {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        return;
      }

      if ((tx < -50 || velocityX < -500) && currentIdx < siblingIds.length - 1) {
        navigateToSibling(siblingIds[currentIdx + 1], 'left');
      } else if ((tx > 50 || velocityX > 500) && currentIdx > 0) {
        navigateToSibling(siblingIds[currentIdx - 1], 'right');
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [editing, siblingIds, activeId, navigateToSibling, translateX]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  if (!record) {
    return <View style={styles.center}><Text style={styles.errorText}>Record not found.</Text></View>;
  }

  const currentIdx = siblingIds.indexOf(activeId);

  return (
    <View style={styles.outerContainer}>
    <ScreenBackground />
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: record.displayId }} />
      <PanGestureHandler
        onHandlerStateChange={handleSwipe}
        onGestureEvent={Animated.event(
          [{ nativeEvent: { translationX: translateX } }],
          { useNativeDriver: true }
        )}
        activeOffsetX={[-20, 20]}
        failOffsetY={[-20, 20]}
      >
      <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Photo — tap to zoom */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setShowZoom(true)}>
          <Image source={{ uri: record.photoPath }} style={styles.photo} resizeMode="cover" />
          <View style={styles.zoomHint}>
            <Text style={styles.zoomHintText}>Tap to zoom</Text>
          </View>
        </TouchableOpacity>

        {/* Record ID banner */}
        <View style={styles.idBanner}>
          <Text style={styles.recordId}>{record.displayId}</Text>
          <Text style={styles.daId}>{daName}</Text>
        </View>

        <View style={styles.body}>
          {editing ? (
            /* ── Edit mode ─────────────────────────────────── */
            <>
              <Text style={styles.label}>Structure Type *</Text>
              <StructureTypePicker
                selected={structureType}
                onSelect={(val, abbrev) => {
                  setStructureType(val);
                  setTypeAbbrev(abbrev);
                }}
              />

              <View style={styles.divider} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>SC — Splice Enclosure</Text>
                </View>
                <Switch
                  value={hasSC}
                  onValueChange={setHasSC}
                  trackColor={{ true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>T — Indexed Terminal</Text>
                </View>
                <Switch
                  value={hasTerminal}
                  onValueChange={v => { setHasTerminal(v); if (!v) setTerminalDes(''); }}
                  trackColor={{ true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              {hasTerminal && (
                <View style={styles.indented}>
                  <Text style={styles.label}>Terminal Designation *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2.13"
                    placeholderTextColor={colors.textSecondary}
                    value={terminalDes}
                    onChangeText={setTerminalDes}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              <View style={styles.divider} />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Optional notes..."
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => { setEditing(false); populateEdit(record); }}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.disabled]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>Save Changes</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* ── View mode ─────────────────────────────────── */
            <>
              <Field label="Structure Type" value={record.structureType} />
              <Field label="Splice Enclosure (SC)" value={record.hasSC ? 'Yes' : 'No'} />
              <Field
                label="Indexed Terminal (T)"
                value={record.hasTerminal
                  ? `Yes — ${record.terminalDesignation ?? ''}`
                  : 'No'}
              />
              {record.notes ? <Field label="Notes" value={record.notes} /> : null}
              <Field label="Recorded By" value={record.recordedBy} />
              <Field
                label="Created"
                value={new Date(record.createdAt).toLocaleString()}
              />
              {record.createdAt !== record.updatedAt && (
                <Field
                  label="Last Updated"
                  value={new Date(record.updatedAt).toLocaleString()}
                />
              )}

              {record.latitude != null && record.longitude != null && (
                <View style={styles.mapContainer}>
                  <WebView
                    style={styles.mapWebView}
                    originWhitelist={['*']}
                    scrollEnabled={false}
                    source={{ html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style></head><body><div id="map"></div><script>var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,touchZoom:false}).setView([${record.latitude},${record.longitude}],17);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);L.marker([${record.latitude},${record.longitude}]).addTo(map);</script></body></html>` }}
                  />
                  <TouchableOpacity
                    style={styles.mapOverlay}
                    onPress={() => {
                      const url = Platform.select({
                        ios: `maps:0,0?q=${record.latitude},${record.longitude}`,
                        android: `geo:0,0?q=${record.latitude},${record.longitude}`,
                      });
                      if (url) Linking.openURL(url);
                    }}
                  >
                    <Text style={styles.mapLabel}>Open in Maps</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.divider} />

              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnText}>Edit Record</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePress}>
                <Text style={styles.deleteBtnText}>Delete Record</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
      </Animated.View>
      </PanGestureHandler>

      {/* Swipe indicator */}
      {siblingIds.length > 1 && currentIdx >= 0 && (
        <View style={styles.swipeIndicator}>
          <Text style={styles.swipeText}>
            {currentIdx + 1} / {siblingIds.length}
          </Text>
        </View>
      )}

      {/* Fullscreen zoomable photo */}
      <Modal visible={showZoom} transparent animationType="fade" onRequestClose={() => setShowZoom(false)}>
        <StatusBar hidden={showZoom} />
        <View style={styles.zoomModal}>
          <ReactNativeZoomableView
            maxZoom={5}
            minZoom={1}
            initialZoom={1}
            bindToBorders
            contentWidth={screenWidth}
            contentHeight={screenWidth * 1.5}
          >
            <Image
              source={{ uri: record.photoPath }}
              style={{ width: screenWidth, height: screenWidth * 1.5 }}
              resizeMode="contain"
            />
          </ReactNativeZoomableView>
          <TouchableOpacity style={styles.zoomClose} onPress={() => setShowZoom(false)}>
            <Text style={styles.zoomCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Record"
        message={`Delete ${record.displayId}? This will permanently remove this record and its photo.`}
        confirmLabel="Delete"
        confirmDanger
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </SafeAreaView>
    </GestureHandlerRootView>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Text style={fieldStyles.value}>{value}</Text>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    color: '#fff',
  },
});

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: BG_COLOR },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
  },
  idBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordId: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Courier New',
  },
  daId: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Courier New',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  indented: { marginLeft: spacing.md, gap: spacing.xs },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: spacing.xs },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelEditBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  cancelEditText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  editBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    backgroundColor: 'rgba(254,226,226,0.92)',
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.7)',
    marginTop: spacing.xs,
  },
  deleteBtnText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  errorText: { fontSize: 16, color: '#fff' },
  disabled: { opacity: 0.5 },
  swipeIndicator: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 1,
  },
  swipeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  zoomHintText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  zoomModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  zoomCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  mapContainer: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    height: 200,
  },
  mapWebView: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
  },
  mapLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
