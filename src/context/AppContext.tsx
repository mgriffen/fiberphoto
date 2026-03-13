import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { getDatabase } from '../db/database';

interface AppContextValue {
  session: Session | null;
  user: User | null;
  userName: string;
  isReady: boolean;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue>({
  session: null,
  user: null,
  userName: '',
  isReady: false,
  signOut: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      await getDatabase(); // ensure schema is initialised

      // Restore existing session
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      setSession(existingSession);
      setIsReady(true);
    })();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const user = session?.user ?? null;
  const userName = user?.user_metadata?.display_name
    ?? user?.email?.split('@')[0]
    ?? '';

  return (
    <AppContext.Provider value={{ session, user, userName, isReady, signOut }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
