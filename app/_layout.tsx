import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { SyncProvider } from '@/context/SyncContext';
import { colors } from '@/components/theme';
import AuthScreen from './auth';

function AppContent() {
  const { session, isReady } = useAppContext();

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Not authenticated — show login screen
  if (!session) {
    return <AuthScreen />;
  }

  // Authenticated — show app wrapped in SyncProvider
  return (
    <SyncProvider>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'FiberPhoto', headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="da-list" options={{ title: 'Load Existing DA' }} />
      <Stack.Screen name="da/[id]" options={{ title: 'DA Detail' }} />
      <Stack.Screen
        name="da/[id]/camera"
        options={{ title: 'Take Photo', headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="da/[id]/record-new" options={{ title: 'New Record' }} />
      <Stack.Screen name="da/[id]/record/[recordId]" options={{ title: 'Record Detail' }} />
    </Stack>
    </SyncProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <AppContent />
    </AppProvider>
  );
}
