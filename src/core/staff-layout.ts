/**
 * 五线谱几何单源 —— 逐值移植自小程序：
 *   components/staff-layout.js        （紧凑谱 140rpx 的坐标与横向排布）
 *   components/staff-glyph-metrics.js （SMuFL 字形裁切尺寸）
 *   components/staff-notation.js      （字形锚点、符干/符杠/附点/休止符常数）
 *
 * 单位一律 **rpx**（小程序内部坐标），1rpx = 0.5pt。
 * 渲染时 SVG viewBox 也用 rpx：画布高 140rpx → 70pt，于是 1 单位 = 0.5pt，
 * 两端（小程序绝对 rpx 定位 / App viewBox rpx）逐像素一致。
 *
 * ⚠️ 改小程序样式后请重跑 tmp/staff-sync-20260915/parity.py 复核本文件。
 */

export type StaffEvent = {
  midis?: number[];
  spellings?: string[];
  dur?: number;
  rest?: boolean;
  bar?: boolean;
  barIndex?: number;
  inputSlot?: number;
  /** 连至下一音（小程序 `tieToNext`）；跨小节时下一系统只画「入弧」 */
  tieToNext?: boolean;
  /** 由前一音连入（小程序 `tieFromPrevious`） */
  tieFromPrevious?: boolean;
};

/** 1rpx = 0.5pt（750rpx 设计宽 → 375pt） */
export const RPX_TO_PT = 0.5;

/** 小程序 answer-staff 固定传的 width 值（设计宽度，不是容器宽度）。 */
export const DEFAULT_STAFF_WIDTH_RPX = 630;

// ===== 垂直坐标：统一「第一线 E4」显式锚点（staff-layout.js）=====
export const STAFF_LINE_TOP = 30;
export const STAFF_LINE_GAP = 15;
export const STAFF_LINE_COUNT = 5;
/** E4 第一线（最底），y 最大 */
export const STAFF_FIRST_LINE_Y = STAFF_LINE_TOP + (STAFF_LINE_COUNT - 1) * STAFF_LINE_GAP + 1; // 91
/** 最顶线 */
export const STAFF_LAST_LINE_Y = STAFF_LINE_TOP + 1; // 31
export const STAFF_STEP_GAP = STAFF_LINE_GAP / 2; // 7.5
export const STAFF_HEIGHT_RPX = 140; // .staff-compact / .answer-staff-shell
/** 谱线高度 1px = 2rpx，音符锚点落在线条中心而非上边缘 */
export const STAFF_LINE_CENTER_OFFSET = 1;

export const STAFF_LINE_YS = Array.from(
  { length: STAFF_LINE_COUNT },
  (_, index) => STAFF_LINE_TOP + 1 + index * STAFF_LINE_GAP,
);

export function staffYForStep(step: number) {
  return roundStaffY(STAFF_FIRST_LINE_Y - step * STAFF_STEP_GAP);
}

/** 0.5rpx 精度输出，跨 webview 不漂移 */
export function roundStaffY(value: number) {
  return Math.round(value * 2) / 2;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

// ===== 横向排布（staff-layout.js: horizontalLayout）=====
export const FIXED_BAR_LEFT_COMPACT = 112;
export const FIXED_BAR_RIGHT_COMPACT = 8;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function headerRight(meter: string, keySignature: string) {
  if (meter && keySignature) return 105;
  if (meter) return 82;
  if (keySignature) return 68;
  return 50;
}

/**
 * 左侧按「全音符 + 降号」预留；右侧还要覆盖二度和弦错位符头、朝上的独立十六分
 * 符尾和附点。数值包含 2rpx 小节线及最小视觉留白。
 */
export const STAFF_GUARDS = { left: 37, right: 38 } as const;

function inferBars(events: StaffEvent[], requestedBars: number) {
  const barIndices: number[] = [];
  let inferred = 0;
  let maxIndex = 0;
  events.forEach((event, index) => {
    if (index > 0 && event && event.bar) inferred += 1;
    const explicit = event && Number.isInteger(event.barIndex) ? (event.barIndex as number) : inferred;
    const barIndex = Math.max(0, explicit);
    barIndices[index] = barIndex;
    maxIndex = Math.max(maxIndex, barIndex);
  });
  const count = requestedBars > 1 ? requestedBars : Math.max(1, maxIndex + 1, inferred + 1);
  return { count, indices: barIndices.map((index) => Math.min(index, count - 1)) };
}

function placeWithinBars(
  events: StaffEvent[],
  barInfo: { count: number; indices: number[] },
  leftBoundary: number,
  rightBoundary: number,
  safe: { left: number; right: number },
  rhythmicCapacity = 0,
) {
  const centers = new Array<number>(events.length);
  const bars: number[] = [];
  const width = Math.max(1, rightBoundary - leftBoundary);
  const barWidth = width / barInfo.count;
  const members: number[][] = Array.from({ length: barInfo.count }, () => []);
  barInfo.indices.forEach((bar, eventIndex) => members[bar].push(eventIndex));

  for (let bar = 1; bar < barInfo.count; bar += 1) {
    bars.push(round(leftBoundary + barWidth * bar));
  }
  members.forEach((eventIndices, bar) => {
    if (!eventIndices.length) return;
    const barLeft = leftBoundary + barWidth * bar;
    const barRight = barLeft + barWidth;
    let innerLeft = barLeft + safe.left;
    let innerRight = barRight - safe.right;
    // 极窄容器无法同时容纳两侧安全区时，至少把符号中心放在小节中心，
    // 不让浮点反转导致音符越过小节线。
    if (innerRight < innerLeft) innerLeft = innerRight = (barLeft + barRight) / 2;
    let elapsed = 0;
    const localCenters = eventIndices.map((eventIndex, localIndex) => {
      const ratio = eventIndices.length === 1
        ? 0.5
        : rhythmicCapacity > 0
          ? clamp(elapsed / rhythmicCapacity, 0, 1)
          : localIndex / (eventIndices.length - 1);
      const center = innerLeft + (innerRight - innerLeft) * ratio;
      elapsed += Math.abs(Number(events[eventIndex] && events[eventIndex].dur) || 1);
      return center;
    });
    if (rhythmicCapacity > 0 && localCenters.length > 1) {
      const minimumGap = Math.min(22, (innerRight - innerLeft) / (localCenters.length - 1));
      for (let index = 1; index < localCenters.length; index += 1) {
        localCenters[index] = Math.max(localCenters[index], localCenters[index - 1] + minimumGap);
      }
      const overflow = Math.max(0, localCenters[localCenters.length - 1] - innerRight);
      if (overflow) {
        localCenters[localCenters.length - 1] = innerRight;
        for (let index = localCenters.length - 2; index >= 0; index -= 1) {
          localCenters[index] = Math.min(localCenters[index], localCenters[index + 1] - minimumGap);
        }
      }
    }
    eventIndices.forEach((eventIndex, localIndex) => {
      centers[eventIndex] = round(localCenters[localIndex]);
    });
  });
  return { centers, bars };
}

export type HorizontalLayout = { centers: number[]; bars: number[]; barIndices: number[] };

export function horizontalLayout(
  events: StaffEvent[],
  options: {
    width?: number;
    meter?: string;
    beamMeter?: string;
    keySignature?: string;
    barCount?: number;
    answerSlots?: number;
  },
): HorizontalLayout {
  const list = Array.isArray(events) ? events : [];
  const width = Math.max(1, Number(options.width) || 700);
  const meter = String(options.meter || '');
  const beamMeter = String(options.beamMeter || '');
  const rhythmicCapacity = (beamMeter || meter) === '3/8' ? 1.5 : 0;
  const keySignature = String(options.keySignature || '');
  const requestedBars = Math.max(0, Number(options.barCount) || 0);
  const answerSlots = Math.max(0, Number(options.answerSlots) || 0);
  const safe = STAFF_GUARDS;
  const rightPad = 4;
  const rightBoundary = width - rightPad;
  const minCenter = headerRight(meter, keySignature) + safe.left;
  const maxCenter = Math.max(minCenter, rightBoundary - safe.right);

  if (!list.length) {
    if (requestedBars <= 1) return { centers: [], bars: [], barIndices: [] };
    const fixedLeft = FIXED_BAR_LEFT_COMPACT;
    const fixedRight = width - FIXED_BAR_RIGHT_COMPACT;
    const barInfo = { count: requestedBars, indices: [] as number[] };
    const placed = placeWithinBars(list, barInfo, fixedLeft, fixedRight, safe, rhythmicCapacity);
    return { ...placed, barIndices: [] };
  }

  // answerSlots 是「固定答题区域」的数量，不是所有 answer-staff 的通用横向分栏
  // 开关。只有事件明确携带 inputSlot 时才使用固定答题区域：三音组/五音组固定
  // 在各自区域，普通多事件谱例仍按时间顺序水平排开。
  const slotAnchored = answerSlots > 0 && list.every((event) => event && Number.isInteger(event.inputSlot));
  if (slotAnchored) {
    const centers = list.map((event, index) => {
      const slot = Number.isInteger(event.inputSlot) ? (event.inputSlot as number) : index;
      const raw = 58 + (Math.min(answerSlots - 1, Math.max(0, slot)) + 0.5) * (width - 58) / answerSlots;
      return round(clamp(raw, minCenter, maxCenter));
    });
    return { centers, bars: [], barIndices: list.map(() => 0) };
  }

  const barInfo = inferBars(list, requestedBars);
  if (barInfo.count > 1 || rhythmicCapacity > 0) {
    const fixed = requestedBars > 1;
    const leftBoundary = fixed ? FIXED_BAR_LEFT_COMPACT : headerRight(meter, keySignature) + 6;
    const endBoundary = fixed ? width - FIXED_BAR_RIGHT_COMPACT : rightBoundary;
    const placed = placeWithinBars(list, barInfo, leftBoundary, endBoundary, safe, rhythmicCapacity);
    return { ...placed, barIndices: barInfo.indices };
  }

  const centers: number[] = [];
  if (list.length === 1) {
    centers.push(round(clamp(width * 0.47, minCenter, maxCenter)));
  } else {
    const spacing = Math.min(88, Math.max(1, Math.floor((maxCenter - minCenter) / (list.length - 1))));
    list.forEach((event, index) => centers.push(round(minCenter + index * spacing)));
  }
  return { centers, bars: [], barIndices: list.map(() => 0) };
}

// ===== 谱面元素统一锚点（staff-layout.js）=====
export const ACCIDENTAL_GAP = 5;
export function keySignatureLeft(keySignature: string) {
  return keySignature === 'F' ? 48 : 47;
}
export function timeSignatureLeft(withKey: boolean) {
  return withKey ? 70 : 47;
}
export const TIME_COLUMN_WIDTH = 35;
export function barlineTop() {
  return STAFF_LINE_TOP + 1;
}
export function barlineHeight() {
  return STAFF_LINE_GAP * 4;
}
/** 空态提示文字：垂直居中于第三线 */
export function emptyTextCenterY() {
  return STAFF_LINE_TOP + STAFF_LINE_GAP * 2 + 1;
}
/** 空态文字盒：.staff-notation .empty 用 emptyTop/emptyHeight 撑开并居中 */
export const EMPTY_TOP = STAFF_LINE_TOP + 1;
export const EMPTY_HEIGHT = STAFF_LINE_GAP * 4;
export const EMPTY_FONT_SIZE = 20;
/** .answer-staff-shell border-radius 12rpx */
export const STAFF_SHELL_RADIUS = 6;

// ===== 字形表（staff-glyph-metrics.js + staff-notation.js）=====
/** Bravura 每谱间 250 字体单位 */
export const SMUFL_UNITS_PER_SPACE = 250;

export type GlyphMetric = { width: number; height: number; originTop: number; sharpScale?: boolean };

export const GLYPH_METRICS = {
  clef: { width: 671, height: 1756, originTop: 1098 },
  sharp: { width: 249, height: 698, originTop: 350, sharpScale: true },
  flat: { width: 226, height: 614, originTop: 439 },
  natural: { width: 168, height: 676, originTop: 341 },
  'notehead-whole': { width: 422, height: 250, originTop: 125 },
  'notehead-half': { width: 295, height: 250, originTop: 125 },
  'notehead-black': { width: 295, height: 250, originTop: 125 },
  'rest-whole': { width: 282, height: 144, originTop: 9 },
  'rest-half': { width: 282, height: 144, originTop: 142 },
  'rest-quarter': { width: 269, height: 748, originTop: 373 },
  'rest-eighth': { width: 247, height: 425, originTop: 174 },
  'rest-sixteenth': { width: 320, height: 679, originTop: 179 },
  'flag-eighth-up': { width: 264, height: 819, originTop: 9 },
  'flag-eighth-down': { width: 306, height: 822, originTop: 808 },
  'flag-sixteenth-up': { width: 279, height: 815, originTop: 2 },
  'flag-sixteenth-down': { width: 291, height: 821.0064, originTop: 812.0064 },
  dot: { width: 100, height: 100, originTop: 50 },
  'time0': { width: 430, height: 501, originTop: 251 },
  'time1': { width: 294, height: 501, originTop: 251 },
  'time2': { width: 406, height: 511, originTop: 254 },
  'time3': { width: 381, height: 500, originTop: 249 },
  'time4': { width: 430, height: 501, originTop: 251 },
  'time5': { width: 363, height: 497, originTop: 246 },
  'time6': { width: 394, height: 500, originTop: 251 },
  'time7': { width: 401, height: 499, originTop: 249 },
  'time8': { width: 396, height: 518, originTop: 259 },
  'time9': { width: 394, height: 500, originTop: 251 },
} as const satisfies Record<string, GlyphMetric>;

export type GlyphName = keyof typeof GLYPH_METRICS;
export type GlyphBox = { left: number; top: number; width: number; height: number };

/** 字形实测盒（rpx）：升号略收 0.9 档。 */
export function glyphSize(name: GlyphName, lineGap = STAFF_LINE_GAP) {
  const metric = GLYPH_METRICS[name] as GlyphMetric;
  const scale = (lineGap / SMUFL_UNITS_PER_SPACE) * (metric.sharpScale ? 0.9 : 1);
  return { width: metric.width * scale, height: metric.height * scale };
}

/** staff-symbols.js: symbol() —— 升号略收一档，锚点仍严格落在原谱线位置。 */
export function symbolBox(name: GlyphName, left: number, anchorY: number, lineGap = STAFF_LINE_GAP): GlyphBox & { name: GlyphName } {
  const metric = GLYPH_METRICS[name] as GlyphMetric;
  const scale = (lineGap / SMUFL_UNITS_PER_SPACE) * (metric.sharpScale ? 0.9 : 1);
  return {
    name,
    left,
    top: anchorY - metric.originTop * scale,
    width: metric.width * scale,
    height: metric.height * scale,
  };
}

/** staff-symbols.js: accidentalSymbol() —— 右缘对齐给定 x。 */
export function accidentalBox(acc: string, rightEdgeX: number, centerY: number, lineGap = STAFF_LINE_GAP): (GlyphBox & { name: GlyphName }) | null {
  const name = ({ '#': 'sharp', b: 'flat', n: 'natural' } as const)[acc as '#' | 'b' | 'n'];
  if (!name) return null;
  const box = symbolBox(name, 0, centerY, lineGap);
  return { ...box, name, left: round(rightEdgeX - box.width) };
}

/**
 * staff-notation.js: noteheadGlyph()
 *
 * ⚠️ 入参约定与小程序**不同**（但结果逐值相同）：
 *   小程序传「黑符头列的左缘」x = centers - headWidth('black')/2，内部再按
 *   `left = x - (width - blackWidth)/2` 把更宽的空心符头重新对中；
 *   App 侧直接传**音符中心** centers，于是
 *   `left = centers - width/2 ≡ 小程序 (centers - blackWidth/2) - (width - blackWidth)/2`。
 * 统一成「中心」之后，noteheadStemStart / headLeft / 加线 / 附点都共用同一个锚点。
 */
export function noteheadBox(kind: 'whole' | 'half' | 'black', centerX: number, centerY: number, lineGap = STAFF_LINE_GAP) {
  const name = `notehead-${kind}` as GlyphName;
  const { width, height } = glyphSize(name, lineGap);
  return { name, width: round(width), height: round(height), left: round(centerX - width / 2), top: round(centerY - height / 2) };
}

/** 音符可达的左右边界（等效小程序 headInfos 的 left/right）。 */
export function noteheadHalfWidth(kind: 'whole' | 'half' | 'black', lineGap = STAFF_LINE_GAP) {
  return glyphSize(`notehead-${kind}` as GlyphName, lineGap).width / 2;
}
/** staff-notation.js: restGlyph() */
export function restBox(kind: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth', x: number, lineTop: number, lineGap: number, headW: number) {
  const name = `rest-${kind}` as GlyphName;
  const metric = GLYPH_METRICS[name] as GlyphMetric;
  const { width, height } = glyphSize(name, lineGap);
  const anchorY = (kind === 'whole' ? lineTop + lineGap : lineTop + lineGap * 2) + STAFF_LINE_CENTER_OFFSET;
  return { name, left: round(x + headW / 2 - width / 2), top: round(anchorY - metric.originTop * (lineGap / SMUFL_UNITS_PER_SPACE)), width: round(width), height: round(height) };
}

/** 休止符字形宽（rpx），附点要靠它算出右缘。 */
export function restWidth(kind: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth', lineGap = STAFF_LINE_GAP) {
  return glyphSize(`rest-${kind}` as GlyphName, lineGap).width;
}

/** staff-notation.js: dotGlyph() */
export function dotBox(left: number, centerY: number, lineGap = STAFF_LINE_GAP) {
  const scale = lineGap / SMUFL_UNITS_PER_SPACE;
  return { name: 'dot' as GlyphName, left: round(left), top: round(centerY - GLYPH_METRICS.dot.originTop * scale), width: round(GLYPH_METRICS.dot.width * scale), height: round(GLYPH_METRICS.dot.height * scale) };
}

/** staff-notation.js: flagGlyph() */
export function flagBox(beamCount: number, up: boolean, stemX: number, stemEndY: number, lineGap = STAFF_LINE_GAP) {
  const name = `flag-${beamCount >= 2 ? 'sixteenth' : 'eighth'}-${up ? 'up' : 'down'}` as GlyphName;
  const metric = GLYPH_METRICS[name] as GlyphMetric;
  const { width, height } = glyphSize(name, lineGap);
  return { name, left: round(stemX), top: round(stemEndY - metric.originTop * (lineGap / SMUFL_UNITS_PER_SPACE)), width: round(width), height: round(height) };
}

/** staff-symbols.js: headerSymbols() —— 谱号 / 调号 / 拍号 */
export function headerSymbols(keySignature: string, meter: string) {
  const lineGap = STAFF_LINE_GAP;
  const y = (step: number) => staffYForStep(step);
  const clefGlyph = symbolBox('clef', 4, y(2), lineGap);
  const keyGlyph = keySignature === 'G' ? symbolBox('sharp', keySignatureLeft('G'), y(8), lineGap)
    : keySignature === 'F' ? symbolBox('flat', keySignatureLeft('F'), y(4), lineGap) : null;
  const meterGlyphs: (GlyphBox & { key: string; name: GlyphName })[] = [];
  const left = timeSignatureLeft(!!keyGlyph);
  String(meter || '').split('/').slice(0, 2).forEach((part, row) => {
    if (!/^\d+$/.test(part)) return;
    const glyphs = Array.from(part, (digit) => symbolBox(`time${digit}` as GlyphName, 0, y(row === 0 ? 6 : 2), lineGap));
    let x = left + (TIME_COLUMN_WIDTH - glyphs.reduce((sum, glyph) => sum + glyph.width, 0)) / 2;
    glyphs.forEach((glyph, index) => {
      meterGlyphs.push({ ...glyph, left: round(x), key: `${row}-${index}` });
      x += glyph.width;
    });
  });
  return { clefGlyph, keyGlyph, meterGlyphs };
}

// ===== 音符/符干/符杠常量（staff-notation.js 紧凑分支）=====
export const STEM_LENGTH = 45.36;
export const SECOND_HEAD_DX = 12.96;
export const BEAM_GAP = 6.48;
export const BEAM_THICKNESS = 4;
export const LEDGER_WIDTH = 31.2;
export const TUPLET_NUMBER_HEIGHT = 18;
export const TUPLET_GAP = 4;
export const TUPLET_FONT_SIZE = 18;
/** 独立二级符杠的短杠长（staff-notation.js: compact ? 13 : 20） */
export const BEAMLET_WIDTH = 13;
/** 连符杠向右侧各多画 3rpx（staff-notation.js: w = lastX - firstX + 3） */
export const BEAM_EXTEND = 3;
// ===== 连音线（staff-notation.js ties 分支 + .tie 样式）=====
/**
 * 连音线锚点内缩 = 黑符头列宽 × 0.65（staff-notation.js: tieInset = headW * 0.65）。
 * ⚠️ 注意用的是黑符头列宽，不是每个符头自己的宽度（Chord 里的小程序一致如此）。
 */
export const TIE_INSET_RATIO = 0.65;
/** 弧顶相对最低符头中心再下移 lineGap × 0.65（staff-notation.js: point.y + lineGap * 0.65） */
export const TIE_BASELINE_RATIO = 0.65;
/** 无下一音（跨系统出弧）时的兜底弧长（staff-notation.js: compact ? 32 : 48） */
export const TIE_EXTENT = 32;
/** 入弧最少保留的左边距（staff-notation.js: Math.max(4, right - 32)） */
export const TIE_MIN_LEFT = 4;
/** 出弧兜底右缘再收 4rpx（staff-notation.js: Math.min(width - 4, left + 32)） */
export const TIE_RIGHT_PAD = 4;
/**
 * 连音线盒高（staff-notation.js: tieHeight = compact ? 10 : 16）。
 * 小程序是 `border-bottom: 2rpx solid` + `border-radius: 0 0 50% 50%`：
 * 弧的两个端点落在盒中线 top + height/2，弧顶落在盒底 top + height。
 */
export const TIE_HEIGHT = 10;
/** .tie border-bottom: 2rpx */
export const TIE_STROKE_WIDTH = 2;
/**
 * 三连音「3」的 SVG 基线补偿：小程序用 `top + line-height:18rpx` 的文本框定位，
 * SVG <Text y> 是基线，取 0.85em 近似 Georgia 斜体数字在 18rpx 行高内的基线位置。
 */
export const TUPLET_BASELINE_RATIO = 0.85;
/** .answer-staff-shell border: 1rpx */
export const STAFF_SHELL_BORDER = 1;
// ===== 结束线（双小节线，answer-staff 的 last）=====
/** .endline width: 12rpx */
export const ENDLINE_WIDTH = 12;
export const ENDLINE_THIN = 2;
export const ENDLINE_THICK = 4;
