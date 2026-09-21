import { router, Stack, type Href, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { configureIOSAudio } from '@/services/audio-engine';
import { Brand } from '@/constants/theme';
import { ProvinceProvider, useProvince } from '@/services/province-context';
import { SubscriptionProvider, useSubscription } from '@/services/subscription';

SplashScreen.preventAutoHideAsync();

const PROTECTED_ROUTES = new Set(['practice', 'exam', 'exam-paper', 'wrongbook', 'stats']);
/** headerShown:false 的 Stack 路由：content 从屏幕顶开始，画「header 下沿分隔线」会跑到状态栏上方。 */
const HEADERLESS_ROUTES = new Set(['(tabs)', 'province-select']);
const SUBSCRIBE_ROUTE = '/subscribe' as Href;
const PROVINCE_ROUTE = '/province-select' as Href;
const DEV_WEB_PREVIEW = __DEV__ && Platform.OS === 'web';

function publicRouteFromSegments(segments: string[]) {
  return segments.find((segment) => !segment.startsWith('('));
}

function AppStack() {
  const segments = useSegments();
  const { ready, isActive } = useSubscription();
  const { ready: provinceReady, provinceId } = useProvince();

  useEffect(() => {
    const route = publicRouteFromSegments(segments);
    if (!DEV_WEB_PREVIEW && ready && !isActive && route && PROTECTED_ROUTES.has(route)) {
      router.replace({ pathname: SUBSCRIBE_ROUTE, params: { reason: 'required' } } as Href);
    }
  }, [isActive, ready, segments]);

  useEffect(() => {
    const route = publicRouteFromSegments(segments);
    if (!DEV_WEB_PREVIEW && provinceReady && !provinceId && route !== 'province-select') {
      router.replace(PROVINCE_ROUTE);
    }
  }, [provinceReady, provinceId, segments]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={({ route }) => ({
          // 顶部与底部 tabBar 同色（2026-09-17）：header 底用 ivory 纯白；页面内容仍是 cream 米白。
          headerStyle: { backgroundColor: Brand.ivory },
          headerTintColor: Brand.forestDeep,
          headerTitleStyle: { color: Brand.ink, fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: Brand.cream,
            // header 下沿的分隔线，与底部 tabBar 上沿那条线同源（Brand.hairline）。
            // headerShown:false 的路由没有 header 可贴，必须排除，否则线会画到状态栏上方。
            ...(HEADERLESS_ROUTES.has(route.name)
              ? null
              : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.hairline }),
          },
          headerBackButtonDisplayMode: 'minimal',
        })}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="province-select" options={{ headerShown: false }} />
        <Stack.Screen name="subscribe" options={{ title: '解锁练耳搭子', presentation: 'modal' }} />
        <Stack.Screen name="practice" options={{ title: '专项训练' }} />
        <Stack.Screen name="exam" options={{ title: '模拟考试' }} />
        <Stack.Screen name="exam-paper" options={{ title: '模拟试卷', gestureEnabled: false }} />
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
    <ProvinceProvider><SubscriptionProvider><AppStack /></SubscriptionProvider></ProvinceProvider>
  );
}
