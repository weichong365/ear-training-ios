/**
 * 河南、浙江统考选择卷生成器。
 *
 * 这里只组合公开出题器已经能够播放的 question，不把省份差异反向写进
 * utils/question.js，避免选择卷与五线谱听写卷互相污染。
 */
const { generate, generateSet } = require('./question.js');

const LETTERS = ['A', 'B', 'C', 'D'];
const INTERVAL_NAMES = [
  '小二度', '大二度', '小三度', '大三度', '纯四度', '增四度',
  '纯五度', '小六度', '大六度', '小七度', '大七度', '纯八度'
];
const CHORD_NAMES = [
  '大三和弦', '小三和弦', '增三和弦', '减三和弦',
  '大六和弦', '小六和弦', '增六和弦', '减六和弦',
  '大四六和弦', '小四六和弦', '增四六和弦', '减四六和弦'
];
const METERS = ['2/4', '3/4', '4/4', '3/8', '6/8'];
const WESTERN_MODES = ['C大调', 'G大调', 'F大调', 'a小调', 'e小调', 'd小调'];
const NATIONAL_MODES = ['宫调式', '商调式', '角调式', '徵调式', '羽调式'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function shuffle(items) {
  const out = items.slice();
  for (let index = out.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    const current = out[index];
    out[index] = out[target];
    out[target] = current;
  }
  return out;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '');
}

function eventSignature(events) {
  return JSON.stringify((events || []).map((event) => ({
    midis: (event.midis || []).slice(),
    dur: Number(event.dur || 0),
    rest: !!event.rest,
    barIndex: Number.isInteger(event.barIndex) ? event.barIndex : 0
  })));
}

function meterCapacity(question) {
  const direct = Number(question && question.beatsPerBar);
  if (direct > 0) return direct;
  const match = String(question && question.meter || '').match(/^(\d+)\/(\d+)$/);
  if (!match) return 0;
  return Number(match[1]) * 4 / Number(match[2]);
}

/**
 * staff-notation 依赖 barIndex 决定小节线与符尾分组。公开出题器的
 * durs / beats 是扁平数组，因此在做选择题选项时必须把 bars 信息补回，
 * 否则谱例会被当作一个超长小节，拍号后的首音与后续小节线也失去安全区。
 */
function attachBarIndices(events, question) {
  const output = events.map((event) => ({ ...event }));
  const sourceBars = Array.isArray(question && question.bars) ? question.bars : [];
  let cursor = 0;

  if (sourceBars.length) {
    sourceBars.forEach((bar, barIndex) => {
      const length = Array.isArray(bar) ? bar.length : 0;
      for (let local = 0; local < length && cursor < output.length; local += 1, cursor += 1) {
        output[cursor].barIndex = barIndex;
        output[cursor].bar = barIndex > 0 && local === 0;
      }
    });
  }

  // 变体节奏会改变事件数量并清空 bars；按拍号容量重新归属小节。
  const capacity = meterCapacity(question);
  let barIndex = cursor > 0 ? output[cursor - 1].barIndex || 0 : 0;
  let elapsed = 0;
  if (cursor > 0 && sourceBars[barIndex]) {
    elapsed = sourceBars[barIndex].reduce((sum, duration) => sum + Math.abs(Number(duration) || 0), 0);
  }
  for (; cursor < output.length; cursor += 1) {
    if (capacity > 0 && elapsed >= capacity - 1e-6) {
      barIndex += 1;
      elapsed = 0;
    }
    output[cursor].barIndex = barIndex;
    output[cursor].bar = barIndex > 0 && elapsed === 0;
    elapsed += Math.abs(Number(output[cursor].dur) || 0);
  }

  return output;
}

function eventsFromQuestion(question) {
  if (Array.isArray(question.durs) && question.durs.length) {
    return attachBarIndices(question.durs.map((dur, index) => ({
      midis: [question.midis[index]],
      spellings: question.spellings && question.spellings[index]
        ? [question.spellings[index]]
        : [],
      dur,
      rest: dur < 0
    })), question);
  }
  if (Array.isArray(question.beats) && question.beats.length) {
    return attachBarIndices(question.beats.map((dur) => ({
      midis: [69],
      spellings: [],
      dur,
      rest: dur < 0
    })), question);
  }
  const midis = (question.midis || []).slice();
  const spellings = (question.spellings || []).slice();
  if (question.type === 'chord' || question.harmonic) {
    return [{ midis, spellings, dur: 4, rest: false }];
  }
  return midis.map((midi, index) => ({
    midis: [midi],
    spellings: spellings[index] ? [spellings[index]] : [],
    dur: 4,
    rest: false
  }));
}

function staffOption(question, text) {
  const events = eventsFromQuestion(question);
  const inferredBarCount = events.reduce((count, event) => (
    Math.max(count, Number.isInteger(event.barIndex) ? event.barIndex + 1 : 1)
  ), 0);
  const declaredBarCount = Math.max(0, Number(question.barCount) || 0);
  const barCount = Math.max(declaredBarCount, inferredBarCount > 1 ? inferredBarCount : 0);
  // 公共谱面在每个小节左右分别保留 37/38rpx，避免临时记号、符尾和
  // 小节线相撞。选择卷若仍把密集的十六分音符硬塞进 540rpx，剩余空间
  // 会让多个事件中心只差几像素，看起来就像全部堆在一起。
  //
  // 固定小节布局的可用宽度为 staffWidth - 120rpx；按最密小节反推整张
  // 谱面的宽度，保证相邻事件中心至少相隔 22rpx。超过卡片宽度的部分由
  // exam.wxml 的横向 scroll-view 展示，不再压缩字形。
  const MIN_EVENT_GAP = 22;
  const BAR_SAFETY_WIDTH = 75;
  const FIXED_OUTER_WIDTH = 120;
  let staffWidth = 540;
  if (barCount > 1) {
    const members = Array.from({ length: barCount }, () => 0);
    events.forEach((event) => {
      const index = Math.max(0, Math.min(barCount - 1, Number(event.barIndex) || 0));
      members[index] += 1;
    });
    const densestBar = Math.max(1, ...members);
    const requiredBarWidth = BAR_SAFETY_WIDTH + (densestBar - 1) * MIN_EVENT_GAP;
    staffWidth = Math.max(540, Math.ceil(FIXED_OUTER_WIDTH + barCount * requiredBarWidth));
  }
  return {
    label: '',
    text: text || '',
    events,
    meter: question.meter || '',
    keySignature: question.keySignature || '',
    barCount,
    staffWidth,
    pitchEditable: false
  };
}

function textOption(text) {
  return {
    label: '',
    text,
    events: [],
    meter: '',
    keySignature: '',
    barCount: 0,
    staffWidth: 540,
    pitchEditable: false
  };
}

function finalizeOptions(candidates, correctKey, keyFactory) {
  const unique = [];
  const seen = new Set();
  candidates.forEach((candidate) => {
    const key = keyFactory(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ candidate, key });
  });
  if (unique.length !== 4) {
    throw new Error(`选择题选项必须为 4 个互不重复项，当前为 ${unique.length} 个`);
  }
  const shuffled = shuffle(unique);
  const correctIndex = shuffled.findIndex((item) => item.key === correctKey);
  if (correctIndex < 0) throw new Error('选择题正确选项在随机排序后丢失');
  return {
    correctIndex,
    options: shuffled.map((item, index) => ({
      ...item.candidate,
      label: LETTERS[index]
    }))
  };
}

function makeTextOptions(correctText, sourcePool) {
  const correct = normalizeText(correctText);
  const choices = [correct];
  shuffle(sourcePool.map(normalizeText)).forEach((text) => {
    if (choices.length < 4 && text && choices.indexOf(text) < 0) choices.push(text);
  });
  const options = choices.map(textOption);
  return finalizeOptions(options, correct, (option) => normalizeText(option.text));
}

function mutatePitchQuestion(source, variant) {
  const question = clone(source);
  const midis = (question.midis || []).slice();
  if (!midis.length) return question;
  const index = (variant - 1) % midis.length;
  const deltas = [1, -1, 2, -2, 3, -3];
  const delta = deltas[(variant - 1) % deltas.length];
  const next = midis[index] + delta;
  midis[index] = Math.max(55, Math.min(84, next));
  question.midis = midis;
  question.answer = midis.slice();
  if (Array.isArray(question.spellings)) question.spellings = [];
  return question;
}

function mutateRhythmQuestion(source, variant) {
  const question = clone(source);
  const beats = (question.beats || []).slice();
  if (!beats.length) return question;
  // 依次轮换事件位置。旧写法以 3 为步长，在事件数恰好与 3 有公因数时
  // 只会访问少数几个位置，不但选项变化单一，极端情况下还凑不齐四项。
  let index = (variant - 1) % beats.length;
  for (let tries = 0; tries < beats.length && Math.abs(beats[index]) < 0.5; tries++) {
    index = (index + 1) % beats.length;
  }
  const duration = beats[index];
  const sign = duration < 0 ? -1 : 1;
  const half = Math.abs(duration) / 2;
  beats.splice(index, 1, sign * half, sign * half);
  question.beats = beats;
  question.answerBeats = beats.slice();
  question.answer = beats.slice();
  question.bars = null;
  return question;
}

function mutateMelodyQuestion(source, variant) {
  const question = clone(source);
  const midis = (question.midis || []).slice();
  if (!midis.length) return question;
  const sounding = (question.durs || []).map((dur, index) => (dur > 0 ? index : -1)).filter((index) => index >= 0);
  const offset = Math.max(0, variant - 1);
  const index = sounding[offset % sounding.length];
  // 先遍历所有发声音，再轮换音高变化。这样五音旋律不会因为固定步长
  // 永远只改同一个音，也避免随机生成卷面时出现不足四个唯一选项。
  const deltas = [2, -2, 1, -1, 3, -3];
  const delta = deltas[Math.floor(offset / sounding.length) % deltas.length];
  midis[index] = Math.max(55, Math.min(84, midis[index] + delta));
  question.midis = midis;
  question.answer = midis.filter((midi, eventIndex) => !question.durs || question.durs[eventIndex] > 0);
  question.spellings = [];
  return question;
}

function makeStaffOptions(audio, mutator) {
  const correct = staffOption(audio);
  const candidates = [correct];
  let variant = 1;
  const seen = new Set([eventSignature(correct.events)]);
  while (candidates.length < 4 && variant < 30) {
    const candidate = staffOption(mutator(audio, variant++));
    const key = eventSignature(candidate.events);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }
  // 同一道选择题的四个谱例必须使用同一横向比例。变体可能把一个时值
  // 拆成两个音符，若每项各算宽度，小节线位置和音符疏密会不一致，既
  // 难以横向比较，也可能意外提示正确答案。统一采用本题所需的最大宽度。
  const sharedStaffWidth = Math.max(540, ...candidates.map((option) => Number(option.staffWidth) || 540));
  const alignedCandidates = candidates.map((option) => ({ ...option, staffWidth: sharedStaffWidth }));
  return finalizeOptions(alignedCandidates, eventSignature(correct.events), (option) => eventSignature(option.events));
}

function chordQuality(question) {
  const quality = String(question.chordName || '').replace(/三$/, '');
  if (question.inversion === 1) return `${quality}六和弦`;
  if (question.inversion === 2) return `${quality}四六和弦`;
  return `${question.chordName || quality}和弦`;
}

function pointsFor(framework, key, fallback) {
  const map = framework.pointsByType || framework.questionPoints || {};
  if (Number.isFinite(map[key])) return map[key];
  if (Number.isFinite(framework.pointsPerQuestion)) return framework.pointsPerQuestion;
  if (Number.isFinite(framework.points)) return framework.points;
  return fallback;
}

function repeatsFor(framework, key, fallback) {
  const map = framework.repeatsByType || {};
  if (Number.isFinite(map[key])) return map[key];
  if (Number.isFinite(framework.repeatCount)) return framework.repeatCount;
  return fallback;
}

function makeMixedSource() {
  let pool = [];
  return function take(predicate, label) {
    for (let batch = 0; batch < 20; batch++) {
      const index = pool.findIndex(predicate);
      if (index >= 0) return pool.splice(index, 1)[0];
      pool = pool.concat(generateSet('mixed'));
    }
    throw new Error(`无法从综合题池取得${label || '指定题型'}`);
  };
}

function makeQuestionFactory(province, framework) {
  let serial = 0;
  return function create(config) {
    serial += 1;
    const repeatCount = repeatsFor(framework, config.pointKey, config.repeatCount);
    const points = pointsFor(framework, config.pointKey, config.points);
    const result = config.optionMode === 'text'
      ? makeTextOptions(config.correctText, config.textPool)
      : makeStaffOptions(config.audio, config.mutator);
    return {
      id: `${province}-choice-${serial}`,
      sectionTitle: config.sectionTitle,
      title: config.title,
      repeatCount,
      played: 0,
      response: null,
      correctIndex: result.correctIndex,
      points,
      audio: { ...config.audio, repeatCount },
      optionMode: config.optionMode,
      options: result.options
    };
  };
}

function section(id, title, questions) {
  return {
    id,
    title,
    startIndex: questions.length ? questions[0].id : '',
    count: questions.length,
    questionIds: questions.map((question) => question.id),
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0)
  };
}

function addStaffQuestion(out, create, config) {
  out.push(create({
    ...config,
    optionMode: 'staff',
    mutator: config.mutator || mutatePitchQuestion
  }));
}

function addTextQuestion(out, create, config) {
  out.push(create({ ...config, optionMode: 'text' }));
}

function buildHenan(framework) {
  const take = makeMixedSource();
  const create = makeQuestionFactory('河南', framework);
  const matchTitle = '一、选出与录音完全一致的一项';
  const mismatchTitle = '二、选出与录音不一致的一项';
  const first = [];
  const second = [];

  for (let index = 0; index < 4; index++) {
    addStaffQuestion(first, create, {
      sectionTitle: matchTitle,
      title: `单音听辨 ${index + 1}`,
      pointKey: 'single', points: 5, repeatCount: 2,
      audio: generate('single')
    });
  }

  [3, 3, 5, 5].forEach((size, index) => {
    const audio = take((question) => question.examSection === 'noteGroup' && question.groupSize === size, `${size}音组`);
    addStaffQuestion(first, create, {
      sectionTitle: matchTitle,
      title: `旋律音组听辨 ${index + 1}`,
      pointKey: 'noteGroup', points: 5, repeatCount: 2, audio
    });
  });

  const melodicPitch = take((question) => question.examSection === 'interval' && !question.harmonic, '旋律音程');
  addStaffQuestion(first, create, {
    sectionTitle: matchTitle, title: '旋律音程听辨', pointKey: 'melodicIntervalPitch',
    points: 5, repeatCount: 2, audio: melodicPitch
  });
  const melodicQuality = take((question) => question.examSection === 'interval' && !question.harmonic, '旋律音程性质');
  addTextQuestion(first, create, {
    sectionTitle: matchTitle, title: '旋律音程性质听辨', pointKey: 'melodicIntervalQuality',
    points: 5, repeatCount: 2, audio: melodicQuality,
    correctText: melodicQuality.intervalName, textPool: INTERVAL_NAMES
  });

  const harmonicPitch = take((question) => question.examSection === 'interval' && question.harmonic, '和声音程');
  addStaffQuestion(first, create, {
    sectionTitle: matchTitle, title: '和声音程听辨', pointKey: 'harmonicIntervalPitch',
    points: 5, repeatCount: 2, audio: harmonicPitch
  });
  const harmonicQuality = take((question) => question.examSection === 'interval' && question.harmonic, '和声音程性质');
  addTextQuestion(first, create, {
    sectionTitle: matchTitle, title: '和声音程性质听辨', pointKey: 'harmonicIntervalQuality',
    points: 5, repeatCount: 2, audio: harmonicQuality,
    correctText: harmonicQuality.intervalName, textPool: INTERVAL_NAMES
  });

  for (let index = 0; index < 3; index++) {
    const audio = take((question) => question.examSection === 'chord', '和弦');
    addStaffQuestion(first, create, {
      sectionTitle: matchTitle, title: `和弦听辨 ${index + 1}`, pointKey: 'chordPitch',
      points: 5, repeatCount: 2, audio
    });
  }
  const chord = take((question) => question.examSection === 'chord', '和弦性质');
  addTextQuestion(first, create, {
    sectionTitle: matchTitle, title: '和弦性质听辨', pointKey: 'chordQuality',
    points: 5, repeatCount: 2, audio: chord,
    correctText: chordQuality(chord), textPool: CHORD_NAMES
  });

  for (let index = 0; index < 4; index++) {
    const audio = generate('rhythm');
    addStaffQuestion(second, create, {
      sectionTitle: mismatchTitle,
      title: `节奏听辨 ${index + 1}（选出不一致项）`,
      pointKey: 'rhythmMismatch', points: 5, repeatCount: 2, audio,
      mutator: mutateRhythmQuestion
    });
  }
  for (let index = 0; index < 4; index++) {
    const audio = generate('melody');
    addStaffQuestion(second, create, {
      sectionTitle: mismatchTitle,
      title: `旋律听辨 ${index + 1}（选出不一致项）`,
      pointKey: 'melodyMismatch', points: 5, repeatCount: 2, audio,
      mutator: mutateMelodyQuestion
    });
  }

  const choiceQuestions = first.concat(second);
  return {
    choiceSections: [section('henan-match', matchTitle, first), section('henan-mismatch', mismatchTitle, second)],
    choiceQuestions
  };
}

function nationalModeAudio() {
  const audio = clone(generate('melody'));
  const modeIndex = Math.floor(Math.random() * NATIONAL_MODES.length);
  const modeOffsets = [
    [0, 2, 4, 7, 9],
    [0, 2, 5, 7, 10],
    [0, 3, 5, 8, 10],
    [0, 2, 5, 7, 9],
    [0, 3, 5, 7, 10]
  ][modeIndex];
  const tonic = 60 + modeIndex * 2;
  let noteIndex = 0;
  audio.midis = audio.durs.map((dur) => {
    if (dur < 0) return tonic;
    const octave = Math.floor(noteIndex / modeOffsets.length) % 2;
    const midi = tonic + modeOffsets[noteIndex % modeOffsets.length] + octave * 12;
    noteIndex += 1;
    return Math.min(81, midi);
  });
  audio.answer = audio.midis.filter((midi, index) => audio.durs[index] > 0);
  audio.spellings = [];
  audio.keySignature = 'C';
  audio.keyName = NATIONAL_MODES[modeIndex];
  return { audio, correctText: NATIONAL_MODES[modeIndex] };
}

function buildZhejiang(framework) {
  const take = makeMixedSource();
  const create = makeQuestionFactory('浙江', framework);
  const sectionTitle = '一、听音选择题';
  const questions = [];

  for (let index = 0; index < 2; index++) {
    const audio = take((question) => question.examSection === 'noteGroup' && question.groupSize === 3, '三音组');
    addStaffQuestion(questions, create, {
      sectionTitle, title: `三音组谱例 ${index + 1}`, pointKey: 'threeNoteGroup',
      points: 1, repeatCount: 3, audio
    });
  }

  const intervalQuality = take((question) => question.examSection === 'interval', '音程性质');
  addTextQuestion(questions, create, {
    sectionTitle, title: '音程性质', pointKey: 'intervalQuality', points: 1, repeatCount: 3,
    audio: intervalQuality, correctText: intervalQuality.intervalName, textPool: INTERVAL_NAMES
  });
  const intervalPitch = take((question) => question.examSection === 'interval', '音程音高');
  addStaffQuestion(questions, create, {
    sectionTitle, title: '音程音高', pointKey: 'intervalPitch', points: 1, repeatCount: 3, audio: intervalPitch
  });

  const chordQualityQuestion = take((question) => question.examSection === 'chord', '和弦性质');
  addTextQuestion(questions, create, {
    sectionTitle, title: '和弦性质', pointKey: 'chordQuality', points: 1, repeatCount: 3,
    audio: chordQualityQuestion, correctText: chordQuality(chordQualityQuestion), textPool: CHORD_NAMES
  });
  const chordPitch = take((question) => question.examSection === 'chord', '和弦音高');
  addStaffQuestion(questions, create, {
    sectionTitle, title: '和弦音高', pointKey: 'chordPitch', points: 1, repeatCount: 3, audio: chordPitch
  });

  const rhythmExample = generate('rhythm');
  addStaffQuestion(questions, create, {
    sectionTitle, title: '节奏谱例', pointKey: 'rhythmExample', points: 1, repeatCount: 3,
    audio: rhythmExample, mutator: mutateRhythmQuestion
  });
  const rhythmMeter = generate('rhythm');
  addTextQuestion(questions, create, {
    sectionTitle, title: '节奏拍号', pointKey: 'rhythmMeter', points: 1, repeatCount: 3,
    audio: rhythmMeter, correctText: rhythmMeter.meter, textPool: METERS
  });

  const western = generate('melody');
  addTextQuestion(questions, create, {
    sectionTitle, title: '西洋调式', pointKey: 'westernMode', points: 1, repeatCount: 3,
    audio: western, correctText: normalizeText(western.keyName), textPool: WESTERN_MODES
  });
  const national = nationalModeAudio();
  addTextQuestion(questions, create, {
    sectionTitle, title: '民族调式', pointKey: 'nationalMode', points: 1, repeatCount: 3,
    audio: national.audio, correctText: national.correctText, textPool: NATIONAL_MODES
  });

  const rhythmOrder = generate('rhythm');
  addStaffQuestion(questions, create, {
    sectionTitle, title: '节奏排序', pointKey: 'rhythmOrder', points: 1, repeatCount: 3,
    audio: rhythmOrder, mutator: mutateRhythmQuestion
  });
  const melodyMeter = generate('melody');
  addTextQuestion(questions, create, {
    sectionTitle, title: '旋律拍号', pointKey: 'melodyMeter', points: 1, repeatCount: 3,
    audio: melodyMeter, correctText: melodyMeter.meter, textPool: METERS
  });
  const missingRhythm = generate('rhythm');
  addStaffQuestion(questions, create, {
    sectionTitle, title: '空缺节奏', pointKey: 'missingRhythm', points: 1, repeatCount: 3,
    audio: missingRhythm, mutator: mutateRhythmQuestion
  });
  const missingMelody = generate('melody');
  addStaffQuestion(questions, create, {
    sectionTitle, title: '空缺旋律', pointKey: 'missingMelody', points: 1, repeatCount: 3,
    audio: missingMelody, mutator: mutateMelodyQuestion
  });
  const melodyOrder = generate('melody');
  addStaffQuestion(questions, create, {
    sectionTitle, title: '旋律排序', pointKey: 'melodyOrder', points: 1, repeatCount: 3,
    audio: melodyOrder, mutator: mutateMelodyQuestion
  });

  return {
    choiceSections: [section('zhejiang-listening-choice', sectionTitle, questions)],
    choiceQuestions: questions
  };
}

function buildChoicePaper(framework) {
  const config = framework || {};
  const identity = [config.province, config.name, config.id, config.code, config.templateFamily]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (identity.indexOf('河南') >= 0 || identity.indexOf('henan') >= 0) return buildHenan(config);
  if (identity.indexOf('浙江') >= 0 || identity.indexOf('zhejiang') >= 0) return buildZhejiang(config);
  throw new Error(`暂不支持的选择卷框架: ${identity || '未指定省份'}`);
}

module.exports = { buildChoicePaper };
