import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '@/context/AppContext';
import { colors } from '@/components/theme';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'FiberPhoto', headerShown: false }} />
        <Stack.Screen name="da-list" options={{ title: 'Load Existing DA' }} />
        <Stack.Screen name="da/[id]" options={{ title: 'DA Detail' }} />
        <Stack.Screen
          name="da/[id]/camera"
          options={{ title: 'Take Photo', headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen name="da/[id]/record-new" options={{ title: 'New Record' }} />
        <Stack.Screen name="da/[id]/record/[recordId]" options={{ title: 'Record Detail' }} />
      </Stack>
    </AppProvider>
  );
}
