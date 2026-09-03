import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Fonts, TouchTarget, TypeScale } from '@/constants/theme';
import { generateProvincePaper, getProvinceFramework, getProvinceVariants, PROVINCES, type ProvinceId } from '@/core/provinces';
import { emptyExamAnswer } from '@/core/exam-answer';
import { getActiveExamSession, saveExamSession, type ExamSession } from '@/services/local-data';

const EXAM_PAPER_ROUTE = '/exam-paper' as Href;

const PAPER = {
  bg: '#FFFFFF',
  ink: '#111111',
  muted: '#666666',
  line: '#141414',
  rule: '#D8D8D8',
} as const;

export default function ExamScreen() {
  const [provinceId, setProvinceId] = useState<ProvinceId>('zhejiang');
  const [variantIndex, setVariantIndex] = useState(0);
  const [activeSession, setActiveSession] = useState<ExamSession | null>(null);
  const variants = useMemo(() => getProvinceVariants(provinceId), [provinceId]);
  const framework = useMemo(() => getProvinceFramework(provinceId, variantIndex), [provinceId, variantIndex]);

  useEffect(() => { getActiveExamSession().then(setActiveSession); }, []);

  function selectProvince(id: ProvinceId) {
    setProvinceId(id);
    setVariantIndex(0);
  }

  async function createPaper() {
    const paper = generateProvincePaper(provinceId, variantIndex);
    const answers = Object.fromEntries(paper.questions.map((question) => [question.id, emptyExamAnswer()]));
    const session: ExamSession = {
      paper,
      answers,
      playCounts: {},
      unlockedIds: [],
      currentIndex: 0,
      updatedAt: paper.createdAt,
    };
    await saveExamSession(session);
    setActiveSession(session);
    router.push(EXAM_PAPER_ROUTE);
  }

  function startNew() {
    if (!activeSession) {
      createPaper();
      return;
    }
    Alert.alert('开始新试卷？', '当前未交卷进度会被新试卷替换。', [
      { text: '取消', style: 'cancel' },
      { text: '开始新卷', style: 'destructive', onPress: createPaper },
    ]);
  }

  const configuredCount = framework.sections.reduce((sum, section) => sum + Number(section.count || 0), 0);
  const hasFullScore = Number.isFinite(framework.fullScore);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>全国各省真题</Text>
        <Text style={styles.subtitle}>按各省真题框架生成电子听写卷</Text>
      </View>

      {!!activeSession && (
        <Pressable accessibilityRole="button" accessibilityLabel={`继续${activeSession.paper.framework.title}`} onPress={() => router.push(EXAM_PAPER_ROUTE)} style={({ pressed }) => [styles.resumeCard, pressed && styles.pressed]}>
          <View>
            <Text style={styles.resumeKicker}>未完成试卷</Text>
            <Text style={styles.resumeTitle}>{activeSession.paper.framework.title}</Text>
            <Text style={styles.resumeSub}>上次做到第 {activeSession.currentIndex + 1} / {activeSession.paper.questions.length} 题</Text>
          </View>
          <View style={styles.resumeAction}><Text style={styles.resumeActionText}>继续作答</Text><AppIcon name="chevronRight" size={16} /></View>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>选择试卷地区</Text>
      <View style={styles.provinceGrid}>
        {PROVINCES.map((item) => (
          <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected: provinceId === item.id }} onPress={() => selectProvince(item.id)} style={({ pressed }) => [styles.provinceButton, provinceId === item.id && styles.provinceActive, pressed && styles.pressed]}>
            <Text style={[styles.provinceText, provinceId === item.id && styles.provinceTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {variants.length > 1 && <>
        <Text style={styles.sectionTitle}>选择年份</Text>
        <View style={styles.yearRow}>
          {variants.map((variant, index) => (
            <Pressable accessibilityRole="radio" accessibilityState={{ selected: variantIndex === index }} key={`${variant.year}-${index}`} onPress={() => setVariantIndex(index)} style={({ pressed }) => [styles.yearButton, variantIndex === index && styles.provinceActive, pressed && styles.pressed]}>
              <Text style={[styles.provinceText, variantIndex === index && styles.provinceTextActive]}>{variant.year}</Text>
            </Pressable>
          ))}
        </View>
      </>}

      <View style={styles.paper}>
        <View style={styles.paperHead}>
          <View style={styles.paperHeadCopy}>
            <Text style={styles.paperKicker}>{framework.sourceConfirmed ? '已按真题资料录入' : '全国通用框架'}</Text>
            <Text style={styles.paperTitle}>{framework.title}</Text>
            <Text style={styles.paperYear}>{framework.year} · {configuredCount} 题</Text>
          </View>
          <View style={styles.scoreBadge}><Text style={styles.scoreMain}>{hasFullScore ? framework.fullScore : '按题'}</Text><Text style={styles.scoreUnit}>{hasFullScore ? '分' : '计分'}</Text></View>
        </View>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleText}>标准音＋预备拍</Text><Text style={styles.ruleDot}>•</Text>
          <Text style={styles.ruleText}>播放次数限制</Text><Text style={styles.ruleDot}>•</Text>
          <Text style={styles.ruleText}>自动保存进度</Text>
        </View>
        <View style={styles.sectionList}>
          {framework.sections.map((section, index) => (
            <View key={`${section.key}-${index}`} style={styles.sectionRow}>
              <View style={styles.sectionIndex}><Text style={styles.sectionIndexText}>{['一', '二', '三', '四', '五', '六', '七', '八', '九'][index]}</Text></View>
              <Text style={styles.sectionName}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.count} 题 · {section.repeats || 3} 遍</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={startNew} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
        <Text style={styles.startText}>{activeSession ? '生成并开始新试卷' : '开始整卷模拟'}</Text>
      </Pressable>
      <Text style={styles.footnote}>交卷前可退出页面，答题内容和播放次数会保存在当前设备。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAPER.bg },
  content: { padding: 20, paddingBottom: 42, gap: 16 },
  hero: { padding: 22, borderRadius: 4, backgroundColor: PAPER.ink },
  title: { color: '#FFFFFF', fontSize: TypeScale.title1, fontWeight: '900', fontFamily: Fonts.serif },
  subtitle: { marginTop: 6, color: 'rgba(255,255,255,.72)', fontSize: TypeScale.footnote },
  resumeCard: { minHeight: 88, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 4, borderWidth: 1, borderColor: PAPER.line, backgroundColor: PAPER.bg },
  resumeKicker: { color: PAPER.muted, fontSize: TypeScale.caption, fontWeight: '800' },
  resumeTitle: { marginTop: 3, maxWidth: 220, color: PAPER.ink, fontSize: TypeScale.subheadline, fontWeight: '900', fontFamily: Fonts.serif },
  resumeSub: { marginTop: 4, color: PAPER.muted, fontSize: TypeScale.caption },
  resumeAction: { minHeight: TouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  resumeActionText: { color: PAPER.ink, fontSize: TypeScale.caption, fontWeight: '900' },
  sectionTitle: { marginTop: 3, color: PAPER.ink, fontSize: TypeScale.headline, fontWeight: '900', fontFamily: Fonts.serif },
  provinceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  provinceButton: { width: '23.3%', minHeight: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: PAPER.line, backgroundColor: PAPER.bg },
  provinceActive: { borderColor: PAPER.ink, backgroundColor: PAPER.ink },
  provinceText: { color: PAPER.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  provinceTextActive: { color: '#FFFFFF' },
  yearRow: { flexDirection: 'row', gap: 8 },
  yearButton: { minHeight: TouchTarget, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: PAPER.line, backgroundColor: PAPER.bg },
  paper: { padding: 16, borderRadius: 4, borderWidth: 1, borderColor: PAPER.line, backgroundColor: PAPER.bg },
  paperHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: PAPER.rule },
  paperHeadCopy: { flex: 1, paddingRight: 10 },
  paperKicker: { color: PAPER.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  paperTitle: { marginTop: 4, color: PAPER.ink, fontSize: TypeScale.headline, fontWeight: '900', fontFamily: Fonts.serif },
  paperYear: { marginTop: 4, color: PAPER.muted, fontSize: TypeScale.caption },
  scoreBadge: { flexDirection: 'row', alignItems: 'baseline' },
  scoreMain: { color: PAPER.ink, fontSize: 30, fontWeight: '900' },
  scoreUnit: { marginLeft: 2, color: PAPER.muted, fontSize: TypeScale.caption },
  ruleRow: { paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  ruleText: { color: PAPER.muted, fontSize: TypeScale.caption },
  ruleDot: { marginHorizontal: 6, color: PAPER.ink },
  sectionList: { gap: 7 },
  sectionRow: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderRadius: 4, backgroundColor: '#F7F7F7' },
  sectionIndex: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: PAPER.ink },
  sectionIndexText: { color: '#FFFFFF', fontSize: TypeScale.caption, fontWeight: '800' },
  sectionName: { flex: 1, marginLeft: 10, color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '700' },
  sectionCount: { color: PAPER.muted, fontSize: TypeScale.caption },
  startButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: PAPER.ink },
  startText: { color: '#FFFFFF', fontSize: TypeScale.subheadline, fontWeight: '900' },
  footnote: { paddingHorizontal: 6, color: PAPER.muted, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
