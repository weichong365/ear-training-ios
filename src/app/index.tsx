import { StatusBar } from 'expo-status-bar';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { HandIcon, type HandIconName } from '@/components/hand-icon';
import type { PracticeMode } from '@/core';
import { Brand, Radius, TouchTarget, TypeScale } from '@/constants/theme';
import { getPracticeRecords } from '@/services/local-data';
import { useSubscription } from '@/services/subscription';

type HomeItem = {
  id: PracticeMode | 'exam' | 'wrongbook' | 'stats';
  name: string;
  desc: string;
  icon: HandIconName;
  tone: 'mint' | 'accent' | 'coral' | 'amber';
};

// 与小程序首页 modes 保持一致：6 个训练项 + 智能强化（full）+ 错题/统计（quick-row）
const GRID_ITEMS: HomeItem[] = [
  { id: 'single', name: '单音听辨', desc: '五线谱定位与音高听写', icon: 'single-note', tone: 'mint' },
  { id: 'interval', name: '音程听辨', desc: '三五音组及旋律和声音程', icon: 'interval', tone: 'accent' },
  { id: 'chord', name: '和弦听辨', desc: '三和弦叠写与转位听辨', icon: 'chord', tone: 'coral' },
  { id: 'rhythm', name: '节奏听辨', desc: '拍号与四小节节奏听写', icon: 'rhythm', tone: 'amber' },
  { id: 'melody', name: '旋律听辨', desc: '拍调号与八小节旋律听写', icon: 'treble', tone: 'accent' },
  { id: 'exam', name: '模拟考试', desc: '全国各省真题 · 电子卷面答题', icon: 'mixed', tone: 'accent' },
];

const QUICK_ITEMS: HomeItem[] = [
  { id: 'wrongbook', name: '错题复盘', desc: '强化薄弱点', icon: 'book', tone: 'coral' },
  { id: 'stats', name: '练习统计', desc: '查看成长趋势', icon: 'stats', tone: 'amber' },
];

const SUBSCRIBE_ROUTE = '/subscribe' as Href;

export default function HomeScreen() {
  const { ready, isActive } = useSubscription();
  const [practiceStats, setPracticeStats] = useState({ total: 0, accuracy: 0 });

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

  function openMode(id: PracticeMode | 'exam') {
    if (!ready || !isActive) {
      router.push({ pathname: SUBSCRIBE_ROUTE, params: { target: id } } as Href);
      return;
    }
    if (id === 'exam') router.push('/exam');
    else router.push({ pathname: '/practice', params: { type: id } });
  }

  function openMemberRoute(pathname: '/wrongbook' | '/stats') {
    if (!ready || !isActive) router.push({ pathname: SUBSCRIBE_ROUTE, params: { reason: 'required' } } as Href);
    else router.push(pathname);
  }

  function openItem(id: HomeItem['id']) {
    if (id === 'wrongbook') openMemberRoute('/wrongbook');
    else if (id === 'stats') openMemberRoute('/stats');
    else openMode(id);
  }

  function itemColors(tone: HomeItem['tone']) {
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
          {GRID_ITEMS.map((item) => {
            const colors = itemColors(item.tone);
            return (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.name} accessibilityHint={item.desc} onPress={() => openItem(item.id)} style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}>
                <View style={[styles.modeIcon, colors.tile]}><HandIcon name={item.icon} size={30} color={colors.icon} /></View>
                <View style={styles.modeCopy}><Text numberOfLines={1} style={styles.modeName}>{item.name}</Text><Text numberOfLines={2} style={styles.modeDesc}>{item.desc}</Text></View>
                <AppIcon name="chevronRight" size={15} color="#68A07E" />
              </Pressable>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="智能强化" accessibilityHint="根据历史错题开始个性化训练" onPress={() => openMode('adaptive')} style={({ pressed }) => [styles.adaptiveCard, pressed && styles.pressed]}>
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
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.name} accessibilityHint={item.desc} onPress={() => openItem(item.id)} style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}>
                <View style={[styles.quickIcon, colors.tile]}><HandIcon name={item.icon} size={30} color={colors.icon} /></View>
                <View style={styles.quickCopy}><Text style={styles.quickTitle}>{item.name}</Text><Text style={styles.quickDesc}>{item.desc}</Text></View>
              </Pressable>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="给学长提建议" onPress={() => router.push('/support')} style={({ pressed }) => [styles.suggestionButton, pressed && styles.pressed]}>
          <Text style={styles.suggestionText}>👨‍🏫 请给学长提建议（听劝版）</Text>
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
  nav: { height: 48, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },
  content: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 36, gap: 8 },
  hero: { height: 110, overflow: 'hidden', borderRadius: 30, backgroundColor: '#0c0d0e' },
  heroImage: { opacity: 1, borderRadius: 0 },
  heroContent: { flex: 1, paddingHorizontal: 30, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', transform: [{ translateY: 73 }] },
  heroBrand: { flex: 1, minWidth: 0, paddingRight: 8 },
  heroTitle: { color: '#1f6f50', fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.5, textShadowColor: 'transparent' },
  heroSub: { marginTop: 3, color: '#1f6f50', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  heroData: { width: 106, height: 50, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: 'rgba(20,22,20,.62)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(244,234,213,.34)', transform: [{ translateY: 73 }, { scale: 0.78 }] },
  heroMetric: { flex: 1, alignItems: 'center' },
  metricNumber: { color: '#FFFFFF', fontSize: TypeScale.subheadline, lineHeight: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricLabel: { marginTop: 2, color: 'rgba(255,255,255,.74)', fontSize: 8, lineHeight: 11, fontWeight: '600' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 30, marginHorizontal: 5, backgroundColor: 'rgba(255,255,255,.30)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  gridCard: { width: '48.6%', aspectRatio: 1.7, padding: 12, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, backgroundColor: '#FFFCF5', shadowColor: '#6E604B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.055, shadowRadius: 7, elevation: 1 },
  modeIcon: { width: 48, height: 48, flexShrink: 0, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconMint: { backgroundColor: '#DCEFE3' },
  iconAccent: { backgroundColor: '#E4F0E8' },
  iconCoral: { backgroundColor: '#F5E4C9' },
  iconAmber: { backgroundColor: '#F8E7A9' },
  modeCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  modeName: { color: '#191C19', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  modeDesc: { marginTop: 3, color: '#718177', fontSize: 8, lineHeight: 12 },
  adaptiveCard: { minHeight: 75, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, borderWidth: 1, borderColor: '#B9DCCA', backgroundColor: '#E3F2E8' },
  targetIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  adaptiveCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  adaptiveLine: { flexDirection: 'row', alignItems: 'center' },
  adaptiveTitle: { color: '#167653', fontSize: 12, fontWeight: '900' },
  adaptiveTag: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', color: '#278F62', backgroundColor: '#CFE8D8', fontSize: 8, fontWeight: '700' },
  adaptiveDesc: { marginTop: 3, color: '#638173', fontSize: 8 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickItem: { flex: 1, minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, backgroundColor: '#FFFCF5', shadowColor: '#6E604B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.055, shadowRadius: 7, elevation: 1 },
  quickIcon: { width: 48, height: 48, flexShrink: 0, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  quickTitle: { color: '#191C19', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  quickDesc: { marginTop: 3, color: '#718177', fontSize: 9 },
  suggestionButton: { minHeight: 48, alignSelf: 'center', marginTop: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1.5, borderColor: '#187958', backgroundColor: '#FFFCF5' },
  suggestionText: { color: '#187958', fontSize: 10, fontWeight: '800' },
  aboutButton: { minHeight: TouchTarget, flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 7, paddingHorizontal: 14 },
  aboutText: { color: '#7A867E', fontSize: 8 },
  pressed: { opacity: 0.72 },
});
