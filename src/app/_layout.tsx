import {
  Archivo_400Regular, Archivo_600SemiBold, Archivo_800ExtraBold, useFonts,
} from '@expo-google-fonts/archivo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigator() {
  const theme = useTheme();
  const dark = theme.chrome.dark;
  // Browser-drawn chrome (scroll bars, form controls) follows the page's
  // declared scheme, not the app's colours: say which one this is.
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.chrome.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="tunings" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Archivo is the interface face on Android and the web; iOS uses the
  // system face (see `theme/faces.ts`). Nothing renders until it has loaded.
  const [fontsLoaded, fontError] = useFonts({ Archivo_400Regular, Archivo_600SemiBold, Archivo_800ExtraBold });
  const scheme = useColorScheme();

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider chrome={scheme === 'dark' ? 'quiet' : 'paper'}>
        <Navigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
