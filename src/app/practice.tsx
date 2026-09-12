import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { AnswerStaff } from '@/components/answer-staff';
import { NotationEditor } from '@/components/notation-editor';
import { PianoKeyboard } from '@/components/piano-keyboard';
import { TeacherGradeMark } from '@/components/teacher-grade-mark';
import { generateQuestionSet, type PracticeGenerateOptions, type PracticeMode, type PracticeProfile } from '@/core';
import { answerIsComplete, CHORD_INVERSIONS, CHORD_QUALITY_NAMES, emptyExamAnswer, formatCorrectAnswer, formatExamAnswer, isTimedQuestion, needsPitch, needsQuality, scoreQuestion, type ExamAnswer } from '@/core/exam-answer';
import type { ExamQuestion } from '@/core/provinces';
import { Brand, Radius, Shadows, TouchTarget, TypeScale } from '@/constants/theme';
import { playPianoNote, playQuestionAudio, stopQuestionAudio } from '@/services/audio-engine';
import { clearActivePracticeSession, finalizePracticeSubmission, getActivePracticeSession, getAudioVolume, getPracticeProfile, getWrongRecords, removeWrongRecord, saveAudioVolume, savePracticeResult, savePracticeSession, type PracticeQuestionSnapshot, type PracticeSession } from '@/services/local-data';

type Phase = 'ready' | 'answering' | 'feedback' | 'finished';
type Highlight = 'correct' | 'wrong' | 'std';

const MODE_NAMES: Record<PracticeMode, string> = {
  single: '单音听记', group: '旋律音组', interval: '音程听记', connection: '和声音程连接', chord: '和弦听记', chordQuality: '和弦性质', chordPitch: '和弦音高', rhythm: '节奏听记', melody: '旋律听记', adaptive: '智能强化',
};
const STANDARD_GAP_MS = 1780;

const PRACTICE_MODES: PracticeMode[] = ['single', 'group', 'interval', 'connection', 'chord', 'chordQuality', 'chordPitch', 'rhythm', 'melody', 'adaptive'];

function practiceSessionId() {
  return `practice_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function safeMode(value: string | string[] | undefined): PracticeMode {
  const mode = Array.isArray(value) ? value[0] : value;
  return (PRACTICE_MODES as string[]).includes(mode || '') ? mode as PracticeMode : 'single';
}

function safeTier(value: string | string[] | undefined): PracticeGenerateOptions {
  const raw = Array.isArray(value) ? value[0] : value;
  const tier = Number(raw);
  return tier === 1 || tier === 2 || tier === 3 ? { tier: tier as 1 | 2 | 3 } : {};
}

/** 和声音程连接：每组固定 2 个音槽位，answer.pitches 保持扁平定长，便于逐组比对与完成判定。 */
function connectionOffsets(question: ExamQuestion): number[] {
  const chords = (question.chords || []) as number[][];
  const offsets = [0];
  chords.forEach((chord) => offsets.push(offsets[offsets.length - 1] + chord.length));
  return offsets;
}

function connectionGroupSlice(question: ExamQuestion, answer: ExamAnswer, groupIndex: number) {
  const offsets = connectionOffsets(question);
  const start = offsets[groupIndex];
  const end = offsets[groupIndex + 1];
  return {
    pitches: answer.pitches.slice(start, end),
    spellings: answer.spellings.slice(start, end),
  };
}

function applyConnectionGroup(question: ExamQuestion, answer: ExamAnswer, groupIndex: number, pitches: number[], spellings: string[]) {
  const offsets = connectionOffsets(question);
  const start = offsets[groupIndex];
  const end = offsets[groupIndex + 1];
  const total = offsets[offsets.length - 1];
  const nextPitches = answer.pitches.slice();
  const nextSpellings = answer.spellings.slice();
  while (nextPitches.length < total) nextPitches.push(undefined as unknown as number);
  while (nextSpellings.length < total) nextSpellings.push('');
  for (let index = start; index < end; index++) {
    nextPitches[index] = pitches[index - start] ?? (undefined as unknown as number);
    nextSpellings[index] = spellings[index - start] ?? '';
  }
  return { ...answer, pitches: nextPitches, spellings: nextSpellings };
}

function answerSlots(question: ExamQuestion) {
  if (question.type === 'interval' && !question.harmonic) return Number(question.noteCount) || question.midis?.length || 2;
  return 1;
}

function maxStack(question: ExamQuestion) {
  if (question.type === 'chord') return Number(question.chordSize) || question.midis?.length || 3;
  if (question.type === 'interval' && question.harmonic) return 2;
  return 1;
}

function keyHighlights(question: ExamQuestion, answer: ExamAnswer, correct: boolean) {
  if (question.type === 'rhythm') return {};
  const target = question.type === 'intervalConnection'
    ? ((question.chords as number[][]) || []).flat().map(Number)
    : (question.midis || []).map(Number);
  const actual = question.type === 'melody' ? answer.events.filter((event) => !event.rest).map((event) => event.midi) : answer.pitches.filter(Number.isFinite);
  const values: Record<number, Highlight> = {};
  actual.forEach((midi) => { values[midi] = correct ? 'correct' : 'wrong'; });
  target.forEach((midi) => { values[midi] = 'correct'; });
  return values;
}

function correctKeyHighlights(question: ExamQuestion) {
  const values: Record<number, Highlight> = {};
  const midis = question.type === 'rhythm' ? [69]
    : question.type === 'intervalConnection' ? ((question.chords as number[][]) || []).flat()
      : (question.midis || []).map(Number);
  midis.forEach((midi) => { if (Number.isFinite(midi)) values[midi] = 'correct'; });
  return values;
}

function answerTitleFor(question: ExamQuestion) {
  if (question.type === 'intervalConnection') return '在谱面上叠写听到的和声音程连接';
  if (needsQuality(question) && !needsPitch(question)) return '选择你听到的和弦性质与转位';
  const noun = question.type === 'single' ? '单音'
    : question.type === 'interval' ? (question.groupSize ? '音组' : '音程')
      : question.type === 'chord' ? '和弦'
        : question.type === 'rhythm' ? '节奏' : '旋律';
  return `在谱面上写下听到的${noun}`;
}

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ type?: string; wrongId?: string; tier?: string }>();
  const mode = safeMode(params.type);
  const generateOptions = useMemo(() => safeTier(params.tier), [params.tier]);
  const wrongId = Array.isArray(params.wrongId) ? params.wrongId[0] : params.wrongId;
  const insets = useSafeAreaInsets();
  const [sessionKey, setSessionKey] = useState(0);
  const [reviewQuestion, setReviewQuestion] = useState<ExamQuestion | null>(null);
  const [reviewLoaded, setReviewLoaded] = useState(!wrongId);
  const [adaptiveProfile, setAdaptiveProfile] = useState<PracticeProfile | null>(null);
  const [activePracticeSession, setActivePracticeSession] = useState<PracticeSession | null>(null);
  const [practiceLoaded, setPracticeLoaded] = useState(Boolean(wrongId));
  const resumeSession = activePracticeSession && activePracticeSession.mode === mode && activePracticeSession.tier === generateOptions.tier ? activePracticeSession : null;
  const questions = useMemo(() => {
    if (!wrongId && !practiceLoaded) return [];
    if (resumeSession) return resumeSession.questions;
    void sessionKey;
    if (wrongId) return reviewQuestion ? [reviewQuestion] : [];
    if (mode === 'adaptive' && !adaptiveProfile) return [];
    return generateQuestionSet(mode, mode === 'adaptive' ? 15 : 10, adaptiveProfile || {}, generateOptions);
  }, [adaptiveProfile, generateOptions, mode, practiceLoaded, resumeSession, reviewQuestion, sessionKey, wrongId]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<ExamAnswer>(emptyExamAnswer);
  const [phase, setPhase] = useState<Phase>('ready');
  const [playCount, setPlayCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [highlights, setHighlights] = useState<Record<number, Highlight>>({});
  const [autoPlay, setAutoPlay] = useState(false);
  const [volume, setVolume] = useState(78);
  const [dragging, setDragging] = useState(false);
  const replaying = useRef(false);
  const submitting = useRef(false);
  const standardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = useRef(practiceSessionId());
  const questionSnapshots = useRef<Array<PracticeQuestionSnapshot | undefined>>([]);
  const completedQuestions = useRef(new Set<number>());
  const restoredSessionId = useRef<string | null>(null);
  const skipPracticeSave = useRef(false);
  const question = questions[index] as ExamQuestion | undefined;
  const scoringQuestion = question ? { ...question, id: `practice-${index}`, points: 1, sectionTitle: question.typeName } as ExamQuestion : null;
  const timed = scoringQuestion ? isTimedQuestion(scoringQuestion) : false;
  const maxPlays = question ? Number(question.repeatCount) || (question.type === 'melody' ? 4 : 3) : 0;
  const complete = scoringQuestion ? answerIsComplete(scoringQuestion, answer) : false;
  const accuracy = questions.length ? Math.round(score / questions.length * 100) : 0;
  const compactPitchMode = mode === 'single' || mode === 'group' || mode === 'interval' || mode === 'connection' || mode === 'chord' || mode === 'chordQuality' || mode === 'chordPitch';
  const qualityOnly = scoringQuestion ? needsQuality(scoringQuestion) && !needsPitch(scoringQuestion) : false;
  const isConnection = question?.type === 'intervalConnection';
  const legacyQualityParts = answer.quality.split(' · ');
  const selectedChordQuality = legacyQualityParts[0] || '';
  const selectedChordInversion = answer.inversion || legacyQualityParts[1] || '';
  const volumeRow = <View style={[styles.volumeRow, compactPitchMode && styles.compactVolumeRow]}><Text style={styles.volumeLabel}>音量</Text><Pressable accessibilityRole="button" accessibilityLabel="降低音量" onPress={() => changeVolume(volume - 10)} style={styles.volumeStep}><AppIcon name="minus" size={17} /></Pressable><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: volume }} style={styles.volumeTrack}><View style={[styles.volumeFill, { width: `${volume}%` }]} /></View><Pressable accessibilityRole="button" accessibilityLabel="提高音量" onPress={() => changeVolume(volume + 10)} style={styles.volumeStep}><AppIcon name="plus" size={17} /></Pressable><Text style={styles.volumeValue}>{volume}%</Text></View>;

  useEffect(() => {
    if (!wrongId) return;
    getWrongRecords().then((records) => {
      const record = records.find((item) => item.id === wrongId);
      setReviewQuestion(record ? { ...record.question, id: `review-${record.id}`, points: 1, sectionTitle: record.question.typeName } as ExamQuestion : null);
      setReviewLoaded(true);
    });
  }, [wrongId]);

  useEffect(() => {
    if (wrongId) return;
    getActivePracticeSession()
      .then(setActivePracticeSession)
      .finally(() => setPracticeLoaded(true));
  }, [wrongId]);

  useEffect(() => {
    let cancelled = false;
    getAudioVolume().then((value) => { if (!cancelled) setVolume(value); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!resumeSession || restoredSessionId.current === resumeSession.sessionId) return;
    restoredSessionId.current = resumeSession.sessionId;
    skipPracticeSave.current = true;
    questionSnapshots.current = resumeSession.snapshots;
    completedQuestions.current = new Set(resumeSession.snapshots.flatMap((snapshot, snapshotIndex) => snapshot?.phase === 'feedback' ? [snapshotIndex] : []));
    sessionId.current = resumeSession.sessionId;
    setScore(resumeSession.score);
    restorePracticeSnapshot(resumeSession.index);
  }, [resumeSession]);

  useEffect(() => {
    if (!practiceLoaded || wrongId || !questions.length || phase === 'finished') return;
    if (skipPracticeSave.current) {
      skipPracticeSave.current = false;
      return;
    }
    capturePracticeSnapshot();
    void savePracticeSession({
      version: 1,
      mode,
      ...(generateOptions.tier ? { tier: generateOptions.tier } : {}),
      questions,
      snapshots: questionSnapshots.current,
      index,
      score,
      sessionId: sessionId.current,
    });
  }, [answer, correct, generateOptions.tier, highlights, index, mode, phase, playCount, practiceLoaded, questions, score, wrongId]);

  useEffect(() => {
    if (mode !== 'adaptive') return;
    let cancelled = false;
    getPracticeProfile()
      .then((profile) => { if (!cancelled) setAdaptiveProfile(profile); })
      .catch(() => { if (!cancelled) setAdaptiveProfile({}); });
    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        if (standardTimer.current) clearTimeout(standardTimer.current);
        standardTimer.current = null;
        stopQuestionAudio();
        setPlaying(false);
        setPreparing(false);
        replaying.current = false;
      }
    });
    return () => {
      if (standardTimer.current) clearTimeout(standardTimer.current);
      subscription.remove();
      stopQuestionAudio();
    };
  }, []);

  async function play() {
    if (!question || !scoringQuestion || playing || preparing || (phase !== 'feedback' && playCount >= maxPlays)) return;
    setPreparing(true);
    setMessage('');
    const isReplay = phase === 'feedback';
    if (standardTimer.current) clearTimeout(standardTimer.current);
    standardTimer.current = null;
    if (isReplay) replaying.current = true;
    const started = await playQuestionAudio(question, {
      volume: volume / 100,
      onFinish: () => {
        if (standardTimer.current) clearTimeout(standardTimer.current);
        standardTimer.current = null;
        setPlaying(false);
        replaying.current = false;
        if (isReplay) setHighlights(correctKeyHighlights(scoringQuestion));
      },
      onInterrupted: () => {
        if (standardTimer.current) clearTimeout(standardTimer.current);
        standardTimer.current = null;
        setPlaying(false);
        replaying.current = false;
        setHighlights(isReplay ? keyHighlights(scoringQuestion, answer, correct) : {});
      },
      onError: (error) => {
        if (standardTimer.current) clearTimeout(standardTimer.current);
        standardTimer.current = null;
        setPlaying(false);
        replaying.current = false;
        setHighlights(isReplay ? keyHighlights(scoringQuestion, answer, correct) : {});
        setMessage(error.message);
      },
    });
    setPreparing(false);
    if (!started) return;
    setPlaying(true);
    if (isReplay || question.type !== 'rhythm') {
      setHighlights({ 69: 'std' });
      standardTimer.current = setTimeout(() => {
        standardTimer.current = null;
        setHighlights(isReplay ? correctKeyHighlights(scoringQuestion) : {});
      }, STANDARD_GAP_MS);
    }
    if (phase !== 'feedback') {
      setPhase('answering');
      setPlayCount((value) => value + 1);
    }
  }

  useEffect(() => {
    if (!autoPlay || phase !== 'ready') return;
    const timer = setTimeout(() => { setAutoPlay(false); void play(); }, 500);
    return () => clearTimeout(timer);
    // play intentionally uses the freshly rendered question after index changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, index, phase]);

  function changeBasic(pitches: number[], spellings: string[]) {
    if (phase !== 'answering') return;
    Haptics.selectionAsync();
    setAnswer((current) => ({ ...current, pitches, spellings }));
  }

  function changeVolume(next: number) {
    const normalized = Math.max(0, Math.min(100, next));
    setVolume(normalized);
    saveAudioVolume(normalized).catch(() => null);
  }

  async function submit() {
    if (!question || !scoringQuestion || phase !== 'answering' || !complete || submitting.current) return;
    submitting.current = true;
    const result = scoreQuestion(scoringQuestion, answer).correct;
    setCorrect(result);
    setPhase('feedback');
    setHighlights(keyHighlights(scoringQuestion, answer, result));
    setScore(finalizePracticeSubmission(completedQuestions.current, index, score, result));
    try {
      await savePracticeResult(question, result, { sessionId: sessionId.current, modeName: wrongId ? '错题强化' : MODE_NAMES[mode], submissionKey: `${sessionId.current}:${index}` });
    } catch {
      setMessage('本题已完成批改，但练习记录未能保存到本机。你仍可继续下一题。');
    } finally {
      submitting.current = false;
    }
    void Haptics.notificationAsync(result ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  }

  function capturePracticeSnapshot() {
    questionSnapshots.current[index] = { answer, phase: phase === 'finished' ? 'feedback' : phase, correct, playCount, highlights };
  }

  function restorePracticeSnapshot(targetIndex: number) {
    const snapshot = questionSnapshots.current[targetIndex];
    if (!snapshot) {
      resetQuestionState();
      setIndex(targetIndex);
      return;
    }
    setAnswer(snapshot.answer);
    setPhase(snapshot.phase);
    setCorrect(snapshot.correct);
    setPlayCount(snapshot.playCount);
    setHighlights(snapshot.highlights);
    setMessage('');
    setPlaying(false);
    setPreparing(false);
    setIndex(targetIndex);
  }

  function resetQuestionState() {
    if (standardTimer.current) clearTimeout(standardTimer.current);
    standardTimer.current = null;
    setAnswer(emptyExamAnswer());
    setPhase('ready');
    setPlayCount(0);
    setPlaying(false);
    setPreparing(false);
    setCorrect(false);
    setHighlights({});
    setMessage('');
  }

  function next() {
    if (playing || preparing) return;
    void Haptics.selectionAsync();
    if (standardTimer.current) clearTimeout(standardTimer.current);
    standardTimer.current = null;
    stopQuestionAudio();
    if (index >= questions.length - 1) {
      if (wrongId && correct) void removeWrongRecord(wrongId);
      setPhase('finished');
      if (!wrongId) void clearActivePracticeSession();
      return;
    }
    capturePracticeSnapshot();
    if (questionSnapshots.current[index + 1]) {
      restorePracticeSnapshot(index + 1);
      return;
    }
    resetQuestionState();
    setIndex((value) => value + 1);
    setAutoPlay(true);
  }

  function previous() {
    if (index <= 0 || playing || preparing) return;
    if (standardTimer.current) clearTimeout(standardTimer.current);
    standardTimer.current = null;
    stopQuestionAudio();
    capturePracticeSnapshot();
    restorePracticeSnapshot(index - 1);
  }

  function restart() {
    if (standardTimer.current) clearTimeout(standardTimer.current);
    standardTimer.current = null;
    stopQuestionAudio();
    setIndex(0);
    setScore(0);
    sessionId.current = practiceSessionId();
    questionSnapshots.current = [];
    completedQuestions.current.clear();
    restoredSessionId.current = null;
    setActivePracticeSession(null);
    resetQuestionState();
    setSessionKey((value) => value + 1);
    if (!wrongId) void clearActivePracticeSession();
  }

  if (!question || !scoringQuestion) {
    const loading = !reviewLoaded || !practiceLoaded || (mode === 'adaptive' && !adaptiveProfile);
    return <View style={styles.loading}>{loading ? <><ActivityIndicator color={Brand.forest} /><Text style={styles.muted}>{!reviewLoaded ? '正在读取错题…' : '正在分析历史练习…'}</Text></> : <><AppIcon name="check" size={48} /><Text style={styles.title}>这道错题已不存在</Text><Pressable accessibilityRole="button" onPress={() => router.replace('/wrongbook')} style={styles.secondary}><Text style={styles.secondaryText}>返回错题复盘</Text></Pressable></>}</View>;
  }

  return <View style={styles.page}>
    <ScrollView
      contentContainerStyle={[styles.content, compactPitchMode && styles.compactContent, { paddingBottom: insets.bottom + (compactPitchMode ? 82 : 128) }]}
      alwaysBounceVertical={!compactPitchMode}
      scrollEnabled={!dragging}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.progressHead, compactPitchMode && styles.compactProgressHead]}><Text style={[styles.title, compactPitchMode && styles.compactTitle]}>{mode === 'adaptive' ? question.typeName : MODE_NAMES[mode]}</Text><Text style={styles.counter} accessibilityLabel={`第 ${index + 1} 题，共 ${questions.length} 题`}><Text style={[styles.counterMain, compactPitchMode && styles.compactCounterMain]}>{index + 1}</Text> / {questions.length}</Text></View>
      <View style={[styles.progressTrack, compactPitchMode && styles.compactProgressTrack]}><View style={[styles.progressFill, { width: `${(index + 1) / questions.length * 100}%` }]} /></View>

      {phase === 'finished' ? <View style={styles.resultCard}>
        <AppIcon name={accuracy >= 70 ? 'trophy' : 'check'} size={52} color={accuracy >= 70 ? Brand.gold : Brand.forest} /><Text style={styles.resultTitle}>本组训练完成</Text><Text style={styles.resultScore}>{accuracy}%</Text><Text style={styles.resultDesc}>共 {questions.length} 题，答对 {score} 题</Text>{score < questions.length && <Text style={styles.resultSub}>{questions.length - score} 道错题已收入错题复盘</Text>}
        <Pressable accessibilityRole="button" onPress={restart} style={styles.primary}><Text style={styles.primaryText}>{wrongId ? '再练一次' : '再来一组'}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.replace(wrongId ? '/wrongbook' : '/')} style={styles.secondary}><Text style={styles.secondaryText}>{wrongId ? '返回错题复盘' : '返回首页'}</Text></Pressable>
      </View> : <>
        <View style={[styles.card, compactPitchMode && styles.compactCard]}>
          <Pressable accessibilityRole="button" accessibilityLabel={playing || preparing ? '音频播放中' : phase === 'feedback' ? '回放正确答案' : phase === 'ready' ? '播放题目' : '再听一遍'} accessibilityState={{ disabled: playing || preparing || (phase !== 'feedback' && playCount >= maxPlays), busy: playing || preparing }} onPress={() => void play()} disabled={playing || preparing || (phase !== 'feedback' && playCount >= maxPlays)} style={({ pressed }) => [styles.playButton, compactPitchMode && styles.compactPlayButton, (playing || preparing) && styles.playing, pressed && styles.pressed]}>
            <View style={styles.playIcon}><AppIcon name={playing || preparing ? 'pause' : 'play'} size={20} color={Brand.textOnAccent} /></View><View style={styles.playCopy}><Text style={styles.playTitle}>{playing ? '播放中…' : phase === 'feedback' ? '回放答案' : phase === 'ready' ? '播放题目' : '再听一遍'}</Text>{!compactPitchMode && <Text style={styles.playSub}>{phase === 'feedback' ? '结合谱面与键盘复盘' : '先听题，再在五线谱上作答'}</Text>}</View><Text style={styles.replay}>{phase === 'feedback' ? '不限次数' : `剩余 ${Math.max(0, maxPlays - playCount)} 次`}</Text>
          </Pressable>
          {volumeRow}
          {!!message && <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>}
          <View style={[styles.answerBlock, compactPitchMode && styles.compactAnswerBlock]}>
            <Text style={styles.answerTitle}>{answerTitleFor(scoringQuestion)}</Text>
            {!compactPitchMode && !qualityOnly && <Text style={styles.answerMethod}>按住音符可上下拖动，单击音符可选择临时记号，双击可擦除音符。</Text>}
            {timed ? <NotationEditor question={scoringQuestion} answer={answer} unlocked={phase === 'answering'} disabled={phase === 'feedback'} reviewCorrect={correct} showCorrect={phase === 'feedback'} onChange={setAnswer} /> : isConnection ? <View style={styles.connectionList}>
              {(scoringQuestion.chords as number[][]).map((chord, groupIndex) => {
                const group = connectionGroupSlice(scoringQuestion, answer, groupIndex);
                return (
                  <View key={groupIndex} style={styles.connectionGroup}>
                    <Text style={styles.connectionLabel}>第 {groupIndex + 1} 组 · 叠写两个音</Text>
                    <AnswerStaff compact pitches={group.pitches} spellings={group.spellings} stacked maxStack={2} disabled={phase !== 'answering'} tone={phase === 'feedback' ? correct ? 'green' : 'red' : ''} showCorrect={phase === 'feedback' && !correct} correctPitches={chord} correctSpellings={[]} emptyText={phase === 'ready' ? '播放题目后开始作答' : phase === 'answering' ? '点击五线谱写入两个音' : ''} onChange={(pitches, spellings) => setAnswer((current) => applyConnectionGroup(scoringQuestion, current, groupIndex, pitches, spellings))} onDragChange={setDragging} />
                  </View>
                );
              })}
            </View> : qualityOnly ? <View style={styles.qualityBlock}>
              <Text style={styles.qualityLabel}>和弦性质</Text>
              <View style={styles.qualityGrid}>{CHORD_QUALITY_NAMES.map((quality) => (
                <Pressable key={quality} accessibilityRole="radio" accessibilityState={{ selected: selectedChordQuality === quality, disabled: phase !== 'answering' }} disabled={phase !== 'answering'} onPress={() => { if (phase !== 'answering') return; Haptics.selectionAsync(); setAnswer({ ...answer, quality, inversion: selectedChordInversion }); }} style={({ pressed }) => [styles.qualityOption, selectedChordQuality === quality && styles.qualityActive, pressed && styles.pressed]}><Text style={[styles.qualityText, selectedChordQuality === quality && styles.qualityTextActive]}>{quality}</Text></Pressable>
              ))}</View>
              <Text style={styles.qualityLabel}>转位</Text>
              <View style={styles.qualityGrid}>{CHORD_INVERSIONS.map((inversion) => (
                <Pressable key={inversion} accessibilityRole="radio" accessibilityState={{ selected: selectedChordInversion === inversion, disabled: phase !== 'answering' }} disabled={phase !== 'answering'} onPress={() => { if (phase !== 'answering') return; Haptics.selectionAsync(); setAnswer({ ...answer, quality: selectedChordQuality, inversion }); }} style={({ pressed }) => [styles.qualityOption, selectedChordInversion === inversion && styles.qualityActive, pressed && styles.pressed]}><Text style={[styles.qualityText, selectedChordInversion === inversion && styles.qualityTextActive]}>{inversion}</Text></Pressable>
              ))}</View>
            </View> : <AnswerStaff compact={compactPitchMode} pitches={answer.pitches} spellings={answer.spellings} slots={answerSlots(scoringQuestion)} stacked={question.type === 'chord' || Boolean(question.harmonic)} maxStack={maxStack(scoringQuestion)} disabled={phase !== 'answering'} tone={phase === 'feedback' ? correct ? 'green' : 'red' : ''} showCorrect={phase === 'feedback' && !correct} correctPitches={question.midis || []} correctSpellings={Array.isArray(question.spellings) ? question.spellings as string[] : []} emptyText={phase === 'ready' ? '播放题目后开始作答' : phase === 'answering' ? '点击五线谱写入答案' : ''} onChange={changeBasic} onDragChange={setDragging} />}
            {phase === 'feedback' && (timed ? <View style={styles.reviewLine}><Text style={styles.reviewText}><Text style={styles.reviewLabel}>正确答案：</Text>见绿色谱面</Text><View style={styles.reviewAnswerRow}><Text style={styles.reviewText}><Text style={styles.reviewLabel}>你的答案：</Text>见谱面</Text><TeacherGradeMark correct={correct} size={36} /></View></View> : <View style={[styles.reviewLine, compactPitchMode && styles.compactReviewLine]}><Text style={styles.reviewText}><Text style={styles.reviewLabel}>正确答案：</Text>{formatCorrectAnswer(scoringQuestion)}</Text><View style={styles.reviewAnswerRow}><Text style={styles.reviewText}><Text style={styles.reviewLabel}>你的答案：</Text>{formatExamAnswer(scoringQuestion, answer)}</Text><TeacherGradeMark correct={correct} size={compactPitchMode ? 30 : 36} /></View></View>)}
          </View>
        </View>

        <View style={[styles.keyboardCard, phase === 'feedback' && styles.keyboardOpen]}>
          <View style={styles.keyboardHead}><View><Text style={styles.keyboardTitle}>复盘钢琴</Text>{!compactPitchMode && <Text style={styles.keyboardSub}>{phase === 'feedback' ? '键盘已解锁，可自由弹奏核对音高' : '提交谱面答案后自动解锁'}</Text>}</View><Text style={[styles.keyboardState, phase === 'feedback' && styles.keyboardStateOpen]}>{phase === 'feedback' ? '已解锁' : '待解锁'}</Text></View>
          <View><View aria-hidden={phase !== 'feedback'} accessibilityElementsHidden={phase !== 'feedback'} importantForAccessibility={phase !== 'feedback' ? 'no-hide-descendants' : 'auto'}><PianoKeyboard disabled={phase !== 'feedback' || playing} highlights={highlights} volume={volume} onKeyPress={phase === 'feedback' ? (midi) => { if (!replaying.current) void playPianoNote(midi, volume / 100); } : undefined} /></View>{phase !== 'feedback' && <View accessibilityRole="text" accessibilityLabel="复盘钢琴待解锁，提交答案后解锁" style={styles.keyboardLock}><View style={styles.lockIcon}><AppIcon name="lock" size={21} color={Brand.textOnAccent} /></View><Text style={styles.lockText}>提交答案后解锁</Text></View>}</View>
        </View>
      </>}
    </ScrollView>

    {phase !== 'finished' && (phase === 'feedback' ? <View style={[styles.bottomActions, { paddingBottom: Math.max(10, insets.bottom) }]}>
      {index > 0 && <Pressable accessibilityRole="button" accessibilityLabel="上一题" accessibilityState={{ disabled: playing || preparing }} disabled={playing || preparing} onPress={previous} style={styles.secondarySmall}><Text style={styles.secondaryText}>上一题</Text></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="回放答案" accessibilityState={{ disabled: playing || preparing }} disabled={playing || preparing} onPress={() => void play()} style={styles.secondarySmall}><Text style={styles.secondaryText}>回放答案</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={index + 1 >= questions.length ? '查看结果' : '下一题'} accessibilityState={{ disabled: playing || preparing }} disabled={playing || preparing} onPress={next} style={styles.primarySmall}><Text style={styles.primaryText}>{index + 1 >= questions.length ? '查看结果' : '下一题'}</Text></Pressable>
    </View> : <View style={[styles.bottomBar, { paddingBottom: Math.max(10, insets.bottom) }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !complete || phase !== 'answering' }} disabled={!complete || phase !== 'answering'} onPress={() => void submit()} style={[styles.submit, (!complete || phase !== 'answering') && styles.submitDisabled]}><Text style={styles.primaryText}>{phase === 'ready' ? '先播放题目' : complete ? '提交答案并解锁键盘' : '完成谱面后提交'}</Text></Pressable><Text style={styles.submitTip}>{phase === 'ready' ? '播放后即可在谱面上作答' : '提交后显示正确谱面，并解锁复盘钢琴'}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.cream }, content: { padding: 16, gap: 14 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Brand.cream }, muted: { color: Brand.muted, fontSize: TypeScale.footnote }, progressHead: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, title: { color: Brand.ink, fontSize: TypeScale.title2, fontWeight: '900', letterSpacing: -0.3 }, counter: { color: Brand.muted, fontSize: TypeScale.subheadline }, counterMain: { color: Brand.forest, fontSize: TypeScale.title1, fontWeight: '900' }, progressTrack: { height: 6, overflow: 'hidden', borderRadius: 6, backgroundColor: Brand.border }, progressFill: { height: '100%', borderRadius: 6, backgroundColor: Brand.forest },
  compactContent: { paddingHorizontal: 14, paddingTop: 8, gap: 8 }, compactProgressHead: { minHeight: 34 }, compactTitle: { fontSize: TypeScale.title3 }, compactCounterMain: { fontSize: TypeScale.title2 }, compactProgressTrack: { height: 5 },
  card: { padding: 13, borderRadius: Radius.card, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border }, playButton: { minHeight: 76, padding: 13, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.card, backgroundColor: Brand.forest }, playing: { backgroundColor: Brand.success }, playIcon: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: 'rgba(255,255,255,.16)' }, playCopy: { flex: 1, marginLeft: 11 }, playTitle: { color: Brand.textOnAccent, fontSize: TypeScale.subheadline, fontWeight: '900' }, playSub: { marginTop: 3, color: Brand.textOnAccentMuted, fontSize: TypeScale.caption }, replay: { color: Brand.textOnAccent, fontSize: TypeScale.caption, fontWeight: '800' }, pressed: { opacity: 0.78 }, volumeRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 7 }, volumeLabel: { color: Brand.muted, fontSize: TypeScale.caption }, volumeStep: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forestSoft }, volumeTrack: { flex: 1, height: 5, overflow: 'hidden', borderRadius: 5, backgroundColor: Brand.divider }, volumeFill: { height: '100%', backgroundColor: Brand.forest }, volumeValue: { width: 42, color: Brand.muted, fontSize: TypeScale.caption, textAlign: 'right', fontVariant: ['tabular-nums'] }, error: { marginTop: 7, color: Brand.danger, fontSize: TypeScale.footnote, lineHeight: 18 },
  compactCard: { padding: 8 }, compactPlayButton: { minHeight: 58, paddingVertical: 7, paddingHorizontal: 10 }, compactVolumeRow: { marginTop: 4 },
  answerBlock: { gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Brand.divider }, answerTitle: { color: Brand.ink, fontSize: TypeScale.headline, fontWeight: '900' }, answerMethod: { color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 19 }, reviewLine: { minHeight: 56, justifyContent: 'center', gap: 3 }, reviewAnswerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, reviewText: { color: Brand.muted, fontSize: TypeScale.footnote, lineHeight: 19, flexShrink: 1 }, reviewLabel: { color: Brand.ink, fontWeight: '900' },
  compactAnswerBlock: { gap: 6, marginTop: 8, paddingTop: 8 }, compactReviewLine: { minHeight: 42 },
  connectionList: { gap: 8 }, connectionGroup: { gap: 5 }, connectionLabel: { color: Brand.muted, fontSize: TypeScale.caption, fontWeight: '700' },
  qualityBlock: { gap: 8 }, qualityLabel: { color: Brand.muted, fontSize: TypeScale.footnote, fontWeight: '700' }, qualityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, qualityOption: { minHeight: TouchTarget, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.ivory }, qualityActive: { borderColor: Brand.forest, backgroundColor: Brand.forest }, qualityText: { color: Brand.ink, fontSize: TypeScale.caption, fontWeight: '700' }, qualityTextActive: { color: Brand.textOnAccent },
  keyboardCard: { padding: 13, borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.successSoft }, keyboardOpen: { borderColor: '#2e8b6f' }, keyboardHead: { marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, keyboardTitle: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '900' }, keyboardSub: { marginTop: 3, color: Brand.muted, fontSize: TypeScale.caption }, keyboardState: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, color: Brand.warning, backgroundColor: Brand.warningSoft, fontSize: 11, fontWeight: '700' }, keyboardStateOpen: { color: Brand.forest, backgroundColor: Brand.forestSoft }, keyboardLock: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.overlay }, lockIcon: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: 'rgba(255,255,255,.14)' }, lockText: { marginTop: 8, color: Brand.textOnAccent, fontSize: TypeScale.caption, fontWeight: '700' },
  bottomBar: { position: 'absolute', left: 10, right: 10, bottom: 0, padding: 10, alignItems: 'center' }, submit: { width: '100%', minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forest }, submitDisabled: { backgroundColor: Brand.disabled }, submitTip: { marginTop: 7, color: Brand.muted, fontSize: TypeScale.caption, lineHeight: 16 }, bottomActions: { position: 'absolute', left: 10, right: 10, bottom: 0, padding: 10, flexDirection: 'row', gap: 8 }, primarySmall: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forest, ...Shadows.raised }, secondarySmall: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1, borderColor: Brand.forest, backgroundColor: Brand.ivory }, primaryText: { color: Brand.textOnAccent, fontSize: TypeScale.subheadline, fontWeight: '900' }, secondaryText: { color: Brand.forest, fontSize: TypeScale.subheadline, fontWeight: '900' },
  resultCard: { marginTop: 24, padding: 28, alignItems: 'center', borderRadius: Radius.hero, backgroundColor: Brand.ivory, borderWidth: 1, borderColor: Brand.border }, resultTitle: { marginTop: 14, color: Brand.ink, fontSize: TypeScale.title3, fontWeight: '900' }, resultScore: { marginTop: 6, color: Brand.forest, fontSize: 58, fontWeight: '900', fontVariant: ['tabular-nums'] }, resultDesc: { color: Brand.ink, fontSize: TypeScale.subheadline, fontWeight: '800' }, resultSub: { marginTop: 8, color: Brand.muted, fontSize: TypeScale.footnote }, primary: { width: '100%', minHeight: 50, marginTop: 24, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, backgroundColor: Brand.forest }, secondary: { width: '100%', minHeight: 50, marginTop: 10, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control, borderWidth: 1, borderColor: Brand.forest, backgroundColor: Brand.ivory },
});
