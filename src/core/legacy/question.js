/**
 * 出题器：单音、音程听辨、和弦、节奏、旋律听辨
 */
const {
  INTERVALS, CHORDS,
  randInt, shuffle, byLevel, midiToName
} = require('./theory');

// 60 套模拟卷的完整考点作为唯一出题标准。数值 3 仅用于兼容旧知识点键和历史记录，
// 不再代表面向用户的难度等级。
const EXAM_STANDARD_LEVEL = 3;

// 出题音域保持 C4-A5；复盘键盘额外展示 G3-B3 区域。
const RANGE = {
  1: { low: 60, high: 81 },
  2: { low: 60, high: 81 },
  3: { low: 60, high: 81 }
};

// 单音听记的扩充分层：音域三档 + 变化音三档。
// NATURAL_PCS：自然音级（白键）的 MIDI 音级集合。
const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
// 入门 / 进阶 / 冲刺 的音域与变化音策略。默认（模拟考试、专项练习）
// 沿用真题音域 C4-A5，仅在省份/难度明确指定 tier 时才启用分层。
const SINGLE_TIERS = {
  1: { low: 60, high: 72, chromatic: 'natural' }, // 入门：一个八度 C4-C5，仅自然音
  2: { low: 60, high: 81, chromatic: 'some' },    // 进阶：C4-A5，自然音为主 + 少量变化音
  3: { low: 57, high: 88, chromatic: 'any' }      // 冲刺：A3-E6 全音域，全半音
};

// 音组听记的扩充分层：音域(起始音级 degree 区间) + 跳进幅度 + 变化音策略。
// baseMin/baseMax 为音组起始音级区间，leapMax 为相邻音级最大跨度。
const GROUP_TIERS = {
  1: { baseMin: 0, baseMax: 6, leapMax: 2, chromatic: 'natural' },   // 入门：一个八度内、级进+三度、仅调内自然音
  2: { baseMin: -3, baseMax: 9, leapMax: 4, chromatic: 'natural' },  // 进阶：低音区到高八度、小跳(三/四/五度)、调内自然音
  3: { baseMin: -6, baseMax: 13, leapMax: 8, chromatic: 'some' }     // 冲刺：更宽音域、大跳(含八度)、自然音为主+变化音
};

// 音程听记的扩充分层：音程种类(半音数集合) + 根音音域 + 变化音策略。
// semitones 直接对应 INTERVALS 的半音数，粒度比 level 更细、可独立指定。
// 入门→冲刺 依次纳入更不协和、更难辨的音程，并逐步放开根音黑键与音域。
const INTERVAL_TIERS = {
  1: { semitones: [2, 4, 5, 7, 12], low: 60, high: 72, chromatic: 'natural' },      // 入门：大二/大三/纯四/纯五/纯八，白键根音、C4-C5
  2: { semitones: [2, 3, 4, 5, 7, 8, 9, 12], low: 57, high: 79, chromatic: 'some' },// 进阶：+小三/小六/大六，少量黑键根音、A3-G5
  3: { semitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], low: 55, high: 81, chromatic: 'any' } // 冲刺：全 12 种(含增四/七度)，全半音根音、G3-A5
};

// 和弦听记的扩充分层：和弦种类(qualities) + 转位(inversions) + 根音音域 + 变化音策略。
// qualities 直接对应 CHORDS 的 id 集合（三和弦 + 七和弦），inversions 为允许的转位集合。
// 入门→冲刺 依次纳入更不协和、更难辨的和弦，并逐步放开转位、根音黑键与音域。
const CHORD_TIERS = {
  1: { qualities: ['major', 'minor'], inversions: [0], low: 60, high: 72, chromatic: 'natural' },        // 入门：大三/小三、原位、白键根音、C4-C5
  2: { qualities: ['major', 'minor', 'dim', 'aug'], inversions: [0, 1, 2], low: 57, high: 79, chromatic: 'some' }, // 进阶：+减三/增三、含第一/第二转位、少量黑键根音、A3-G5
  3: { qualities: ['major', 'minor', 'dim', 'aug', 'dom7', 'maj7', 'min7', 'halfdim7', 'dim7', 'minmaj7'], inversions: [0, 1, 2, 3], low: 55, high: 84, chromatic: 'any' } // 冲刺：全三和弦+全七和弦、含第三转位、全半音根音、G3-C6
};

// 节奏听记的扩充分层：拍号(meters) + 时值复杂度(level) + 休止符(allowRest) + 速度(bpm)。
// level 对应 EXAM_BAR_PATTERNS 的难度档：1 基本时值(四分/八分/二分) / 2 +附点·切分·休止 / 3 +十六分·三连音·复杂休止。
// 入门→冲刺 逐步纳入更难拍号与更细时值，并放开休止符。默认（模拟考试、专项练习）
// 仍沿用 EXAM_STANDARD_LEVEL=3 全量时值，仅在省份/难度明确指定 tier 时才启用分层。
const RHYTHM_TIERS = {
  1: { level: 1, meters: ['2/4', '3/4', '4/4'], allowRest: false, bpm: 66 },          // 入门：简单拍、基本时值、无休止
  2: { level: 2, meters: ['2/4', '3/4', '4/4', '6/8'], allowRest: true, bpm: 76 },    // 进阶：+6/8、附点/切分、含休止
  3: { level: 3, meters: ['2/4', '3/4', '4/4', '3/8', '6/8'], allowRest: true, bpm: 86 } // 冲刺：全拍号、十六分/三连音/复杂休止
};

// 旋律听记的扩充分层：调号(keys) + 拍号(meters) + 时值复杂度(level) + 变化音(chromatic) + 休止符(allowRest) + 速度(bpm)。
// level 对应 EXAM_BAR_PATTERNS 的难度档（与节奏听记共用同一套节奏型库）；
// keys 为调号池（C=无升降，G/F=一升一降），仅用既有 keySignature 记谱约定（前端已支持 C/G/F）。
// chromatic: 'natural' 仅调号内变化音(F♯/B♭)；'some' 额外注入一个调外半音经过音(♯，避开终止式与调号音)。
// 默认（模拟考试、专项练习）仍沿用 EXAM_STANDARD_LEVEL=3 与 pickMelodyKey/pickExamMeter，
// 仅在省份/难度明确指定 tier 时才启用分层。
const MELODY_TIERS = {
  1: { keys: ['C'], meters: ['2/4', '3/4', '4/4'], level: 1, chromatic: 'natural', allowRest: false, bpm: 70 },          // 入门：无升降、简单拍、基本时值、无休止
  2: { keys: ['C', 'G', 'F'], meters: ['2/4', '3/4', '4/4', '6/8'], level: 2, chromatic: 'natural', allowRest: true, bpm: 78 }, // 进阶：一升一降、+6/8、附点/切分、含休止
  3: { keys: ['C', 'G', 'F'], meters: ['2/4', '3/4', '4/4', '3/8', '6/8'], level: 3, chromatic: 'some', allowRest: true, bpm: 86 } // 冲刺：全拍号、十六分/三连音、含调外变化音
};

// 和声连接听记（江西卷特有）的扩充分层：整条连接内每个音程的种类(半音数集合) + 根音音域 + 变化音策略。
// 江西卷卷面即「和声音程连接」，整条连接始终为和声音程；分层难度梯度与 INTERVAL_TIERS 一致，
// 入门→冲刺 依次纳入更不协和、更难辨的音程，并逐步放开根音黑键与音域。
const CONNECTION_TIERS = {
  1: { semitones: [2, 4, 5, 7, 12], low: 60, high: 72, chromatic: 'natural' },      // 入门：大二/大三/纯四/纯五/纯八，白键根音、C4-C5
  2: { semitones: [2, 3, 4, 5, 7, 8, 9, 12], low: 57, high: 79, chromatic: 'some' },// 进阶：+小三/小六/大六，少量黑键根音、A3-G5
  3: { semitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], low: 55, high: 81, chromatic: 'any' } // 冲刺：全 12 种(含增四/七度)，全半音根音、G3-A5
};

/** 拍值 -> 时值名称 */
const DUR_NAMES = {
  4: '全音符', 3: '附点二分', 2: '二分', 1.5: '附点四分',
  1: '四分', 0.75: '附点八分', 0.5: '八分', 0.25: '十六分'
};

function beatsLabel(beats, max = 8) {
  const names = beats.slice(0, max).map((b) => {
    const name = DUR_NAMES[Math.abs(b)] || String(Math.abs(b));
    return b < 0 ? `${name}休止` : name;
  });
  return names.join(' ') + (beats.length > max ? ' …' : '');
}

/** 从 [low, high] 音域中抽取一个自然音（白键）。 */
function pickNatural(low, high) {
  const candidates = [];
  for (let midi = low; midi <= high; midi++) {
    if (NATURAL_PCS.includes(midi % 12)) candidates.push(midi);
  }
  return candidates[randInt(0, candidates.length - 1)];
}

/**
 * 单音听辨。
 * options.range 覆盖音域 { low, high }；
 * options.chromatic 控制变化音：'natural' 仅自然音 / 'some' 自然音为主少量变化音 / 'any' 全半音（默认）。
 * 不传 options 时保持历史行为（C4-A5 全半音随机），不影响既有试卷。
 */
function genSingle(difficulty, options = {}) {
  const fallback = RANGE[difficulty] || RANGE[3];
  const range = options.range || fallback;
  const chromatic = options.chromatic || 'any';
  const { low, high } = range;
  let midi;
  if (chromatic === 'natural') {
    midi = pickNatural(low, high);
  } else if (chromatic === 'some') {
    // 约 30% 概率出变化音（黑键），其余为自然音。
    midi = Math.random() < 0.3 ? randInt(low, high) : pickNatural(low, high);
  } else {
    midi = randInt(low, high);
  }
  return {
    type: 'single',
    typeName: '单音听辨',
    midis: [midi],
    answer: midi,
    answerText: midiToName(midi),
    knowledgeKey: `single:${midi}`,
    hint: '听音后，在五线谱上写出你听到的音；提交后可用键盘复盘'
  };
}

/**
 * 音程听辨：harmonic=true 和声音程（任意顺序），false 旋律音程（按顺序）。
 * options.tier 一键套用「音程种类 + 根音音域 + 变化音」分层；也可单独指定
 * semitones(音程半音数集合)/range(根音音域)/chromatic(根音变化音)。
 * 不传 options 时保持历史行为（byLevel 全量音程、C4-A5 全半音随机根音）。
 */
function genInterval(difficulty, forcedHarmonic = null, options = {}) {
  // 专项训练按 60 套试卷加入三音组、五音组；综合卷传入 forcedHarmonic，仍保持原有固定结构。
  if (forcedHarmonic === null && Math.random() < 0.36) {
    return genNoteGroup(difficulty, Math.random() < 0.58 ? 3 : 5);
  }
  const tier = hasExamValue(options.tier) ? (INTERVAL_TIERS[options.tier] || INTERVAL_TIERS[1]) : null;

  // 音程种类：tier 指定 semitones 集合 > options.semitones 单独指定 > 默认 byLevel 全量。
  let pool;
  if (tier) {
    pool = INTERVALS.filter((i) => tier.semitones.includes(i.semitones));
  } else if (Array.isArray(options.semitones) && options.semitones.length) {
    pool = INTERVALS.filter((i) => options.semitones.includes(i.semitones));
  } else {
    pool = byLevel(INTERVALS, difficulty);
  }
  const target = pool[randInt(0, pool.length - 1)];

  // 根音音域：默认沿用真题 RANGE，tier / options.range 可覆盖；rootHigh 保证音程不越界。
  const range = options.range || (tier ? { low: tier.low, high: tier.high } : RANGE[difficulty]);
  const { low, high } = range;
  const rootHigh = Math.max(low, high - target.semitones);

  // 根音变化音：'natural' 仅白键根音 / 'some' 少量黑键 / 'any' 全半音（默认）。
  const chromatic = hasExamValue(options.chromatic) ? options.chromatic : (tier ? tier.chromatic : 'any');
  let root;
  if (chromatic === 'natural') {
    root = pickNatural(low, rootHigh);
  } else if (chromatic === 'some') {
    root = Math.random() < 0.3 ? randInt(low, rootHigh) : pickNatural(low, rootHigh);
  } else {
    root = randInt(low, rootHigh);
  }

  const harmonic = typeof forcedHarmonic === 'boolean'
    ? forcedHarmonic
    : Math.random() < 0.4; // 常规训练中 40% 为和声音程
  const midis = [root, root + target.semitones];

  return {
    type: 'interval',
    typeName: harmonic ? '和声音程听辨' : '旋律音程听辨',
    midis,
    harmonic,
    intervalName: target.name,
    semitones: target.semitones,
    answer: midis,
    answerText: `${target.name}（${midis.map(midiToName).join(' ')}）`,
    noteCount: 2,
    knowledgeKey: `interval:${harmonic ? 'harmonic' : 'melodic'}:${target.semitones}`,
    hint: harmonic
      ? '两个音同时响起，在五线谱同一谱格中叠写两个音'
      : '两个音先后响起，在两个固定谱格中按顺序写出'
  };
}

/** 转位名称 */
const INVERSION_NAMES = ['原位', '第一转位', '第二转位', '第三转位'];

/** 和弦转位：将最低 inv 个音移高八度 */
function invertOffsets(offsets, inv) {
  const arr = offsets.slice();
  for (let i = 0; i < inv; i++) arr.push(arr.shift() + 12);
  return arr;
}

// 专项和弦训练以大、小三和弦及原位为主；增、减和弦与转位继续保留，
// 但不再像原先那样等概率出现，避免一组练习连续堆叠高难考点。
const PRACTICE_CHORD_QUALITY_WEIGHTS = [
  { id: 'major', weight: 42 },
  { id: 'minor', weight: 38 },
  { id: 'dim', weight: 12 },
  { id: 'aug', weight: 8 }
];
const PRACTICE_CHORD_INVERSION_WEIGHTS = [
  { value: 0, weight: 70 },
  { value: 1, weight: 20 },
  { value: 2, weight: 10 }
];

function weightedValue(items) {
  let cursor = Math.random() * items.reduce((sum, item) => sum + item.weight, 0);
  for (const item of items) {
    cursor -= item.weight;
    if (cursor < 0) return Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : item.id;
  }
  const fallback = items[items.length - 1];
  return Object.prototype.hasOwnProperty.call(fallback, 'value') ? fallback.value : fallback.id;
}

/**
 * 和弦听辨：覆盖大、小、增、减三和弦及三种位置，专项练习采用基础考点优先权重。
 * options.tier 一键套用「和弦种类 + 转位 + 根音音域 + 变化音」分层；也可单独指定
 * qualities(和弦 id 集合)/inversions(转位集合)/range(根音音域)/chromatic(根音变化音)。
 * 不传 options 时保持历史行为（大/小为主权重、增/减保留、白键+黑键随机根音）。
 */
function genChord(difficulty, options = {}) {
  const tier = hasExamValue(options.tier) ? (CHORD_TIERS[options.tier] || CHORD_TIERS[1]) : null;
  const explicit = tier || Array.isArray(options.qualities) || Array.isArray(options.inversions)
    || hasExamValue(options.range) || hasExamValue(options.chromatic);

  let target;
  let inversion;
  let range;
  let chromatic;

  if (explicit) {
    // 分层/显式指定模式：直接按选项构建，覆盖默认权重。
    let pool;
    if (tier) pool = CHORDS.filter((c) => tier.qualities.includes(c.id));
    else if (Array.isArray(options.qualities) && options.qualities.length) pool = CHORDS.filter((c) => options.qualities.includes(c.id));
    else pool = CHORDS.filter((c) => c.group === 'triad');
    target = pool[randInt(0, pool.length - 1)];

    let inversions;
    if (tier) inversions = tier.inversions;
    else if (Array.isArray(options.inversions) && options.inversions.length) inversions = options.inversions;
    else inversions = [0, 1, 2];
    // 三和弦仅 3 个音，最多第二转位；七和弦才允许第三转位。
    inversions = inversions.filter((inv) => inv < target.offsets.length);
    if (!inversions.length) inversions = [0];
    inversion = inversions[randInt(0, inversions.length - 1)];

    range = options.range || (tier ? { low: tier.low, high: tier.high } : RANGE[difficulty]);
    chromatic = hasExamValue(options.chromatic) ? options.chromatic : (tier ? tier.chromatic : 'any');
  } else {
    // 默认：专项训练基础考点优先权重（保持历史行为）。
    const triads = CHORDS.filter((chord) => chord.group === 'triad');
    const basicPool = triads.filter((chord) => chord.id === 'major' || chord.id === 'minor');
    const weightedTargetId = difficulty === 1 ? '' : weightedValue(PRACTICE_CHORD_QUALITY_WEIGHTS);
    target = difficulty === 1
      ? basicPool[randInt(0, basicPool.length - 1)]
      : triads.find((chord) => chord.id === weightedTargetId);
    inversion = difficulty === 1 ? 0 : weightedValue(PRACTICE_CHORD_INVERSION_WEIGHTS);
    range = RANGE[difficulty];
    chromatic = 'any';
  }

  const { low, high } = range;
  const voiced = invertOffsets(target.offsets, inversion);
  const maxOffset = Math.max(...voiced);
  const rootHigh = Math.max(low, high - maxOffset);
  let root;
  if (chromatic === 'natural') root = pickNatural(low, rootHigh);
  else if (chromatic === 'some') root = Math.random() < 0.3 ? randInt(low, rootHigh) : pickNatural(low, rootHigh);
  else root = randInt(low, rootHigh);
  const midis = voiced.map((o) => root + o);
  const size = target.offsets.length;

  return {
    type: 'chord',
    typeName: size === 4 ? '七和弦听辨' : '和弦听辨',
    midis,
    rootPc: root % 12,
    rootName: midiToName(root).replace(/\d+$/, ''),
    chordName: target.name,
    chordSymbol: target.symbol,
    inversion,
    inversionName: INVERSION_NAMES[inversion],
    chordSize: size,
    answer: [root % 12, target.name, inversion],
    answerText: `${midiToName(root).replace(/\d+$/, '')}${target.name}和弦 · ${INVERSION_NAMES[inversion]}`,
    knowledgeKey: `chord:${target.id}:${inversion}`,
    hint: size === 4 ? '听七和弦后，在五线谱同一谱格中叠写四个音' : '听三和弦后，在五线谱同一谱格中叠写三个音'
  };
}

/* ---------------- 节奏：程序化生成 ---------------- */

// 1 拍节奏单元
const CELLS_1 = [[1], [0.5, 0.5]];
// 1 拍复杂节奏单元
const CELLS_1_MID = [...CELLS_1, [0.25, 0.25, 0.5], [0.5, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25]];
// 2 拍单元
const CELLS_2 = {
  1: [[2], [1, 1], [1, 0.5, 0.5], [0.5, 0.5, 1]],
  2: [[2], [1, 1], [1.5, 0.5], [0.5, 1.5], [1, 0.5, 0.5], [0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5], [1, -1], [-0.5, 0.5, 1]],
  3: [[2], [1.5, 0.5], [0.5, 1.5], [1, 0.5, 0.5], [0.5, 0.25, 0.25, 1], [1, 0.25, 0.25, 0.5], [0.5, 0.5, 0.5, 0.5], [0.25, 0.25, 0.25, 0.25, 1], [1, -0.5, 0.5], [-0.5, 0.5, 0.5, 0.5], [0.5, -0.5, 0.5, 0.5]]
};

/** 生成一小节（4 拍）：优先 2 拍单元 ×2，或 2+1+1 组合 */
function genBar(difficulty) {
  const use2 = Math.random() < 0.55;
  if (use2) {
    const pool = CELLS_2[difficulty];
    const a = pool[randInt(0, pool.length - 1)];
    const b = pool[randInt(0, pool.length - 1)];
    return [...a, ...b];
  }
  const pool2 = CELLS_2[difficulty];
  const two = pool2[randInt(0, pool2.length - 1)];
  const cells1 = difficulty === 1 ? CELLS_1 : CELLS_1_MID;
  const c1 = cells1[randInt(0, cells1.length - 1)];
  const c2 = cells1[randInt(0, cells1.length - 1)];
  return Math.random() < 0.5 ? [...two, ...c1, ...c2] : [...c1, ...c2, ...two];
}

/** 生成指定小节数的节奏型（负时值表示休止，末尾小节给长音收束） */
function genRhythmBars(difficulty, barCount = 8) {
  const bars = [];
  for (let bar = 0; bar < barCount; bar++) {
    if (bar === barCount - 1) {
      bars.push(difficulty === 1 ? [2, 2] : [[4], [2, 2]][randInt(0, 1)]);
    } else {
      bars.push(genBar(difficulty));
    }
  }
  return bars;
}

function flattenBars(bars) {
  return bars.reduce((out, bar) => out.concat(bar), []);
}

function rhythmKey(beats) {
  return beats.join(',');
}

/** 从正确答案只改动少量小节，构造更有区分度的近似干扰项 */
function mutateRhythmBars(source, difficulty) {
  const bars = source.map((bar) => bar.slice());
  const mutableCount = Math.max(1, bars.length - 1);
  const changes = Math.min(difficulty === 3 ? 2 : 1, mutableCount);
  const used = new Set();
  for (let n = 0; n < changes; n++) {
    let index;
    do index = randInt(0, mutableCount - 1); while (used.has(index));
    used.add(index);
    const oldKey = rhythmKey(bars[index]);
    let replacement = bars[index];
    for (let tries = 0; tries < 20 && rhythmKey(replacement) === oldKey; tries++) {
      replacement = genBar(difficulty);
    }
    bars[index] = replacement;
  }
  return bars;
}

/** 节奏听辨：指定小节数，4 个谱面选项 */
function genRhythmQuestion(difficulty, barCount = 8) {
  const targetBars = genRhythmBars(difficulty, barCount);
  const target = flattenBars(targetBars);
  const optionSet = new Set([target.join(',')]);
  const options = [target];
  let attempts = 0;
  while (options.length < 4 && attempts++ < 80) {
    const cand = flattenBars(mutateRhythmBars(targetBars, difficulty));
    const key = cand.join(',');
    if (!optionSet.has(key)) {
      optionSet.add(key);
      options.push(cand);
    }
  }
  // 极端随机碰撞时兜底，保证始终有四个选项。
  while (options.length < 4) {
    const cand = flattenBars(genRhythmBars(difficulty, barCount));
    const key = cand.join(',');
    if (!optionSet.has(key)) {
      optionSet.add(key);
      options.push(cand);
    }
  }
  const shuffled = shuffle(options.map((b, i) => ({ b, i })));
  const answerIndex = shuffled.findIndex((x) => x.i === 0);

  return {
    type: 'rhythm',
    typeName: '节奏听辨',
    beats: target,
    bpm: difficulty === 1 ? 70 : difficulty === 2 ? 80 : 92,
    options: shuffled.map((x) => x.b), // 4 个节奏型（拍值数组）
    answer: answerIndex,
    answerText: `选项 ${'ABCD'[answerIndex]}（${beatsLabel(target)}）`,
    barCount,
    knowledgeKey: `rhythm:d${difficulty}:bars${barCount}:rest${target.some((b) => b < 0) ? 1 : 0}:min${Math.min(...target.map(Math.abs))}`,
    hint: `听 ${barCount} 小节节奏，选出你听到的谱面`
  };
}

function genRhythm(difficulty) {
  const question = genExamRhythm(difficulty);
  return {
    ...question,
    typeName: '节奏听辨',
    repeatCount: 3,
    hint: '辨认拍号，并在五线谱上写出四小节节奏'
  };
}

/* ---------------- 旋律：8 小节、按序听辨音高 ---------------- */

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MELODY_KEYS = {
  C: { id: 'C', name: 'C 大调', tonic: 60, letters: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], altered: '' },
  G: { id: 'G', name: 'G 大调', tonic: 67, letters: ['G', 'A', 'B', 'C', 'D', 'E', 'F'], altered: '#' },
  F: { id: 'F', name: 'F 大调', tonic: 65, letters: ['F', 'G', 'A', 'B', 'C', 'D', 'E'], altered: 'b' }
};

// 每组轮廓都是完整的八小节四句式：A（1-2）—A′（3-4）—B（5-6）—A″（7-8）。
// 第 4 小节落在属音形成半终止，第 8 小节级进回到主音形成完全终止。
const MELODY_CONTOURS = [
  [[0, 1, 2, 4, 3, 2], [2, 3, 4, 3, 2, 1], [0, 1, 2, 4, 3, 2], [3, 2, 1, 4], [4, 5, 6, 5, 4, 3], [3, 4, 5, 4, 3, 2], [2, 3, 4, 2, 1], [2, 1, 0, 0]],
  [[2, 1, 0, 1, 2, 3], [4, 3, 2, 1, 2], [2, 3, 4, 5, 4, 2], [3, 2, 1, 4], [4, 6, 5, 4, 3], [3, 5, 4, 3, 2], [2, 4, 3, 2, 1], [2, 1, 0, 0]],
  [[4, 3, 2, 1, 2], [0, 1, 2, 3, 4], [4, 5, 6, 5, 4], [3, 2, 1, 4], [2, 3, 4, 5, 3], [4, 3, 2, 1], [0, 2, 4, 2, 1], [2, 1, 0, 0]]
];

// 四句式旋律模板。每一组都遵循 A—A′—B—A″：第二句保留主题开头但
// 改变后半句，第三句进入较高音区形成高潮，第四句只再现主题特征而不做
// 整小节复制。句尾音级由下方的终止式逻辑统一收束。
const FOUR_PHRASE_MELODY_TEMPLATES = [
  [
    [[0, 1, 2, 4, 3, 2], [2, 3, 4, 3, 1, 2]],
    [[0, 1, 2, 4, 3, 1], [2, 3, 5, 4, 3, 4]],
    [[4, 5, 7, 6, 5, 4], [3, 5, 4, 3, 2, 1]],
    [[0, 1, 2, 4, 3, 1], [2, 3, 2, 1, 0]]
  ],
  [
    [[2, 1, 0, 1, 3, 2], [3, 2, 1, 0, 1, 2]],
    [[2, 1, 0, 1, 3, 2], [3, 4, 5, 3, 2, 4]],
    [[4, 6, 5, 7, 6, 4], [5, 4, 3, 2, 0, 1]],
    [[2, 1, 0, 1, 3, 2], [3, 2, 1, 2, 1, 0]]
  ],
  [
    [[0, 2, 1, 3, 4, 2], [1, 2, 4, 3, 1, 2]],
    [[0, 2, 1, 3, 4, 2], [2, 4, 5, 3, 2, 4]],
    [[4, 3, 5, 7, 6, 4], [5, 6, 4, 3, 2, 1]],
    [[0, 2, 1, 3, 4, 2], [3, 2, 1, 2, 1, 0]]
  ],
  [
    [[4, 3, 2, 0, 1, 2], [1, 3, 2, 4, 3, 2]],
    [[4, 3, 2, 0, 1, 2], [2, 3, 5, 4, 3, 4]],
    [[4, 5, 6, 7, 5, 4], [6, 5, 3, 4, 2, 1]],
    [[4, 3, 2, 0, 1, 2], [3, 2, 4, 1, 0]]
  ],
  [
    [[0, 1, 3, 2, 4, 3], [2, 1, 3, 4, 1, 2]],
    [[0, 1, 3, 2, 4, 3], [2, 4, 3, 5, 3, 4]],
    [[4, 6, 5, 7, 6, 5], [4, 5, 3, 2, 0, 1]],
    [[0, 1, 3, 2, 4, 3], [2, 3, 1, 2, 1, 0]]
  ],
  [
    [[2, 3, 4, 2, 1, 2], [0, 1, 3, 2, 1, 2]],
    [[2, 3, 4, 2, 1, 2], [3, 5, 4, 2, 3, 4]],
    [[4, 5, 7, 6, 4, 5], [6, 4, 3, 5, 2, 1]],
    [[2, 3, 4, 2, 1, 2], [3, 1, 2, 1, 0]]
  ]
];

const MELODY_PHRASE_INFO = [
  { name: '第一句', role: '陈述', cadenceDegree: 2 },
  { name: '第二句', role: '呼应', cadenceDegree: 4 },
  { name: '第三句', role: '发展', cadenceDegree: 1 },
  { name: '第四句', role: '收束', cadenceDegree: 0 }
];

// 句尾都从相邻音级进入终止音，避免随机轮廓在小节末突然跳进目标音。
const MELODY_CADENCE_APPROACHES = [
  [1, 2],
  [3, 4],
  [2, 1],
  [2, 1, 0]
];

const MELODY_RHYTHMS = {
  1: [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [1, 0.5, 0.5, 1, 1]],
  2: [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [1, 0.5, 0.5, 1, 1], [0.5, 0.5, 1, 1, 1]],
  3: [[1, 1, 0.5, 0.5, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [0.5, 0.25, 0.25, 1, 1, 1]]
};

const MELODY_REST_RHYTHMS = {
  2: [[-0.5, 0.5, 1, 1, 1], [1, -0.5, 0.5, 1, 1], [1, 1, -0.5, 0.5, 1]],
  3: [[-0.5, 0.5, 1, 1, 1], [0.5, -0.5, 0.5, 0.5, 1, 1], [1, -0.25, 0.25, 0.5, 1, 1], [1, 1, -0.5, 0.5, 1]]
};

function pickMelodyKey(difficulty) {
  if (difficulty === 1) return MELODY_KEYS.C;
  const choices = difficulty === 2 ? ['C', 'C', 'G', 'F'] : ['C', 'G', 'G', 'F', 'F'];
  return MELODY_KEYS[choices[randInt(0, choices.length - 1)]];
}

function degreeNote(key, degree, alter = 0) {
  const octaveShift = Math.floor(degree / 7);
  const scaleIndex = ((degree % 7) + 7) % 7;
  const letter = key.letters[scaleIndex];
  const keyAccidental = key.id === 'G' && letter === 'F' ? '#' : key.id === 'F' && letter === 'B' ? 'b' : '';
  const keyShift = keyAccidental === '#' ? 1 : keyAccidental === 'b' ? -1 : 0;
  const diatonicMidi = key.tonic + octaveShift * 12 + MAJOR_SCALE[scaleIndex];
  const midi = diatonicMidi + alter;
  // alter 为调外临时变音（±1 半音），拼写用显式升/降号；默认 0 保持调号内拼写。
  const accidental = alter !== 0 ? (alter > 0 ? '#' : 'b') : keyAccidental;
  // 八度按「自然音名」推导（diatonicMidi - keyShift），避免 B♯/C♭ 跨八度时算错八度号。
  const octave = Math.floor((diatonicMidi - keyShift) / 12) - 1;
  return { midi, spelling: `${letter}${accidental}${octave}` };
}

function fitContour(contour, count) {
  if (count <= 1) return [contour[contour.length - 1]];
  return Array.from({ length: count }, (_, index) => (
    contour[Math.round(index * (contour.length - 1) / (count - 1))]
  ));
}

function buildMelodyPhrasePlan(barCount) {
  const baseLength = Math.floor(barCount / 4);
  const remainder = barCount % 4;
  let startBar = 1;
  return MELODY_PHRASE_INFO.map((info, index) => {
    const length = baseLength + (index < remainder ? 1 : 0);
    const phrase = {
      ...info,
      motif: index === 0 ? 'A' : index === 1 ? 'A′' : index === 2 ? 'B' : 'A″',
      startBar,
      endBar: startBar + length - 1
    };
    startBar += length;
    return phrase;
  });
}

function phraseForBar(phrases, barNumber) {
  return phrases.findIndex((phrase) => barNumber >= phrase.startBar && barNumber <= phrase.endBar);
}

function phraseContour(template, phrase, phraseIndex, barNumber) {
  const source = template[phraseIndex];
  const phraseLength = phrase.endBar - phrase.startBar + 1;
  if (phraseLength <= 1) return source.reduce((all, contour) => all.concat(contour), []);
  const localIndex = barNumber - phrase.startBar;
  const sourceIndex = Math.round(localIndex * (source.length - 1) / (phraseLength - 1));
  return source[sourceIndex];
}

function smoothMelodyDegrees(values) {
  const result = values.map((degree) => Math.max(0, Math.min(7, degree)));
  for (let index = 1; index < result.length; index++) {
    // 等距抽样偶尔会把同一音级复制成相邻两音，改成邻音可明显增强流动感。
    if (result[index] === result[index - 1]) {
      const next = values[index + 1];
      const preferred = Number.isFinite(next) && next < result[index] ? -1 : 1;
      const candidate = result[index] + preferred;
      result[index] = candidate >= 0 && candidate <= 7 ? candidate : result[index] - preferred;
    }
    // 控制为七度以内，并让过大的轮廓转折先经过中间音级。
    const leap = result[index] - result[index - 1];
    if (Math.abs(leap) > 4) result[index] = result[index - 1] + Math.sign(leap) * 4;
  }
  return result;
}

function applyPhraseCadence(degrees, phraseIndex) {
  const result = degrees.slice();
  const approach = MELODY_CADENCE_APPROACHES[phraseIndex] || [0];
  const count = Math.min(result.length, approach.length);
  const cadenceStart = result.length - count;
  if (cadenceStart > 0 && result[cadenceStart - 1] === approach[approach.length - count]) {
    const pivot = result[cadenceStart - 1] + (phraseIndex === 0 ? -1 : 1);
    result[cadenceStart - 1] = Math.max(0, Math.min(7, pivot));
  }
  for (let index = 0; index < count; index++) {
    result[cadenceStart + index] = approach[approach.length - count + index];
  }
  return result;
}

/** 判断某音级是否为调号内变化音（G 调 F♯ / F 调 B♭）。 */
function isKeyAccidentalDegree(key, degree) {
  const scaleIndex = ((degree % 7) + 7) % 7;
  const letter = key.letters[scaleIndex];
  return (key.id === 'G' && letter === 'F') || (key.id === 'F' && letter === 'B');
}

/**
 * 在乐句内部挑选一个可注入「调外半音经过音」的发声位。
 * 规则：跳过主题起音(index 0)与句尾级进终止(最后 2 音)；
 * 跳过 MI/TI 级（升半音后即下一自然音，非真正变化音）与调号内变化音级。
 * 返回 -1 表示本句没有安全注入位。
 */
function pickChromaticSlot(key, degrees, soundingCount) {
  const maxSlot = soundingCount - 3; // 保留主题起音 + 句尾级进终止
  if (maxSlot < 1) return -1;
  const candidates = [];
  for (let index = 1; index <= maxSlot; index++) {
    const degree = degrees[index];
    const scaleIndex = ((degree % 7) + 7) % 7;
    if (scaleIndex === 2 || scaleIndex === 6) continue; // MI/TI：升半音=下一自然音
    if (isKeyAccidentalDegree(key, degree)) continue;   // 避免与调号音重号
    candidates.push(index);
  }
  return candidates.length ? candidates[randInt(0, candidates.length - 1)] : -1;
}

function cadenceRhythm(meter, phraseIndex) {
  const patterns = {
    '2/4': [[0.5, 0.5, 1], [1, 1], [0.5, 0.5, 1], [1, 1]],
    '3/4': [[1, 2], [0.5, 0.5, 2], [0.5, 0.5, 2], [1, 2]],
    '4/4': [[1, 1, 2], [0.5, 0.5, 1, 2], [1, 0.5, 0.5, 2], [1, 1, 2]],
    '3/8': [[0.5, 1], [0.25, 0.25, 1], [0.25, 0.25, 1], [0.5, 1]],
    '6/8': [[0.5, 1, 1.5], [0.5, 0.5, 0.5, 1.5], [0.5, 0.5, 0.5, 1.5], [1.5, 1.5]]
  };
  const choices = patterns[meter.id];
  if (choices) return choices[Math.min(phraseIndex, choices.length - 1)].slice();
  return [meter.beatsPerBar / 3, meter.beatsPerBar * 2 / 3];
}

function pickRhythmVariation(pool, source, excluded = []) {
  const blocked = new Set([source].concat(excluded).map((bar) => JSON.stringify(bar)));
  const sourceNotes = source.filter((duration) => duration > 0).length;
  const close = pool.filter((bar) => (
    !blocked.has(JSON.stringify(bar))
    && Math.abs(bar.filter((duration) => duration > 0).length - sourceNotes) <= 1
  ));
  const candidates = close.length ? close : pool.filter((bar) => !blocked.has(JSON.stringify(bar)));
  return (candidates.length ? candidates[randInt(0, candidates.length - 1)] : source).slice();
}

function buildPhraseRhythmBars(level, meter, barCount, phrases, allowRest = null) {
  const bars = genExamBars(level, meter, barCount, allowRest);
  // 两小节一句时，后续乐句沿用第一句的节奏密度，但使用变化节奏，避免
  // A′ 和 A″ 变成机械复制；B 句使用对比节奏并把听觉重心推向高潮。
  if (barCount >= 8) {
    const pool = examPatterns(meter, level);
    const openingPool = pool.filter((bar) => bar[0] > 0);
    const opening = (openingPool.length ? openingPool[randInt(0, openingPool.length - 1)] : pool[0]).slice();
    const response = pickRhythmVariation(pool, opening);
    const development = pickRhythmVariation(pool, response, [opening]);
    const returnBar = pickRhythmVariation(pool, opening, [response]);
    bars[phrases[0].startBar - 1] = opening;
    bars[phrases[1].startBar - 1] = response;
    bars[phrases[2].startBar - 1] = development;
    bars[phrases[3].startBar - 1] = returnBar;
  }
  phrases.forEach((phrase, phraseIndex) => {
    bars[phrase.endBar - 1] = cadenceRhythm(meter, phraseIndex);
  });
  return bars;
}

function buildMelodyRhythms(difficulty) {
  const pool = MELODY_RHYTHMS[difficulty];
  const opening = pool[randInt(0, pool.length - 1)].slice();
  const response = pool[randInt(0, pool.length - 1)].slice();
  const bars = [
    opening, response, opening.slice(), [1, 1, 2],
    pool[randInt(0, pool.length - 1)].slice(), response.slice(),
    pool[randInt(0, pool.length - 1)].slice(), difficulty === 1 ? [2, 2] : [1, 1, 2]
  ];
  if (difficulty > 1) {
    const candidates = shuffle([1, 5, 6]);
    const restBarCount = difficulty === 2 ? 1 : 2;
    for (let index = 0; index < restBarCount; index++) {
      const restPool = MELODY_REST_RHYTHMS[difficulty];
      bars[candidates[index]] = restPool[randInt(0, restPool.length - 1)].slice();
    }
  }
  return bars;
}

function genMelody(difficulty) {
  const key = pickMelodyKey(difficulty);
  const contours = MELODY_CONTOURS[randInt(0, MELODY_CONTOURS.length - 1)];
  const rhythmBars = buildMelodyRhythms(difficulty);
  const durs = [];
  const midis = [];
  const spellings = [];
  const answer = [];
  const answerSpellings = [];

  rhythmBars.forEach((rhythm, barIndex) => {
    const soundingCount = rhythm.filter((duration) => duration > 0).length;
    const degrees = fitContour(contours[barIndex], soundingCount);
    // 采用一升/一降调时，让调号中的变化音实际出现在对比乐句中。
    if (barIndex === 4 && key.id !== 'C' && degrees.length) {
      degrees[Math.floor(degrees.length / 2)] = key.id === 'G' ? 6 : 3;
    }
    let degreeIndex = 0;
    let lastNote = degreeNote(key, degrees[0]);
    rhythm.forEach((duration) => {
      if (duration > 0) {
        lastNote = degreeNote(key, degrees[degreeIndex++]);
        answer.push(lastNote.midi);
        answerSpellings.push(lastNote.spelling);
      }
      // 休止事件保留占位音高，使 durs / midis / spellings 始终严格对齐。
      durs.push(duration);
      midis.push(lastNote.midi);
      spellings.push(lastNote.spelling);
    });
  });

  const span = Math.max(...answer) - Math.min(...answer);
  const preview = answerSpellings.slice(0, 8).join(' ');
  const restCount = durs.filter((duration) => duration < 0).length;
  return {
    type: 'melody',
    typeName: '旋律听辨',
    midis,
    durs,
    spellings,
    bpm: difficulty === 1 ? 72 : difficulty === 2 ? 82 : 92,
    noteCount: answer.length,
    answer,
    answerText: `正确旋律见谱面（${preview}${answer.length > 8 ? ' …' : ''}）`,
    answerNotes: answerSpellings.join(' '),
    keySignature: key.id,
    keyName: key.name,
    melodicStructure: 'A-A′-B-A″',
    restCount,
    knowledgeKey: `melody:d${difficulty}:key${key.id}:rest${restCount}:span${span <= 5 ? 'narrow' : span <= 9 ? 'medium' : 'wide'}`,
    hint: '听 8 小节旋律，按顺序在键盘上听辨音高；不考点击节奏'
  };
}

/* ---------------- 综合训练：按统考真题固定组卷 ---------------- */

const MIXED_EXAM_COUNT = 21;

const NOTE_GROUP_CONTOURS = {
  3: [
    [0, 1, 2], [2, 1, 0], [0, 2, 1], [2, 0, 1], [0, 1, 0], [1, 2, 0]
  ],
  4: [
    [0, 1, 2, 3], [3, 2, 1, 0], [0, 2, 3, 1],
    [2, 0, 1, 3], [0, 1, 3, 2], [3, 1, 2, 0]
  ],
  5: [
    [0, 1, 2, 3, 2], [3, 2, 1, 0, 1], [0, 2, 1, 3, 2],
    [2, 1, 0, 1, 2], [0, 1, 3, 2, 1], [3, 1, 2, 0, 1]
  ]
};

const NOTE_GROUP_SIZE_NAMES = { 3: '三', 4: '四', 5: '五' };

/** 动态生成音组轮廓：从 0 开始，相邻音级跨度 1~leapMax，随机方向，限制在 0~6 内。 */
function genGroupContour(size, leapMax) {
  const contour = [0];
  for (let i = 1; i < size; i++) {
    const prev = contour[i - 1];
    const step = randInt(1, Math.max(1, leapMax));
    const dir = Math.random() < 0.5 ? -1 : 1;
    let next = prev + dir * step;
    if (next < 0) next = prev + step;
    if (next > 6) next = prev - step;
    contour.push(next);
  }
  return contour;
}

/** 变化音：把某音替换为相邻黑键（±1 半音，保证落在调式自然音之外）。 */
function chromaticizeNote(note) {
  const candidates = [1, -1]
    .map((delta) => note.midi + delta)
    .filter((midi) => !NATURAL_PCS.includes(((midi % 12) + 12) % 12));
  if (!candidates.length) return note;
  const midi = candidates[randInt(0, candidates.length - 1)];
  return { midi, spelling: midiToName(midi) };
}

/**
 * 真题音组：连续播放并要求按原顺序复现，复用旋律音程的键盘答题交互。
 * options.tier 一键套用音域+跳进+变化音分层；也可单独指定 baseMin/baseMax/leapMax/chromatic。
 * 不传 options 时保持历史行为（固定轮廓池、起始音级 0~6-maxContour、仅调内自然音）。
 */
function genNoteGroup(difficulty, size, options = {}) {
  const sizeName = NOTE_GROUP_SIZE_NAMES[size] || String(size);
  const key = pickMelodyKey(difficulty);
  const tier = hasExamValue(options.tier) ? (GROUP_TIERS[options.tier] || GROUP_TIERS[1]) : null;
  const leapMax = hasExamValue(options.leapMax) ? Number(options.leapMax) : (tier ? tier.leapMax : 3);
  const baseMin = hasExamValue(options.baseMin) ? Number(options.baseMin) : (tier ? tier.baseMin : 0);
  const baseMax = hasExamValue(options.baseMax) ? Number(options.baseMax) : (tier ? tier.baseMax : 6);
  const chromatic = hasExamValue(options.chromatic) ? options.chromatic : (tier ? tier.chromatic : 'natural');

  // 轮廓：未指定分层时沿用历史固定轮廓池；指定 tier/leapMax 时动态生成（支持更大跳进）。
  const contour = (tier || hasExamValue(options.leapMax))
    ? genGroupContour(size, leapMax)
    : NOTE_GROUP_CONTOURS[size][randInt(0, NOTE_GROUP_CONTOURS[size].length - 1)];

  const maxContour = Math.max(...contour);
  const baseDegree = randInt(baseMin, Math.max(baseMin, baseMax - maxContour));
  const notes = contour.map((offset) => degreeNote(key, baseDegree + offset));

  // 变化音：'some' 时把某个非首音替换为相邻黑键（半音），拼写用升号临时记号。
  if (chromatic === 'some' && notes.length > 1) {
    const idx = randInt(1, notes.length - 1);
    notes[idx] = chromaticizeNote(notes[idx]);
  }

  const midis = notes.map((note) => note.midi);
  const labels = notes.map((note) => note.spelling);

  return {
    type: 'interval',
    typeName: `${sizeName}音组听辨`,
    midis,
    spellings: labels,
    harmonic: false,
    intervalName: `${sizeName}音组`,
    answer: midis,
    answerText: labels.join(' '),
    noteCount: size,
    groupSize: size,
    examSection: 'noteGroup',
    keySignature: key.id,
    keyName: key.name,
    knowledgeKey: `note-group:${size}:d${difficulty}:key${key.id}`,
    hint: `听连续 ${size} 个音，在 ${size} 个固定谱格中按原顺序写出`
  };
}

/** 真题第 3 题固定为前两个旋律音程、后两个和声音程。options 透传给 genInterval。 */
function genExamInterval(difficulty, harmonic, options = {}) {
  const question = genInterval(difficulty, harmonic, options);
  return {
    ...question,
    typeName: harmonic ? '和声音程听写' : '旋律音程听写',
    examSection: 'interval',
    examPoints: 1,
    repeatCount: 3
  };
}

/** 五个和声音程连续出现，和 60 套试卷的第 4 大题（江西「和声音程连接」）一致。
 *  options 可为数字（旧签名 intervalCount）或对象：{ tier, intervalCount, semitones, range, chromatic }。
 *  tier 一键套用「音程种类 + 根音音域 + 变化音」分层；显式 semitones/range/chromatic 可单独覆盖。
 *  整条连接始终为和声音程（江西卷面约定），不传任何 options 时保持历史全量音程行为。 */
function genIntervalConnection(difficulty, options = {}) {
  const opts = typeof options === 'number' ? { intervalCount: options } : (options || {});
  const intervalCount = examCount(opts.intervalCount, 5);
  const tier = hasExamValue(opts.tier) ? (CONNECTION_TIERS[opts.tier] || CONNECTION_TIERS[1]) : null;

  // 每个音程的约束：tier 指定 semitones 集合 > options 单独指定 > 默认 byLevel 全量。
  const intervalOptions = {};
  if (tier) {
    intervalOptions.semitones = tier.semitones;
    intervalOptions.range = { low: tier.low, high: tier.high };
    intervalOptions.chromatic = tier.chromatic;
  }
  if (Array.isArray(opts.semitones) && opts.semitones.length) intervalOptions.semitones = opts.semitones;
  if (hasExamValue(opts.range)) intervalOptions.range = opts.range;
  if (hasExamValue(opts.chromatic)) intervalOptions.chromatic = opts.chromatic;

  const links = [];
  const seen = new Set();
  let attempts = 0;
  while (links.length < intervalCount && attempts++ < intervalCount * 200) {
    const question = genInterval(difficulty, true, intervalOptions);
    const key = practiceQuestionKey(question);
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(question);
  }
  if (links.length < intervalCount) {
    throw new Error(`无法生成 ${intervalCount} 个互不重复的和声音程连接`);
  }
  const chords = links.map((question) => question.midis);
  return {
    type: 'intervalConnection',
    typeName: '和声音程连接',
    chords,
    answer: chords,
    answerText: links.map((question) => question.intervalName).join(' · '),
    intervalNames: links.map((question) => question.intervalName),
    links,
    noteCount: intervalCount * 2,
    examSection: 'intervalConnection',
    examPoints: 5,
    repeatCount: 3,
    knowledgeKey: `interval-connection:d${difficulty}:${links.map((question) => question.semitones).join('-')}`,
    hint: `连续听 ${intervalCount} 个和声音程，在 ${intervalCount} 个谱格中分别写出两个音`
  };
}

/** 综合卷使用大、小、增、减三和弦及三种位置；options 可套用 CHORD_TIERS 分层（含七和弦），或单独指定 qualities/inversions/range/chromatic。 */
function genExamChord(difficulty, options = {}) {
  const tier = hasExamValue(options.tier) ? (CHORD_TIERS[options.tier] || CHORD_TIERS[1]) : null;

  // 和弦种类池：tier > options.qualities > 默认（难度 1 仅大/小，否则全三和弦）。
  let pool;
  if (tier) pool = CHORDS.filter((c) => tier.qualities.includes(c.id));
  else if (Array.isArray(options.qualities) && options.qualities.length) pool = CHORDS.filter((c) => options.qualities.includes(c.id));
  else {
    const allTriads = CHORDS.filter((chord) => chord.group === 'triad');
    pool = difficulty === 1
      ? allTriads.filter((chord) => chord.id === 'major' || chord.id === 'minor')
      : allTriads;
  }
  const target = pool[randInt(0, pool.length - 1)];

  // 转位集合：tier > options.inversions > 默认（难度 1 仅原位，否则 0-2）。
  let inversions;
  if (tier) inversions = tier.inversions;
  else if (Array.isArray(options.inversions) && options.inversions.length) inversions = options.inversions;
  else inversions = difficulty === 1 ? [0] : [0, 1, 2];
  // 三和弦最多第二转位；七和弦才允许第三转位。
  inversions = inversions.filter((inv) => inv < target.offsets.length);
  if (!inversions.length) inversions = [0];
  const inversion = inversions[randInt(0, inversions.length - 1)];

  // 根音音域 + 变化音：rootHigh 保证转位后最高音不越界。
  const range = options.range || (tier ? { low: tier.low, high: tier.high } : RANGE[difficulty]);
  const { low, high } = range;
  const voiced = invertOffsets(target.offsets, inversion);
  const maxOffset = Math.max(...voiced);
  const rootHigh = Math.max(low, high - maxOffset);
  const chromatic = hasExamValue(options.chromatic) ? options.chromatic : (tier ? tier.chromatic : 'any');
  let root;
  if (chromatic === 'natural') root = pickNatural(low, rootHigh);
  else if (chromatic === 'some') root = Math.random() < 0.3 ? randInt(low, rootHigh) : pickNatural(low, rootHigh);
  else root = randInt(low, rootHigh);
  const midis = voiced.map((offset) => root + offset);
  const size = target.offsets.length;
  return {
    type: 'chord',
    typeName: size === 4 ? '七和弦听写' : '三和弦听写',
    midis,
    rootPc: root % 12,
    rootName: midiToName(root).replace(/\d+$/, ''),
    chordName: target.name,
    chordSymbol: target.symbol,
    inversion,
    inversionName: INVERSION_NAMES[inversion],
    chordSize: size,
    answer: midis,
    answerText: `${midiToName(root).replace(/\d+$/, '')}${target.name}和弦 · ${INVERSION_NAMES[inversion]}`,
    examSection: 'chord',
    examPoints: 1,
    repeatCount: 3,
    knowledgeKey: `exam-chord:${target.id}:${inversion}`,
    hint: size === 4 ? '听七和弦，在谱格中叠写四个音' : '听三和弦，在谱格中叠写三个音'
  };
}

const EXAM_METERS = [
  { id: '2/4', numerator: 2, denominator: 4, beatsPerBar: 2 },
  { id: '3/4', numerator: 3, denominator: 4, beatsPerBar: 3 },
  { id: '4/4', numerator: 4, denominator: 4, beatsPerBar: 4 },
  { id: '3/8', numerator: 3, denominator: 8, beatsPerBar: 1.5 },
  { id: '6/8', numerator: 6, denominator: 8, beatsPerBar: 3 }
];

const EXAM_BAR_PATTERNS = {
  '2/4': {
    1: [[1, 1], [0.5, 0.5, 1], [1, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
    2: [[1.5, 0.5], [0.5, 1.5], [1, -0.5, 0.5], [-0.5, 0.5, 1], [0.5, 0.25, 0.25, 1]],
    3: [[0.25, 0.25, 0.25, 0.25, 1], [1 / 3, 1 / 3, 1 / 3, 1], [0.5, -0.25, 0.25, 0.5, 0.5]]
  },
  '3/4': {
    1: [[1, 1, 1], [0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1], [1, 1, 0.5, 0.5]],
    2: [[1.5, 0.5, 1], [1, 1.5, 0.5], [1, -0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1]],
    3: [[1 / 3, 1 / 3, 1 / 3, 1, 1], [0.25, 0.25, 0.5, 1, 1], [1, 0.5, -0.5, 0.5, 0.5]]
  },
  '4/4': {
    1: [[1, 1, 1, 1], [0.5, 0.5, 1, 1, 1], [1, 1, 0.5, 0.5, 1]],
    2: [[1.5, 0.5, 1, 1], [1, -0.5, 0.5, 1, 1], [0.5, 0.5, 1.5, 0.5, 1]],
    3: [[1 / 3, 1 / 3, 1 / 3, 1, 1, 1], [0.25, 0.25, 0.5, 1, 1, 1], [1, 0.5, -0.5, 0.5, 0.5, 1]]
  },
  '3/8': {
    1: [[0.5, 0.5, 0.5], [0.75, 0.25, 0.5], [0.5, 0.75, 0.25]],
    2: [[0.5, 0.25, 0.25, 0.5], [0.25, 0.25, 0.5, 0.5], [-0.25, 0.25, 0.5, 0.5]],
    3: [[0.25, 0.25, 0.25, 0.25, 0.5], [0.5, -0.25, 0.25, 0.5]]
  },
  '6/8': {
    1: [[1.5, 1.5], [0.5, 0.5, 0.5, 1.5], [1.5, 0.5, 0.5, 0.5]],
    2: [[0.75, 0.25, 0.5, 1.5], [0.5, 0.25, 0.25, 0.5, 1.5], [1.5, -0.5, 0.5, 0.5]],
    3: [[0.25, 0.25, 0.5, 0.5, 0.5, 1], [0.5, -0.25, 0.25, 0.5, 0.5, 1]]
  }
};

function pickExamMeter(difficulty) {
  const pool = difficulty === 1 ? EXAM_METERS.slice(0, 3) : EXAM_METERS;
  return pool[randInt(0, pool.length - 1)];
}

/** 从指定拍号 id 集合中随机取一个拍号；集合为空或全非法时回退到入门拍号池。 */
function pickMeterFromPool(meterIds) {
  const meters = (meterIds || [])
    .map((id) => EXAM_METERS.find((item) => item.id === id))
    .filter(Boolean);
  if (!meters.length) return pickExamMeter(1);
  return meters[randInt(0, meters.length - 1)];
}

/** 从指定调号 id 集合中随机取一个调号；集合为空或全非法时回退到难度默认调号。 */
function pickKeyFromPool(keyIds, difficulty) {
  const keys = (keyIds || [])
    .map((id) => MELODY_KEYS[id])
    .filter(Boolean);
  if (!keys.length) return pickMelodyKey(difficulty);
  return keys[randInt(0, keys.length - 1)];
}

function examPatterns(meter, difficulty) {
  const groups = EXAM_BAR_PATTERNS[meter.id];
  return groups[1]
    .concat(difficulty >= 2 ? groups[2] : [])
    .concat(difficulty >= 3 ? groups[3] : []);
}

function genExamBars(difficulty, meter, barCount, allowRest = null) {
  let pool = examPatterns(meter, difficulty);
  // allowRest=false 时过滤掉含休止符（负时值）的节奏型；过滤后为空则回退全量池。
  if (allowRest === false) {
    const noRest = pool.filter((pattern) => pattern.every((duration) => duration > 0));
    if (noRest.length) pool = noRest;
  }
  const bars = [];
  for (let index = 0; index < barCount; index++) {
    if (index === barCount - 1) {
      bars.push(meter.denominator === 8 ? [meter.beatsPerBar] : meter.beatsPerBar === 4 ? [2, 2] : [meter.beatsPerBar]);
    } else {
      bars.push(pool[randInt(0, pool.length - 1)].slice());
    }
  }
  return bars;
}

function genExamRhythm(difficulty, barCount = 4, forcedMeterId = '', options = {}) {
  const tier = hasExamValue(options.tier) ? (RHYTHM_TIERS[options.tier] || RHYTHM_TIERS[3]) : null;
  // 时值复杂度：tier > options.level > 默认 difficulty（真题统一为 level 3）。
  const level = tier ? tier.level : (hasExamValue(options.level) ? options.level : difficulty);
  // 拍号：显式 forcedMeterId > options.meters/tier.meters 拍号池 > 默认 pickExamMeter。
  let meter;
  if (forcedMeterId) {
    meter = EXAM_METERS.find((item) => item.id === forcedMeterId) || pickExamMeter(difficulty);
  } else if (tier) {
    meter = pickMeterFromPool(tier.meters);
  } else if (Array.isArray(options.meters) && options.meters.length) {
    meter = pickMeterFromPool(options.meters);
  } else {
    meter = pickExamMeter(difficulty);
  }
  // 休止符：tier > options.allowRest > 默认不过滤（null）。
  const allowRest = tier ? tier.allowRest : (hasExamValue(options.allowRest) ? options.allowRest : null);
  // 速度：tier > options.bpm > 默认按 difficulty 递减。
  const bpm = tier ? tier.bpm : (hasExamValue(options.bpm) ? options.bpm : (difficulty === 1 ? 70 : difficulty === 2 ? 78 : 86));
  const bars = genExamBars(level, meter, barCount, allowRest);
  const beats = flattenBars(bars);
  return {
    type: 'rhythm',
    typeName: '节奏听写',
    beats,
    answerBeats: beats,
    answer: beats,
    answerText: `${meter.id} 拍 · ${beatsLabel(beats)}`,
    bars,
    barCount,
    meter: meter.id,
    meterNumerator: meter.numerator,
    meterDenominator: meter.denominator,
    beatsPerBar: meter.beatsPerBar,
    bpm,
    examSection: 'rhythm',
    examPoints: 3,
    repeatCount: 3,
    knowledgeKey: `exam-rhythm:d${difficulty}:meter${meter.id}:min${Math.min(...beats.map(Math.abs))}`,
    hint: '先选择时值或休止符，再在谱面上依次写入四小节节奏'
  };
}

function genExamMelody(difficulty, barCount = 8, forcedMeterId = '', forcedKeySignature = '', options = {}) {
  const tier = hasExamValue(options.tier) ? (MELODY_TIERS[options.tier] || MELODY_TIERS[3]) : null;
  const forcedKeyId = typeof forcedKeySignature === 'string'
    ? forcedKeySignature.replace(/\s+/g, '').replace('大调', '').toUpperCase()
    : forcedKeySignature && forcedKeySignature.id;
  // 调号：显式 forcedKeySignature > tier.keys / options.keys 调号池 > 难度默认调号。
  const key = forcedKeyId
    ? (MELODY_KEYS[forcedKeyId] || pickMelodyKey(difficulty))
    : tier
      ? pickKeyFromPool(tier.keys, difficulty)
      : Array.isArray(options.keys) && options.keys.length
        ? pickKeyFromPool(options.keys, difficulty)
        : pickMelodyKey(difficulty);
  // 拍号：显式 forcedMeterId > tier.meters / options.meters 拍号池 > 难度默认拍号。
  let meter;
  if (forcedMeterId) {
    meter = EXAM_METERS.find((item) => item.id === forcedMeterId) || pickExamMeter(difficulty);
  } else if (tier) {
    meter = pickMeterFromPool(tier.meters);
  } else if (Array.isArray(options.meters) && options.meters.length) {
    meter = pickMeterFromPool(options.meters);
  } else {
    meter = pickExamMeter(difficulty);
  }
  // 时值复杂度：tier.level > options.level > 默认 difficulty（真题统一 level 3）。
  const level = tier ? tier.level : (hasExamValue(options.level) ? options.level : difficulty);
  // 变化音：tier.chromatic > options.chromatic > 默认 'natural'（仅调号内变化音，保持历史行为）。
  const chromatic = tier ? tier.chromatic : (hasExamValue(options.chromatic) ? options.chromatic : 'natural');
  // 休止符：tier.allowRest > options.allowRest > 默认不过滤（null）。
  const allowRest = tier ? tier.allowRest : (hasExamValue(options.allowRest) ? options.allowRest : null);
  // 速度：tier.bpm > options.bpm > 默认按 difficulty 递增。
  const bpm = tier ? tier.bpm : (hasExamValue(options.bpm) ? options.bpm : (difficulty === 1 ? 70 : difficulty === 2 ? 78 : 86));
  const phraseTemplate = FOUR_PHRASE_MELODY_TEMPLATES[randInt(0, FOUR_PHRASE_MELODY_TEMPLATES.length - 1)];
  const phrases = buildMelodyPhrasePlan(barCount);
  const rhythmBars = buildPhraseRhythmBars(level, meter, barCount, phrases, allowRest);
  const durs = [];
  const midis = [];
  const spellings = [];
  const answer = [];
  const answerSpellings = [];
  // 调外变化音注入位：仅在「呼应句」内部选一个安全发声位，避开主题起音与终止式。
  const chromaticBar = chromatic === 'some' ? phrases[1].startBar - 1 : -1;
  let chromaticCount = 0;

  rhythmBars.forEach((rhythm, barIndex) => {
    const barNumber = barIndex + 1;
    const phraseIndex = phraseForBar(phrases, barNumber);
    const phrase = phrases[phraseIndex];
    const soundingCount = rhythm.filter((duration) => duration > 0).length;
    const contour = phraseContour(phraseTemplate, phrase, phraseIndex, barNumber);
    let degrees = smoothMelodyDegrees(fitContour(contour, soundingCount));
    const atPhraseEnd = barNumber === phrase.endBar;
    // 一升/一降调的变化音安排在第三句高潮的内部，不占用句尾的级进终止。
    if (phraseIndex === 2 && barNumber === phrase.startBar && key.id !== 'C' && degrees.length > 1) {
      const cadenceSlots = atPhraseEnd
        ? Math.min(degrees.length, MELODY_CADENCE_APPROACHES[phraseIndex].length)
        : 0;
      const expressiveSlots = Math.max(1, degrees.length - cadenceSlots);
      degrees[Math.min(expressiveSlots - 1, Math.floor(expressiveSlots / 2))] = key.id === 'G' ? 6 : 3;
    }
    // 每句最后两至三个音都按相邻音级解决：第一句开放，第二句落属音，
    // 第三句回落蓄势，第四句以 2—1—主音完成收束。
    if (atPhraseEnd && degrees.length) degrees = applyPhraseCadence(degrees, phraseIndex);
    const chromaticSlot = barIndex === chromaticBar ? pickChromaticSlot(key, degrees, soundingCount) : -1;
    let degreeIndex = 0;
    let lastNote = degreeNote(key, degrees[0]);
    rhythm.forEach((duration) => {
      if (duration > 0) {
        const slotIndex = degreeIndex;
        const alter = slotIndex === chromaticSlot ? 1 : 0;
        lastNote = degreeNote(key, degrees[slotIndex], alter);
        degreeIndex++;
        if (alter !== 0) chromaticCount++;
        answer.push(lastNote.midi);
        answerSpellings.push(lastNote.spelling);
      }
      durs.push(duration);
      midis.push(lastNote.midi);
      spellings.push(lastNote.spelling);
    });
  });

  return {
    type: 'melody',
    typeName: '单声部旋律听写',
    midis,
    durs,
    spellings,
    bars: rhythmBars,
    bpm,
    noteCount: answer.length,
    answer,
    answerText: `正确旋律见谱面（${answerSpellings.slice(0, 8).join(' ')} …）`,
    answerNotes: answerSpellings.join(' '),
    keySignature: key.id,
    keyName: key.name,
    meter: meter.id,
    meterNumerator: meter.numerator,
    meterDenominator: meter.denominator,
    beatsPerBar: meter.beatsPerBar,
    barCount,
    melodicStructure: 'A-A′-B-A″',
    phraseCount: 4,
    phrases,
    phraseEndDegrees: phrases.map((phrase) => phrase.cadenceDegree),
    restCount: durs.filter((duration) => duration < 0).length,
    chromaticCount,
    examSection: 'melody',
    examPoints: 4,
    repeatCount: 4,
    knowledgeKey: `exam-melody:d${difficulty}:key${key.id}:meter${meter.id}`,
    hint: `按第一句、第二句、第三句、第四句听辨，再写入${barCount}小节旋律`
  };
}

/**
 * 60 套模拟卷统一顺序：5 单音 → 2 三音组 → 2 五音组 →
 * 2 旋律音程 → 2 和声音程 → 1 组五连接 → 5 三和弦 →
 * 1 个四小节节奏 → 1 个八小节旋律，共 21 个作答单元、30 分。
 */
function generateExamMixed() {
  const standard = EXAM_STANDARD_LEVEL;
  const questions = [];
  const appendUnique = (count, factory, keyFactory) => {
    const seen = new Set();
    let attempts = 0;
    while (seen.size < count && attempts < count * 100) {
      attempts++;
      const question = factory();
      const key = keyFactory(question);
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push(question);
    }
  };
  appendUnique(5, () => ({
    ...genSingle(standard), examSection: 'single', examPoints: 1, repeatCount: 3
  }), (question) => `single:${question.midis[0]}`);
  appendUnique(2, () => ({
    ...genNoteGroup(standard, 3), examPoints: 0.5, repeatCount: 3
  }), practiceQuestionKey);
  appendUnique(2, () => ({
    ...genNoteGroup(standard, 5), examPoints: 1.5, repeatCount: 3
  }), practiceQuestionKey);
  const intervalKey = (question) => practiceQuestionKey(question);
  appendUnique(2, () => genExamInterval(standard, false), intervalKey);
  appendUnique(2, () => genExamInterval(standard, true), intervalKey);
  questions.push(genIntervalConnection(standard));
  appendUnique(5, () => genExamChord(standard), practiceQuestionKey);
  questions.push(genExamRhythm(standard));
  questions.push(genExamMelody(standard));
  return questions.map((question, index) => ({
    ...question,
    examOrder: index + 1,
    examTotal: MIXED_EXAM_COUNT
  }));
}

function hasExamValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function examCount(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function resolveExamPoints(section, item, itemCount, fallback) {
  if (item && hasExamValue(item.points)) return Number(item.points);
  if (hasExamValue(section.itemPoints)) return Number(section.itemPoints);
  if (hasExamValue(section.points) && itemCount > 0) return Number(section.points) / itemCount;
  return fallback;
}

function examSectionValue(section, item, key) {
  if (item && hasExamValue(item[key])) return item[key];
  if (section && hasExamValue(section[key])) return section[key];
  return undefined;
}

function withExamSectionMeta(question, section, item, itemCount) {
  const out = { ...question };
  const title = examSectionValue(section, item, 'title');
  const repeats = examSectionValue(section, item, 'repeats');
  const sourceSectionKey = examSectionValue(section, item, 'sourceSectionKey');
  const sourceSectionTitle = examSectionValue(section, item, 'sourceSectionTitle');
  const bars = examSectionValue(section, item, 'bars');
  const systems = examSectionValue(section, item, 'systems');
  const meter = examSectionValue(section, item, 'meter');
  const keySignature = examSectionValue(section, item, 'keySignature');

  out.examPoints = resolveExamPoints(section, item, itemCount, question.examPoints);
  if (hasExamValue(title)) {
    out.title = title;
    out.typeName = title;
  }
  if (hasExamValue(repeats)) {
    out.repeats = Number(repeats);
    out.repeatCount = Number(repeats);
  }

  ['answerMode', 'qualityRequired', 'cue', 'repeatSource'].forEach((key) => {
    const value = examSectionValue(section, item, key);
    if (hasExamValue(value)) out[key] = value;
  });

  out.sourceSectionKey = hasExamValue(sourceSectionKey)
    ? sourceSectionKey
    : item && hasExamValue(item.key)
      ? item.key
      : section.key || section.type || question.examSection || question.type;
  out.sourceSectionTitle = hasExamValue(sourceSectionTitle)
    ? sourceSectionTitle
    : hasExamValue(title)
      ? title
      : question.typeName;

  // bars 与题目内实际节奏数组同名，因此卷面规格使用 exam* 字段保存。
  if (hasExamValue(bars)) out.examBars = Number(bars);
  if (hasExamValue(systems)) {
    out.systems = Number(systems);
    out.examSystems = Number(systems);
  }
  if (hasExamValue(meter)) {
    out.meter = meter;
    out.examMeter = meter;
  }
  if (hasExamValue(keySignature)) {
    out.keySignature = keySignature;
    out.examKeySignature = keySignature;
  }
  return out;
}

function appendUniqueExamQuestions(target, seen, count, factory, keyFactory, label) {
  for (let index = 0; index < count; index++) {
    let accepted = null;
    let attempts = 0;
    while (!accepted && attempts++ < 500) {
      const question = factory(index);
      const key = keyFactory(question);
      if (seen.has(key)) continue;
      seen.add(key);
      accepted = question;
    }
    if (!accepted) throw new Error(`无法生成互不重复的${label}（需要 ${count} 题）`);
    target.push(accepted);
  }
}

function configuredItems(section) {
  return Array.isArray(section.items) && section.items.length ? section.items : null;
}

/**
 * 按省份卷面 sections 生成真题结构。题型数据与界面结构分离，
 * 便于各省份共用同一套五线谱作答组件。
 */
function generateExamFromSections(sections) {
  const standard = EXAM_STANDARD_LEVEL;
  const result = {
    singles: [],
    groups: [],
    intervals: [],
    connectionQuestion: null,
    chords: [],
    rhythmQuestions: [],
    melodyQuestions: []
  };
  const seen = {
    single: new Set(),
    group: new Set(),
    interval: new Set(),
    chord: new Set(),
    rhythm: new Set(),
    melody: new Set()
  };

  (Array.isArray(sections) ? sections : []).forEach((section) => {
    if (!section) return;
    const key = section.key || section.type;

    if (key === 'single') {
      const count = examCount(section.count, 1);
      const singleOptions = {};
      // 省份卷面可用 tier（1/2/3）一键套用音域+变化音分层，也可单独指定 range/chromatic。
      if (hasExamValue(section.tier)) {
        const tier = SINGLE_TIERS[section.tier] || SINGLE_TIERS[1];
        singleOptions.range = { low: tier.low, high: tier.high };
        singleOptions.chromatic = tier.chromatic;
      }
      if (hasExamValue(section.range)) singleOptions.range = section.range;
      if (hasExamValue(section.chromatic)) singleOptions.chromatic = section.chromatic;
      appendUniqueExamQuestions(result.singles, seen.single, count, () => (
        withExamSectionMeta({ ...genSingle(standard, singleOptions), examSection: 'single' }, section, null, count)
      ), practiceQuestionKey, '单音');
      return;
    }

    if (key === 'group') {
      const sizes = Array.isArray(section.groupSizes) && section.groupSizes.length
        ? section.groupSizes.map((size) => {
          const parsed = Number(size);
          return parsed === 4 ? 4 : parsed === 5 ? 5 : 3;
        })
        : [3];
      const count = examCount(section.count, sizes.length);
      // 省份卷面可用 tier（1/2/3）一键套用音域+跳进+变化音分层，也可单独指定 baseMin/baseMax/leapMax/chromatic。
      const groupOptions = {};
      if (hasExamValue(section.tier)) groupOptions.tier = section.tier;
      if (hasExamValue(section.baseMin)) groupOptions.baseMin = section.baseMin;
      if (hasExamValue(section.baseMax)) groupOptions.baseMax = section.baseMax;
      if (hasExamValue(section.leapMax)) groupOptions.leapMax = section.leapMax;
      if (hasExamValue(section.chromatic)) groupOptions.chromatic = section.chromatic;
      appendUniqueExamQuestions(result.groups, seen.group, count, (index) => (
        withExamSectionMeta(genNoteGroup(standard, sizes[index % sizes.length], groupOptions), section, null, count)
      ), practiceQuestionKey, '音组');
      return;
    }

    if (key === 'interval') {
      const requestedTotal = examCount(section.count, 1);
      const hasMelodic = hasExamValue(section.melodicCount);
      const hasHarmonic = hasExamValue(section.harmonicCount);
      let melodicCount = hasMelodic ? examCount(section.melodicCount, 0) : 0;
      let harmonicCount = hasHarmonic ? examCount(section.harmonicCount, 0) : 0;
      if (!hasMelodic && !hasHarmonic) {
        if (section.harmonic === true) harmonicCount = requestedTotal;
        else if (section.harmonic === false) melodicCount = requestedTotal;
        else {
          melodicCount = Math.ceil(requestedTotal / 2);
          harmonicCount = requestedTotal - melodicCount;
        }
      } else if (!hasMelodic && requestedTotal > harmonicCount) {
        melodicCount = requestedTotal - harmonicCount;
      } else if (!hasHarmonic && requestedTotal > melodicCount) {
        harmonicCount = requestedTotal - melodicCount;
      }
      const total = melodicCount + harmonicCount;
      // 省份卷面可用 tier（1/2/3）一键套用「音程种类+根音音域+变化音」分层，也可单独指定 semitones/range/chromatic。
      const intervalOptions = {};
      if (hasExamValue(section.tier)) intervalOptions.tier = section.tier;
      if (Array.isArray(section.semitones) && section.semitones.length) intervalOptions.semitones = section.semitones;
      if (hasExamValue(section.range)) intervalOptions.range = section.range;
      if (hasExamValue(section.chromatic)) intervalOptions.chromatic = section.chromatic;
      appendUniqueExamQuestions(result.intervals, seen.interval, melodicCount, () => (
        withExamSectionMeta(genExamInterval(standard, false, intervalOptions), section, null, total)
      ), practiceQuestionKey, '旋律音程');
      appendUniqueExamQuestions(result.intervals, seen.interval, harmonicCount, () => (
        withExamSectionMeta(genExamInterval(standard, true, intervalOptions), section, null, total)
      ), practiceQuestionKey, '和声音程');
      return;
    }

    if (key === 'connection' || key === 'intervalConnection') {
      // 省份卷面可用 tier（1/2/3）一键套用「音程种类+根音音域+变化音」分层，也可单独指定 semitones/range/chromatic。
      const connOptions = { intervalCount: examCount(section.intervalCount, 5) };
      if (hasExamValue(section.tier)) connOptions.tier = section.tier;
      if (Array.isArray(section.semitones) && section.semitones.length) connOptions.semitones = section.semitones;
      if (hasExamValue(section.range)) connOptions.range = section.range;
      if (hasExamValue(section.chromatic)) connOptions.chromatic = section.chromatic;
      const question = genIntervalConnection(standard, connOptions);
      result.connectionQuestion = withExamSectionMeta(question, section, null, 1);
      return;
    }

    if (key === 'chord' || key === 'chordQuality' || key === 'chordPitch') {
      const count = examCount(section.count, 1);
      // 省份卷面可用 tier（1/2/3）一键套用「和弦种类+转位+根音音域+变化音」分层，也可单独指定 qualities/inversions/range/chromatic。
      const chordOptions = {};
      if (hasExamValue(section.tier)) chordOptions.tier = section.tier;
      if (Array.isArray(section.qualities) && section.qualities.length) chordOptions.qualities = section.qualities;
      if (Array.isArray(section.inversions) && section.inversions.length) chordOptions.inversions = section.inversions;
      if (hasExamValue(section.range)) chordOptions.range = section.range;
      if (hasExamValue(section.chromatic)) chordOptions.chromatic = section.chromatic;
      appendUniqueExamQuestions(result.chords, seen.chord, count, () => {
        const question = genExamChord(standard, chordOptions);
        question.chordTaskType = key;
        if (key === 'chordQuality' && !hasExamValue(section.qualityRequired)) {
          question.qualityRequired = true;
        }
        return withExamSectionMeta(question, section, null, count);
      }, practiceQuestionKey, '和弦');
      return;
    }

    if (key === 'rhythm') {
      const items = configuredItems(section);
      const count = items ? items.length : examCount(section.count, 1);
      // 省份卷面可用 tier（1/2/3）一键套用「拍号+时值复杂度+休止符+速度」分层，也可单独指定 level/meters/allowRest/bpm。
      const rhythmOptions = {};
      if (hasExamValue(section.tier)) rhythmOptions.tier = section.tier;
      if (hasExamValue(section.level)) rhythmOptions.level = section.level;
      if (Array.isArray(section.meters) && section.meters.length) rhythmOptions.meters = section.meters;
      if (hasExamValue(section.allowRest)) rhythmOptions.allowRest = section.allowRest;
      if (hasExamValue(section.bpm)) rhythmOptions.bpm = section.bpm;
      appendUniqueExamQuestions(result.rhythmQuestions, seen.rhythm, count, (index) => {
        const item = items ? items[index] : null;
        const spec = item || section;
        const bars = examCount(spec.bars, examCount(section.bars, 4));
        const meter = spec.meter || section.meter || '';
        return withExamSectionMeta(genExamRhythm(standard, bars, meter, rhythmOptions), section, item, count);
      }, practiceQuestionKey, '节奏');
      return;
    }

    if (key === 'melody') {
      const items = configuredItems(section);
      const count = items ? items.length : examCount(section.count, 1);
      // 省份卷面可用 tier（1/2/3）一键套用「调号+拍号+时值复杂度+变化音+休止+速度」分层，
      // 也可单独指定 keys/meters/level/chromatic/allowRest/bpm。
      const melodyOptions = {};
      if (hasExamValue(section.tier)) melodyOptions.tier = section.tier;
      if (Array.isArray(section.keys) && section.keys.length) melodyOptions.keys = section.keys;
      if (Array.isArray(section.meters) && section.meters.length) melodyOptions.meters = section.meters;
      if (hasExamValue(section.level)) melodyOptions.level = section.level;
      if (hasExamValue(section.chromatic)) melodyOptions.chromatic = section.chromatic;
      if (hasExamValue(section.allowRest)) melodyOptions.allowRest = section.allowRest;
      if (hasExamValue(section.bpm)) melodyOptions.bpm = section.bpm;
      appendUniqueExamQuestions(result.melodyQuestions, seen.melody, count, (index) => {
        const item = items ? items[index] : null;
        const spec = item || section;
        const bars = examCount(spec.bars, examCount(section.bars, 8));
        const meter = spec.meter || section.meter || '';
        const keySignature = spec.keySignature || section.keySignature || '';
        return withExamSectionMeta(
          genExamMelody(standard, bars, meter, keySignature, melodyOptions),
          section,
          item,
          count
        );
      }, practiceQuestionKey, '旋律');
      return;
    }

    throw new Error(`未知考试题型: ${key}`);
  });

  return result;
}

/** 广西统考卷面：5 单音、4 音组、4 音程、4 和弦、4 小节节奏、4 小节旋律。 */
function generateExamGuangxi() {
  const standard = EXAM_STANDARD_LEVEL;
  const questions = [];
  const appendUnique = (count, factory, keyFactory) => {
    const seen = new Set();
    let attempts = 0;
    while (seen.size < count && attempts < count * 100) {
      attempts++;
      const question = factory();
      const key = keyFactory(question);
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push(question);
    }
  };
  appendUnique(5, () => ({ ...genSingle(standard), examSection: 'single', examPoints: 0.5, repeatCount: 3 }), (q) => `single:${q.midis[0]}`);
  appendUnique(2, () => ({ ...genNoteGroup(standard, 3), examPoints: 0.5, repeatCount: 3 }), practiceQuestionKey);
  appendUnique(2, () => ({ ...genNoteGroup(standard, 5), examPoints: 1.5, repeatCount: 3 }), practiceQuestionKey);
  const intervalKey = (q) => practiceQuestionKey(q);
  appendUnique(2, () => ({ ...genExamInterval(standard, false), examPoints: 0.5 }), intervalKey);
  appendUnique(2, () => ({ ...genExamInterval(standard, true), examPoints: 0.5 }), intervalKey);
  appendUnique(4, () => ({ ...genExamChord(standard), examPoints: 0.75 }), practiceQuestionKey);
  questions.push({ ...genExamRhythm(standard, 8), examPoints: 5, repeatCount: 4 });
  questions.push({ ...genExamMelody(standard, 8), barCount: 8, examPoints: 13.5, repeatCount: 6 });
  return questions.map((question, index) => ({ ...question, examOrder: index + 1, examTotal: questions.length }));
}

/** 江苏卷面结构：音组、音程与和弦题量更大，节奏和旋律各有两套指定拍号。 */
function generateExamJiangsu() {
  const standard = EXAM_STANDARD_LEVEL;
  const unique = (count, factory, keyFactory) => {
    const out = []; const seen = new Set(); let attempts = 0;
    while (out.length < count && attempts++ < count * 100) {
      const q = factory(); const key = keyFactory(q);
      if (!seen.has(key)) { seen.add(key); out.push(q); }
    }
    return out;
  };
  const singles = unique(5, () => ({ ...genSingle(standard), examPoints: 0.5, repeatCount: 3 }), (q) => `single:${q.midis[0]}`);
  const groups = unique(3, () => ({ ...genNoteGroup(standard, 3), examPoints: 0.5, repeatCount: 3 }), practiceQuestionKey)
    .concat(unique(2, () => ({ ...genNoteGroup(standard, 5), examPoints: 4, repeatCount: 3 }), practiceQuestionKey));
  const intervalKey = (q) => practiceQuestionKey(q);
  const intervals = unique(2, () => ({ ...genExamInterval(standard, false), examPoints: 1.5 }), intervalKey)
    .concat(unique(2, () => ({ ...genExamInterval(standard, true), examPoints: 1.5 }), intervalKey))
    .concat(unique(4, () => ({ ...genExamInterval(standard, true), examPoints: 2 }), intervalKey));
  const chords = unique(6, () => ({ ...genExamChord(standard), examPoints: 3, repeatCount: 3 }), practiceQuestionKey);
  const makeRhythm = (meterId) => {
    const meter = EXAM_METERS.find((item) => item.id === meterId);
    const bars = genExamBars(standard, meter, 4);
    const beats = flattenBars(bars);
    return { ...genExamRhythm(standard), bars, beats, answerBeats: beats, barCount: 4, meter: meter.id, meterNumerator: meter.numerator, meterDenominator: meter.denominator, beatsPerBar: meter.beatsPerBar, examPoints: 12, repeatCount: 4 };
  };
  const rhythmQuestions = [makeRhythm('2/4'), makeRhythm('3/4')];
  const melodyQuestions = [
    { ...genExamMelody(standard, 4, '3/4'), barCount: 4, examPoints: 16, repeatCount: 5 },
    { ...genExamMelody(standard, 4, '6/8'), barCount: 4, examPoints: 16, repeatCount: 5 }
  ];
  return { singles, groups, intervals, chords, rhythmQuestions, melodyQuestions };
}

function genPracticeMelody(difficulty) {
  const question = genExamMelody(difficulty);
  return {
    ...question,
    typeName: '旋律听辨',
    repeatCount: 4,
    hint: '辨认拍号与调号，按四个两小节乐句写出八小节单声部旋律'
  };
}

const GENERATORS = {
  single: genSingle,
  interval: genInterval,
  chord: genChord,
  rhythm: genRhythm,
  melody: genPracticeMelody
};

/** 按真题统一标准生成一题。 */
function generate(type) {
  if (!GENERATORS[type]) throw new Error(`未知题型: ${type}`);
  return GENERATORS[type](EXAM_STANDARD_LEVEL);
}

function weightedType(types, profile = {}) {
  const weights = types.map((type) => {
    const item = profile[type] || {};
    const errorRate = Number.isFinite(item.errorRate)
      ? item.errorRate
      : item.attempts
        ? ((item.wrong || 0) / item.attempts) * 100
        : item.wrong ? Math.min(90, 25 + item.wrong * 5) : 25;
    return Math.max(10, errorRate + 10);
  });
  let cursor = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < types.length; i++) {
    cursor -= weights[i];
    if (cursor <= 0) return types[i];
  }
  return types[types.length - 1];
}

/**
 * 练习题去重键：同一专项练习中，答案和关键题型参数完全一致才视为重复。
 * 和声音程/和弦按同时发声的音高集合比较，避免只是音符顺序不同却重复出现。
 */
function practiceQuestionKey(question) {
  const midis = (question.midis || []).slice();
  if (question.harmonic || question.type === 'chord') midis.sort((a, b) => a - b);
  return JSON.stringify({
    type: question.type,
    harmonic: !!question.harmonic,
    midis,
    durs: question.durs || [],
    beats: question.beats || [],
    bpm: question.bpm || 0,
    meter: question.meter || '',
    keySignature: question.keySignature || ''
  });
}

/** 按真题统一标准生成一组题。 */
function generateSet(type, count = 10, profile = {}) {
  const allTypes = Object.keys(GENERATORS);
  const questions = [];
  if (type === 'mixed') {
    return generateExamMixed();
  }
  if (type === 'adaptive') {
    // 先覆盖每个题型，再把剩余题量倾斜给错率较高的模块。
    const seen = new Set();
    const append = (question) => {
      const key = practiceQuestionKey(question);
      if (seen.has(key)) return false;
      seen.add(key);
      questions.push(question);
      return true;
    };
    allTypes.slice(0, Math.min(count, allTypes.length)).forEach((itemType) => append(generate(itemType)));
    let attempts = 0;
    const maxAttempts = Math.max(300, count * 120);
    while (questions.length < count && attempts++ < maxAttempts) {
      append(generate(weightedType(allTypes, profile)));
    }
    // 极端随机碰撞时轮询所有题型继续找题，但绝不以重复题凑数。
    attempts = 0;
    while (questions.length < count && attempts++ < maxAttempts) {
      append(generate(allTypes[attempts % allTypes.length]));
    }
    if (questions.length < count) {
      throw new Error(`无法生成 ${count} 道互不重复的智能强化题`);
    }
    return shuffle(questions);
  }
  // 专项练习一组题不允许重复。单音题的键就是 MIDI，因此 10 题一定是 10 个不同音高。
  const seen = new Set();
  let attempts = 0;
  const maxAttempts = Math.max(100, count * 80);
  while (questions.length < count && attempts < maxAttempts) {
    attempts++;
    const question = generate(type);
    const key = practiceQuestionKey(question);
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(question);
  }
  if (questions.length < count) {
    throw new Error(`无法生成 ${count} 道互不重复的${type}专项题`);
  }
  return questions;
}

module.exports = {
  generate,
  generateSet,
  generateExamFromSections,
  generateExamGuangxi,
  generateExamJiangsu,
  MIXED_EXAM_COUNT,
  EXAM_METERS,
  EXAM_STANDARD_LEVEL,
  SINGLE_TIERS,
  GROUP_TIERS,
  INTERVAL_TIERS,
  CHORD_TIERS,
  RHYTHM_TIERS,
  MELODY_TIERS,
  CONNECTION_TIERS,
  NATURAL_PCS
};
