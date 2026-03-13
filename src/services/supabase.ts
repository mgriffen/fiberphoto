import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dvmrvfamnmezqnfjkdsi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2bXJ2ZmFtbm1lenFuZmprZHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTI4ODIsImV4cCI6MjA4ODkyODg4Mn0.fx_yzM1lvPpJ--krjXNwXkObYiEV_7BuORAT0dvZc3U';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
