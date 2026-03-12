import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getDatabase } from '../db/database';
import { getSetting, setSetting } from '../db/recordRepository';

interface AppContextValue {
  userName: string;
  setUserName: (name: string) => Promise<void>;
  isReady: boolean;
}

const AppContext = createContext<AppContextValue>({
  userName: '',
  setUserName: async () => {},
  isReady: false,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [userName, setUserNameState] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      await getDatabase(); // ensure schema is initialised
      const stored = await getSetting('userName');
      if (stored) setUserNameState(stored);
      setIsReady(true);
    })();
  }, []);

  const setUserName = async (name: string) => {
    await setSetting('userName', name);
    setUserNameState(name);
  };

  return (
    <AppContext.Provider value={{ userName, setUserName, isReady }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
