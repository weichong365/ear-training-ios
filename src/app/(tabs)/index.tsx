import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { getProvincePracticeModules, hasDedicatedFramework, PROVINCES, type ProvincePracticeModule } from '@/core/provinces';
import { Btn, hitSlopFor } from '@/constants/button-tokens';
import { Brand, Shadows, TypeScale } from '@/constants/theme';
import { getPracticeStats } from '@/services/local-data';
import { useProvince } from '@/services/province-context';
import { useSubscription } from '@/services/subscription';

type HomeIconName = 'single-note' | 'triplet' | 'interval' | 'chord' | 'rhythm' | 'treble' | 'mixed' | 'target';
type GridItem = { key: string; name: string; desc: string; icon: HomeIconName; onPress: () => void };

const SUBSCRIBE_ROUTE = '/subscribe' as Href;
const HERO_WAVE_HEIGHTS = [17, 34, 24, 42, 30, 50, 22, 38, 26];
const HOME_ICONS = {
  'single-note': require('../../../assets/home-icons/single-note.png'),
  triplet: require('../../../assets/home-icons/triplet.png'),
  interval: require('../../../assets/home-icons/interval.png'),
  chord: require('../../../assets/home-icons/chord.png'),
  rhythm: require('../../../assets/home-icons/rhythm.png'),
  treble: require('../../../assets/home-icons/treble.png'),
  mixed: require('../../../assets/home-icons/mixed.png'),
  target: require('../../../assets/home-icons/target.png'),
} as const;

export default function HomeScreen() {
  const { ready, configured, isActive } = useSubscription();
  const { provinceId } = useProvince();
  const [practiceStats, setPracticeStats] = useState({ todayCount: 0, todayAccuracy: 0 });
  const province = useMemo(() => PROVINCES.find((item) => item.id === provinceId), [provinceId]);
  const modules = useMemo(() => (provinceId ? getProvincePracticeModules(provinceId) : []), [provinceId]);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    getPracticeStats().then((stats) => {
      if (mounted) setPracticeStats({ todayCount: stats.todayCount, todayAccuracy: stats.todayAccuracy });
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

  const gridItems: GridItem[] = [
    ...modules.map((module) => ({ key: module.type, name: module.name, desc: module.desc, icon: module.icon as HomeIconName, onPress: () => openModule(module) })),
    { key: 'exam', name: '模拟考试', desc: '全国各省真题 · 电子卷面答题', icon: 'mixed', onPress: openExam },
  ];

  // 小程序 index.js refreshProvince：专项卡片 + 模拟考试共 N 张，
  // N 为偶数 → 智能强化整行独占（wide）；N 为奇数 → 补末行右半（short），
  // 避免首页最后一格留空。卡片集合本身随省份变化（7 模块通用省 / 6 模块专有省）。
  const adaptiveShort = (modules.length + 1) % 2 !== 0;
  const adaptiveCard = { name: '智能强化', desc: '按薄弱项生成专项练习', icon: 'target' as HomeIconName, onPress: openAdaptive };

  const memberTitle = !ready ? '正在同步' : !configured ? '免费开放' : isActive ? '会员权益' : '未开通会员';
  const memberSummary = !ready ? '请稍候' : !configured ? '当前版本全部功能免费' : isActive ? '全部训练已解锁' : '开通后解锁全部训练';
  const memberAction = !ready ? '同步中' : !configured ? '免费开放' : isActive ? '会员有效' : '开通会员';

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.safe}><View style={styles.nav}><Text style={styles.navTitle}>练耳搭子</Text></View></SafeAreaView>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="切换练习省份" accessibilityHint={`当前为${province?.label || '未选择'}`} hitSlop={hitSlopFor(Btn.home.provinceBar.minHeight)} onPress={() => router.push('/province-select?switch=1')} style={({ pressed }) => [styles.provinceBar, pressed && styles.pressed]}>
          <View style={styles.provinceCopy}><Text style={styles.provinceCaption}>当前练习按</Text><Text style={styles.provinceName}>{province?.label || '请选择省份'}</Text><Text style={styles.provinceCaption}>题型生成</Text>{!!province?.label && !hasDedicatedFramework(province.id) && <Text style={styles.provinceMeta}>通用模板</Text>}</View>
          <View style={styles.provinceAction}><Text style={styles.provinceActionText}>切换</Text><AppIcon name="chevronRight" size={15} color={Brand.forest} /></View>
        </Pressable>
        <LinearGradient colors={['#12372f', '#23785f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View pointerEvents="none" style={styles.heroWave}>{HERO_WAVE_HEIGHTS.map((height, index) => <View key={index} style={[styles.heroWaveBar, { height }]} />)}</View>
          <View style={styles.heroBrand}><Text style={styles.heroTitle}>练耳搭子</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.heroSub}>音乐艺考 · 听音练耳专项训练</Text></View>
          <View style={styles.heroData}><View style={styles.heroMetric}><Text style={styles.metricNumber}>{practiceStats.todayCount}</Text><Text style={styles.metricLabel}>今日练习</Text></View><LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,.28)', 'rgba(255,255,255,0)']} style={styles.heroDivider} /><View style={styles.heroMetric}><Text style={styles.metricNumber}>{practiceStats.todayAccuracy}%</Text><Text style={styles.metricLabel}>今日正确率</Text></View></View>
        </LinearGradient>
        <View style={styles.memberStatusBar}>
          <View style={styles.memberStatusCopy}><Text style={styles.memberStatusTitle}>{memberTitle}</Text><Text numberOfLines={1} style={styles.memberStatusMeta}>{memberSummary}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={memberAction} disabled={!ready || !configured} hitSlop={hitSlopFor(Btn.home.inviteButton.height)} onPress={() => router.push(SUBSCRIBE_ROUTE)} style={({ pressed }) => [styles.memberStatusButton, pressed && styles.pressed]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.memberStatusButtonText}>{memberAction}</Text></Pressable>
        </View>
        <View style={styles.grid}>
          {gridItems.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.name} accessibilityHint={item.desc} onPress={item.onPress} style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}>
            <Image accessibilityElementsHidden source={HOME_ICONS[item.icon]} resizeMode="contain" style={styles.modeIcon} />
            <View style={styles.modeCopy}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.modeName}>{item.name}</Text></View>
            <AppIcon name="chevronRight" size={14} color="#6E9B7E" />
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel={adaptiveCard.name} accessibilityHint={adaptiveCard.desc} onPress={adaptiveCard.onPress} style={({ pressed }) => [styles.gridCard, adaptiveShort ? styles.adaptiveCellShort : styles.adaptiveCellWide, pressed && styles.pressed]}>
            <Image accessibilityElementsHidden source={HOME_ICONS[adaptiveCard.icon]} resizeMode="contain" style={styles.modeIcon} />
            <View style={styles.modeCopy}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.modeName, styles.adaptiveName, adaptiveShort && styles.adaptiveNameShort]}>{adaptiveCard.name}</Text><Text numberOfLines={adaptiveShort ? 2 : 1} style={styles.adaptiveDesc}>{adaptiveCard.desc}</Text></View>
            <AppIcon name="chevronRight" size={14} color="#6E9B7E" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.cream },
  // 顶栏与底部 tabBar 同色（2026-09-17 口径）：纯白底 + 深色标题，状态栏文字随底色转深。
  // 下沿的分隔线与底部 tabBar 上沿同一条（hairline），底部那条线就是它的镜像。
  safe: { backgroundColor: Brand.ivory, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.hairline },
  nav: { minHeight: 48, paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: Brand.ink, fontSize: TypeScale.headline, fontWeight: '800', letterSpacing: 0.4 },
  content: { flexGrow: 1, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 20, gap: 12 },
  provinceBar: { ...Btn.home.provinceBar, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Brand.ivory, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(31,111,91,.12)', ...Shadows.card },
  provinceCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  provinceCaption: { color: Brand.disabled, fontSize: 11 }, provinceName: { color: Brand.forest, fontSize: 13, fontWeight: '800' },
  provinceMeta: { paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden', borderRadius: 4, color: Brand.success, backgroundColor: 'rgba(46,139,111,.10)', fontSize: 10, fontWeight: '700' },
  provinceAction: { marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 3 }, provinceActionText: { color: Brand.forest, fontSize: 13, fontWeight: '800' },
  hero: { height: 95, paddingHorizontal: 16, overflow: 'hidden', borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadows.raised },
  heroWave: { position: 'absolute', left: '42%', right: '4%', bottom: 0, height: 40, overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', opacity: 0.16, transform: [{ skewX: '-8deg' }] },
  heroWaveBar: { width: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: Brand.textOnAccent },
  heroBrand: { zIndex: 1, flexShrink: 1, minWidth: 0, paddingRight: 8 }, heroTitle: { color: Brand.textOnAccent, fontSize: 22, lineHeight: 25, fontWeight: '800', letterSpacing: 0.5 },
  heroSub: { marginTop: 7, color: 'rgba(235,250,244,.84)', fontSize: 11.5, lineHeight: 15, fontWeight: '600', letterSpacing: 0.5 },
  heroData: { zIndex: 1, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }, heroMetric: { minWidth: 48, alignItems: 'center' },
  metricNumber: { color: Brand.textOnAccent, fontSize: 20, lineHeight: 23, fontWeight: '800', fontVariant: ['tabular-nums'] }, metricLabel: { marginTop: 4, color: 'rgba(235,250,244,.72)', fontSize: 10, lineHeight: 13 }, heroDivider: { width: 1.2, height: 34 },
  memberStatusBar: { ...Btn.home.usageStrip, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: Brand.ivory, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(31,111,91,.10)' },
  memberStatusCopy: { flex: 1, minWidth: 0, paddingLeft: 4, flexDirection: 'row', alignItems: 'baseline', gap: 5 }, memberStatusTitle: { color: Brand.forest, ...Btn.home.usageTitle }, memberStatusMeta: { color: '#5F6F65', ...Btn.home.usageMeta },
  memberStatusButton: { width: '40%', ...Btn.home.inviteButton, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.forest }, memberStatusButtonText: { color: Brand.textOnAccent, fontSize: Btn.home.inviteButton.fontSize, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', justifyContent: 'space-between', rowGap: 12 },
  gridCard: { width: '48.4%', ...Btn.home.modeCard, flexDirection: 'row', alignItems: 'center', backgroundColor: Brand.ivory, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(31,111,91,.12)', ...Shadows.card },
  // 智能强化补位（对齐小程序 .adaptive-cell-wide / .adaptive-cell-short，rpx ÷ 2）：
  // wide 整行独占 44rpx→22pt 右内边距；short 补右半格 28rpx→14pt 右内边距、上下 12rpx→6pt。
  adaptiveCellWide: { width: '100%', paddingRight: 22 },
  adaptiveCellShort: { paddingVertical: 6, paddingRight: 14 },
  modeIcon: { ...Btn.home.modeIcon, flexShrink: 0 }, modeCopy: { flex: 1, minWidth: 0 }, modeName: { color: Brand.ink, ...Btn.home.modeName, lineHeight: 19 }, adaptiveName: { color: Brand.forest }, adaptiveNameShort: { fontSize: 14 }, adaptiveDesc: { marginTop: 3, color: Brand.success, fontSize: 9, lineHeight: 12 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
