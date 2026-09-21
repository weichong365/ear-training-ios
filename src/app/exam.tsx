import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Btn, hitSlopFor } from '@/constants/button-tokens';
import { Brand, TypeScale } from '@/constants/theme';
import { generateProvincePaper, getProvinceFramework, getProvinceVariants, PROVINCES, type ProvinceId } from '@/core/provinces';
import { emptyExamAnswer } from '@/core/exam-answer';
import { getActiveExamSession, saveExamSession, type ExamSession } from '@/services/local-data';
import { useProvince } from '@/services/province-context';

const EXAM_PAPER_ROUTE = '/exam-paper' as Href;

/** 与小程序的考试页（亚麻米白底 + 森林绿）保持一致，替代此前的纯黑白卷面风。 */
const PAPER = {
  linen: '#F4EAD5',
  shell: '#FFFFFF',
  ink: '#18201E',
  muted: '#75827E',
  forest: Brand.forest,
  forestSoft: '#E7F2EE',
  accent: Brand.success,
  accentTint: '#F1F7EF',
  border: '#D7E1D5',
  rule: '#C7DACA',
} as const;

const R = { card: 7, option: 6, button: 5 } as const;

export default function ExamScreen() {
  const { provinceId: selectedProvince } = useProvince();
  const [provinceId, setProvinceId] = useState<ProvinceId>('zhejiang');
  const [variantIndex, setVariantIndex] = useState(0);
  const [activeSession, setActiveSession] = useState<ExamSession | null>(null);
  const [creating, setCreating] = useState(false);
  const syncedProvince = useRef(false);
  const variants = useMemo(() => getProvinceVariants(provinceId), [provinceId]);
  const framework = useMemo(() => getProvinceFramework(provinceId, variantIndex), [provinceId, variantIndex]);

  useEffect(() => { getActiveExamSession().then(setActiveSession); }, []);

  useEffect(() => {
    // 首页带入的已选省份：首次就绪时同步到本地选择，之后用户手动切换不被覆盖。
    if (selectedProvince && !syncedProvince.current) {
      setProvinceId(selectedProvince);
      syncedProvince.current = true;
    }
  }, [selectedProvince]);

  function selectProvince(id: ProvinceId) {
    setProvinceId(id);
    setVariantIndex(0);
  }

  async function createPaper() {
    if (creating) return;
    setCreating(true);
    try {
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
    } catch {
      Alert.alert('试卷未能创建', '请检查设备存储后重试。');
    } finally {
      setCreating(false);
    }
  }

  function startNew() {
    if (!activeSession) {
      createPaper();
      return;
    }
    Alert.alert('开始新试卷？', '当前未交卷进度会被新试卷替换。', [
      { text: '取消', style: 'cancel' },
      { text: '开始新卷', style: 'destructive', onPress: () => void createPaper() },
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
        {Array.from({ length: (3 - (PROVINCES.length % 3)) % 3 }, (_, index) => <View key={`filler-${index}`} style={styles.provinceFiller} />)}
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

      <Pressable accessibilityRole="button" accessibilityState={{ disabled: creating, busy: creating }} disabled={creating} hitSlop={hitSlopFor(Btn.exam.provinceConfirm.height)} onPress={startNew} style={({ pressed }) => [styles.startButton, creating && styles.startDisabled, pressed && styles.pressed]}>
        <Text style={styles.startText}>{creating ? '正在生成试卷…' : activeSession ? '生成并开始新试卷' : '开始整卷模拟'}</Text>
      </Pressable>
      <Text style={styles.footnote}>交卷前可退出页面，答题内容和播放次数会保存在当前设备。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAPER.linen },
  content: { padding: 14, paddingBottom: 42, gap: 16 },
  hero: { padding: 20, borderRadius: R.card, backgroundColor: PAPER.forest },
  title: { color: PAPER.shell, fontSize: TypeScale.title1, fontWeight: '900' },
  subtitle: { marginTop: 6, color: 'rgba(255,255,255,.76)', fontSize: TypeScale.footnote },
  resumeCard: { ...Btn.exam.provincePicker, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: PAPER.forest, backgroundColor: PAPER.shell },
  resumeKicker: { color: PAPER.muted, fontSize: TypeScale.caption, fontWeight: '800' },
  resumeTitle: { marginTop: 3, maxWidth: 220, color: PAPER.ink, fontSize: TypeScale.subheadline, fontWeight: '900' },
  resumeSub: { marginTop: 4, color: PAPER.muted, fontSize: TypeScale.caption },
  resumeAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  resumeActionText: { color: PAPER.forest, fontSize: TypeScale.caption, fontWeight: '900' },
  sectionTitle: { marginTop: 3, color: PAPER.ink, fontSize: TypeScale.headline, fontWeight: '900' },
  // 小程序 .province-grid = repeat(3, minmax(0,1fr)) + gap 10rpx → 3 列、列距 5pt。
  // RN 没有 grid，用 flexBasis 30% + flexGrow 1 复刻：每行 3 格等宽，末行不足 3 格时
  // 用透明填充格补齐，保证最后一格的宽度与前几行一致（不会拉成整行）。
  provinceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  provinceButton: { flexBasis: '30%', flexGrow: 1, ...Btn.exam.provincePill, alignItems: 'center', justifyContent: 'center', borderColor: '#CBDED2', backgroundColor: PAPER.shell },
  provinceFiller: { flexBasis: '30%', flexGrow: 1 },
  provinceActive: { borderColor: PAPER.forest, backgroundColor: PAPER.forestSoft },
  provinceText: { color: '#566B60', fontSize: Btn.exam.provincePill.fontSize, fontWeight: '700' },
  provinceTextActive: { color: PAPER.forest },
  yearRow: { flexDirection: 'row', gap: 8 },
  yearButton: { flexBasis: '30%', flexGrow: 1, ...Btn.exam.provincePill, alignItems: 'center', justifyContent: 'center', borderColor: '#CBDED2', backgroundColor: PAPER.shell },
  paper: { padding: 16, borderRadius: R.card, borderWidth: 1, borderColor: PAPER.border, backgroundColor: PAPER.shell },
  paperHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: PAPER.rule },
  paperHeadCopy: { flex: 1, paddingRight: 10 },
  paperKicker: { color: PAPER.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  paperTitle: { marginTop: 4, color: PAPER.ink, fontSize: TypeScale.headline, fontWeight: '900' },
  paperYear: { marginTop: 4, color: PAPER.muted, fontSize: TypeScale.caption },
  scoreBadge: { flexDirection: 'row', alignItems: 'baseline' },
  scoreMain: { color: PAPER.forest, fontSize: 30, fontWeight: '900' },
  scoreUnit: { marginLeft: 2, color: PAPER.muted, fontSize: TypeScale.caption },
  ruleRow: { paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  ruleText: { color: PAPER.muted, fontSize: TypeScale.caption },
  ruleDot: { marginHorizontal: 6, color: PAPER.accent },
  sectionList: { gap: 7 },
  sectionRow: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderRadius: R.option, backgroundColor: PAPER.accentTint },
  sectionIndex: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: PAPER.forest },
  sectionIndexText: { color: PAPER.shell, fontSize: TypeScale.caption, fontWeight: '800' },
  sectionName: { flex: 1, marginLeft: 10, color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '700' },
  sectionCount: { color: PAPER.muted, fontSize: TypeScale.caption },
  startButton: { ...Btn.exam.provinceConfirm, alignItems: 'center', justifyContent: 'center', backgroundColor: PAPER.forest },
  startDisabled: { opacity: 0.5 },
  startText: { color: PAPER.shell, fontSize: Btn.exam.provinceConfirm.fontSize, fontWeight: '700' },
  footnote: { paddingHorizontal: 6, color: PAPER.muted, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
