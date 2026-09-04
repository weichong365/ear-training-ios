import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PracticeType } from '@/core';
import { Brand, Radius, TypeScale } from '@/constants/theme';
import { getExamResults, getPracticeRecords, type ExamResultRecord, type PracticeRecord } from '@/services/local-data';

const TYPE_NAMES: Record<PracticeType, string> = {
  single: '单音', group: '旋律音组', interval: '音程', connection: '和声音程连接', chord: '和弦', chordQuality: '和弦性质', chordPitch: '和弦音高', rhythm: '节奏', melody: '旋律',
};

export default function StatsScreen() {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [examResults, setExamResults] = useState<ExamResultRecord[]>([]);
  useFocusEffect(useCallback(() => {
    Promise.all([getPracticeRecords(), getExamResults()]).then(([practice, exams]) => {
      setRecords(practice);
      setExamResults(exams);
    });
  }, []));

  const summary = useMemo(() => {
    const correct = records.filter((item) => item.correct).length;
    const byType = Object.keys(TYPE_NAMES).map((type) => {
      const list = records.filter((item) => item.type === type);
      const typeCorrect = list.filter((item) => item.correct).length;
      const accuracy = list.length ? Math.round(typeCorrect / list.length * 100) : 0;
      return { type: type as PracticeType, attempts: list.length, accuracy, errorRate: 100 - accuracy };
    }).sort((left, right) => right.errorRate - left.errorRate);
    const buckets = new Map<string, PracticeRecord[]>();
    records.forEach((record) => {
      const key = record.sessionId || record.id;
      buckets.set(key, [...(buckets.get(key) || []), record]);
    });
    const recent = Array.from(buckets.values()).map((list) => ({
      id: list[0].sessionId || list[0].id,
      modeName: list[0].modeName || TYPE_NAMES[list[0].type],
      createdAt: Math.max(...list.map((item) => item.createdAt)),
      accuracy: Math.round(list.filter((item) => item.correct).length / list.length * 100),
      total: list.length,
    })).sort((left, right) => right.createdAt - left.createdAt).slice(0, 8);
    return { correct, sessions: buckets.size, accuracy: records.length ? Math.round(correct / records.length * 100) : 0, byType, recent };
  }, [records]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>练习统计</Text>
        <Text style={styles.subtitle}>所有数据优先保存在当前设备</Text>
      </View>

      <View style={styles.overview}>
        <View style={styles.overviewItem}><Text style={styles.overviewMain}>{summary.sessions}</Text><Text style={styles.overviewLabel}>练习组数</Text></View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewItem}><Text style={styles.overviewMain}>{records.length}</Text><Text style={styles.overviewLabel}>累计题目</Text></View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewItem}><Text style={[styles.overviewMain, styles.highlight]}>{summary.accuracy}%</Text><Text style={styles.overviewLabel}>正确率</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>薄弱项分析</Text>
        <Text style={styles.cardSub}>按错误率从高到低排列</Text>
        <View style={styles.bars}>
          {summary.byType.map((item) => (
            <View key={item.type} style={styles.barRow}>
              <View style={styles.barTop}><Text style={styles.barName}>{TYPE_NAMES[item.type]}</Text><Text style={styles.barValue}>{item.attempts ? `${item.accuracy}%` : '暂无'}</Text></View>
              <View style={styles.track}><View style={[styles.fill, { width: `${item.accuracy}%` }]} /></View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>最近练习</Text>
        {summary.recent.length ? summary.recent.map((record) => (
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
  overview: { paddingVertical: 20, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewMain: { color: Brand.ink, fontSize: TypeScale.title2, fontWeight: '900', fontVariant: ['tabular-nums'] },
  highlight: { color: Brand.forest },
  overviewLabel: { marginTop: 4, color: Brand.muted, fontSize: TypeScale.caption },
  overviewDivider: { width: StyleSheet.hairlineWidth, height: 42, backgroundColor: Brand.divider },
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
