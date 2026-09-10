import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Brand } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Brand.forest,
        tabBarInactiveTintColor: Brand.disabled,
        sceneStyle: { backgroundColor: Brand.cream, paddingTop: route.name === 'index' ? 0 : insets.top },
      })}>
      <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: ({ color }) => <AppIcon name="headphones" size={24} color={color} /> }} />
      <Tabs.Screen name="wrongbook" options={{ title: '错题', tabBarIcon: ({ color }) => <AppIcon name="wrongbookTab" size={24} color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: '我的', tabBarIcon: ({ color }) => <AppIcon name="profile" size={24} color={color} /> }} />
      <Tabs.Screen name="about" options={{ title: '举手', tabBarIcon: ({ color }) => <AppIcon name="hand" size={24} color={color} /> }} />
    </Tabs>
  );
}
