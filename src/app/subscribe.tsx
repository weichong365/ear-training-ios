import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { Brand, Radius, TouchTarget, TypeScale } from '@/constants/theme';
import type { PracticeMode } from '@/core';
import { useSubscription } from '@/services/subscription';

const BENEFITS: [AppIconName, string, string][] = [
  ['melody', '全部专项训练', '单音、音程、和弦、节奏与四句式旋律'],
  ['exam', '全国各省真题', '按真实出题框架生成完整模拟试卷'],
  ['adaptive', '智能强化', '根据错题和正确率动态调整训练重点'],
  ['stats', '错题与统计', '持续记录薄弱点和阶段进步'],
];

const PRACTICE_TARGETS = new Set<PracticeMode>(['single', 'interval', 'chord', 'melody', 'rhythm', 'adaptive']);
const TERMS_ROUTE = '/terms' as Href;

function packageLabel(item: PurchasesPackage) {
  if (item.packageType === 'ANNUAL' || item.product.subscriptionPeriod === 'P1Y') return '年度方案';
  if (item.packageType === 'MONTHLY' || item.product.subscriptionPeriod === 'P1M') return '月度方案';
  return item.product.title || '订阅方案';
}

function periodSuffix(item: PurchasesPackage) {
  if (item.packageType === 'ANNUAL' || item.product.subscriptionPeriod === 'P1Y') return '/年';
  if (item.packageType === 'MONTHLY' || item.product.subscriptionPeriod === 'P1M') return '/月';
  return '';
}

function trialLabel(item: PurchasesPackage | null) {
  const intro = item?.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unit = intro.periodUnit.toUpperCase();
  const value = intro.periodNumberOfUnits;
  if (unit === 'WEEK') return `${value * 7} 天`;
  if (unit === 'DAY') return `${value} 天`;
  if (unit === 'MONTH') return `${value} 个月`;
  if (unit === 'YEAR') return `${value} 年`;
  return '免费';
}

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

export default function SubscribeScreen() {
  const params = useLocalSearchParams<{ target?: string; reason?: string }>();
  const {
    ready,
    configured,
    busy,
    isActive,
    isTrial,
    willRenew,
    expiresAt,
    offering,
    error,
    refresh,
    purchase,
    restore,
    manage,
  } = useSubscription();
  const packages = useMemo(() => {
    const available = offering?.availablePackages || [];
    return [...available].sort((a, b) => {
      const rank = (item: PurchasesPackage) => item.packageType === 'ANNUAL' ? 0 : item.packageType === 'MONTHLY' ? 1 : 2;
      return rank(a) - rank(b);
    });
  }, [offering]);
  const [selectedId, setSelectedId] = useState('');

  const selected = packages.find((item) => item.identifier === selectedId) || packages[0] || null;
  const freeTrial = trialLabel(selected);

  function continueToTarget() {
    const target = typeof params.target === 'string' ? params.target : '';
    if (target === 'exam') {
      router.replace('/exam');
      return;
    }
    if (PRACTICE_TARGETS.has(target as PracticeMode)) {
      router.replace({ pathname: '/practice', params: { type: target } });
      return;
    }
    router.replace('/');
  }

  async function startPurchase() {
    if (!selected) return;
    const unlocked = await purchase(selected);
    if (unlocked) continueToTarget();
  }

  async function restoreAccess() {
    const restored = await restore();
    if (restored) {
      Alert.alert('购买已恢复', '当前 Apple ID 的练耳搭子订阅已恢复。', [
        { text: '继续使用', onPress: continueToTarget },
      ]);
    }
  }

  if (!ready) {
    return <View style={styles.loadingPage}><ActivityIndicator color={Brand.forest} size="large" /><Text style={styles.loadingText}>正在连接 App Store…</Text></View>;
  }

  if (isActive) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.activeHero}>
          <View style={styles.activeMark}><AppIcon name="check" size={40} color={Brand.forest} /></View>
          <Text style={styles.activeTitle}>{isTrial ? '免费试用进行中' : '全部功能已解锁'}</Text>
          <Text style={styles.activeBody}>
            {expiresAt ? `${willRenew ? '下一续订日' : '当前使用期截止'}：${formatDate(expiresAt)}` : '感谢你支持练耳搭子'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={continueToTarget} style={styles.primaryButton}><Text style={styles.primaryText}>继续训练</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={manage} style={styles.secondaryButton}><Text style={styles.secondaryText}>管理 Apple 订阅</Text></Pressable>
        <Text style={styles.manageHint}>取消自动续订后，在当前付费期结束前仍可继续使用全部功能。</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.title}>听得更准，写得更稳</Text>
        <Text style={styles.subtitle}>开启 Apple 免费试用，完整体验专项训练与全国各省模拟考试。</Text>
        <View style={styles.trialPill}><Text style={styles.trialPillText}>首订推荐 · 7 天免费试用</Text></View>
      </View>

      <View style={styles.benefitCard}>
        {BENEFITS.map(([icon, title, body]) => (
          <View key={title} style={styles.benefitRow}>
            <View style={styles.benefitIcon}><AppIcon name={icon} size={22} /></View>
            <View style={styles.benefitCopy}><Text style={styles.benefitTitle}>{title}</Text><Text style={styles.benefitBody}>{body}</Text></View>
          </View>
        ))}
      </View>

      {configured && packages.length > 0 ? (
        <View style={styles.plans}>
          {packages.map((item) => {
            const selectedPlan = item.identifier === selected?.identifier;
            const annual = item.packageType === 'ANNUAL' || item.product.subscriptionPeriod === 'P1Y';
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedPlan }}
                key={item.identifier}
                onPress={() => setSelectedId(item.identifier)}
                style={({ pressed }) => [styles.plan, selectedPlan && styles.planSelected, pressed && styles.pressed]}
              >
                <View style={[styles.radio, selectedPlan && styles.radioSelected]}>{selectedPlan ? <View style={styles.radioDot} /> : null}</View>
                <View style={styles.planCopy}>
                  <View style={styles.planTitleLine}><Text style={styles.planTitle}>{packageLabel(item)}</Text>{annual ? <Text style={styles.recommended}>推荐</Text> : null}</View>
                  <Text style={styles.planMeta}>{trialLabel(item) ? `${trialLabel(item)}免费，之后自动续订` : '按所选周期自动续订'}</Text>
                </View>
                <Text style={styles.planPrice}>{item.product.priceString}<Text style={styles.planSuffix}>{periodSuffix(item)}</Text></Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>{configured ? '正在读取订阅方案' : '订阅服务等待配置'}</Text>
          <Text style={styles.setupBody}>{configured ? '请检查网络，或稍后重新读取 App Store 商品。' : '完成 App Store Connect 与 RevenueCat 商品关联后，这里会自动显示本地价格。'}</Text>
          {configured ? <Pressable accessibilityRole="button" onPress={refresh} style={styles.retryButton}><Text style={styles.retryText}>重新读取</Text></Pressable> : null}
        </View>
      )}

      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selected || busy, busy }} disabled={!selected || busy} onPress={startPurchase} style={[styles.primaryButton, (!selected || busy) && styles.disabled]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{freeTrial ? `开启 ${freeTrial}免费试用` : '订阅并解锁全部功能'}</Text>}
      </Pressable>
      {selected ? <Text style={styles.renewalText}>{freeTrial ? `${freeTrial}免费，之后 ${selected.product.priceString}${periodSuffix(selected)}。` : `${selected.product.priceString}${periodSuffix(selected)}。`}订阅会自动续期，可随时在 Apple ID 设置中取消。</Text> : null}

      <View style={styles.linkRow}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={restoreAccess} style={styles.linkButton}><Text style={styles.link}>恢复购买</Text></Pressable>
        <Text style={styles.linkDivider}>·</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push(TERMS_ROUTE)} style={styles.linkButton}><Text style={styles.link}>订阅与使用条款</Text></Pressable>
        <Text style={styles.linkDivider}>·</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={styles.linkButton}><Text style={styles.link}>隐私政策</Text></Pressable>
      </View>
      <Text style={styles.appleNote}>付款将由 Apple ID 确认。免费试用仅适用于符合 Apple 条件的新订阅用户；取消后仍可使用至当前试用或订阅期结束。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.cream },
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.cream },
  loadingText: { marginTop: 12, color: Brand.muted, fontSize: TypeScale.footnote },
  content: { padding: 18, paddingBottom: 42, gap: 12 },
  hero: { padding: 24, borderRadius: Radius.hero, backgroundColor: Brand.forestDeep },
  title: { color: Brand.textOnAccent, fontSize: TypeScale.title1, fontWeight: '900' },
  subtitle: { marginTop: 8, maxWidth: 310, color: Brand.textOnAccentMuted, fontSize: TypeScale.footnote, lineHeight: 20 },
  trialPill: { alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 11, paddingVertical: 7, borderRadius: Radius.control, backgroundColor: 'rgba(183,137,34,.18)', borderWidth: 1, borderColor: 'rgba(183,137,34,.42)' },
  trialPillText: { color: '#E8CB73', fontSize: TypeScale.caption, fontWeight: '800' },
  benefitCard: { padding: 16, gap: 15, borderRadius: Radius.card, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border },
  benefitRow: { flexDirection: 'row', alignItems: 'center' },
  benefitIcon: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forestSoft },
  benefitCopy: { flex: 1, marginLeft: 11 },
  benefitTitle: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '800' },
  benefitBody: { marginTop: 3, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 18 },
  plans: { gap: 8 },
  plan: { minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.ivory },
  planSelected: { borderColor: Brand.forest, backgroundColor: Brand.successSoft },
  pressed: { opacity: 0.72 },
  radio: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: '#9BB3A4' },
  radioSelected: { borderColor: Brand.forest },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.forest },
  planCopy: { flex: 1, marginLeft: 10 },
  planTitleLine: { flexDirection: 'row', alignItems: 'center' },
  planTitle: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '800' },
  recommended: { marginLeft: 7, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden', borderRadius: 7, color: Brand.textOnAccent, backgroundColor: Brand.forest, fontSize: 11, fontWeight: '800' },
  planMeta: { marginTop: 4, color: Brand.muted, fontSize: TypeScale.caption },
  planPrice: { color: Brand.forestDeep, fontSize: TypeScale.headline, fontWeight: '900' },
  planSuffix: { color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '600' },
  setupCard: { padding: 16, borderRadius: Radius.card, borderWidth: 1, borderColor: '#E4C989', backgroundColor: Brand.warningSoft },
  setupTitle: { color: Brand.warning, fontSize: TypeScale.subheadline, fontWeight: '900' },
  setupBody: { marginTop: 6, color: Brand.warning, fontSize: TypeScale.footnote, lineHeight: 20 },
  retryButton: { minHeight: TouchTarget, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: '#F0D895' },
  retryText: { color: '#624B10', fontSize: TypeScale.footnote, fontWeight: '800' },
  error: { paddingHorizontal: 6, color: Brand.danger, fontSize: TypeScale.footnote, lineHeight: 19, textAlign: 'center' },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forest },
  primaryText: { color: Brand.textOnAccent, fontSize: TypeScale.subheadline, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1.5, borderColor: Brand.forest, backgroundColor: Brand.ivory },
  secondaryText: { color: Brand.forest, fontSize: TypeScale.subheadline, fontWeight: '900' },
  renewalText: { paddingHorizontal: 9, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 4 },
  linkButton: { minHeight: TouchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  link: { color: Brand.forest, fontSize: TypeScale.caption, fontWeight: '800', textDecorationLine: 'underline' },
  linkDivider: { color: Brand.disabled, fontSize: TypeScale.caption },
  appleNote: { paddingHorizontal: 7, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  activeHero: { padding: 26, alignItems: 'center', borderRadius: Radius.hero, backgroundColor: Brand.forestDeep },
  activeMark: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31, backgroundColor: '#FFFFFF' },
  activeTitle: { marginTop: 16, color: Brand.textOnAccent, fontSize: TypeScale.title2, fontWeight: '900' },
  activeBody: { marginTop: 8, color: Brand.textOnAccentMuted, fontSize: TypeScale.footnote },
  manageHint: { color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
});
