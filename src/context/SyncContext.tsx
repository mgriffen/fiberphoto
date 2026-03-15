import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAppContext } from './AppContext';
import {
  performSync,
  onSyncStateChange,
  getSyncState,
  SyncState,
  SyncProgress,
} from '../services/syncService';

interface SyncContextValue {
  syncState: SyncState;
  syncProgress: SyncProgress | null;
  isOnline: boolean;
  triggerSync: () => Promise<void>;
  lastSyncedAt: number;
}

const SyncContext = createContext<SyncContextValue>({
  syncState: 'idle',
  syncProgress: null,
  isOnline: true,
  triggerSync: async () => {},
  lastSyncedAt: 0,
});

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAppContext();
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(0);

  useEffect(() => {
    return onSyncStateChange((state, progress) => {
      setSyncState(state);
      setSyncProgress(progress ?? null);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });

    return unsubscribe;
  }, []);

  const triggerSync = useCallback(async () => {
    if (user?.id && isOnline) {
      const result = await performSync(user.id);
      setLastSyncedAt(Date.now());
      if (result) {
        Alert.alert('Sync Complete', result);
      }
    }
  }, [user?.id, isOnline]);

  return (
    <SyncContext.Provider value={{ syncState, syncProgress, isOnline, triggerSync, lastSyncedAt }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  return useContext(SyncContext);
}
