import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAppContext } from './AppContext';
import {
  performSync,
  onSyncStateChange,
  getSyncState,
  SyncState,
} from '../services/syncService';

interface SyncContextValue {
  syncState: SyncState;
  isOnline: boolean;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  syncState: 'idle',
  isOnline: true,
  triggerSync: async () => {},
});

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAppContext();
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [isOnline, setIsOnline] = useState(true);

  // Listen to sync state changes
  useEffect(() => {
    return onSyncStateChange(setSyncState);
  }, []);

  // Listen to network state (no auto-sync — user controls when to sync)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });

    return unsubscribe;
  }, []);

  const triggerSync = useCallback(async () => {
    if (user?.id && isOnline) {
      await performSync(user.id);
    }
  }, [user?.id, isOnline]);

  return (
    <SyncContext.Provider value={{ syncState, isOnline, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  return useContext(SyncContext);
}
