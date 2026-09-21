import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnswerStaff } from '@/components/answer-staff';
import { NotationEditor } from '@/components/notation-editor';
import { StaffPreview } from '@/components/staff-preview';
import { TeacherGradeMark } from '@/components/teacher-grade-mark';
import { AppIcon } from '@/components/app-icon';
import { Btn, hitSlopFor } from '@/constants/button-tokens';
import { Brand, Fonts, Shadows, TypeScale } from '@/constants/theme';
import { DEFAULT_AUDIO_VOLUME } from '@/core/audio-settings';
import {
  answerIsComplete,
  answerIsStarted,
  CHORD_INVERSIONS,
  CHORD_QUALITY_NAMES,
  emptyExamAnswer,
  formatCorrectAnswer,
  formatExamAnswer,
  INTERVAL_QUALITIES,
  isTimedQuestion,
  needsPitch,
  needsQuality,
  scoreQuestion,
  targetPitches,
  type ExamAnswer,
} from '@/core/exam-answer';
import type { ChoiceOption, ExamQuestion } from '@/core/provinces';
import { playQuestionAudio, stopQuestionAudio } from '@/services/audio-engine';
import {
  clearActiveExamSession,
  getAudioVolume,
  getActiveExamSession,
  saveExamResult,
  saveExamSession,
  type ExamSession,
} from '@/services/local-data';

/**
 * 卷面配色与小程序端 `subpackages/exam/pages/exam/exam.wxss` 的「综合训练卷面」保持一致：
 * 亚麻米白底 + 森林绿主色，替代此前的纯黑白拟真答题卡。
 */
const PAPER = {
  linen: '#F4EAD5',
  linenDeep: '#EEE5D2',
  shell: '#FFFFFF',
  ink: '#18201E',
  heading: '#203C31',
  muted: '#75827E',
  faint: '#8A8E98',
  forest: Brand.forest,
  forestDeep: Brand.forestDeep,
  forestSoft: '#E2F2EC',
  accent: Brand.success,
  accentTint: '#F1F7EF',
  border: '#D7E1D5',
  rule: '#C7DACA',
  danger: '#D75B66',
  dangerSoft: '#FFF0F1',
} as const;

/** 圆角取自小程序 rpx ÷ 2 的等效 pt 值。 */
const R = { shell: 10, card: 7, option: 6, button: 5 } as const;

const SECTION_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;

type QuestionResult = { question: ExamQuestion; answer: ExamAnswer; score: number; total: number; correct: boolean };
type SubmittedResult = { score: number; total: number; correctCount: number; details: QuestionResult[] };

/**
 * 选择题谱面 —— 与小程序 `exam.wxml` 的 `<answer-staff style="width: {{option.staffWidth}}rpx">` 一一对应：
 * 事件原样交给同一渲染出口（不拆成单音、不丢拼写），宽度超过 540rpx 时按小程序用横向滚动承载。
 */
function ChoiceOptionPreview({ option }: { option: ChoiceOption }) {
  if (option.text) return <Text style={styles.choiceText}>{option.text}</Text>;
  const staffWidth = Number(option.staffWidth) || 0;
  const staff = (
    <StaffPreview
      events={option.events || []}
      meter={option.meter || ''}
      keySignature={option.keySignature || ''}
      barCount={Number(option.barCount) || 0}
      staffWidth={staffWidth || undefined}
      ink
    />
  );
  return staffWidth > 540
    ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choicePreviewScroll}>{staff}</ScrollView>
    : staff;
}

function basicSlots(item: ExamQuestion) {
  if (item.type === 'interval' && !item.harmonic) return Number(item.noteCount) || item.midis?.length || 2;
  if (item.type === 'single') return 1;
  return Math.max(1, targetPitches(item).length);
}

function basicStack(item: ExamQuestion) {
  return item.type === 'chord' || (item.type === 'interval' && Boolean(item.harmonic));
}

function samePitchSet(actual: number[], expected: number[]) {
  const left = actual.filter(Number.isFinite).slice().sort((a, b) => a - b);
  const right = expected.slice().sort((a, b) => a - b);
  return left.length === right.length && left.every((midi, index) => midi === right[index]);
}

type SectionInfo = { index: string; count: number; repeats: number };

type QuestionCardProps = {
  question: ExamQuestion;
  index: number;
  answer: ExamAnswer;
  unlocked: boolean;
  playCount: number;
  activeAudioId: string | null;
  preparingId: string | null;
  audioMessage?: string;
  result?: QuestionResult;
  showSection: boolean;
  section?: SectionInfo;
  onPlay: (question: ExamQuestion, index: number) => void;
  onUpdate: (question: ExamQuestion, index: number, answer: ExamAnswer) => void;
};

function ExamQuestionCard({ question, index, answer, unlocked, playCount, activeAudioId, preparingId, audioMessage, result, showSection, section, onPlay, onUpdate }: QuestionCardProps) {
  const review = Boolean(result);
  const isPlaying = activeAudioId === question.id;
  const isPreparing = preparingId === question.id;
  const audioBusy = Boolean(activeAudioId || preparingId);
  const maxPlays = Number(question.repeatCount) || 3;
  const requiredPitches = targetPitches(question).length;
  const currentComplete = answerIsComplete(question, answer);
  const legacyQualityParts = answer.quality.split(' · ');
  const selectedChordQuality = legacyQualityParts[0] || '';
  const selectedChordInversion = answer.inversion || legacyQualityParts[1] || '';

  function update(next: ExamAnswer) {
    if (!review && unlocked) onUpdate(question, index, next);
  }

  function updateBasic(pitches: number[], spellings: string[]) {
    if (!unlocked || review || !needsPitch(question)) return;
    Haptics.selectionAsync();
    update({ ...answer, pitches, spellings });
  }

  return <>
    {showSection && <View style={styles.sectionHeading}>
      <Text style={styles.sectionNumber}>{section?.index || SECTION_NUMERALS[0]}</Text>
      <View style={styles.sectionTitleWrap}>
        <Text style={styles.sectionTitleText}>{question.sectionTitle || question.typeName}</Text>
        {!!section && <Text style={styles.sectionMetaText}>{section.count} 题 · 每题 {section.repeats} 遍</Text>}
      </View>
    </View>}
    <View style={[styles.paperQuestion, result?.correct && styles.paperCorrect, result && !result.correct && styles.paperWrong]}>
      <View style={styles.questionHead}>
        <View style={styles.questionHeadCopy}><Text style={styles.questionTitle}>{index + 1}. {question.typeName}</Text><Text style={styles.questionInstruction}>{question.choice ? '听记后选择与音响一致的答案' : isTimedQuestion(question) ? '选择拍号、调号和时值后，在对应小节写谱' : '在五线谱上写出你听到的答案'}</Text></View>
        <Text style={styles.points}>{question.points} 分</Text>
      </View>

      <View style={styles.audioCard}>
        <Pressable accessibilityRole="button" accessibilityLabel={isPreparing ? '正在准备音频' : isPlaying ? '正在播放' : review ? '回放本题' : '播放本题'} accessibilityState={{ disabled: (audioBusy && !isPlaying && !isPreparing) || isPlaying || isPreparing || (!review && playCount >= maxPlays), busy: isPlaying || isPreparing }} onPress={() => onPlay(question, index)} disabled={(audioBusy && !isPlaying && !isPreparing) || isPlaying || isPreparing || (!review && playCount >= maxPlays)} style={({ pressed }) => [styles.playButton, (isPlaying || isPreparing) && styles.playingButton, pressed && styles.pressed]}>
          <View style={styles.playIcon}><AppIcon name={isPlaying || isPreparing ? 'pause' : 'play'} size={13} color={PAPER.shell} /></View>
          <Text numberOfLines={1} style={styles.playTitle}>{isPreparing ? '正在准备音频' : isPlaying ? '正在播放，请完整听完' : review ? '回放本题' : playCount ? '再听一遍' : '播放本题'}</Text>
          <Text style={styles.playCount}>{review ? '不限' : `${playCount} / ${maxPlays}`}</Text>
        </Pressable>
        {!!audioMessage && <Text accessibilityLiveRegion="polite" style={styles.errorText}>{audioMessage}</Text>}
      </View>

      <View style={styles.answerCard}>
        {!unlocked && !review && <Text style={styles.lockHint}>本题尚未播放；播放开始后答题区自动解锁</Text>}
        {question.choice ? <View style={styles.choiceList}>{question.choice.options.map((option, optionIndex) => {
          const selected = answer.choiceIndex === optionIndex;
          const correctOption = review && question.choice?.correctIndex === optionIndex;
          const wrongOption = review && selected && !correctOption;
          return <Pressable accessibilityRole="radio" accessibilityLabel={`选项 ${option.label}，${option.text || '五线谱谱例'}`} accessibilityState={{ selected, disabled: !unlocked || review }} key={`${question.id}-${optionIndex}`} disabled={!unlocked || review} onPress={() => { Haptics.selectionAsync(); update({ ...answer, choiceIndex: optionIndex }); }} style={({ pressed }) => [styles.choiceOption, selected && !review && styles.choiceActive, correctOption && styles.choiceCorrect, wrongOption && styles.choiceWrong, pressed && styles.pressed]}>
            <View style={[styles.choiceLabel, selected && !review && styles.choiceLabelActive, correctOption && styles.choiceLabelCorrect, wrongOption && styles.choiceLabelWrong]}><Text style={[styles.choiceLabelText, (selected && !review || correctOption || wrongOption) && styles.choiceLabelTextActive]}>{option.label}</Text></View>
            <View aria-hidden={true} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.choicePreview}><ChoiceOptionPreview option={option} /></View>
          </Pressable>;
        })}</View> : isTimedQuestion(question) ? <NotationEditor question={question} answer={answer} unlocked={unlocked || review} disabled={review} reviewCorrect={result?.correct} showCorrect={review} ink onChange={update} /> : <>
          {needsPitch(question) && <>
            <Text style={styles.answerHint}>点击谱面写入音符：{answer.pitches.filter(Number.isFinite).length} / {requiredPitches}</Text>
            {question.type === 'intervalConnection' && Array.isArray(question.chords) ? <View style={styles.connectionGrid}>{(question.chords as number[][]).map((chord, pairIndex) => {
              const chords = question.chords as number[][];
              const offset = chords.slice(0, pairIndex).reduce((sum, item) => sum + item.length, 0);
              const totalSlots = chords.reduce((sum, item) => sum + item.length, 0);
              const pairEntries = Array.from({ length: chord.length }, (_, itemIndex) => ({ pitch: answer.pitches[offset + itemIndex], spelling: (answer.spellings || [])[offset + itemIndex] })).filter((item) => Number.isFinite(item.pitch));
              const pairPitches = pairEntries.map((item) => item.pitch);
              const pairCorrect = samePitchSet(pairPitches, chord);
              return <View key={pairIndex} style={styles.connectionItem}><Text style={styles.connectionLabel}>第 {pairIndex + 1} 组</Text><AnswerStaff pitches={pairPitches} spellings={pairEntries.map((item) => item.spelling || '')} stacked maxStack={chord.length} ink disabled={!unlocked || review} tone={review ? pairCorrect ? 'green' : 'red' : ''} correctPitches={chord} showCorrect={review && !pairCorrect} onChange={(pitches, spellings) => {
                const nextPitches = Array.from({ length: totalSlots }, (_, itemIndex) => Number.isFinite(answer.pitches[itemIndex]) ? answer.pitches[itemIndex] : Number.NaN);
                const nextSpellings = Array.from({ length: totalSlots }, (_, itemIndex) => (answer.spellings || [])[itemIndex] || '');
                for (let itemIndex = 0; itemIndex < chord.length; itemIndex += 1) {
                  nextPitches[offset + itemIndex] = Number.isFinite(pitches[itemIndex]) ? pitches[itemIndex] : Number.NaN;
                  nextSpellings[offset + itemIndex] = spellings[itemIndex] || '';
                }
                Haptics.selectionAsync();
                update({ ...answer, pitches: nextPitches, spellings: nextSpellings });
              }} /></View>;
            })}</View> : <AnswerStaff pitches={answer.pitches} spellings={answer.spellings || []} slots={basicStack(question) ? 1 : basicSlots(question)} stacked={basicStack(question)} maxStack={basicStack(question) ? requiredPitches : 1} ink disabled={!unlocked || review} tone={review ? result?.correct ? 'green' : 'red' : ''} correctPitches={targetPitches(question)} correctSpellings={Array.isArray(question.spellings) ? question.spellings as string[] : []} showCorrect={review && !result?.correct} onChange={updateBasic} />}
            {!review && <View style={styles.answerActions}><Pressable accessibilityRole="button" accessibilityState={{ disabled: !answer.pitches.some(Number.isFinite) }} disabled={!answer.pitches.some(Number.isFinite)} onPress={() => update({ ...answer, pitches: answer.pitches.slice(0, -1), spellings: (answer.spellings || []).slice(0, -1) })} style={styles.actionButton}><Text style={styles.actionText}>撤销一笔</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: !answer.pitches.some(Number.isFinite) }} disabled={!answer.pitches.some(Number.isFinite)} onPress={() => update({ ...answer, pitches: [], spellings: [] })} style={styles.actionButton}><Text style={styles.actionText}>清空</Text></Pressable></View>}
          </>}
          {needsQuality(question) && (question.type === 'interval'
            ? <View style={styles.qualityBlock}><Text style={styles.answerHint}>音程性质</Text><View style={styles.qualityGrid}>{INTERVAL_QUALITIES.map((quality) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: answer.quality === quality, disabled: !unlocked || review }} key={quality} disabled={!unlocked || review} onPress={() => { Haptics.selectionAsync(); update({ ...answer, quality }); }} style={({ pressed }) => [styles.qualityOption, answer.quality === quality && styles.qualityActive, pressed && styles.pressed]}><Text style={[styles.qualityText, answer.quality === quality && styles.qualityTextActive]}>{quality}</Text></Pressable>)}</View></View>
            : <View style={styles.qualityBlock}>
              <Text style={styles.answerHint}>和弦性质</Text><View style={styles.qualityGrid}>{CHORD_QUALITY_NAMES.map((quality) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: selectedChordQuality === quality, disabled: !unlocked || review }} key={quality} disabled={!unlocked || review} onPress={() => { Haptics.selectionAsync(); update({ ...answer, quality, inversion: selectedChordInversion }); }} style={({ pressed }) => [styles.qualityOption, selectedChordQuality === quality && styles.qualityActive, pressed && styles.pressed]}><Text style={[styles.qualityText, selectedChordQuality === quality && styles.qualityTextActive]}>{quality}</Text></Pressable>)}</View>
              <Text style={styles.answerHint}>转位</Text><View style={styles.qualityGrid}>{CHORD_INVERSIONS.map((inversion) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: selectedChordInversion === inversion, disabled: !unlocked || review }} key={inversion} disabled={!unlocked || review} onPress={() => { Haptics.selectionAsync(); update({ ...answer, quality: selectedChordQuality, inversion }); }} style={({ pressed }) => [styles.qualityOption, selectedChordInversion === inversion && styles.qualityActive, pressed && styles.pressed]}><Text style={[styles.qualityText, selectedChordInversion === inversion && styles.qualityTextActive]}>{inversion}</Text></Pressable>)}</View>
            </View>)}
        </>}
        {result ? <View style={styles.reviewLine}><View style={styles.reviewCopy}><Text style={styles.reviewAnswer}>正确答案：{formatCorrectAnswer(question)}</Text><Text style={styles.reviewCandidate}>你的答案：{formatExamAnswer(question, answer)}</Text><Text style={styles.reviewScore}>得分 {result.score.toFixed(1).replace(/\.0$/, '')} / {result.total.toFixed(1).replace(/\.0$/, '')}</Text></View><TeacherGradeMark correct={result.correct} size={48} /></View> : <Text style={[styles.completionText, currentComplete && styles.completionDone]}>{currentComplete ? '本题已完整作答' : '作答内容会自动保存'}</Text>}
      </View>
    </View>
  </>;
}

export default function ExamPaperScreen() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [audioMessages, setAudioMessages] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<SubmittedResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [volume, setVolume] = useState(DEFAULT_AUDIO_VOLUME);

  useEffect(() => {
    Promise.all([getActiveExamSession(), getAudioVolume()])
      .then(([value, savedVolume]) => {
        setSession(value);
        setVolume(savedVolume);
      })
      .catch(() => setSaveMessage('未能读取本机试卷，请返回后重试。'))
      .finally(() => setLoading(false));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { stopQuestionAudio(); setActiveAudioId(null); setPreparingId(null); }
    });
    return () => { subscription.remove(); stopQuestionAudio(); };
  }, []);

  const answeredCount = useMemo(() => {
    if (!session) return 0;
    return session.paper.questions.filter((item) => answerIsStarted(session.answers[item.id] || emptyExamAnswer())).length;
  }, [session]);
  const resultById = useMemo(() => new Map((submitted?.details || []).map((item) => [item.question.id, item])), [submitted]);
  // 小节序号 / 题数 / 播放遍数：小程序卷面在每个大题前显示「一 单音 · 5 题」，此处按卷面题目顺序推导。
  const sectionInfo = useMemo(() => {
    const map = new Map<string, SectionInfo>();
    for (const item of session?.paper.questions || []) {
      const key = item.sectionTitle || item.typeName;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { index: SECTION_NUMERALS[map.size] || String(map.size + 1), count: 1, repeats: Number(item.repeatCount) || 3 });
    }
    return map;
  }, [session]);

  function commit(next: ExamSession) {
    setSession(next);
    saveExamSession(next)
      .then(() => setSaveMessage(''))
      .catch(() => setSaveMessage('本题答案未能保存到本机，请保持页面开启并重试操作。'));
  }

  function updateAnswer(question: ExamQuestion, index: number, nextAnswer: ExamAnswer) {
    if (!session || submitted) return;
    commit({ ...session, currentIndex: index, answers: { ...session.answers, [question.id]: nextAnswer } });
  }

  async function play(question: ExamQuestion, index: number) {
    if (!session || activeAudioId || preparingId) return;
    const playCount = session.playCounts[question.id] || 0;
    const maxPlays = Number(question.repeatCount) || 3;
    if (!submitted && playCount >= maxPlays) return;
    setPreparingId(question.id);
    setAudioMessages((current) => ({ ...current, [question.id]: '' }));
    const started = await playQuestionAudio(question, {
      volume: volume / 100,
      onFinish: () => setActiveAudioId((current) => current === question.id ? null : current),
      onInterrupted: () => setActiveAudioId((current) => current === question.id ? null : current),
      onError: (error) => {
        setActiveAudioId((current) => current === question.id ? null : current);
        setAudioMessages((current) => ({ ...current, [question.id]: error.message }));
      },
    });
    setPreparingId(null);
    if (!started) return;
    setActiveAudioId(question.id);
    if (!submitted) {
      const unlockedIds = session.unlockedIds.includes(question.id) ? session.unlockedIds : [...session.unlockedIds, question.id];
      commit({ ...session, currentIndex: index, playCounts: { ...session.playCounts, [question.id]: playCount + 1 }, unlockedIds });
    }
  }

  async function finishExam() {
    if (!session || submitting) return;
    setSubmitting(true);
    setSaveMessage('');
    stopQuestionAudio();
    setActiveAudioId(null);
    setPreparingId(null);
    const details = session.paper.questions.map((item) => {
      const writtenAnswer = session.answers[item.id] || emptyExamAnswer();
      return { question: item, answer: writtenAnswer, ...scoreQuestion(item, writtenAnswer) };
    });
    const score = details.reduce((sum, item) => sum + item.score, 0);
    const total = details.reduce((sum, item) => sum + item.total, 0);
    const correctCount = details.filter((item) => item.correct).length;
    try {
      await saveExamResult({ paperId: session.paper.id, provinceId: session.paper.provinceId, provinceLabel: session.paper.provinceLabel, frameworkTitle: session.paper.framework.title, score, total, correctCount, questionCount: details.length });
      await clearActiveExamSession();
      setSubmitted({ score, total, correctCount, details });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSaveMessage('交卷结果未能保存，请检查设备存储后重新提交。重复提交不会生成重复成绩。');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmSubmit() {
    if (!session || submitting) return;
    const incomplete = session.paper.questions.filter((item) => !answerIsComplete(item, session.answers[item.id] || emptyExamAnswer())).length;
    Alert.alert('确认交卷', incomplete ? `还有 ${incomplete} 题未完整作答，仍要交卷吗？` : '交卷后将在原卷面显示批改结果。', [{ text: '继续检查', style: 'cancel' }, { text: '确认交卷', onPress: finishExam }]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={PAPER.ink} /><Text style={styles.loadingText}>正在恢复试卷</Text></View>;
  if (!session) return <View style={styles.center}><Text style={styles.emptyTitle}>没有未完成的试卷</Text><Pressable accessibilityRole="button" onPress={() => router.replace('/exam')} style={styles.smallButton}><Text style={styles.smallButtonText}>返回选卷</Text></Pressable></View>;

  return <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 42 }]} showsVerticalScrollIndicator={false}>
    <View style={styles.paperShell}>
      <View style={styles.paperTopline}>
        <Text numberOfLines={1} style={styles.paperToplineText}>{session.paper.provinceLabel}音乐类专业省级统一模拟考试</Text>
        <Text style={styles.paperToplineText}>{session.paper.framework.year} 真题框架</Text>
      </View>
      <Text style={styles.paperTitle}>听音卷</Text>
      <Text style={styles.paperSubtitle}>模拟考试 · {session.paper.framework.title}</Text>
      <View style={styles.paperRule}><Text style={styles.paperRuleText}>{submitted ? '复盘模式：绿色为正确答案，错误作答保留为红色；播放按钮可无限次回放并核对谱面。' : '请按真题顺序作答：先播放音频，再在谱面填写答案；作答内容会自动保存到本机。'}</Text></View>

      {submitted ? <View style={styles.resultHero}>
        <AppIcon name="trophy" size={30} color={PAPER.forest} />
        <Text style={styles.resultTitle}>已完成交卷</Text>
        <Text style={styles.resultScore}>{submitted.score.toFixed(1).replace(/\.0$/, '')}<Text style={styles.resultTotal}> / {submitted.total.toFixed(1).replace(/\.0$/, '')}</Text></Text>
        <Text style={styles.resultPercent}>得分率 {submitted.total > 0 ? Math.round(submitted.score / submitted.total * 100) : 0}%</Text>
        <Text style={styles.resultSub}>答对 {submitted.correctCount} / {submitted.details.length} 题 · 标准答案已显示在原卷面</Text>
      </View> : <>
        <View style={styles.examHead}>
          <Text style={styles.paperMeta}>整卷连续作答 · 每题独立播放 · 自动保存进度</Text>
          <Text accessibilityLabel={`已答${answeredCount}题，共${session.paper.questions.length}题`} style={styles.answerCounter}>已答 {answeredCount}/{session.paper.questions.length}</Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: session.paper.questions.length, now: answeredCount }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${answeredCount / Math.max(1, session.paper.questions.length) * 100}%` }]} /></View>
      </>}
      {!!saveMessage && <Text accessibilityLiveRegion="polite" style={styles.saveError}>{saveMessage}</Text>}

      {session.paper.questions.map((question, index) => <ExamQuestionCard key={question.id} question={question} index={index} answer={session.answers[question.id] || emptyExamAnswer()} unlocked={session.unlockedIds.includes(question.id)} playCount={session.playCounts[question.id] || 0} activeAudioId={activeAudioId} preparingId={preparingId} audioMessage={audioMessages[question.id]} result={resultById.get(question.id)} section={sectionInfo.get(question.sectionTitle || question.typeName)} showSection={index === 0 || session.paper.questions[index - 1]?.sectionTitle !== question.sectionTitle} onPlay={play} onUpdate={updateAnswer} />)}

      {submitted ? <Pressable accessibilityRole="button" hitSlop={hitSlopFor(Btn.exam.submitPaper.height)} onPress={() => router.replace('/exam')} style={styles.submitButton}><Text style={styles.submitText}>返回模拟考试</Text></Pressable> : <>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting, busy: submitting }} disabled={submitting} hitSlop={hitSlopFor(Btn.exam.submitPaper.height)} onPress={confirmSubmit} style={[styles.submitButton, submitting && styles.submitDisabled]}><Text style={styles.submitText}>{submitting ? '正在交卷…' : '交 卷'}</Text></Pressable>
        <View style={styles.paperFooter}><Text style={styles.footerText}>请检查所有谱格、拍号与调号后再交卷</Text></View>
      </>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAPER.linen },
  content: { paddingHorizontal: 7, paddingTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: PAPER.linen },
  loadingText: { color: PAPER.muted, fontSize: TypeScale.footnote },
  emptyTitle: { color: PAPER.ink, fontSize: TypeScale.title3, fontWeight: '900' },
  smallButton: { ...Btn.exam.provinceConfirm, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: PAPER.forest },
  smallButtonText: { color: PAPER.shell, fontSize: Btn.exam.provinceConfirm.fontSize, fontWeight: '700' },
  paperShell: { paddingHorizontal: 10, paddingTop: 13, paddingBottom: 20, borderRadius: R.shell, borderWidth: 1, borderColor: PAPER.rule, backgroundColor: PAPER.shell, ...Shadows.card },
  paperTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: PAPER.forest },
  paperToplineText: { flexShrink: 1, color: PAPER.muted, fontSize: TypeScale.caption },
  paperSubtitle: { marginTop: 4, color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '600', textAlign: 'center' },
  paperTitle: { marginTop: 14, color: PAPER.ink, fontSize: 19, fontWeight: '800', fontFamily: Fonts.serif, letterSpacing: 4, textAlign: 'center' },
  paperRule: { marginTop: 10, padding: 8, borderRadius: R.card, borderWidth: 1, borderColor: PAPER.rule, backgroundColor: PAPER.accentTint },
  paperRuleText: { color: '#50685A', fontSize: TypeScale.caption, lineHeight: 18 },
  examHead: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 },
  paperMeta: { flex: 1, color: PAPER.muted, fontSize: TypeScale.caption },
  answerCounter: { color: PAPER.forest, fontSize: TypeScale.caption, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressTrack: { marginTop: 8, height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: PAPER.linenDeep },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: PAPER.forest },
  saveError: { marginTop: 10, padding: 10, borderRadius: R.card, color: '#B63F4F', backgroundColor: PAPER.dangerSoft, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  sectionHeading: { marginTop: 17, marginBottom: 6, paddingTop: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: PAPER.accent },
  sectionNumber: { width: 19, height: 19, borderRadius: 10, overflow: 'hidden', color: PAPER.shell, backgroundColor: PAPER.forest, fontSize: 11, fontWeight: '700', fontFamily: Fonts.serif, lineHeight: 19, textAlign: 'center' },
  sectionTitleWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 },
  sectionTitleText: { color: PAPER.heading, fontSize: TypeScale.subheadline, fontWeight: '800' },
  sectionMetaText: { color: PAPER.muted, fontSize: TypeScale.caption },
  paperQuestion: { marginTop: 8, padding: 14, gap: 12, borderRadius: R.card, borderWidth: 1, borderColor: PAPER.border, backgroundColor: PAPER.shell },
  paperCorrect: { borderColor: PAPER.accent, backgroundColor: PAPER.forestSoft },
  paperWrong: { borderColor: PAPER.danger, backgroundColor: PAPER.dangerSoft },
  questionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  questionHeadCopy: { flex: 1, paddingRight: 8 },
  questionTitle: { color: PAPER.ink, fontSize: TypeScale.headline, fontWeight: '900' },
  questionInstruction: { marginTop: 4, color: PAPER.muted, fontSize: TypeScale.caption, lineHeight: 18 },
  points: { color: PAPER.forest, fontSize: TypeScale.footnote, fontWeight: '900' },
  audioCard: { padding: 8, borderRadius: R.card, backgroundColor: PAPER.shell, borderWidth: 1, borderColor: PAPER.rule },
  // 小程序考试页每题播放是 .audio-action 药丸：42rpx 高 / 0 11rpx / 999rpx / 16rpx（字号抬到 9pt）。
  playButton: { ...Btn.exam.audioAction, flexDirection: 'row', alignItems: 'center', gap: 3.5, backgroundColor: PAPER.forest },
  playingButton: { backgroundColor: PAPER.accent },
  playIcon: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  playTitle: { color: PAPER.shell, fontSize: Btn.exam.audioAction.fontSize, fontWeight: '800' },
  playCount: { marginLeft: 'auto', color: PAPER.shell, fontSize: Btn.exam.audioAction.fontSize, fontWeight: '900', fontVariant: ['tabular-nums'] },
  errorText: { marginTop: 7, color: '#B63F4F', fontSize: TypeScale.caption },
  answerCard: { padding: 12, gap: 12, borderRadius: R.card, backgroundColor: PAPER.shell, borderWidth: 1, borderColor: PAPER.rule },
  lockHint: { padding: 12, borderRadius: R.card, color: PAPER.muted, backgroundColor: PAPER.linenDeep, fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  answerHint: { color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '800' },
  answerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  connectionGrid: { gap: 9 },
  connectionItem: { gap: 5, padding: 7, borderRadius: R.option, backgroundColor: PAPER.accentTint },
  connectionLabel: { color: PAPER.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  actionButton: { ...Btn.exam.undoLink, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: PAPER.forest, fontSize: Btn.exam.undoLink.fontSize, fontWeight: '700' },
  qualityBlock: { gap: 8 },
  qualityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qualityOption: { ...Btn.exam.qualityOption, alignItems: 'center', justifyContent: 'center', borderColor: PAPER.border, backgroundColor: PAPER.shell },
  qualityActive: { borderColor: PAPER.forest, backgroundColor: PAPER.forest },
  qualityText: { color: PAPER.ink, fontSize: Btn.exam.qualityOption.fontSize, fontWeight: '700' },
  qualityTextActive: { color: PAPER.shell },
  choiceList: { gap: 9 },
  choiceOption: { ...Btn.exam.choiceOption, flexDirection: 'row', alignItems: 'center', gap: 7, borderColor: PAPER.border, backgroundColor: PAPER.shell },
  choiceActive: { borderColor: PAPER.forest, backgroundColor: '#EDF7F0' },
  choiceCorrect: { borderColor: PAPER.accent, backgroundColor: PAPER.forestSoft },
  choiceWrong: { borderColor: PAPER.danger, backgroundColor: PAPER.dangerSoft },
  choiceLabel: { ...Btn.exam.choiceLabel, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF2EE', borderWidth: 1, borderColor: PAPER.border },
  choiceLabelActive: { backgroundColor: PAPER.forest, borderColor: PAPER.forest },
  choiceLabelCorrect: { backgroundColor: PAPER.accent, borderColor: PAPER.accent },
  choiceLabelWrong: { backgroundColor: PAPER.danger, borderColor: PAPER.danger },
  choiceLabelText: { color: '#52645A', fontSize: Btn.exam.choiceLabel.fontSize, fontWeight: '900' },
  choiceLabelTextActive: { color: PAPER.shell },
  choicePreview: { flex: 1 }, choicePreviewScroll: { alignItems: 'center' },
  choiceText: { color: '#35473E', fontSize: TypeScale.footnote, fontWeight: '700' },
  completionText: { color: PAPER.muted, fontSize: TypeScale.caption, textAlign: 'right' },
  completionDone: { color: PAPER.forest, fontWeight: '800' },
  reviewLine: { paddingTop: 8, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: PAPER.rule },
  reviewCopy: { flex: 1 },
  reviewAnswer: { color: '#24745F', fontSize: TypeScale.footnote, fontWeight: '700' },
  reviewCandidate: { marginTop: 3, color: PAPER.muted, fontSize: TypeScale.caption },
  reviewScore: { marginTop: 4, color: PAPER.forest, fontSize: TypeScale.footnote, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  resultHero: { marginTop: 14, padding: 18, alignItems: 'center', borderRadius: R.card, borderWidth: 2, borderColor: '#8FC3A0', backgroundColor: PAPER.forestSoft },
  resultTitle: { marginTop: 8, color: PAPER.forest, fontSize: TypeScale.subheadline, fontWeight: '800' },
  resultScore: { marginTop: 6, color: PAPER.forest, fontSize: 31, fontWeight: '800', fontFamily: Fonts.serif, fontVariant: ['tabular-nums'] },
  resultTotal: { color: '#5C746E', fontSize: TypeScale.subheadline },
  resultPercent: { marginTop: 2, color: '#5C746E', fontSize: TypeScale.caption, textAlign: 'center' },
  resultSub: { marginTop: 5, color: '#5C746E', fontSize: TypeScale.caption, lineHeight: 17, textAlign: 'center' },
  paperFooter: { marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: PAPER.rule },
  footerText: { color: PAPER.faint, fontSize: TypeScale.caption, textAlign: 'center' },
  submitButton: { ...Btn.exam.submitPaper, marginTop: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: PAPER.forest },
  submitDisabled: { opacity: 0.58 },
  submitText: { color: PAPER.shell, fontSize: Btn.exam.submitPaper.fontSize, fontWeight: '800', letterSpacing: 6 },
});
