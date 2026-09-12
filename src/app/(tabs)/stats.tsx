import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PracticeType } from '@/core';
import { Brand, Radius, TypeScale } from '@/constants/theme';
import { getExamResults, getPracticeStats, type ExamResultRecord, type PracticeStats } from '@/services/local-data';

const TYPE_NAMES: Record<PracticeType, string> = {
  single: '单音', group: '旋律音组', interval: '音程', connection: '和声音程连接', chord: '和弦', chordQuality: '和弦性质', chordPitch: '和弦音高', rhythm: '节奏', melody: '旋律',
};

export default function StatsScreen() {
  const [stats, setStats] = useState<PracticeStats | null>(null);
  const [examResults, setExamResults] = useState<ExamResultRecord[]>([]);
  useFocusEffect(useCallback(() => {
    Promise.all([getPracticeStats(), getExamResults()]).then(([practice, exams]) => {
      setStats(practice);
      setExamResults(exams);
    });
  }, []));

  const byType = (Object.keys(TYPE_NAMES) as PracticeType[]).map((type) => {
    const item = stats?.byType[type];
    return item
      ? { type, attempts: item.attempts, accuracy: item.accuracy, errorRate: item.errorRate }
      : { type, attempts: 0, accuracy: 0, errorRate: 0 };
  }).filter((item) => item.attempts > 0).sort((left, right) => right.errorRate - left.errorRate);

  const accuracyTrend = stats?.accuracyTrend;
  const trendUp = accuracyTrend != null && accuracyTrend >= 0;
  const trend7day = stats?.trend7day || [];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>练习统计</Text>
        <Text style={styles.subtitle}>所有数据优先保存在当前设备</Text>
      </View>

      <View style={styles.overviewGrid}>
        <View style={styles.overviewCard}><Text style={styles.overviewLabel}>累计练习</Text><Text style={styles.overviewMain}>{stats ? stats.totalQuestions : 0}<Text style={styles.overviewUnit}> 题</Text></Text></View>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>正确率</Text>
          <View style={styles.overviewValueRow}>
            <Text style={[styles.overviewMain, styles.highlight]}>{stats ? stats.accuracy : 0}%</Text>
            {accuracyTrend != null ? (
              <View style={[styles.trendChip, trendUp ? styles.trendUp : styles.trendDown]}>
                <Text style={[styles.trendChipText, trendUp ? styles.trendUpText : styles.trendDownText]}>{trendUp ? '↑' : '↓'}{trendUp ? accuracyTrend : -accuracyTrend}%</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.overviewCard}><Text style={styles.overviewLabel}>连续练习</Text><Text style={styles.overviewMain}>{stats ? stats.streak : 0}<Text style={styles.overviewUnit}> 天</Text></Text></View>
        <View style={styles.overviewCard}><Text style={styles.overviewLabel}>今日练习</Text><Text style={styles.overviewMain}>{stats ? stats.todayCount : 0}<Text style={styles.overviewUnit}> 题</Text></Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>薄弱项分析</Text>
        <Text style={styles.cardSub}>按错误率从高到低排列</Text>
        <View style={styles.bars}>
          {byType.map((item) => (
            <View key={item.type} style={styles.barRow}>
              <View style={styles.barTop}><Text style={styles.barName}>{TYPE_NAMES[item.type]}</Text><Text style={styles.barValue}>{item.attempts ? `${item.accuracy}%` : '暂无'}</Text></View>
              <View style={styles.track}><View style={[styles.fill, { width: `${item.accuracy}%` }]} /></View>
            </View>
          ))}
          {byType.length === 0 ? <Text style={styles.emptyText}>完成一组新练习后即可生成分析。</Text> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>近 7 天正确率</Text>
        <Text style={styles.cardSub}>每日答题准确率变化</Text>
        <View style={styles.trendChart}>
          {trend7day.map((item) => (
            <View key={item.label} style={styles.trendCol}>
              <Text style={[styles.trendNum, item.total === 0 && styles.trendNumEmpty]}>{item.total > 0 ? `${item.accuracy}%` : '—'}</Text>
              <View style={styles.trendBarTrack}>
                <View style={[
                  styles.trendBar,
                  item.total === 0 ? styles.trendBarEmpty : (item.isToday ? styles.trendBarToday : item.accuracy >= 70 ? styles.trendBarGood : item.accuracy >= 30 ? styles.trendBarMid : styles.trendBarLow),
                  { height: `${Math.max(8, item.accuracy)}%` },
                ]} />
              </View>
              <Text style={[styles.trendLabel, item.isToday && styles.trendLabelToday]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>最近练习</Text>
        {(stats?.recent || []).length ? stats!.recent.map((record) => (
          <View key={record.id} style={styles.recordRow}>
            <View style={[styles.recordMark, record.accuracy >= 70 ? styles.goodMark : styles.badMark]} />
            <Text style={styles.recordName}>{record.modeName}</Text>
            <Text style={styles.recordDate}>{new Date(record.createdAt).toLocaleDateString('zh-CN')} · {record.total}题</Text>
            <Text style={[styles.recordResult, record.accuracy >= 70 ? styles.good : styles.bad]}>{record.accuracy}%</Text>
          </View>
        )) : <Text style={styles.emptyText}>完成第一道练习后，这里会显示成长记录。</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>模拟考试成绩</Text>
        <Text style={styles.cardSub}>整卷交卷后自动记录在当前设备</Text>
        {examResults.length ? examResults.slice(0, 6).map((result) => (
          <View key={result.id} style={styles.examRow}>
            <View style={styles.examBadge}><Text style={styles.examBadgeText}>{result.provinceLabel.slice(0, 1)}</Text></View>
            <View style={styles.examCopy}><Text numberOfLines={1} style={styles.examName}>{result.frameworkTitle}</Text><Text style={styles.examMeta}>{new Date(result.createdAt).toLocaleDateString('zh-CN')} · 答对 {result.correctCount}/{result.questionCount}</Text></View>
            <Text style={styles.examScore}>{result.score.toFixed(1).replace(/\.0$/, '')}<Text style={styles.examTotal}>/{result.total.toFixed(1).replace(/\.0$/, '')}</Text></Text>
          </View>
        )) : <Text style={styles.emptyText}>完成并提交一套模拟卷后，这里会保存成绩。</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.cream },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  hero: { padding: 20, borderRadius: Radius.hero, backgroundColor: Brand.forest },
  title: { color: Brand.textOnAccent, fontSize: TypeScale.title2, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { marginTop: 6, color: Brand.textOnAccentMuted, fontSize: TypeScale.footnote },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  overviewCard: { width: '48.5%', paddingVertical: 18, alignItems: 'center', borderRadius: Radius.card, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border },
  overviewMain: { marginTop: 6, color: Brand.ink, fontSize: TypeScale.title1, fontWeight: '900', fontVariant: ['tabular-nums'] },
  highlight: { color: Brand.forest },
  overviewUnit: { color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  overviewLabel: { color: Brand.muted, fontSize: TypeScale.caption },
  overviewValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  trendChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  trendUp: { backgroundColor: '#E2F2EC' },
  trendDown: { backgroundColor: '#F6E3E2' },
  trendChipText: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  trendUpText: { color: Brand.forest },
  trendDownText: { color: Brand.danger },
  card: { padding: 16, borderRadius: Radius.card, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border },
  cardTitle: { color: Brand.ink, fontSize: TypeScale.headline, fontWeight: '900' },
  cardSub: { marginTop: 4, color: Brand.muted, fontSize: TypeScale.caption },
  bars: { marginTop: 17, gap: 14 },
  barRow: { gap: 0 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barName: { color: Brand.ink, fontSize: TypeScale.footnote, fontWeight: '700' },
  barValue: { color: Brand.muted, fontSize: TypeScale.caption, fontVariant: ['tabular-nums'] },
  track: { height: 7, marginTop: 8, overflow: 'hidden', borderRadius: 7, backgroundColor: Brand.divider },
  fill: { height: '100%', borderRadius: 7, backgroundColor: Brand.forest },
  trendChart: { marginTop: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
  trendCol: { flex: 1, alignItems: 'center' },
  trendNum: { color: Brand.muted, fontSize: 10, fontVariant: ['tabular-nums'] },
  trendNumEmpty: { color: Brand.disabled },
  trendBarTrack: { width: '100%', height: 72, marginTop: 5, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: '58%', borderRadius: 5 },
  trendBarToday: { backgroundColor: Brand.forest },
  trendBarGood: { backgroundColor: '#4E9E7B' },
  trendBarMid: { backgroundColor: '#C7A14D' },
  trendBarLow: { backgroundColor: '#C77B72' },
  trendBarEmpty: { backgroundColor: Brand.divider },
  trendLabel: { marginTop: 6, color: Brand.muted, fontSize: 11, fontWeight: '700' },
  trendLabelToday: { color: Brand.forest },
  recordRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.divider },
  recordMark: { width: 5, height: 25, marginRight: 10, borderRadius: 5 },
  goodMark: { backgroundColor: Brand.forest },
  badMark: { backgroundColor: Brand.danger },
  recordName: { flex: 1, color: Brand.ink, fontSize: TypeScale.footnote, fontWeight: '700' },
  recordDate: { marginRight: 12, color: Brand.muted, fontSize: TypeScale.caption },
  recordResult: { fontSize: TypeScale.footnote, fontWeight: '800', fontVariant: ['tabular-nums'] },
  good: { color: Brand.forest },
  bad: { color: Brand.danger },
  emptyText: { marginTop: 17, color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 19 },
  examRow: { minHeight: 62, marginTop: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.divider },
  examBadge: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forestSoft },
  examBadgeText: { color: Brand.forest, fontSize: TypeScale.caption, fontWeight: '900' },
  examCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  examName: { color: Brand.ink, fontSize: TypeScale.footnote, fontWeight: '800' },
  examMeta: { marginTop: 4, color: Brand.muted, fontSize: TypeScale.caption },
  examScore: { color: Brand.forest, fontSize: TypeScale.headline, fontWeight: '900', fontVariant: ['tabular-nums'] },
  examTotal: { color: Brand.muted, fontSize: TypeScale.caption },
});
