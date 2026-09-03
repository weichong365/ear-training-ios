/**
 * 乐理基础库：音名、音程、和弦、节奏型定义与工具函数
 */

// 音名（半音阶），index 0 = C
const NOTE_NAMES = ['C', '#C', 'D', '#D', 'E', 'F', '#F', 'G', '#G', 'A', '#A', 'B'];
// 首调唱名（C 大调自然音）
const SOLFEGE = { 0: 'do', 2: 're', 4: 'mi', 5: 'fa', 7: 'sol', 9: 'la', 11: 'si' };

/** MIDI -> 音名 + 八度，如 60 -> "C4" */
function midiToName(midi) {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** MIDI -> 唱名（仅自然音有效，变化音返回音名） */
function midiToSolfege(midi) {
  const pc = midi % 12;
  return SOLFEGE[pc] || NOTE_NAMES[pc];
}

/** [min, max] 随机整数 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 数组随机取 n 个（不重复） */
function sample(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}

/** 打乱数组 */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 音程表（艺考常考范围）
 * semitones: 半音数, name: 性质, level: 原题库范围层级（仅用于内部筛选）
 */
const INTERVALS = [
  { semitones: 1, name: '小二度', level: 3 },
  { semitones: 2, name: '大二度', level: 1 },
  { semitones: 3, name: '小三度', level: 2 },
  { semitones: 4, name: '大三度', level: 1 },
  { semitones: 5, name: '纯四度', level: 1 },
  { semitones: 6, name: '增四度', level: 3 },
  { semitones: 7, name: '纯五度', level: 1 },
  { semitones: 8, name: '小六度', level: 2 },
  { semitones: 9, name: '大六度', level: 2 },
  { semitones: 10, name: '小七度', level: 3 },
  { semitones: 11, name: '大七度', level: 3 },
  { semitones: 12, name: '纯八度', level: 1 }
];

/**
 * 和弦表（三和弦 4 种 + 七和弦 6 种，业界通用简称 + 符号标记）
 * offsets: 相对根音的半音偏移, group: triad 三和弦 | seventh 七和弦
 */
const CHORDS = [
  { id: 'major', name: '大三', symbol: 'Major', offsets: [0, 4, 7], group: 'triad', level: 1 },
  { id: 'minor', name: '小三', symbol: 'Minor', offsets: [0, 3, 7], group: 'triad', level: 1 },
  { id: 'dim', name: '减三', symbol: 'dim', offsets: [0, 3, 6], group: 'triad', level: 2 },
  { id: 'aug', name: '增三', symbol: 'aug', offsets: [0, 4, 8], group: 'triad', level: 2 },
  { id: 'dom7', name: '属七', symbol: '⁷', offsets: [0, 4, 7, 10], group: 'seventh', level: 2 },
  { id: 'maj7', name: '大七', symbol: 'Maj⁷', offsets: [0, 4, 7, 11], group: 'seventh', level: 3 },
  { id: 'min7', name: '小七', symbol: 'm⁷', offsets: [0, 3, 7, 10], group: 'seventh', level: 3 },
  { id: 'halfdim7', name: '半减七', symbol: 'ø⁷', offsets: [0, 3, 6, 10], group: 'seventh', level: 3 },
  { id: 'dim7', name: '减七', symbol: 'dim⁷', offsets: [0, 3, 6, 9], group: 'seventh', level: 3 },
  { id: 'minmaj7', name: '小大七', symbol: 'mMaj⁷', offsets: [0, 3, 7, 11], group: 'seventh', level: 3 }
];

/**
 * 节奏型库（一小节 4/4 拍，数值为拍值：1=四分，0.5=八分，0.25=十六分，1.5=附点四分）
 */
const RHYTHM_PATTERNS = [
  { beats: [1, 1, 1, 1], label: '四分 四分 四分 四分', level: 1 },
  { beats: [1, 0.5, 0.5, 1, 1], label: '四分 二八 四分 四分', level: 1 },
  { beats: [0.5, 0.5, 1, 0.5, 0.5, 1], label: '二八 四分 二八 四分', level: 1 },
  { beats: [1, 1, 0.5, 0.5, 0.5, 0.5], label: '四分 四分 四个八分', level: 1 },
  { beats: [1.5, 0.5, 1, 1], label: '附点四分 八分 四分 四分', level: 2 },
  { beats: [0.5, 0.5, 1.5, 0.5, 1], label: '二八 附点四分 八分 四分', level: 2 },
  { beats: [1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], label: '四分 二八 四个八分', level: 2 },
  { beats: [0.25, 0.25, 0.25, 0.25, 1, 1, 1], label: '四个十六分 四分 四分 四分', level: 2 },
  { beats: [0.5, 0.25, 0.25, 1, 1, 1], label: '八分带十六分 四分 四分 四分', level: 3 },
  { beats: [0.25, 0.25, 0.5, 0.25, 0.25, 0.5, 1, 1], label: '十六分切分组合', level: 3 },
  { beats: [1, 1.5, 0.5, 0.5, 0.5], label: '四分 附点四分 二八', level: 2 },
  { beats: [0.5, 0.5, 0.5, 0.5, 1.5, 0.5], label: '四个八分 附点四分 八分', level: 3 }
];

/** 按内部题库范围筛选；当前产品统一传入完整真题范围。 */
function byLevel(list, coverage) {
  return list.filter((x) => x.level <= coverage);
}

module.exports = {
  NOTE_NAMES,
  SOLFEGE,
  midiToName,
  midiToSolfege,
  randInt,
  sample,
  shuffle,
  INTERVALS,
  CHORDS,
  RHYTHM_PATTERNS,
  byLevel
};
