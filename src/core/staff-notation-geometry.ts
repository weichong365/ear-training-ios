/**
 * 五线谱标注几何 —— `components/staff-notation.js` 的 `layout()` 1:1 移植（紧凑谱 140rpx）。
 *
 * 纯函数、无 React 依赖（冒烟脚本可直接 import）：输入小程序形状的 events，
 * 输出全部谱面元素的 **rpx** 坐标。App 端三处谱面（答题谱 / 听记编辑器 / 谱例预览）
 * 共用这一份几何，不再各自算一套。
 *
 * ⚠️ 改小程序 `staff-layout.js` / `staff-notation.js` 后请重跑 tmp/staff-sync-20260915/parity.py。
 */

import type { NoteheadKind, RestKind, StemDirection } from './music-notation.ts';
import { beamGroupAtBeat, durationNotation, fitTupletBeamY, ledgerLineYs, staffStepFromWrittenMidi, staffSvgYFromWrittenMidi } from './music-notation.ts';
import { naturalMidiForPitchSpelling, staffAccidental } from './pitch-spelling.ts';
import {
  BEAM_EXTEND,
  BEAM_GAP,
  BEAM_THICKNESS,
  BEAMLET_WIDTH,
  DEFAULT_STAFF_WIDTH_RPX,
  LEDGER_WIDTH,
  SECOND_HEAD_DX,
  STAFF_HEIGHT_RPX,
  STAFF_LINE_CENTER_OFFSET,
  STAFF_LINE_GAP,
  STAFF_LINE_TOP,
  STEM_LENGTH,
  TIE_BASELINE_RATIO,
  TIE_EXTENT,
  TIE_HEIGHT,
  TIE_INSET_RATIO,
  TIE_MIN_LEFT,
  TIE_RIGHT_PAD,
  TUPLET_GAP,
  TUPLET_NUMBER_HEIGHT,
  horizontalLayout,
  noteheadBox,
  restBox,
  type StaffEvent,
} from './staff-layout.ts';

export type StaffGeometryOptions = {
  /** 布局宽度（rpx）—— 小程序 answer-staff 的 width prop，默认 630（**不是**容器宽） */
  width?: number;
  meter?: string;
  beamMeter?: string;
  keySignature?: string;
  barCount?: number;
  answerSlots?: number;
};

export type StaffHead = {
  key: string;
  eventIndex: number;
  /** 该音符在 event.midis 里的原始下标（未排序） */
  noteIndex: number;
  midi: number;
  spelling?: string;
  step: number;
  /** 符头中心 x（= 列中心 + 二度错位 dx） */
  centerX: number;
  centerY: number;
  headKind: NoteheadKind;
  /** 符头 bbox 左缘 */
  headLeft: number;
  /** 该符头 bbox 右缘 */
  headRight: number;
  acc: '' | '#' | 'b' | 'n';
  /** 加线左缘（宽 LEDGER_WIDTH） */
  ledgerX: number;
  ledgerYs: number[];
};

export type StaffRestMark = {
  key: string;
  eventIndex: number;
  centerX: number;
  kind: RestKind;
  /** 休止符 bbox 右缘；附点锚点 */
  right: number;
  dotCenterY: number;
};

/**
 * 连音线（staff-notation.js 的 ties 分支）。
 * `edge` 决定弧的两端是否落在系统边缘：`complete` = 两音都在本系统内；
 * `outgoing` / `incoming` = 跨系统的半弧（小程序靠 `.tie-outgoing` / `.tie-incoming` 标注）。
 */
export type StaffTie = {
  key: string;
  eventIndex: number;
  edge: 'complete' | 'outgoing' | 'incoming';
  /** 弧左缘（rpx） */
  left: number;
  /** 盒上缘；弧端点在该盒的中线、弧顶在盒底 */
  top: number;
  width: number;
  height: number;
};

export type StaffGeometry = {
  heads: StaffHead[];
  rests: StaffRestMark[];
  /** 音符附点 / 休止符附点：统一成「锚点右缘 + 中心 y」 */
  dots: { key: string; noteRightX: number; centerY: number }[];
  stems: { key: string; x: number; y1: number; y2: number }[];
  /** x1/x2 已含小程序 `w = lastX - firstX + 3` */
  beams: { key: string; x1: number; x2: number; y: number }[];
  flags: { key: string; stemX: number; stemEndY: number; beamCount: number; direction: StemDirection }[];
  /** top = 小程序 `.tuplet-number` 文本框上缘 */
  tuplets: { key: string; x: number; top: number }[];
  ties: StaffTie[];
  bars: number[];
  barIndices: number[];
  /** 参与排布的音符锚点（供答题命中层复用，等价小程序 hitTargets 的 x/y） */
  targets: { eventIndex: number; noteIndex: number; midi: number; spelling: string; step: number; x: number; y: number }[];
};

type EvStem = {
  idx: number;
  /** 该音符是连音组硬边界（休止 / 全音符） */
  break?: boolean;
  x?: number;
  leftX?: number;
  rightX?: number;
  up?: boolean;
  step?: number;
  beamCount?: number;
  tuplet?: boolean;
  topY?: number;
  botY?: number;
  bar?: boolean;
  beamGroup?: number;
};

export function staffEventIsRest(event: StaffEvent) {
  return Boolean(event && event.rest) || Number(event && event.dur) < 0;
}

/** 小程序 roundGeometry：2 位小数（与 staff-layout 的 round 同口径） */
function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** 实心符头列宽：既是横向列宽，也是休止符对中的基准（小程序 headW） */
export function staffBlackHeadWidth() {
  return noteheadBox('black', 0, 0).width;
}

/**
 * `staff-notation.js` 的 `layout()` 纯函数版本。
 */
export function buildStaffGeometry(events: StaffEvent[], options: StaffGeometryOptions = {}): StaffGeometry {
  const list = Array.isArray(events) ? events.filter(Boolean) : [];
  const width = Math.max(1, Number(options.width) || DEFAULT_STAFF_WIDTH_RPX);
  const meter = String(options.meter || '');
  const beamMeter = String(options.beamMeter || '');
  const keySignature = String(options.keySignature || '');
  const horizontal = horizontalLayout(list, {
    width,
    meter,
    beamMeter,
    keySignature,
    barCount: options.barCount,
    answerSlots: options.answerSlots,
  });

  const heads: StaffHead[] = [];
  const rests: StaffRestMark[] = [];
  const dots: StaffGeometry['dots'] = [];
  const targets: StaffGeometry['targets'] = [];
  const evStem: EvStem[] = [];
  const tiePoints: ({ x: number; y: number } | null)[] = [];
  const tripletItems: { idx: number; up: boolean; step: number | null; topY: number; botY: number; headCenterX: number }[] = [];

  const headW = staffBlackHeadWidth();
  const beatSize = beamMeter || meter;
  let beamBar: number | undefined;
  let elapsed = 0;

  list.forEach((event, index) => {
    const columnLeft = horizontal.centers[index] - headW / 2;
    const bar = horizontal.barIndices[index];
    const startsBar = index > 0 && bar !== horizontal.barIndices[index - 1];
    const dur = Number(event.dur) || 1;
    if (bar !== beamBar) {
      beamBar = bar;
      elapsed = 0;
    }
    const beamGroup = beamGroupAtBeat(elapsed, beatSize);
    elapsed += Math.abs(dur);
    const notation = durationNotation(dur);

    // ---- 休止符 ----
    if (staffEventIsRest(event)) {
      const box = restBox(notation.restKind, columnLeft, STAFF_LINE_TOP, STAFF_LINE_GAP, headW);
      const right = box.left + box.width;
      const dotCenterY = STAFF_LINE_TOP + STAFF_LINE_GAP * 1.5 + STAFF_LINE_CENTER_OFFSET;
      rests.push({ key: `r-${index}`, eventIndex: index, centerX: columnLeft + headW / 2, kind: notation.restKind, right, dotCenterY });
      if (notation.dotCount) dots.push({ key: `d-${index}`, noteRightX: right, centerY: dotCenterY });
      evStem.push({ idx: index, break: true, bar: startsBar });
      return;
    }

    // ---- 五线谱音符 ----
    const midis = Array.isArray(event.midis) ? event.midis : [];
    const spellings = Array.isArray(event.spellings) ? event.spellings : [];
    const pitched = midis
      .map((midi, noteIndex) => ({ midi, noteIndex, spelling: spellings[noteIndex] }))
      .sort((left, right) => left.midi - right.midi);
    // 记谱音高：先把「拼写」折算到该字母的自然音再算谱位，等价小程序 spell()/stepOf()
    const written = pitched.map((note) => naturalMidiForPitchSpelling(note.midi, note.spelling));
    const steps = written.map((midi) => staffStepFromWrittenMidi(midi));

    let previousStep: number | null = null;
    let shifted = false;
    const headInfos: { step: number; centerX: number; centerY: number; left: number; right: number }[] = [];

    pitched.forEach((note, noteIndex) => {
      const step = steps[noteIndex];
      let dx = 0;
      if (previousStep !== null && Math.abs(step - previousStep) === 1) {
        shifted = !shifted;
        dx = shifted ? SECOND_HEAD_DX : 0;
      } else {
        shifted = false;
      }
      previousStep = step;

      const centerX = horizontal.centers[index] + dx;
      const centerY = staffSvgYFromWrittenMidi(written[noteIndex]);
      const box = noteheadBox(notation.headKind, centerX, centerY, STAFF_LINE_GAP);
      const acc = staffAccidental(note.midi, note.spelling, keySignature);
      const ledgerYs = ledgerLineYs(written[noteIndex]);
      const ledgerX = box.left + box.width / 2 - LEDGER_WIDTH / 2;

      heads.push({
        key: `n-${index}-${noteIndex}`,
        eventIndex: index,
        noteIndex: note.noteIndex,
        midi: note.midi,
        spelling: note.spelling,
        step,
        centerX,
        centerY,
        headKind: notation.headKind,
        headLeft: box.left,
        headRight: box.left + box.width,
        acc,
        ledgerX,
        ledgerYs,
      });
      targets.push({ eventIndex: index, noteIndex: note.noteIndex, midi: note.midi, spelling: note.spelling || '', step, x: centerX, y: centerY });
      headInfos.push({ step, centerX, centerY, left: box.left, right: box.left + box.width });
    });

    if (notation.dotCount && headInfos.length) {
      const anchor = headInfos[0];
      const dotCenterY = Math.abs(anchor.step) % 2 === 0 ? anchor.centerY - STAFF_LINE_GAP / 2 : anchor.centerY;
      dots.push({ key: `d-${index}`, noteRightX: Math.max(...headInfos.map((head) => head.right)), centerY: dotCenterY });
    }

    // 连音线锚点：本事件组内**最低**符头的中心（小程序 tiePoints[i]）。
    // 无符干（全音符）与有符干走同一套锚点，先算再决定是否提前 return。
    tiePoints[index] = { x: horizontal.centers[index], y: Math.max(...headInfos.map((head) => head.centerY)) };

    // 全音符无符干，但仍是连音组硬边界，防止横梁跨小节误连
    if (!notation.hasStem) {
      evStem.push({ idx: index, break: true, bar: startsBar });
      return;
    }

    const averageStep = steps.reduce((sum, value) => sum + value, 0) / Math.max(1, steps.length);
    const up = averageStep < 4;
    const topY = Math.min(...headInfos.map((head) => head.centerY));
    const botY = Math.max(...headInfos.map((head) => head.centerY));
    const stemInset = STAFF_LINE_GAP * 0.2;
    const leftX = Math.min(...headInfos.map((head) => head.left)) + stemInset;
    const rightX = Math.max(...headInfos.map((head) => head.right)) - stemInset;

    evStem.push({
      idx: index,
      x: up ? rightX : leftX,
      leftX,
      rightX,
      up,
      step: averageStep,
      beamCount: notation.beamCount,
      tuplet: notation.tuplet,
      topY,
      botY,
      bar: startsBar,
      beamGroup,
    });
    if (notation.tuplet) {
      tripletItems.push({ idx: index, up, step: averageStep, topY, botY, headCenterX: horizontal.centers[index] });
    }
  });

  // ---- 符干 / 连符杠 / 独立符尾 ----
  const stems: StaffGeometry['stems'] = [];
  const beams: StaffGeometry['beams'] = [];
  const flags: StaffGeometry['flags'] = [];
  const stemLength = STEM_LENGTH;
  const beamThickness = BEAM_THICKNESS;
  const staffHeight = STAFF_HEIGHT_RPX;
  let run: EvStem[] = [];

  const addFlag = (stem: EvStem) => {
    const stemEndY = stem.up ? (stem.topY as number) - stemLength : (stem.botY as number) + stemLength;
    flags.push({
      key: `f-${stem.idx}`,
      stemX: stem.x as number,
      stemEndY,
      beamCount: Number(stem.beamCount) || 0,
      direction: stem.up ? 'up' : 'down',
    });
  };

  const flushRun = () => {
    if (run.length === 1) {
      const single = run[0];
      stems.push({
        key: `s-${single.idx}`,
        x: single.x as number,
        y1: single.up ? (single.topY as number) - stemLength : (single.botY as number),
        y2: single.up ? (single.topY as number) : (single.botY as number) + stemLength,
      });
      addFlag(single);
    } else if (run.length >= 2) {
      // 组内方向不一致时，取离第三线最远的音符定方向
      const anchor = run.reduce((best, item) => (Math.abs((item.step as number) - 4) > Math.abs((best.step as number) - 4) ? item : best), run[0]);
      const beamUp = Boolean(anchor.up);
      const beamX = (item: EvStem) => (beamUp ? (item.rightX as number) : (item.leftX as number));
      const firstX = beamX(run[0]);
      const lastX = beamX(run[run.length - 1]);
      let beamY = beamUp
        ? Math.min(...run.map((item) => (item.topY as number) - stemLength))
        : Math.max(...run.map((item) => (item.botY as number) + stemLength));
      if (run.some((item) => item.tuplet)) {
        beamY = fitTupletBeamY(beamY, beamUp ? 'up' : 'down', staffHeight, TUPLET_NUMBER_HEIGHT, TUPLET_GAP, beamThickness);
      }
      beams.push({ key: `b-${run[0].idx}`, x1: firstX, x2: lastX + BEAM_EXTEND, y: beamY });

      let sub: EvStem[] = [];
      const flushSub = () => {
        const secondaryY = beamY + (beamUp ? BEAM_GAP : -BEAM_GAP);
        if (sub.length >= 2) {
          const subStart = beamX(sub[0]);
          const subEnd = beamX(sub[sub.length - 1]);
          beams.push({ key: `b2-${sub[0].idx}`, x1: subStart, x2: subEnd + BEAM_EXTEND, y: secondaryY });
        } else if (sub.length === 1) {
          // 独立二级符杠画成 beamlet：组首向右，其余向左
          const note = sub[0];
          const noteX = beamX(note);
          const beamletX = note.idx === run[0].idx ? noteX : noteX - BEAMLET_WIDTH;
          beams.push({ key: `bl-${note.idx}`, x1: beamletX, x2: beamletX + BEAMLET_WIDTH, y: secondaryY });
        }
        sub = [];
      };
      run.forEach((item) => {
        if ((item.beamCount as number) >= 2) sub.push(item);
        else flushSub();
      });
      flushSub();

      run.forEach((item) => {
        stems.push({
          key: `s-${item.idx}`,
          x: beamX(item),
          y1: beamUp ? beamY : (item.botY as number),
          y2: beamUp ? (item.botY as number) : beamY,
        });
      });
    }
    run = [];
  };

  evStem.forEach((item) => {
    if (item.break) {
      flushRun();
      return;
    }
    if (item.bar) flushRun();
    if ((item.beamCount as number) > 0) {
      if (run.length && run[run.length - 1].beamGroup !== item.beamGroup) flushRun();
      if (run.length && Boolean(run[run.length - 1].tuplet) !== Boolean(item.tuplet)) flushRun();
      run.push(item);
      return;
    }
    flushRun();
    stems.push({
      key: `s-${item.idx}`,
      x: item.x as number,
      y1: item.up ? (item.topY as number) - stemLength : (item.botY as number),
      y2: item.up ? (item.topY as number) : (item.botY as number) + stemLength,
    });
  });
  flushRun();

  // ---- 三连音「3」：放横梁外侧、对齐组内中间音符 ----
  const tuplets: StaffGeometry['tuplets'] = [];
  let tripletGroup: typeof tripletItems = [];
  const flushTriplet = () => {
    if (!tripletGroup.length) return;
    const dist = (step: number | null) => Math.abs((step == null ? 4 : step) - 4);
    const anchor = tripletGroup.reduce((best, item) => (dist(item.step) > dist(best.step) ? item : best), tripletGroup[0]);
    const middle = tripletGroup[Math.floor(tripletGroup.length / 2)];
    let top: number;
    if (anchor.up) {
      const beamY = fitTupletBeamY(Math.min(...tripletGroup.map((item) => item.topY)) - stemLength, 'up', staffHeight, TUPLET_NUMBER_HEIGHT, TUPLET_GAP, beamThickness);
      top = beamY - TUPLET_GAP - TUPLET_NUMBER_HEIGHT;
    } else {
      const beamY = fitTupletBeamY(Math.max(...tripletGroup.map((item) => item.botY)) + stemLength, 'down', staffHeight, TUPLET_NUMBER_HEIGHT, TUPLET_GAP, beamThickness);
      top = beamY + beamThickness + TUPLET_GAP;
    }
    tuplets.push({ key: `t-${tripletGroup[0].idx}`, x: middle.headCenterX, top });
    tripletGroup = [];
  };
  tripletItems.forEach((item) => {
    if (tripletGroup.length && item.idx !== tripletGroup[tripletGroup.length - 1].idx + 1) flushTriplet();
    tripletGroup.push(item);
  });
  flushTriplet();

  // ---- 连音线（staff-notation.js 尾段）----
  // 内缩用**黑符头列宽**（headW），不是各符头自身宽度 —— 与小程序的 tieInset 一致。
  const ties: StaffTie[] = [];
  const tieInset = headW * TIE_INSET_RATIO;
  list.forEach((event, index) => {
    const point = tiePoints[index];
    if (!point) return;
    const top = round2(point.y + STAFF_LINE_GAP * TIE_BASELINE_RATIO);
    if (event.tieFromPrevious) {
      const right = point.x - tieInset;
      const left = Math.max(TIE_MIN_LEFT, right - TIE_EXTENT);
      ties.push({ key: `tie-in-${index}`, eventIndex: index, edge: 'incoming', left: round2(left), top, width: round2(right - left), height: TIE_HEIGHT });
    }
    if (event.tieToNext) {
      const next = tiePoints[index + 1];
      const left = point.x + tieInset;
      const right = next ? next.x - tieInset : Math.min(width - TIE_RIGHT_PAD, left + TIE_EXTENT);
      if (right > left) ties.push({ key: `tie-out-${index}`, eventIndex: index, edge: next ? 'complete' : 'outgoing', left: round2(left), top, width: round2(right - left), height: TIE_HEIGHT });
    }
  });

  return { heads, rests, dots, stems, beams, flags, tuplets, ties, bars: horizontal.bars, barIndices: horizontal.barIndices, targets };
}
