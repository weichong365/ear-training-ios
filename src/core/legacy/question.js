

const {
  INTERVALS, CHORDS,
  randInt, shuffle, byLevel, midiToName
} = require('./theory');
const { RHYTHM_BANK_2025 } = require('./rhythm-bank-2025');
const { MELODY_BANK_2025 } = require('./melody-bank-2025');


const EXAM_STANDARD_LEVEL = 3;


const RANGE = {
  1: { low: 55, high: 81 },
  2: { low: 55, high: 81 },
  3: { low: 55, high: 81 }
};


const SAMPLE_MIDI_MIN = 55;
const SAMPLE_MIDI_MAX = 81;


const CHROMATIC_RATIO_LOW = 0.15;
const CHROMATIC_RATIO_SOME = 0.30;


const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];


const SINGLE_ALTERED_POOL = [61, 63, 66, 68, 70, 73, 75, 78, 80];


const CHORD_ROOT_PCS = [0, 2, 4, 5, 7, 9, 11];


const CHORD_ROOT_SPELLING = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };


const SPELL_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SPELL_LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SPELL_NATURAL_PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };


const SHARP_SPELLING_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];


function midiToSpelling(midi) {
  return `${SHARP_SPELLING_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}


function pickChromaticNote(chromatic, low, high) {
  if (chromatic === 'natural') return pickNatural(low, high);
  if (chromatic === 'any') return randInt(low, high);
  const ratio = chromatic === 'low' ? CHROMATIC_RATIO_LOW : CHROMATIC_RATIO_SOME;
  if (Math.random() >= ratio) return pickNatural(low, high);
  const blacks = [];
  for (let midi = low; midi <= high; midi++) {
    if (!NATURAL_PCS.includes(midi % 12)) blacks.push(midi);
  }
  return blacks.length ? blacks[randInt(0, blacks.length - 1)] : pickNatural(low, high);
}


function pickChordRoot(low, high, excludePcs) {
  const candidates = [];
  for (let midi = low; midi <= high; midi++) {
    const pc = midi % 12;
    if (CHORD_ROOT_PCS.includes(pc) && !(excludePcs && excludePcs.includes(pc))) candidates.push(midi);
  }
  if (!candidates.length) {
    for (let midi = low; midi <= high; midi++) {
      if (CHORD_ROOT_PCS.includes(midi % 12)) candidates.push(midi);
    }
  }
  return candidates[randInt(0, candidates.length - 1)];
}

const SINGLE_TIERS = {
  1: { low: 55, high: 81, chromatic: 'natural' },
  2: { low: 55, high: 81, chromatic: 'low' },
  3: { low: 55, high: 81, chromatic: 'some' }
};


const GROUP_TIERS = {
  1: { low: 55, high: 81, chromatic: 'natural' },
  2: { low: 55, high: 81, chromatic: 'low' },
  3: { low: 55, high: 81, chromatic: 'some' }
};


const INTERVAL_TIERS = {
  1: { semitones: [2, 4, 5, 7, 12], low: 55, high: 81, chromatic: 'natural' },
  2: { semitones: [2, 3, 4, 5, 7, 8, 9, 12], low: 55, high: 81, chromatic: 'low' },
  3: { semitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], low: 55, high: 81, chromatic: 'some' }
};


const CHORD_TIERS = {
  1: { qualities: ['major', 'minor'], inversions: [0], low: 55, high: 81, chromatic: 'natural' },
  2: { qualities: ['major', 'minor', 'dim', 'aug'], inversions: [0, 1, 2], low: 55, high: 81, chromatic: 'low' },
  3: { qualities: ['major', 'minor', 'dim', 'aug'], inversions: [0, 1, 2], low: 55, high: 81, chromatic: 'some' }
};


const RHYTHM_TIERS = {
  1: { level: 1, meters: ['2/4', '3/4', '4/4'], allowRest: true, bpm: 66 },
  2: { level: 2, meters: ['2/4', '3/4', '4/4', '6/8'], allowRest: true, bpm: 76 },
  3: { level: 3, meters: ['2/4', '3/4', '4/4', '3/8', '6/8'], allowRest: true, bpm: 86 }
};

// PCM 渲染器统一按“四分音符长度”计算：3/8 的 ♪=96 等于内部 ♩=48；
// 6/8 的附点四分音符=52 等于内部 ♩=78。
function rhythmPlaybackBpm(meterId, fallback = 72) {
  return { '2/4': 64, '4/4': 60, '3/8': 48, '6/8': 78 }[meterId] || fallback;
}


const MELODY_TIERS = {
  1: { keys: ['C'], meters: ['2/4', '3/4', '4/4'], level: 1, chromatic: 'natural', allowRest: false, bpm: 70 },
  2: { keys: ['C', 'G', 'F'], meters: ['2/4', '3/4', '4/4', '6/8'], level: 2, chromatic: 'natural', allowRest: true, bpm: 78 },
  3: { keys: ['C', 'G', 'F'], meters: ['2/4', '3/4', '4/4', '3/8', '6/8'], level: 3, chromatic: 'some', allowRest: true, bpm: 86 }
};


const CONNECTION_TIERS = {
  1: { semitones: [2, 4, 5, 7, 12], low: 55, high: 81, chromatic: 'natural' },
  2: { semitones: [2, 3, 4, 5, 7, 8, 9, 12], low: 55, high: 81, chromatic: 'low' },
  3: { semitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], low: 55, high: 81, chromatic: 'some' }
};


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


function pickNatural(low, high) {
  const candidates = [];
  for (let midi = low; midi <= high; midi++) {
    if (NATURAL_PCS.includes(midi % 12)) candidates.push(midi);
  }
  return candidates[randInt(0, candidates.length - 1)];
}


function genSingle(difficulty, options = {}) {
  const fallback = RANGE[difficulty] || RANGE[3];
  const range = options.range || fallback;
  const chromatic = options.chromatic || 'low';
  const { low, high } = range;

  const midi = hasExamValue(options.midi)
    ? Number(options.midi)
    : pickChromaticNote(chromatic, low, high);
  return {
    type: 'single',
    typeName: '单音听记',
    midis: [midi],
    answer: midi,
    answerText: midiToName(midi),
    knowledgeKey: `single:${midi}`,
    hint: '听音后，在五线谱上写出你听到的音；提交后可用键盘复盘'
  };
}


function genSingleSet(count, alteredCount, options = {}) {
  const standard = EXAM_STANDARD_LEVEL;
  const { low, high } = options.range || RANGE[standard] || RANGE[3];
  const alteredSafe = Math.max(0, Math.min(count, alteredCount));
  const naturalPool = [];
  for (let m = low; m <= high; m++) if (NATURAL_PCS.includes(m % 12)) naturalPool.push(m);
  const alteredPool = SINGLE_ALTERED_POOL.filter((m) => m >= low && m <= high);
  const used = new Set();
  const take = (pool) => {
    const avail = pool.filter((m) => !used.has(m));
    if (!avail.length) return null;
    const m = avail[randInt(0, avail.length - 1)];
    used.add(m);
    return m;
  };
  const out = [];
  for (let i = 0; i < count - alteredSafe; i++) {
    const m = take(naturalPool);
    if (m == null) throw new Error('单音自然音池不足');
    out.push(genSingle(standard, { ...options, midi: m }));
  }
  for (let i = 0; i < alteredSafe; i++) {
    const m = take(alteredPool);
    if (m == null) throw new Error('单音变化音池不足');
    out.push(genSingle(standard, { ...options, midi: m }));
  }
  return shuffle(out);
}


function genInterval(difficulty, forcedHarmonic = null, options = {}) {

  if (forcedHarmonic === null && Math.random() < 0.36) {
    return genNoteGroup(difficulty, Math.random() < 0.58 ? 3 : 5);
  }
  const tier = hasExamValue(options.tier) ? (INTERVAL_TIERS[options.tier] || INTERVAL_TIERS[1]) : null;


  let pool;
  if (tier) {
    pool = INTERVALS.filter((i) => tier.semitones.includes(i.semitones));
  } else if (Array.isArray(options.semitones) && options.semitones.length) {
    pool = INTERVALS.filter((i) => options.semitones.includes(i.semitones));
  } else {
    pool = byLevel(INTERVALS, difficulty);
  }
  const target = pool[randInt(0, pool.length - 1)];


  const range = options.range || (tier ? { low: tier.low, high: tier.high } : RANGE[difficulty]);
  const { low, high } = range;
  const rootHigh = Math.max(low, high - target.semitones);


  const chromatic = hasExamValue(options.chromatic) ? options.chromatic : (tier ? tier.chromatic : 'low');
  const root = pickChromaticNote(chromatic, low, rootHigh);

  const harmonic = typeof forcedHarmonic === 'boolean'
    ? forcedHarmonic
    : Math.random() < 0.4;
  const midis = [root, root + target.semitones];

  return {
    type: 'interval',
    typeName: harmonic ? '和声音程听记' : '旋律音程听记',
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


const INVERSION_NAMES = ['原位', '第一转位', '第二转位', '第三转位'];


function invertOffsets(offsets, inv) {
  const arr = offsets.slice();
  for (let i = 0; i < inv; i++) arr.push(arr.shift() + 12);
  return arr;
}


function rootSpellingName(root) {
  return CHORD_ROOT_SPELLING[((root % 12) + 12) % 12] || midiToName(root).replace(/\d+$/, '');
}


function spellChord(root, offsets, inversion) {
  const count = offsets.length;
  const rootLetter = (CHORD_ROOT_SPELLING[((root % 12) + 12) % 12] || 'C')[0];
  const rootLetterIndex = SPELL_LETTER_INDEX[rootLetter];
  const voiced = invertOffsets(offsets, inversion);
  const spellings = [];
  for (let i = 0; i < count; i++) {
    const toneIndex = (i + inversion) % count;
    const letter = SPELL_LETTERS[(rootLetterIndex + 2 * toneIndex) % 7];
    const naturalPc = SPELL_NATURAL_PCS[letter];
    const midi = root + voiced[i];
    const midiPc = ((midi % 12) + 12) % 12;
    let diff = midiPc - naturalPc;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    const acc = diff === 1 ? '#' : diff === -1 ? 'b' : diff === 2 ? '##' : diff === -2 ? 'bb' : '';

    spellings.push(`${letter}${acc}${Math.floor((midi - diff) / 12) - 1}`);
  }
  return spellings;
}


function spellingsToChordName(spellings) {
  if (!Array.isArray(spellings) || spellings.length < 3 || spellings.length > 4) return null;
  const parsed = spellings.map((s) => {
    const m = String(s || '').match(/^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/);
    if (!m) return null;
    const letter = m[1];
    const accStr = m[2] || '';
    const acc = accStr.startsWith('b') ? -accStr.length : accStr.length;
    const octave = Number(m[3]);
    const naturalPc = SPELL_NATURAL_PCS[letter];
    const midi = (octave + 1) * 12 + naturalPc + acc;
    return { letter, letterIdx: SPELL_LETTER_INDEX[letter], midi, accStr };
  });
  if (parsed.some((p) => !p)) return null;
  const sorted = parsed.slice().sort((a, b) => a.midi - b.midi);
  const size = sorted.length;
  const letterIdxs = sorted.map((p) => p.letterIdx);

  const CHORD_STRUCTURES = {
    major:    { offsets: [0, 4, 7], letters: [0, 2, 4], name: '大三' },
    minor:    { offsets: [0, 3, 7], letters: [0, 2, 4], name: '小三' },
    aug:      { offsets: [0, 4, 8], letters: [0, 2, 4], name: '增三' },
    dim:      { offsets: [0, 3, 6], letters: [0, 2, 4], name: '减三' },
    dom7:     { offsets: [0, 4, 7, 10], letters: [0, 2, 4, 6], name: '属七' },
    maj7:     { offsets: [0, 4, 7, 11], letters: [0, 2, 4, 6], name: '大七' },
    min7:     { offsets: [0, 3, 7, 10], letters: [0, 2, 4, 6], name: '小七' },
    halfdim7: { offsets: [0, 3, 6, 10], letters: [0, 2, 4, 6], name: '半减七' },
    dim7:     { offsets: [0, 3, 6, 9],  letters: [0, 2, 4, 6], name: '减七' },
    minmaj7:  { offsets: [0, 3, 7, 11], letters: [0, 2, 4, 6], name: '小大七' }
  };
  for (const chordId in CHORD_STRUCTURES) {
    const struct = CHORD_STRUCTURES[chordId];
    if (struct.offsets.length !== size) continue;
    for (let candidate = 0; candidate < size; candidate++) {
      const rootMidi = sorted[candidate].midi;
      const rootLetterIdx = letterIdxs[candidate];
      let match = true;
      for (let i = 1; i < size; i++) {
        const idx = (candidate + i) % size;
        const expectedOffset = struct.offsets[i];
        const expectedLetter = (rootLetterIdx + struct.letters[i]) % 7;
        let midiDiff = sorted[idx].midi - rootMidi;
        while (midiDiff < 0) midiDiff += 12;
        while (midiDiff >= 12) midiDiff -= 12;
        if (midiDiff !== expectedOffset || letterIdxs[idx] !== expectedLetter) { match = false; break; }
      }
      if (match) {

        const lowLetterRel = ((letterIdxs[0] - rootLetterIdx) % 7 + 7) % 7;
        const inversion = struct.letters.indexOf(lowLetterRel);
        if (inversion < 0) continue;

        const ce = sorted[candidate];
        return {
          rootName: ce.letter + ce.accStr,
          chordId,
          chordName: struct.name,
          inversion,
          inversionName: INVERSION_NAMES[inversion]
        };
      }
    }
  }
  return null;
}


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


function genChord(difficulty, options = {}) {
  const tier = hasExamValue(options.tier) ? (CHORD_TIERS[options.tier] || CHORD_TIERS[1]) : null;
  const explicit = tier || Array.isArray(options.qualities) || Array.isArray(options.inversions)
    || hasExamValue(options.range) || hasExamValue(options.chromatic);

  let target;
  let inversion;
  let range;

  if (explicit) {

    let pool;
    if (tier) pool = CHORDS.filter((c) => tier.qualities.includes(c.id));
    else if (Array.isArray(options.qualities) && options.qualities.length) pool = CHORDS.filter((c) => options.qualities.includes(c.id));
    else pool = CHORDS.filter((c) => c.group === 'triad');
    target = pool[randInt(0, pool.length - 1)];

    let inversions;
    if (tier) inversions = tier.inversions;
    else if (Array.isArray(options.inversions) && options.inversions.length) inversions = options.inversions;
    else inversions = [0, 1, 2];

    inversions = inversions.filter((inv) => inv < target.offsets.length);
    if (!inversions.length) inversions = [0];
    inversion = inversions[randInt(0, inversions.length - 1)];

    range = options.range || (tier ? { low: tier.low, high: tier.high } : RANGE[difficulty]);
  } else {

    const triads = CHORDS.filter((chord) => chord.group === 'triad');
    const basicPool = triads.filter((chord) => chord.id === 'major' || chord.id === 'minor');
    const weightedTargetId = difficulty === 1 ? '' : weightedValue(PRACTICE_CHORD_QUALITY_WEIGHTS);
    target = difficulty === 1
      ? basicPool[randInt(0, basicPool.length - 1)]
      : triads.find((chord) => chord.id === weightedTargetId);
    inversion = difficulty === 1 ? 0 : weightedValue(PRACTICE_CHORD_INVERSION_WEIGHTS);
    range = RANGE[difficulty];
  }

  const { low, high } = range;
  const voiced = invertOffsets(target.offsets, inversion);
  const maxOffset = Math.max(...voiced);
  const rootHigh = Math.max(low, high - maxOffset);

  const root = target.id === 'aug'
    ? pickChordRoot(low, rootHigh, [11])
    : pickChordRoot(low, rootHigh);
  const midis = voiced.map((o) => root + o);
  const spellings = spellChord(root, target.offsets, inversion);
  const size = target.offsets.length;
  const rootName = rootSpellingName(root);

  return {
    type: 'chord',
    typeName: size === 4 ? '七和弦听记' : '和弦听记',
    midis,
    spellings,
    rootPc: root % 12,
    rootName,
    chordName: target.name,
    chordSymbol: target.symbol,
    inversion,
    inversionName: INVERSION_NAMES[inversion],
    chordSize: size,
    answer: [root % 12, target.name, inversion],
    answerText: `${rootName}${target.name}和弦 · ${INVERSION_NAMES[inversion]}`,
    knowledgeKey: `chord:${target.id}:${inversion}`,
    hint: size === 4 ? '听七和弦后，在五线谱同一谱格中叠写四个音' : '听三和弦后，在五线谱同一谱格中叠写三个音'
  };
}




const CELLS_1 = [[1], [0.5, 0.5]];

const CELLS_1_MID = [...CELLS_1, [0.25, 0.25, 0.5], [0.5, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25]];

const CELLS_2 = {
  1: [[2], [1, 1], [1, 0.5, 0.5], [0.5, 0.5, 1]],
  2: [[2], [1, 1], [1.5, 0.5], [0.5, 1.5], [1, 0.5, 0.5], [0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5], [1, -1], [-0.5, 0.5, 1]],
  3: [[2], [1.5, 0.5], [0.5, 1.5], [1, 0.5, 0.5], [0.5, 0.25, 0.25, 1], [1, 0.25, 0.25, 0.5], [0.5, 0.5, 0.5, 0.5], [0.25, 0.25, 0.25, 0.25, 1], [1, -0.5, 0.5], [-0.5, 0.5, 0.5, 0.5], [0.5, -0.5, 0.5, 0.5]]
};


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

function rhythmSymbolKinds(beats) {
  const kinds = new Set();
  for (const b of beats) {
    const value = Math.round(Math.abs(b) * 1000);
    kinds.add(b < 0 ? -value : value);
  }
  return kinds.size;
}

function rhythmKey(beats) {
  return beats.join(',');
}


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
    typeName: '节奏听记',
    beats: target,
    bpm: difficulty === 1 ? 70 : difficulty === 2 ? 80 : 92,
    options: shuffled.map((x) => x.b),
    answer: answerIndex,
    answerText: `选项 ${'ABCD'[answerIndex]}（${beatsLabel(target)}）`,
    barCount,
    knowledgeKey: `rhythm:d${difficulty}:bars${barCount}:rest${target.some((b) => b < 0) ? 1 : 0}:min${Math.min(...target.map(Math.abs))}`,
    hint: `听 ${barCount} 小节节奏，选出你听到的谱面`
  };
}

function genRhythm(difficulty, options = {}) {
  const question = genExamRhythm(difficulty, 6, { ...options, useBank: true });
  return {
    ...question,
    typeName: '节奏听记',
    repeatCount: 3,
    hint: '辨认拍号，并在五线谱上写出六小节节奏'
  };
}



const MELODY_PHRASE_INFO = [
  { name: '第一句', role: '陈述', cadenceDegree: 2 },
  { name: '第二句', role: '呼应', cadenceDegree: 4 },
  { name: '第三句', role: '发展', cadenceDegree: 1 },
  { name: '第四句', role: '收束', cadenceDegree: 0 }
];


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

const MIXED_EXAM_COUNT = 21;

const NOTE_GROUP_SIZE_NAMES = { 3: '三', 4: '四', 5: '五' };


function genNoteGroup(difficulty, size, options = {}) {
  const sizeName = NOTE_GROUP_SIZE_NAMES[size] || String(size);
  const tier = hasExamValue(options.tier) ? (GROUP_TIERS[options.tier] || GROUP_TIERS[3]) : null;
  const range = options.range || (tier ? { low: tier.low, high: tier.high } : RANGE[difficulty]);
  const { low, high } = range;

  const naturalPool = [];
  for (let m = low; m <= high; m++) if (NATURAL_PCS.includes(m % 12)) naturalPool.push(m);
  const alteredPool = SINGLE_ALTERED_POOL.filter((m) => m >= low && m <= high);


  const alteredPos = Math.random() < 0.25 ? randInt(0, size - 1) : -1;
  const MAX_STEP = 9;

  let midis = null;
  for (let attempt = 0; attempt < 500 && !midis; attempt++) {
    const seq = [];
    const used = new Set();
    let ok = true;
    for (let i = 0; i < size && ok; i++) {
      const pool = i === alteredPos ? alteredPool : naturalPool;
      const prev = seq.length ? seq[seq.length - 1] : null;
      const avail = pool.filter((m) => !used.has(m) && (prev == null || Math.abs(m - prev) <= MAX_STEP));
      if (!avail.length) { ok = false; break; }
      const m = avail[randInt(0, avail.length - 1)];
      used.add(m);
      seq.push(m);
    }
    if (ok) midis = seq;
  }
  if (!midis) throw new Error(`无法生成 ${size} 音组（音域内可选音不足）`);

  const labels = midis.map(midiToSpelling);

  return {
    type: 'interval',
    typeName: `${sizeName}音组听记`,
    midis,
    spellings: labels,
    harmonic: false,
    intervalName: `${sizeName}音组`,
    answer: midis,
    answerText: labels.join(' '),
    noteCount: size,
    groupSize: size,
    examSection: 'noteGroup',
    knowledgeKey: `note-group:${size}:d${difficulty}`,
    hint: `听连续 ${size} 个音，在 ${size} 个固定谱格中按原顺序写出`
  };
}


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


function genIntervalConnection(difficulty, options = {}) {
  const opts = typeof options === 'number' ? { intervalCount: options } : (options || {});
  const intervalCount = examCount(opts.intervalCount, 5);
  const tier = hasExamValue(opts.tier) ? (CONNECTION_TIERS[opts.tier] || CONNECTION_TIERS[1]) : null;


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


function genExamChord(difficulty, options = {}) {
  const tier = hasExamValue(options.tier) ? (CHORD_TIERS[options.tier] || CHORD_TIERS[1]) : null;


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


  let inversions;
  if (tier) inversions = tier.inversions;
  else if (Array.isArray(options.inversions) && options.inversions.length) inversions = options.inversions;
  else inversions = difficulty === 1 ? [0] : [0, 1, 2];

  inversions = inversions.filter((inv) => inv < target.offsets.length);
  if (!inversions.length) inversions = [0];
  const inversion = inversions[randInt(0, inversions.length - 1)];


  const range = options.range || (tier ? { low: tier.low, high: tier.high } : RANGE[difficulty]);
  const { low, high } = range;
  const voiced = invertOffsets(target.offsets, inversion);
  const maxOffset = Math.max(...voiced);
  const rootHigh = Math.max(low, high - maxOffset);

  const root = target.id === 'aug'
    ? pickChordRoot(low, rootHigh, [11])
    : pickChordRoot(low, rootHigh);
  const midis = voiced.map((offset) => root + offset);
  const spellings = spellChord(root, target.offsets, inversion);
  const size = target.offsets.length;
  const rootName = rootSpellingName(root);
  return {
    type: 'chord',
    typeName: size === 4 ? '七和弦听写' : '三和弦听写',
    midis,
    spellings,
    rootPc: root % 12,
    rootName,
    chordName: target.name,
    chordSymbol: target.symbol,
    inversion,
    inversionName: INVERSION_NAMES[inversion],
    chordSize: size,
    answer: midis,
    answerText: `${rootName}${target.name}和弦 · ${INVERSION_NAMES[inversion]}`,
    examSection: 'chord',
    examPoints: 1,
    repeatCount: 3,
    knowledgeKey: `exam-chord:${target.id}:${inversion}`,
    hint: size === 4 ? '听七和弦，在谱格中叠写四个音' : '听三和弦，在谱格中叠写三个音'
  };
}

// 60 套模拟卷 + 12 条省级真题共用一个全局抽题袋；一轮抽完前不重复。
const RHYTHM_BANK = RHYTHM_BANK_2025;
const RHYTHM_META = RHYTHM_BANK.map(function (record) { return record.meter; });
let _rhythmQueue = [];

function _shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    const value = arr[i];
    arr[i] = arr[j];
    arr[j] = value;
  }
  return arr;
}

function pickFromRhythmBank() {
  if (_rhythmQueue.length === 0) {
    _rhythmQueue = _shuffleArr(RHYTHM_BANK.map(function (_, index) { return index; }));
  }
  const record = RHYTHM_BANK[_rhythmQueue.shift()];
  const events = record.bars.map(function (bar) {
    return bar.map(function (item) { return { ...item }; });
  });
  const bars = events.map(function (bar) {
    return bar.map(function (item) { return item.rest ? -item.duration : item.duration; });
  });
  return {
    id: record.id,
    sourcePaper: record.sourcePaper,
    meter: record.meter,
    events,
    bars,
  };
}

const MELODY_BANK = MELODY_BANK_2025;
let _melodyQueue = [];

function pickFromMelodyBank() {
  if (_melodyQueue.length === 0) {
    _melodyQueue = _shuffleArr(MELODY_BANK.map(function (_, index) { return index; }));
  }
  const record = MELODY_BANK[_melodyQueue.shift()];
  const bars = record.bars.map(function (bar) {
    return bar.map(function (event) { return { ...event }; });
  });
  return { ...record, bars, barCount: bars.length };
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
    1: [[1, 1], [0.5, 0.5, 1], [1, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1, -1], [-0.5, 0.5, 1], [0.5, -0.5, 0.5, 0.5], [0.75, 0.5, 0.75], [0.5, 0.75, 0.75]],
    2: [[1.5, 0.5], [0.5, 1.5], [1, -0.5, 0.5], [-0.5, 0.5, 1], [0.5, 0.25, 0.25, 1]],
    3: [[0.25, 0.25, 0.25, 0.25, 1], [1 / 3, 1 / 3, 1 / 3, 1], [0.5, -0.25, 0.25, 0.5, 0.5]]
  },
  '3/4': {
    1: [[1, 1, 1], [0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1], [1, 1, 0.5, 0.5], [2, 1], [1, 2], [1.5, 0.5, 1], [1, -1, 1], [0.5, -0.5, 1, 1]],
    2: [[1.5, 0.5, 1], [1, 1.5, 0.5], [1, -0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1]],
    3: [[1 / 3, 1 / 3, 1 / 3, 1, 1], [0.25, 0.25, 0.5, 1, 1], [1, 0.5, -0.5, 0.5, 0.5]]
  },
  '4/4': {
    1: [[1, 1, 1, 1], [0.5, 0.5, 1, 1, 1], [1, 1, 0.5, 0.5, 1], [1.5, 0.5, 1, 1], [1, 1, 1.5, 0.5], [0.5, 0.5, 0.5, 0.5, 1, 1], [1, -1, 1, 1], [0.5, -0.5, 1, 1, 1], [2, 1, 1], [0.75, 0.75, 0.5, 1, 1], [0.75, 0.5, 0.75, 1, 1]],
    2: [[1.5, 0.5, 1, 1], [1, -0.5, 0.5, 1, 1], [0.5, 0.5, 1.5, 0.5, 1], [0.25, 0.25, 0.25, 0.25, 1, 1, 1], [0.25, 0.25, 0.5, 1, 1, 1]],
    3: [[1 / 3, 1 / 3, 1 / 3, 1, 1, 1], [0.25, 0.25, 0.5, 1, 1, 1], [1, 0.5, -0.5, 0.5, 0.5, 1]]
  },
  '3/8': {
    1: [[0.5, 0.5, 0.5], [0.75, 0.25, 0.5], [0.5, 0.75, 0.25], [-0.5, 0.5, 0.5]],
    2: [[0.5, 0.25, 0.25, 0.5], [0.25, 0.25, 0.5, 0.5], [-0.25, 0.25, 0.5, 0.5]],
    3: [[0.25, 0.25, 0.25, 0.25, 0.5], [0.5, -0.25, 0.25, 0.5], [-0.75, 0.25, 0.5], [-0.75, 0.5, 0.25]]
  },
  '6/8': {
    1: [[1.5, 1.5], [0.5, 0.5, 0.5, 1.5], [1.5, 0.5, 0.5, 0.5]],
    2: [[0.75, 0.25, 0.5, 1.5], [0.5, 0.25, 0.25, 0.5, 1.5], [1.5, -0.5, 0.5, 0.5], [-0.75, 0.25, 0.5, 1.5], [-0.75, 0.5, 0.25, 1.5]],
    3: [[0.25, 0.25, 0.5, 0.5, 0.5, 1], [0.5, -0.25, 0.25, 0.5, 0.5, 1]]
  }
};

function pickExamMeter(difficulty) {
  const pool = difficulty === 1 ? EXAM_METERS.slice(0, 3) : EXAM_METERS;
  return pool[randInt(0, pool.length - 1)];
}


function pickMeterFromPool(meterIds) {
  const meters = (meterIds || [])
    .map((id) => EXAM_METERS.find((item) => item.id === id))
    .filter(Boolean);
  if (!meters.length) return pickExamMeter(1);
  return meters[randInt(0, meters.length - 1)];
}


function examPatterns(meter, difficulty) {
  const groups = EXAM_BAR_PATTERNS[meter.id];
  return groups[1]
    .concat(difficulty >= 2 ? groups[2] : [])
    .concat(difficulty >= 3 ? groups[3] : []);
}

function genExamBars(difficulty, meter, barCount, allowRest = null, minKinds = 0) {
  let pool = examPatterns(meter, difficulty);

  if (allowRest === false) {
    const noRest = pool.filter((pattern) => pattern.every((duration) => duration > 0));
    if (noRest.length) pool = noRest;
  }
  const build = () => {
    const bars = [];
    const used = new Set();
    for (let index = 0; index < barCount; index++) {
      if (index === barCount - 1) {
        bars.push(meter.denominator === 8 ? [meter.beatsPerBar] : meter.beatsPerBar === 4 ? [2, 2] : [meter.beatsPerBar]);
      } else {
        let chosen = null;
        for (let tries = 0; tries < 200 && !chosen; tries++) {
          const candidate = pool[randInt(0, pool.length - 1)];
          const key = candidate.join(',');
          if (!used.has(key)) { chosen = candidate; used.add(key); }
        }
        if (!chosen) { chosen = pool[randInt(0, pool.length - 1)]; used.add(chosen.join(',')); }
        bars.push(chosen.slice());
      }
    }
    return bars;
  };

  if (minKinds <= 0) return build();
  for (let attempt = 0; attempt < 600; attempt++) {
    const bars = build();
    if (rhythmSymbolKinds(flattenBars(bars)) >= minKinds) return bars;
  }
  return build();
}

function genExamRhythm(difficulty, barCount = 4, options = {}) {
  const tier = hasExamValue(options.tier) ? (RHYTHM_TIERS[options.tier] || RHYTHM_TIERS[3]) : null;

  const level = tier ? tier.level : (hasExamValue(options.level) ? options.level : difficulty);

  let meter;
  let bars = null;
  if (tier) {
    meter = pickMeterFromPool(tier.meters);
  } else {
    meter = pickExamMeter(difficulty);
  }

  const allowRest = tier ? tier.allowRest : (hasExamValue(options.allowRest) ? options.allowRest : null);

  const useBank = hasExamValue(options.useBank) ? options.useBank : false;
  let rhythmEvents = null;
  let sourcePaper = null;
  if (useBank) {
    // 从节奏题库（60 套模拟卷 + 12 条省级真题）抽取，一轮内不重复，用尽自动重新洗牌。
    // 使用题库原题拍号，保证节奏与参考答案不被改写。
    const picked = pickFromRhythmBank();
    if (picked) {
      bars = picked.bars;
      rhythmEvents = picked.events;
      sourcePaper = picked.sourcePaper;
      barCount = bars.length;
      const pickedMeter = EXAM_METERS.find((m) => m.id === picked.meter);
      if (pickedMeter) meter = pickedMeter;
    }
  }
  if (!bars) bars = genExamBars(level, meter, barCount, allowRest);
  // 重新按新 meter 计算 bpm（题库拍号可能不同）
  const configuredBpm = tier ? tier.bpm : (hasExamValue(options.bpm) ? options.bpm : (difficulty === 1 ? 70 : difficulty === 2 ? 78 : 86));
  const bpm = rhythmPlaybackBpm(meter.id, configuredBpm);
  const beats = flattenBars(bars);
  return {
    type: 'rhythm',
    typeName: '节奏听写',
    beats,
    answerBeats: beats,
    answer: beats,
    answerText: `${meter.id} 拍 · ${beatsLabel(beats)}`,
    bars,
    rhythmEvents,
    sourcePaper,
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
    hint: '先选择时值或休止符，再在谱面上依次写入 ' + barCount + ' 小节节奏'
  };
}

function genExamMelody(difficulty, barCount = 8, forcedMeterId = '', forcedKeySignature = '', options = {}) {
  const picked = pickFromMelodyBank();
  const meter = EXAM_METERS.find((item) => item.id === picked.meter);
  const tier = hasExamValue(options.tier) ? (MELODY_TIERS[options.tier] || MELODY_TIERS[3]) : null;
  const configuredBpm = tier ? tier.bpm
    : (hasExamValue(options.bpm) ? options.bpm : (difficulty === 1 ? 70 : difficulty === 2 ? 78 : 86));
  const melodyEvents = picked.bars;
  const flatEvents = flattenBars(melodyEvents);
  const durs = [];
  const midis = [];
  const spellings = [];
  const answer = [];
  const answerSpellings = [];
  let lastMidi = 60;
  let lastSpelling = 'C4';

  flatEvents.forEach(function (event) {
    if (!event.rest) {
      lastMidi = event.midi;
      lastSpelling = event.spelling;
      answer.push(lastMidi);
      answerSpellings.push(lastSpelling);
    }
    durs.push(event.rest ? -event.duration : event.duration);
    midis.push(lastMidi);
    spellings.push(lastSpelling);
  });

  const phrases = buildMelodyPhrasePlan(picked.barCount);
  return {
    type: 'melody',
    typeName: '单声部旋律听写',
    midis,
    durs,
    spellings,
    bars: melodyEvents.map(function (bar) {
      return bar.map(function (event) { return event.rest ? -event.duration : event.duration; });
    }),
    melodyEvents,
    bpm: rhythmPlaybackBpm(meter.id, configuredBpm),
    noteCount: answer.length,
    answer,
    answerText: `正确旋律见谱面（${answerSpellings.slice(0, 8).join(' ')} …）`,
    answerNotes: answerSpellings.join(' '),
    keySignature: picked.keySignature,
    keyName: picked.keyName,
    meter: meter.id,
    meterNumerator: meter.numerator,
    meterDenominator: meter.denominator,
    beatsPerBar: meter.beatsPerBar,
    barCount: picked.barCount,
    sourcePaper: picked.sourcePaper,
    melodicStructure: picked.sourceLabel || '2025年模拟试卷原题',
    phraseCount: phrases.length,
    phrases,
    phraseEndDegrees: phrases.map((phrase) => phrase.cadenceDegree),
    restCount: flatEvents.filter((event) => event.rest).length,
    chromaticCount: 0,
    examSection: 'melody',
    examPoints: 4,
    repeatCount: 4,
    knowledgeKey: `exam-melody:paper${picked.sourcePaper}`,
    hint: picked.sourceLabel
      ? `辨认拍号与调号，写出${picked.sourceLabel}的 ${picked.barCount} 小节完整旋律`
      : `辨认拍号与调号，写出参考答案第 7 题的 ${picked.barCount} 小节完整旋律`
  };
}


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

  genSingleSet(5, 1).forEach((question) => {
    questions.push({ ...question, examSection: 'single', examPoints: 1, repeatCount: 3 });
  });
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
  questions.push(genExamRhythm(standard, 6, { useBank: true }));
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

  const fallbackPoints = question.type === 'rhythm' ? 12 : question.type === 'melody' ? 16 : question.examPoints;
  out.examPoints = resolveExamPoints(section, item, itemCount, fallbackPoints);
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


  if (hasExamValue(bars)) out.examBars = question.type === 'rhythm' ? 6 : question.sourcePaper ? 8 : Number(bars);
  if (hasExamValue(systems)) {
    const resolvedSystems = question.type === 'melody' && question.sourcePaper ? 4 : Number(systems);
    out.systems = resolvedSystems;
    out.examSystems = resolvedSystems;
  }
  if (hasExamValue(meter)) {
    const resolvedMeter = question.sourcePaper && (question.type === 'rhythm' || question.type === 'melody')
      ? question.meter
      : meter;
    out.meter = resolvedMeter;
    out.examMeter = resolvedMeter;
  }
  if (hasExamValue(keySignature)) {
    const resolvedKey = question.type === 'melody' && question.sourcePaper
      ? question.keySignature
      : keySignature;
    out.keySignature = resolvedKey;
    out.examKeySignature = resolvedKey;
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

      const groupOptions = {};
      if (hasExamValue(section.tier)) groupOptions.tier = section.tier;
      if (hasExamValue(section.range)) groupOptions.range = section.range;
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

      const rhythmOptions = {};
      if (hasExamValue(section.tier)) rhythmOptions.tier = section.tier;
      if (hasExamValue(section.level)) rhythmOptions.level = section.level;
      if (hasExamValue(section.allowRest)) rhythmOptions.allowRest = section.allowRest;
      if (hasExamValue(section.bpm)) rhythmOptions.bpm = section.bpm;
      rhythmOptions.useBank = true;
      appendUniqueExamQuestions(result.rhythmQuestions, seen.rhythm, count, (index) => {
        const item = items ? items[index] : null;
        const spec = item || section;
        const bars = Math.max(6, examCount(spec.bars, examCount(section.bars, 4)));
        return withExamSectionMeta(genExamRhythm(standard, bars, rhythmOptions), section, item, count);
      }, practiceQuestionKey, '节奏');
      return;
    }

    if (key === 'melody') {
      const items = configuredItems(section);
      const count = items ? items.length : examCount(section.count, 1);

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
  questions.push({ ...genExamRhythm(standard, 8, { useBank: true }), examPoints: 5, repeatCount: 4 });
  questions.push({ ...genExamMelody(standard, 8), barCount: 8, examPoints: 13.5, repeatCount: 6 });
  return questions.map((question, index) => ({ ...question, examOrder: index + 1, examTotal: questions.length }));
}


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
  const makeRhythm = () => {
    const question = genExamRhythm(standard, 6, { useBank: true });
    return { ...question, examPoints: 12, repeatCount: 4 };
  };
  const rhythmQuestions = [makeRhythm(), makeRhythm()];
  const melodyQuestions = [
    { ...genExamMelody(standard, 8), examPoints: 16, repeatCount: 5 },
    { ...genExamMelody(standard, 8), examPoints: 16, repeatCount: 5 }
  ];
  return { singles, groups, intervals, chords, rhythmQuestions, melodyQuestions };
}

function genPracticeMelody(difficulty, options = {}) {
  const question = genExamMelody(difficulty, 8, '', '', options);
  return {
    ...question,
    typeName: '旋律听记',
    repeatCount: 4,
    hint: '辨认拍号与调号，按四个两小节乐句写出八小节单声部旋律'
  };
}


function genPracticeSingle(difficulty, options = {}) {
  const opts = { ...options };
  if (hasExamValue(opts.tier)) {
    const tier = SINGLE_TIERS[opts.tier] || SINGLE_TIERS[1];
    if (!hasExamValue(opts.range)) opts.range = { low: tier.low, high: tier.high };
    if (!hasExamValue(opts.chromatic)) opts.chromatic = tier.chromatic;
  }
  return genSingle(difficulty, opts);
}


function genPracticeGroup(difficulty, options = {}) {
  const sizes = [3, 4, 5];
  const size = sizes[randInt(0, sizes.length - 1)];
  const question = genNoteGroup(difficulty, size, options);
  return { ...question, repeatCount: 3 };
}


function genPracticeInterval(difficulty, options = {}) {
  return genInterval(difficulty, null, options);
}


function genPracticeConnection(difficulty, options = {}) {
  const question = genIntervalConnection(difficulty, options);
  return { ...question, repeatCount: 3 };
}


function genPracticeChordQuality(difficulty, options = {}) {
  const question = genExamChord(difficulty, options);
  question.chordTaskType = 'chordQuality';
  question.qualityRequired = true;
  question.answerMode = 'qualityFill';
  question.typeName = '和弦性质听写';
  question.hint = '听和弦，只写性质（大/小/增/减三和弦及转位）';
  return question;
}


function genPracticeChordPitch(difficulty, options = {}) {
  const question = genExamChord(difficulty, options);
  question.chordTaskType = 'chordPitch';
  question.typeName = '和弦音高听写';
  question.hint = '听和弦，只写音高';
  return question;
}

const GENERATORS = {
  single: genPracticeSingle,
  group: genPracticeGroup,
  interval: genPracticeInterval,
  connection: genPracticeConnection,
  chord: genChord,
  chordQuality: genPracticeChordQuality,
  chordPitch: genPracticeChordPitch,
  rhythm: genRhythm,
  melody: genPracticeMelody
};


const ADAPTIVE_TYPES = ['single', 'interval', 'chord', 'rhythm', 'melody'];


function generate(type, options = {}) {
  if (!GENERATORS[type]) throw new Error(`未知题型: ${type}`);
  return GENERATORS[type](EXAM_STANDARD_LEVEL, options);
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


function practiceQuestionKey(question) {
  let midis;
  if (Array.isArray(question.chords)) {

    midis = question.chords.map((chord) => chord.slice().sort((a, b) => a - b)).flat();
  } else {
    midis = (question.midis || []).slice();
    if (question.harmonic || question.type === 'chord') midis.sort((a, b) => a - b);
  }
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

function genChordSet(count, type, options = {}) {
  const opts = { ...options }; delete opts.tier;
  const n5 = Math.floor(count * .5), n3 = Math.floor(count * .3);
  const invs = shuffle([].concat(new Array(n5).fill(0), new Array(n3).fill(1), new Array(count - n5 - n3).fill(2)));
  const gen = GENERATORS[type], used = new Set(), out = [];
  for (const inv of invs) {
    const o = { ...opts, qualities: [Math.random() < .3 ? (Math.random() < .6 ? 'dim' : 'aug') : (Math.random() < .5 ? 'major' : 'minor')], inversions: [inv] };
    let q = null;
    for (let a = 0; a < 400 && !q; a++) {
      const c = gen(EXAM_STANDARD_LEVEL, o), k = practiceQuestionKey(c);
      if (!used.has(k)) { used.add(k); q = c; }
    }
    out.push(q || gen(EXAM_STANDARD_LEVEL, o));
  }
  return out;
}


function generateSet(type, count = 10, profile = {}, options = {}) {
  const questions = [];
  if (type === 'mixed') {
    return generateExamMixed();
  }
  if (type === 'single') {

    const alteredCount = count <= 5 ? 1 : (Math.random() < 0.5 ? 1 : 2);
    return genSingleSet(count, alteredCount, options);
  }
  if (type.startsWith('chord')) return genChordSet(count, type, options);
  if (type === 'adaptive') {

    const seen = new Set();
    const append = (question) => {
      const key = practiceQuestionKey(question);
      if (seen.has(key)) return false;
      seen.add(key);
      questions.push(question);
      return true;
    };
    ADAPTIVE_TYPES.slice(0, Math.min(count, ADAPTIVE_TYPES.length)).forEach((itemType) => append(generate(itemType)));
    let attempts = 0;
    const maxAttempts = Math.max(300, count * 120);
    while (questions.length < count && attempts++ < maxAttempts) {
      append(generate(weightedType(ADAPTIVE_TYPES, profile)));
    }

    attempts = 0;
    while (questions.length < count && attempts++ < maxAttempts) {
      append(generate(ADAPTIVE_TYPES[attempts % ADAPTIVE_TYPES.length]));
    }
    if (questions.length < count) {
      throw new Error(`无法生成 ${count} 道互不重复的智能强化题`);
    }
    return shuffle(questions);
  }

  const seen = new Set();
  let attempts = 0;
  const maxAttempts = Math.max(100, count * 80);
  while (questions.length < count && attempts < maxAttempts) {
    attempts++;
    const question = generate(type, options);
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
  genPracticeGroup,
  genPracticeConnection,
  genPracticeChordQuality,
  genPracticeChordPitch,
  spellingsToChordName,
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
  NATURAL_PCS,
  RHYTHM_BANK,
  RHYTHM_META,
  pickFromRhythmBank,
  MELODY_BANK,
  pickFromMelodyBank,
  rhythmPlaybackBpm
};
