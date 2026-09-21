import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_ICON_SIZE, TAB_ICONS, type TabIconKey } from '@/constants/tab-icons';
import { Brand } from '@/constants/theme';

/**
 * 底部 tabBar 图标 = **小程序原图**，按选中态切图。
 * 口径、来源与 25pt 的推导见 `src/constants/tab-icons.ts` 文件头；
 * 字节级同步由 `scripts/tab-icon-smoke.cjs` 守住。
 * ⚠️ 不要再退回 `AppIcon` 手绘分支 —— 那套与小程序有可见笔触差。
 */
function miniTabIcon(key: TabIconKey) {
  const MiniTabIcon = ({ focused }: { focused: boolean }) => (
    <Image
      source={focused ? TAB_ICONS[key].active : TAB_ICONS[key].normal}
      style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }}
      resizeMode="contain"
    />
  );
  MiniTabIcon.displayName = `MiniTabIcon(${key})`;
  return MiniTabIcon;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Brand.forest,
        tabBarInactiveTintColor: Brand.disabled,
        // 顶部露底色必须与底部 tabBar 同色（2026-09-17 口径）。错题/我的/举手 三页没有自绘顶栏，
        // 状态栏那一条是靠 sceneStyle 露出来的，所以用 ivory 纯白而不是 cream 米白。
        sceneStyle: { backgroundColor: Brand.ivory, paddingTop: route.name === 'index' ? 0 : insets.top },
        // ⚠️ 不要在这里覆盖底部导航栏的样式：底部那条上沿线来自框架默认 theme（colors.border），
        // 一旦覆盖就会连默认布局与底部安全区一起顶掉（scripts/answer-smoke.mjs:98 守着）。
        // 顶部各页引用的 Brand.hairline 就是「框架默认 border 的等价半透明写法」，
        // 关系由 scripts/nav-hairline-smoke.cjs 对账。
      })}>
      <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: miniTabIcon('index') }} />
      <Tabs.Screen name="wrongbook" options={{ title: '错题', tabBarIcon: miniTabIcon('wrongbook') }} />
      <Tabs.Screen name="stats" options={{ title: '我的', tabBarIcon: miniTabIcon('stats') }} />
      <Tabs.Screen name="about" options={{ title: '举手', tabBarIcon: miniTabIcon('about') }} />
    </Tabs>
  );
}
