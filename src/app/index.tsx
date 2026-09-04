import { StatusBar } from 'expo-status-bar';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { HandIcon, type HandIconName } from '@/components/hand-icon';
import { getProvincePracticeModules, PROVINCES, type ProvincePracticeModule } from '@/core/provinces';
import { Brand, Radius, Shadows, TouchTarget, TypeScale } from '@/constants/theme';
import { getPracticeRecords } from '@/services/local-data';
import { useProvince } from '@/services/province-context';
import { useSubscription } from '@/services/subscription';

type GridItem = {
  key: string;
  name: string;
  desc: string;
  icon: HandIconName;
  tone: 'mint' | 'accent' | 'coral' | 'amber';
  onPress: () => void;
};

const SUBSCRIBE_ROUTE = '/subscribe' as Href;

const QUICK_ITEMS: Omit<GridItem, 'onPress'>[] = [
  { key: 'wrongbook', name: '错题复盘', desc: '强化薄弱点', icon: 'book', tone: 'coral' },
  { key: 'stats', name: '练习统计', desc: '查看成长趋势', icon: 'stats', tone: 'amber' },
];

export default function HomeScreen() {
  const { ready, isActive } = useSubscription();
  const { provinceId } = useProvince();
  const [practiceStats, setPracticeStats] = useState({ total: 0, accuracy: 0 });

  const modules = useMemo(
    () => (provinceId ? getProvincePracticeModules(provinceId) : []),
    [provinceId],
  );
  const provinceLabel = useMemo(
    () => PROVINCES.find((province) => province.id === provinceId)?.label,
    [provinceId],
  );
  useFocusEffect(useCallback(() => {
    let mounted = true;
    getPracticeRecords().then((records) => {
      if (!mounted) return;
      const correct = records.filter((record) => record.correct).length;
      setPracticeStats({
        total: records.length,
        accuracy: records.length ? Math.round(correct / records.length * 100) : 0,
      });
    });
    return () => { mounted = false; };
  }, []));

  function openModule(module: ProvincePracticeModule) {
    if (!ready || !isActive) {
      router.push({ pathname: SUBSCRIBE_ROUTE, params: { target: module.type, tier: String(module.tier) } } as Href);
      return;
    }
    router.push({ pathname: '/practice', params: { type: module.type, tier: String(module.tier) } });
  }

  function openExam() {
    if (!ready || !isActive) {
      router.push({ pathname: SUBSCRIBE_ROUTE, params: { target: 'exam' } } as Href);
      return;
    }
    router.push('/exam');
  }

  function openAdaptive() {
    if (!ready || !isActive) {
      router.push({ pathname: SUBSCRIBE_ROUTE, params: { target: 'adaptive' } } as Href);
      return;
    }
    router.push({ pathname: '/practice', params: { type: 'adaptive' } });
  }

  function openMemberRoute(pathname: '/wrongbook' | '/stats') {
    if (!ready || !isActive) router.push({ pathname: SUBSCRIBE_ROUTE, params: { reason: 'required' } } as Href);
    else router.push(pathname);
  }

  const gridItems: GridItem[] = [
    ...modules.map((module) => ({
      key: module.type,
      name: module.name,
      desc: module.desc,
      icon: module.icon as HandIconName,
      tone: module.tone,
      onPress: () => openModule(module),
    })),
    { key: 'exam', name: '模拟考试', desc: '全国各省真题 · 电子卷面答题', icon: 'mixed', tone: 'accent', onPress: openExam },
  ];

  function itemColors(tone: GridItem['tone']) {
    if (tone === 'coral') return { tile: styles.iconCoral, icon: '#B98232' };
    if (tone === 'amber') return { tile: styles.iconAmber, icon: '#C28B24' };
    if (tone === 'mint') return { tile: styles.iconMint, icon: '#2E8B57' };
    return { tile: styles.iconAccent, icon: '#2E8B57' };
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.nav}>
          <Text style={styles.navTitle}>练耳搭子</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`当前省份${provinceLabel || '未选择'}，点击切换`} onPress={() => router.push('/province-select?switch=1')} style={styles.provinceChip}>
            <Text style={styles.provinceChipText}>{provinceLabel || '选择省份'}</Text>
            <AppIcon name="chevronDown" size={13} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ImageBackground source={require('../../assets/images/hero-piano-keys.jpg')} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroContent}>
            <View style={styles.heroBrand}>
              <Text style={styles.heroTitle}>练耳搭子</Text>
              <Text numberOfLines={1} style={styles.heroSub}>音乐艺考 · 视唱练耳专项训练</Text>
            </View>
            <View style={styles.heroData}>
              <View style={styles.heroMetric}><Text style={styles.metricNumber}>{practiceStats.total}</Text><Text style={styles.metricLabel}>累计练习</Text></View>
              <View style={styles.metricDivider} />
              <View style={styles.heroMetric}><Text style={styles.metricNumber}>{practiceStats.accuracy}%</Text><Text style={styles.metricLabel}>正确率</Text></View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.grid}>
          {gridItems.map((item) => {
            const colors = itemColors(item.tone);
            return (
              <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.name} accessibilityHint={item.desc} onPress={item.onPress} style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}>
                <View style={[styles.modeIcon, colors.tile]}><HandIcon name={item.icon} size={30} color={colors.icon} /></View>
                <View style={styles.modeCopy}><Text numberOfLines={2} style={styles.modeName}>{item.name}</Text><Text numberOfLines={2} style={styles.modeDesc}>{item.desc}</Text></View>
                <AppIcon name="chevronRight" size={15} color="#68A07E" />
              </Pressable>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="智能强化" accessibilityHint="根据历史错题开始个性化训练" onPress={openAdaptive} style={({ pressed }) => [styles.adaptiveCard, pressed && styles.pressed]}>
          <View style={styles.targetIcon}><HandIcon name="target" size={30} color="#2E8B57" /></View>
          <View style={styles.adaptiveCopy}>
            <View style={styles.adaptiveLine}><Text style={styles.adaptiveTitle}>智能强化</Text><Text style={styles.adaptiveTag}>个性推荐</Text></View>
            <Text numberOfLines={1} style={styles.adaptiveDesc}>按薄弱题型生成专项试题训练</Text>
          </View>
          <AppIcon name="chevronRight" size={17} color="#68A07E" />
        </Pressable>

        <View style={styles.quickRow}>
          {QUICK_ITEMS.map((item) => {
            const colors = itemColors(item.tone);
            return (
              <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.name} accessibilityHint={item.desc} onPress={() => openMemberRoute(item.key as '/wrongbook' | '/stats')} style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}>
                <View style={[styles.quickIcon, colors.tile]}><HandIcon name={item.icon} size={30} color={colors.icon} /></View>
                <View style={styles.quickCopy}><Text style={styles.quickTitle}>{item.name}</Text><Text style={styles.quickDesc}>{item.desc}</Text></View>
              </Pressable>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="给学长提建议" onPress={() => router.push('/support')} style={({ pressed }) => [styles.suggestionButton, pressed && styles.pressed]}>
          <AppIcon name="message" size={18} color={Brand.forest} />
          <Text style={styles.suggestionText}>给学长提建议</Text>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="关于与音色版权" onPress={() => router.push('/about')} style={({ pressed }) => [styles.aboutButton, pressed && styles.pressed]}>
          <AppIcon name="info" size={19} color={Brand.ink} />
          <Text style={styles.aboutText}>关于与音色版权</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5ECD9' },
  safe: { backgroundColor: '#202438' },
  nav: { minHeight: 48, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  navTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },
  provinceChip: { minHeight: TouchTarget, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.14)' },
  provinceChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 36, gap: 8 },
  hero: { height: 110, overflow: 'hidden', borderRadius: 30, backgroundColor: '#0c0d0e' },
  heroImage: { opacity: 1, borderRadius: 0 },
  heroContent: { flex: 1, paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroBrand: { flex: 1, minWidth: 0, paddingRight: 8 },
  heroTitle: { color: '#1f6f50', fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.5, textShadowColor: 'transparent' },
  heroSub: { marginTop: 3, color: '#1f6f50', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  heroData: { width: 86, height: 42, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', borderRadius: 11, backgroundColor: 'rgba(20,22,20,.62)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(244,234,213,.34)' },
  heroMetric: { flex: 1, alignItems: 'center' },
  metricNumber: { color: '#FFFFFF', fontSize: TypeScale.subheadline, lineHeight: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricLabel: { marginTop: 2, color: 'rgba(255,255,255,.74)', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 26, marginHorizontal: 4, backgroundColor: 'rgba(255,255,255,.30)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  gridCard: { width: '48.6%', minHeight: 112, padding: 12, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, backgroundColor: '#FFFCF5', ...Shadows.card },
  modeIcon: { width: 48, height: 48, flexShrink: 0, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconMint: { backgroundColor: '#DCEFE3' },
  iconAccent: { backgroundColor: '#E4F0E8' },
  iconCoral: { backgroundColor: '#F5E4C9' },
  iconAmber: { backgroundColor: '#F8E7A9' },
  modeCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  modeName: { color: '#191C19', fontSize: TypeScale.footnote, lineHeight: 17, fontWeight: '900' },
  modeDesc: { marginTop: 3, color: '#66776C', fontSize: 11, lineHeight: 15 },
  adaptiveCard: { minHeight: 75, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, borderWidth: 1, borderColor: '#B9DCCA', backgroundColor: '#E3F2E8' },
  targetIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  adaptiveCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  adaptiveLine: { flexDirection: 'row', alignItems: 'center' },
  adaptiveTitle: { color: '#167653', fontSize: TypeScale.footnote, fontWeight: '900' },
  adaptiveTag: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', color: '#237A57', backgroundColor: '#CFE8D8', fontSize: 11, fontWeight: '700' },
  adaptiveDesc: { marginTop: 3, color: '#587567', fontSize: 11, lineHeight: 15 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickItem: { flex: 1, minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, backgroundColor: '#FFFCF5', ...Shadows.card },
  quickIcon: { width: 48, height: 48, flexShrink: 0, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  quickTitle: { color: '#191C19', fontSize: TypeScale.footnote, lineHeight: 17, fontWeight: '900' },
  quickDesc: { marginTop: 3, color: '#66776C', fontSize: 11, lineHeight: 15 },
  suggestionButton: { minHeight: 48, flexDirection: 'row', gap: 7, alignSelf: 'center', marginTop: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1.5, borderColor: '#187958', backgroundColor: '#FFFCF5' },
  suggestionText: { color: '#187958', fontSize: TypeScale.footnote, fontWeight: '800' },
  aboutButton: { minHeight: TouchTarget, flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 7, paddingHorizontal: 14 },
  aboutText: { color: '#66756C', fontSize: TypeScale.caption },
  pressed: { opacity: 0.72 },
});
