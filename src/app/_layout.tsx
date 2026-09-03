import { router, Stack, type Href, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { configureIOSAudio } from '@/services/audio-engine';
import { Brand } from '@/constants/theme';
import { SubscriptionProvider, useSubscription } from '@/services/subscription';

SplashScreen.preventAutoHideAsync();

const PROTECTED_ROUTES = new Set(['practice', 'exam', 'exam-paper', 'wrongbook', 'stats']);
const SUBSCRIBE_ROUTE = '/subscribe' as Href;
const DEV_WEB_PREVIEW = __DEV__ && Platform.OS === 'web';

function AppStack() {
  const segments = useSegments();
  const { ready, isActive } = useSubscription();

  useEffect(() => {
    const route = segments[0];
    if (!DEV_WEB_PREVIEW && ready && !isActive && route && PROTECTED_ROUTES.has(route)) {
      router.replace({ pathname: SUBSCRIBE_ROUTE, params: { reason: 'required' } } as Href);
    }
  }, [isActive, ready, segments]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Brand.cream },
          headerTintColor: Brand.forestDeep,
          headerTitleStyle: { color: Brand.ink, fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Brand.cream },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="subscribe" options={{ title: '解锁练耳搭子', presentation: 'modal' }} />
        <Stack.Screen name="practice" options={{ title: '专项训练' }} />
        <Stack.Screen name="exam" options={{ title: '模拟考试' }} />
        <Stack.Screen name="exam-paper" options={{ title: '模拟试卷', gestureEnabled: false }} />
        <Stack.Screen name="wrongbook" options={{ title: '错题复盘' }} />
        <Stack.Screen name="stats" options={{ title: '练习统计' }} />
        <Stack.Screen name="about" options={{ title: '关于练耳搭子' }} />
        <Stack.Screen name="privacy" options={{ title: '隐私政策' }} />
        <Stack.Screen name="terms" options={{ title: '订阅与使用条款' }} />
        <Stack.Screen name="support" options={{ title: '使用帮助' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    Promise.all([configureIOSAudio(), SplashScreen.hideAsync()]).catch(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <SubscriptionProvider><AppStack /></SubscriptionProvider>
  );
}
