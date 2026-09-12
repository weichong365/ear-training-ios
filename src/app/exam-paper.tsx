import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnswerStaff } from '@/components/answer-staff';
import { NotationEditor, NotationStaff } from '@/components/notation-editor';
import { StaffPreview } from '@/components/staff-preview';
import { TeacherGradeMark } from '@/components/teacher-grade-mark';
import { AppIcon } from '@/components/app-icon';
import { Fonts, Radius, TouchTarget, TypeScale } from '@/constants/theme';
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

const PAPER = {
  bg: '#FFFFFF',
  ink: '#111111',
  inkSoft: '#3A3A3A',
  muted: '#666666',
  faint: '#8A8A8A',
  line: '#141414',
  rule: '#D8D8D8',
} as const;

type QuestionResult = { question: ExamQuestion; answer: ExamAnswer; score: number; total: number; correct: boolean };
type SubmittedResult = { score: number; total: number; correctCount: number; details: QuestionResult[] };

function optionEvents(option: ChoiceOption) {
  return (option.events || []).flatMap((event) => (event.midis || [69]).map((midi) => ({
    midi,
    duration: Math.abs(Number(event.dur) || 1),
    rest: Boolean(event.rest),
    barIndex: Number.isInteger(event.barIndex) ? Number(event.barIndex) : undefined,
  })));
}

function ChoiceOptionPreview({ option }: { option: ChoiceOption }) {
  if (option.text) return <Text style={styles.choiceText}>{option.text}</Text>;
  const events = optionEvents(option);
  const timed = events.some((event) => event.rest || event.duration !== 1) || Number(option.barCount) > 0;
  if (timed) return <NotationStaff events={events} meter={option.meter || ''} keySignature={option.keySignature || ''} barCount={Number(option.barCount) || 4} ink />;
  return <StaffPreview midis={events.map((event) => event.midi)} harmonic={events.length <= 3} compact ink />;
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
  onPlay: (question: ExamQuestion, index: number) => void;
  onUpdate: (question: ExamQuestion, index: number, answer: ExamAnswer) => void;
};

function ExamQuestionCard({ question, index, answer, unlocked, playCount, activeAudioId, preparingId, audioMessage, result, showSection, onPlay, onUpdate }: QuestionCardProps) {
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
    {showSection && <View style={styles.sectionDivider}><Text style={styles.sectionDividerText}>{question.sectionTitle}</Text></View>}
    <View style={[styles.paperQuestion, result?.correct && styles.paperCorrect, result && !result.correct && styles.paperWrong]}>
      <View style={styles.questionHead}>
        <View style={styles.questionHeadCopy}><Text style={styles.questionTitle}>{index + 1}. {question.typeName}</Text><Text style={styles.questionInstruction}>{question.choice ? '听记后选择与音响一致的答案' : isTimedQuestion(question) ? '选择拍号、调号和时值后，在对应小节写谱' : '在五线谱上写出你听到的答案'}</Text></View>
        <Text style={styles.points}>{question.points} 分</Text>
      </View>

      <View style={styles.audioCard}>
        <Pressable accessibilityRole="button" accessibilityLabel={isPreparing ? '正在准备音频' : isPlaying ? '正在播放' : review ? '回放本题' : '播放本题'} accessibilityState={{ disabled: (audioBusy && !isPlaying && !isPreparing) || isPlaying || isPreparing || (!review && playCount >= maxPlays), busy: isPlaying || isPreparing }} onPress={() => onPlay(question, index)} disabled={(audioBusy && !isPlaying && !isPreparing) || isPlaying || isPreparing || (!review && playCount >= maxPlays)} style={({ pressed }) => [styles.playButton, (isPlaying || isPreparing) && styles.playingButton, pressed && styles.pressed]}>
          <View style={styles.playIcon}><AppIcon name={isPlaying || isPreparing ? 'pause' : 'play'} size={20} color="#FFFFFF" /></View>
          <View style={styles.playCopy}><Text style={styles.playTitle}>{isPreparing ? '正在准备音频' : isPlaying ? '正在播放，请完整听完' : review ? '回放本题' : playCount ? '再听一遍' : '播放本题'}</Text><Text style={styles.playSub}>{review ? '交卷后回放不限次数' : '音频开始后本题答题区自动解锁'}</Text></View>
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
  const [volume, setVolume] = useState(78);

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
    <View style={styles.paperHeader}>
      <View style={styles.sealStrip}><View style={styles.sealDash} /><Text style={styles.paperSeal}>密封线内不要答题</Text><View style={styles.sealDash} /></View>
      <Text style={styles.paperSubtitle}>{session.paper.framework.title}</Text>
      <Text style={styles.paperTitle}>练耳听写答题卡</Text>
      <View style={styles.paperInfoRow}><Text style={styles.paperInfo}>姓名：＿＿＿＿＿＿</Text><Text style={styles.paperInfo}>准考证号：＿＿＿＿＿＿＿＿</Text></View>
    </View>
    {submitted ? <View style={styles.resultHero}><AppIcon name="trophy" size={34} color="#FFFFFF" /><Text style={styles.resultTitle}>已完成交卷</Text><Text style={styles.resultScore}>{submitted.score.toFixed(1).replace(/\.0$/, '')}<Text style={styles.resultTotal}> / {submitted.total.toFixed(1).replace(/\.0$/, '')}</Text></Text><Text style={styles.resultSub}>答对 {submitted.correctCount} / {submitted.details.length} 题 · 标准答案已显示在原卷面</Text></View> : <>
      <View style={styles.examHead}><View style={styles.examHeadCopy}><Text style={styles.examTitle}>{session.paper.provinceLabel}卷 · {session.paper.framework.year}</Text><Text style={styles.paperMeta}>整卷连续作答 · 每题独立播放 · 自动保存进度</Text></View><Text accessibilityLabel={`已答${answeredCount}题，共${session.paper.questions.length}题`} style={styles.answerCounter}>已答 {answeredCount}/{session.paper.questions.length}</Text></View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: session.paper.questions.length, now: answeredCount }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${answeredCount / Math.max(1, session.paper.questions.length) * 100}%` }]} /></View>
    </>}
    {!!saveMessage && <Text accessibilityLiveRegion="polite" style={styles.saveError}>{saveMessage}</Text>}

    {session.paper.questions.map((question, index) => <ExamQuestionCard key={question.id} question={question} index={index} answer={session.answers[question.id] || emptyExamAnswer()} unlocked={session.unlockedIds.includes(question.id)} playCount={session.playCounts[question.id] || 0} activeAudioId={activeAudioId} preparingId={preparingId} audioMessage={audioMessages[question.id]} result={resultById.get(question.id)} showSection={index === 0 || session.paper.questions[index - 1]?.sectionTitle !== question.sectionTitle} onPlay={play} onUpdate={updateAnswer} />)}

    {submitted ? <Pressable accessibilityRole="button" onPress={() => router.replace('/exam')} style={styles.submitButton}><Text style={styles.submitText}>返回模拟考试</Text></Pressable> : <View style={styles.paperFooter}><Text style={styles.footerText}>请检查所有谱格、拍号与调号后再交卷</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting, busy: submitting }} disabled={submitting} onPress={confirmSubmit} style={[styles.submitButton, submitting && styles.submitDisabled]}><Text style={styles.submitText}>{submitting ? '正在交卷…' : '提交整张试卷'}</Text></Pressable></View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAPER.bg },
  content: { padding: 20, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: PAPER.bg },
  loadingText: { color: PAPER.muted, fontSize: TypeScale.footnote },
  emptyTitle: { color: PAPER.ink, fontSize: TypeScale.title3, fontWeight: '900', fontFamily: Fonts.serif },
  smallButton: { minHeight: TouchTarget, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: PAPER.ink },
  smallButtonText: { color: '#FFFFFF', fontSize: TypeScale.footnote, fontWeight: '800' },
  paperHeader: { paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center', gap: 10, borderRadius: 4, borderWidth: 1, borderColor: PAPER.line, backgroundColor: PAPER.bg },
  sealStrip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 10 },
  sealDash: { flex: 1, height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: PAPER.muted },
  paperSeal: { color: PAPER.muted, fontSize: TypeScale.caption, fontWeight: '700', letterSpacing: 3 },
  paperSubtitle: { color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '700', fontFamily: Fonts.serif },
  paperTitle: { color: PAPER.ink, fontSize: 26, fontWeight: '900', fontFamily: Fonts.serif, letterSpacing: 5 },
  paperInfoRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', gap: 12 },
  paperInfo: { color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '700', fontFamily: Fonts.serif },
  examHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  examHeadCopy: { flex: 1 },
  examTitle: { color: PAPER.ink, fontSize: TypeScale.title2, fontWeight: '900', fontFamily: Fonts.serif },
  paperMeta: { marginTop: 5, color: PAPER.muted, fontSize: TypeScale.caption },
  answerCounter: { color: PAPER.muted, fontSize: TypeScale.caption, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: PAPER.rule },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: PAPER.ink },
  saveError: { padding: 10, borderRadius: Radius.control, color: '#B3261E', backgroundColor: '#F6E4E2', fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  sectionDivider: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 4, backgroundColor: PAPER.ink },
  sectionDividerText: { color: '#FFFFFF', fontSize: TypeScale.subheadline, fontWeight: '900', fontFamily: Fonts.serif },
  paperQuestion: { padding: 14, gap: 12, borderRadius: 4, borderWidth: 1, borderColor: PAPER.line, backgroundColor: PAPER.bg },
  paperCorrect: { borderColor: '#2e8b6f', backgroundColor: '#e2f2ec' },
  paperWrong: { borderColor: '#C0392B', backgroundColor: '#FBF0EE' },
  questionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  questionHeadCopy: { flex: 1, paddingRight: 8 },
  questionTitle: { color: PAPER.ink, fontSize: TypeScale.headline, fontWeight: '900', fontFamily: Fonts.serif },
  questionInstruction: { marginTop: 4, color: PAPER.muted, fontSize: TypeScale.caption, lineHeight: 18 },
  points: { color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '900' },
  audioCard: { padding: 8, borderRadius: 4, backgroundColor: PAPER.bg, borderWidth: 1, borderColor: PAPER.rule },
  playButton: { minHeight: 64, padding: 10, flexDirection: 'row', alignItems: 'center', borderRadius: 4, backgroundColor: PAPER.ink },
  playingButton: { backgroundColor: '#000000' },
  playIcon: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: 'rgba(255,255,255,.16)' },
  playCopy: { flex: 1, marginLeft: 9 },
  playTitle: { color: '#FFFFFF', fontSize: TypeScale.subheadline, fontWeight: '900' },
  playSub: { marginTop: 2, color: 'rgba(255,255,255,.72)', fontSize: TypeScale.caption },
  playCount: { color: '#FFFFFF', fontSize: TypeScale.footnote, fontWeight: '900', fontVariant: ['tabular-nums'] },
  errorText: { marginTop: 7, color: '#B3261E', fontSize: TypeScale.caption },
  answerCard: { padding: 12, gap: 12, borderRadius: 4, backgroundColor: PAPER.bg, borderWidth: 1, borderColor: PAPER.rule },
  lockHint: { padding: 12, borderRadius: 4, color: PAPER.muted, backgroundColor: '#F5F5F5', fontSize: TypeScale.caption, lineHeight: 18, textAlign: 'center' },
  answerHint: { color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '800' },
  answerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  connectionGrid: { gap: 9 },
  connectionItem: { gap: 5, padding: 7, borderRadius: 4, backgroundColor: '#F7F7F7' },
  connectionLabel: { color: PAPER.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  actionButton: { minHeight: TouchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '700' },
  qualityBlock: { gap: 8 },
  qualityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qualityOption: { minHeight: TouchTarget, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: PAPER.line, backgroundColor: PAPER.bg },
  qualityActive: { borderColor: PAPER.ink, backgroundColor: PAPER.ink },
  qualityText: { color: PAPER.ink, fontSize: TypeScale.caption, fontWeight: '700' },
  qualityTextActive: { color: '#FFFFFF' },
  choiceList: { gap: 9 },
  choiceOption: { minHeight: 52, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 4, borderWidth: 1.5, borderColor: PAPER.line, backgroundColor: PAPER.bg },
  choiceActive: { borderColor: PAPER.ink, backgroundColor: '#F2F2F2' },
  choiceCorrect: { borderColor: '#2e8b6f', backgroundColor: '#e2f2ec' },
  choiceWrong: { borderColor: '#C0392B', backgroundColor: '#FBF0EE' },
  choiceLabel: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EFEFEF', borderWidth: 1, borderColor: PAPER.line },
  choiceLabelActive: { backgroundColor: PAPER.ink, borderColor: PAPER.ink },
  choiceLabelCorrect: { backgroundColor: '#2e8b6f', borderColor: '#2e8b6f' },
  choiceLabelWrong: { backgroundColor: '#C0392B', borderColor: '#C0392B' },
  choiceLabelText: { color: PAPER.ink, fontSize: TypeScale.caption, fontWeight: '900' },
  choiceLabelTextActive: { color: '#FFFFFF' },
  choicePreview: { flex: 1 },
  choiceText: { color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '700' },
  completionText: { color: PAPER.muted, fontSize: TypeScale.caption, textAlign: 'right' },
  completionDone: { color: PAPER.ink, fontWeight: '800' },
  reviewLine: { paddingTop: 8, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: PAPER.rule },
  reviewCopy: { flex: 1 },
  reviewAnswer: { color: '#B3261E', fontSize: TypeScale.footnote, fontWeight: '700' },
  reviewCandidate: { marginTop: 3, color: PAPER.muted, fontSize: TypeScale.caption },
  reviewScore: { marginTop: 4, color: PAPER.ink, fontSize: TypeScale.footnote, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  resultHero: { padding: 24, alignItems: 'center', borderRadius: 4, backgroundColor: PAPER.ink },
  resultTitle: { marginTop: 10, color: '#FFFFFF', fontSize: TypeScale.title2, fontWeight: '900', fontFamily: Fonts.serif },
  resultScore: { marginTop: 10, color: '#FFFFFF', fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  resultTotal: { color: 'rgba(255,255,255,.72)', fontSize: TypeScale.title3 },
  resultSub: { marginTop: 5, color: 'rgba(255,255,255,.72)', fontSize: TypeScale.footnote, textAlign: 'center' },
  paperFooter: { gap: 10, paddingTop: 8 },
  footerText: { color: PAPER.muted, fontSize: TypeScale.caption, textAlign: 'center' },
  submitButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: PAPER.ink },
  submitDisabled: { opacity: 0.58 },
  submitText: { color: '#FFFFFF', fontSize: TypeScale.subheadline, fontWeight: '900' },
});
