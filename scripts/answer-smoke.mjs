import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const {
  answerIsComplete,
  emptyExamAnswer,
  formatCorrectAnswer,
  formatExamAnswer,
  scoreQuestion,
} = await import('../src/core/exam-answer.ts');
const {
  naturalMidiFromStaffTapY,
  staffSvgYFromWrittenMidi,
} = await import('../src/core/staff-coordinate.ts');
const {
  augmentationDotY,
  chordHeadOffsets,
  durationNotation,
  ledgerLineYs,
  stemDirectionForWrittenMidis,
} = await import('../src/core/music-notation.ts');
const {
  accidentalGlyphForPitch,
  accidentalGlyphForKeySignature,
  defaultPitchSpelling,
  formatPitchSpelling,
  naturalMidiForPitchSpelling,
} = await import('../src/core/pitch-spelling.ts');
const { practiceAnswerCorrect } = await import('../src/core/answer-sync.ts');
const { DEFAULT_AUDIO_VOLUME, parseStoredVolume } = await import('../src/core/audio-settings.ts');
const { pianoPlaybackConfig } = await import('../src/core/piano-playback.ts');
const require = createRequire(import.meta.url);
const questionCore = require('../src/core/legacy/question.js');
const pcmRenderer = require('../src/core/legacy/pcm-renderer.js');
const { midiToName } = require('../src/core/legacy/theory.js');

const homeSource = readFileSync(new URL('../src/app/index.tsx', import.meta.url), 'utf8');
const handIconSource = readFileSync(new URL('../src/components/hand-icon.tsx', import.meta.url), 'utf8');
assert.match(homeSource, /<View\b[^>]*style=\{styles\.heroDivider\}[^>]*\/?>(?:[\s\S]*?)?/, '首页数据区必须渲染渐隐分割线样式');
assert.match(homeSource, /heroDivider\s*:\s*\{/, '首页必须定义渐隐分割线样式');
assert.match(homeSource, /<View\b[^>]*style=\{styles\.heroWave\}[^>]*\/?>(?:[\s\S]*?)?/, '首页英雄卡必须渲染受限波形样式');
assert.match(homeSource, /heroWave\s*:\s*\{/, '首页必须定义受限波形样式');
assert.match(homeSource, /<Pressable\b[^>]*style=\{[^\r\n]*styles\.memberStatusButton[^\r\n]*\}/, '会员按钮必须应用独立样式');
assert.match(homeSource, /memberStatusButton\s*:\s*\{/, '会员按钮必须定义受约束的独立样式');
assert.doesNotMatch(handIconSource, /melody-clef-reference\.png/, '首页旋律图标必须使用独立 SVG，不能复用谱面素材');
assert.match(handIconSource, /if\s*\(name === ['"]treble['"]\)[\s\S]*?<Svg\b/, '首页旋律图标必须在 treble 分支渲染 SVG');

const base = {
  id: 'smoke',
  typeName: '测试题',
  sectionTitle: '测试',
  points: 4,
  answerText: '测试答案',
};

const pitchQuestion = { ...base, type: 'single', answer: [60], midis: [60], answerMode: 'staff' };
assert.equal(scoreQuestion(pitchQuestion, { ...emptyExamAnswer(), pitches: [60] }).score, 4);
assert.equal(scoreQuestion(pitchQuestion, { ...emptyExamAnswer(), pitches: [62] }).score, 0);
assert.equal(answerIsComplete(pitchQuestion, { ...emptyExamAnswer(), pitches: [Number.NaN] }), false, '空音符槽位不应被视为完成');
assert.deepEqual(emptyExamAnswer().accidentals, []);
assert.equal(formatExamAnswer(pitchQuestion, { ...emptyExamAnswer(), pitches: [61], accidentals: ['sharp'] }), 'C♯4');

const chordQuestion = {
  ...base,
  type: 'chord',
  midis: [60, 64, 67],
  harmonic: true,
  qualityRequired: true,
  chordName: '大三',
  inversionName: '原位',
};
const chordAnswer = { ...emptyExamAnswer(), pitches: [67, 60, 64], quality: '大三和弦 · 原位' };
assert.equal(scoreQuestion(chordQuestion, chordAnswer).score, 4);
assert.equal(answerIsComplete(chordQuestion, chordAnswer), true);
assert.equal(scoreQuestion(chordQuestion, { ...chordAnswer, pitches: [60, 64, 69] }).score, 0, '基础题出现部分音正确时不应给部分分');

const qualityOnlyQuestion = { ...chordQuestion, answerMode: 'qualityFill', answerText: 'C4 E4 G4' };
assert.equal(answerIsComplete(qualityOnlyQuestion, { ...emptyExamAnswer(), quality: '大三和弦' }), false, '和弦性质题未选转位时不应允许提交');
assert.equal(answerIsComplete(qualityOnlyQuestion, { ...emptyExamAnswer(), quality: '大三和弦', inversion: '原位' }), true);
assert.equal(scoreQuestion(qualityOnlyQuestion, { ...emptyExamAnswer(), quality: '大三和弦', inversion: '原位' }).correct, true);
assert.equal(formatExamAnswer(qualityOnlyQuestion, { ...emptyExamAnswer(), quality: '大三和弦', inversion: '原位' }), '大三和弦 · 原位');
assert.equal(scoreQuestion(qualityOnlyQuestion, { ...emptyExamAnswer(), quality: '大三和弦 · 原位' }).correct, true, '旧版本保存的组合答案应继续可批改');
assert.equal(formatCorrectAnswer(qualityOnlyQuestion), '大三和弦 · 原位', '只填性质题不应把音高显示成正确答案');

const staffAndQualityQuestion = { ...chordQuestion, answerMode: 'staff+quality', answerText: 'C4 E4 G4' };
assert.equal(formatCorrectAnswer(staffAndQualityQuestion), 'C4 E4 G4 · 大三和弦 · 原位');

const rhythmQuestion = { ...base, type: 'rhythm', meter: '2/4', beats: [1, -0.5, 0.5], answerMode: 'rhythm' };
const rhythmAnswer = {
  ...emptyExamAnswer(),
  meter: '2/4',
  events: [
    { midi: 69, duration: 1 },
    { midi: 69, duration: 0.5, rest: true },
    { midi: 69, duration: 0.5 },
  ],
};
assert.equal(scoreQuestion(rhythmQuestion, rhythmAnswer).score, 4);
assert.equal(answerIsComplete(rhythmQuestion, rhythmAnswer), true);

const melodyQuestion = {
  ...base,
  type: 'melody',
  meter: '2/4',
  keySignature: 'G',
  midis: [67, 69, 71, 72],
  durs: [1, 1, 1, 1],
  answerMode: 'melody',
};
const melodyAnswer = {
  ...emptyExamAnswer(),
  meter: '2/4',
  keySignature: 'G',
  events: melodyQuestion.midis.map((midi) => ({ midi, duration: 1 })),
};
assert.equal(scoreQuestion(melodyQuestion, melodyAnswer).score, 4);
assert.equal(answerIsComplete(melodyQuestion, melodyAnswer), true);
assert.equal(formatExamAnswer(melodyQuestion, melodyAnswer), '2/4 · G · 见谱面');

const twoBarQuestion = { ...base, type: 'rhythm', meter: '2/4', beatsPerBar: 2, barCount: 2, beats: [1, 1, 0.5, 0.5, 1] };
const oneBarCorrect = {
  ...emptyExamAnswer(), meter: '2/4', events: [
    { midi: 69, duration: 1, barIndex: 0 }, { midi: 69, duration: 1, barIndex: 0 },
    { midi: 69, duration: 1, barIndex: 1 }, { midi: 69, duration: 1, barIndex: 1 },
  ],
};
assert.equal(scoreQuestion(twoBarQuestion, oneBarCorrect).score, 2.2, '模拟考时值题没有按小节 90% + 拍号 10% 计分');
assert.equal(practiceAnswerCorrect(twoBarQuestion, oneBarCorrect), false, '专项练习不应接受只有部分小节正确的答案');
const misplacedBars = { ...emptyExamAnswer(), meter: '2/4', events: [
  { midi: 69, duration: 0.5, barIndex: 0 }, { midi: 69, duration: 0.5, barIndex: 0 }, { midi: 69, duration: 1, barIndex: 0 },
  { midi: 69, duration: 1, barIndex: 1 }, { midi: 69, duration: 1, barIndex: 1 },
] };
assert.equal(practiceAnswerCorrect(twoBarQuestion, misplacedBars), false, '节奏写入错误小节仍被判为正确');

const choiceQuestion = {
  ...base,
  type: 'rhythm',
  choice: { correctIndex: 2, options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }] },
};
assert.equal(scoreQuestion(choiceQuestion, { ...emptyExamAnswer(), choiceIndex: 2 }).score, 4);
assert.equal(scoreQuestion(choiceQuestion, { ...emptyExamAnswer(), choiceIndex: 1 }).score, 0);
assert.equal(formatExamAnswer(choiceQuestion, { ...emptyExamAnswer(), choiceIndex: 1 }), '选项 B');

const naturalMidis = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];
naturalMidis.forEach((midi) => {
  const renderedTapY = staffSvgYFromWrittenMidi(midi) * 122 / 96;
  assert.equal(naturalMidiFromStaffTapY(renderedTapY, 122, 60, 81), midi, `谱面点击没有回到 MIDI ${midi}`);
});

assert.equal(staffSvgYFromWrittenMidi(64), 68, 'E4 必须落在高音谱表第一线');
assert.equal(staffSvgYFromWrittenMidi(67), 58, 'G4 必须落在高音谱表第二线');
assert.equal(staffSvgYFromWrittenMidi(77), 28, 'F5 必须落在高音谱表第五线');
assert.equal(defaultPitchSpelling(80), 'G#5', 'MIDI 80 不应回退成 C5');
assert.equal(naturalMidiForPitchSpelling(80), 79, 'G#5 必须写在 G5 的谱位');
assert.equal(staffSvgYFromWrittenMidi(naturalMidiForPitchSpelling(80)), 23, 'G#5 谱位必须位于第五线上方的间');
assert.equal(accidentalGlyphForPitch(80), '♯', 'G#5 谱面必须显示升号');
assert.equal(accidentalGlyphForKeySignature(66, 'F#4', 'G'), '', 'G 大调中 F♯ 不应重复标临时升号');
assert.equal(accidentalGlyphForKeySignature(65, 'Fn4', 'G'), '♮', 'G 大调中 F♮ 必须显示还原号');
assert.equal(accidentalGlyphForKeySignature(70, 'Bb4', 'F'), '', 'F 大调中 B♭ 不应重复标临时降号');
assert.equal(formatPitchSpelling(80), 'G♯5', '谱面与答案文本必须使用同一音名');
assert.deepEqual(ledgerLineYs(60), [78], '中央 C 必须显示第一条下加线');
assert.deepEqual(ledgerLineYs(81), [18], 'A5 必须显示第一条上加线');
assert.deepEqual(ledgerLineYs(79), [], 'G5 位于第五线上方的间，不应误加线');
assert.equal(durationNotation(4).headKind, 'whole', '四拍时值必须使用全音符头');
assert.equal(durationNotation(4).hasStem, false, '全音符不能显示符干');
assert.equal(durationNotation(2).headKind, 'half', '二拍时值必须使用二分音符头');
assert.equal(durationNotation(2).hasStem, true, '二分音符必须显示符干');
assert.equal(stemDirectionForWrittenMidis([71]), 'down', '第三线 B4 的符干必须向下');
assert.equal(stemDirectionForWrittenMidis([69]), 'up', '第三线下方 A4 的符干必须向上');
assert.deepEqual(chordHeadOffsets([60, 62, 64]), [0, 8, 0], '连续二度和弦的符头必须交替错位');
assert.equal(augmentationDotY(64), 63, '在线上的 E4 附点必须移入上方间');
assert.equal(augmentationDotY(65), 63, '在间上的 F4 附点必须保持同一高度');

const fixedSharpQuestion = { type: 'single', midis: [80] };
const fixedSharpNotes = pcmRenderer.buildQuestionTimeline(fixedSharpQuestion).events
  .filter((event) => event.type === 'note' && event.start > 1);
assert.deepEqual(fixedSharpNotes.map((event) => event.midi), [80], 'G#5 音频没有使用与题目一致的 MIDI 80');
assert.equal(midiToName(80), '#G5', 'G#5 的答案文本与 MIDI 80 不一致');

assert.equal(DEFAULT_AUDIO_VOLUME, 78);
assert.equal(parseStoredVolume(''), 78, '首次安装不应被空缓存静音');
assert.equal(parseStoredVolume('0'), 0, '用户保存的静音设置必须保留');
assert.equal(parseStoredVolume(150), 100);
assert.equal(parseStoredVolume(-10), 0);

const lowPianoConfigs = [55, 56, 57, 58, 59].map(pianoPlaybackConfig);
assert.equal(lowPianoConfigs.every(Boolean), true, '复盘钢琴 G3-B3 存在无法播放的琴键');
assert.equal(new Set(lowPianoConfigs.map((item) => `${item.sampleMidi}:${item.playbackRate.toFixed(6)}`)).size, 5, '复盘钢琴 G3-B3 没有形成五个不同音高');
assert.deepEqual(pianoPlaybackConfig(60), { sampleMidi: 60, playbackRate: 1 });
assert.equal(pianoPlaybackConfig(54), null);
const audioEngineSource = readFileSync(new URL('../src/services/audio-engine.ts', import.meta.url), 'utf8');
assert.match(audioEngineSource, /pianoPlayer\.setPlaybackRate\(config\.playbackRate\)/, '复盘钢琴必须通过 iOS 原生播放器方法设置音高');
assert.doesNotMatch(audioEngineSource, /pianoPlayer\.playbackRate\s*=/, '直接写 playbackRate 会让 iOS 复盘钢琴静音');

const originalRandom = Math.random;
let seed = 246813579;
Math.random = () => {
  seed = seed * 1664525 + 1013904223 >>> 0;
  return seed / 0x100000000;
};
const adaptiveQuestions = questionCore.generateSet('adaptive', 15, {
  single: { attempts: 20, wrong: 20, errorRate: 100 },
  interval: { attempts: 20, wrong: 0, errorRate: 0 },
  chord: { attempts: 20, wrong: 0, errorRate: 0 },
  rhythm: { attempts: 20, wrong: 0, errorRate: 0 },
  melody: { attempts: 20, wrong: 0, errorRate: 0 },
});
Math.random = originalRandom;
assert.equal(adaptiveQuestions.length, 15);
assert.equal(adaptiveQuestions.filter((question) => question.type === 'single').length >= 4, true, '智能强化没有向高错率题型倾斜');

for (const type of ['single', 'interval', 'chord', 'rhythm', 'melody']) {
  for (let index = 0; index < 40; index += 1) {
    const question = questionCore.generate(type);
    let generatedAnswer = emptyExamAnswer();
    if (['single', 'interval', 'chord'].includes(type)) {
      generatedAnswer = { ...generatedAnswer, pitches: question.midis.slice() };
    } else if (type === 'rhythm') {
      generatedAnswer = {
        ...generatedAnswer,
        meter: question.meter,
        events: question.beats.map((duration) => ({ midi: 69, duration: Math.abs(duration), rest: duration < 0 })),
      };
    } else {
      generatedAnswer = {
        ...generatedAnswer,
        meter: question.meter,
        keySignature: question.keySignature,
        events: question.durs.map((duration, eventIndex) => ({
          midi: question.midis[eventIndex],
          duration: Math.abs(duration),
          rest: duration < 0,
        })),
      };
    }
    assert.equal(scoreQuestion(question, generatedAnswer).correct, true, `${type} 的真实生成题未能判定正确`);
  }
}

const connectionQuestion = {
  ...base,
  type: 'intervalConnection',
  chords: [[60, 64], [62, 69]],
  answer: [[60, 64], [62, 69]],
};
assert.equal(scoreQuestion(connectionQuestion, { ...emptyExamAnswer(), pitches: [64, 60, 69, 62] }).correct, true);

console.log('答题评分测试通过：真实随机题、谱面坐标、音高、音程连接、和弦、节奏、旋律与四选一均正常。');
