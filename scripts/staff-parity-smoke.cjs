/**
 * 五线谱标注跨端对账 —— 跑**小程序自己的** components/staff-notation/staff-notation.js `layout()`，
 * 与 App 端 src/core/staff-notation-geometry.ts `buildStaffGeometry()` 逐字段比对。
 *
 * 为什么不是「把期望值手抄进断言」：手抄的值会随小程序改动静默过期。这份脚本每次直接
 * 执行小程序源码，任何一端的几何漂移都会立刻报错 —— 这才是「两端同步」的可执行证据。
 *
 * 覆盖：符头位置/错位、调号抑制与还原号、加线、附点、休止符、符干、连符杠、次级符杠
 * beamlet、独立符尾、三连音「3」、连音线（含跨系统出入弧）、小节线与固定答题区域。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const iosRoot = path.resolve(__dirname, '..');
const miniprogramRoot = path.resolve(iosRoot, '..');

// ---------------------------------------------------------------- 小程序原版 layout
function loadMiniComponent(file) {
  const previous = global.Component;
  let definition = null;
  global.Component = (value) => { definition = value; };
  try {
    delete require.cache[require.resolve(file)];
    require(file);
  } finally {
    global.Component = previous;
  }
  assert.ok(definition && definition.methods, `小程序组件没有被捕获：${file}`);
  return definition;
}

const miniFile = path.join(miniprogramRoot, 'components/staff-notation/staff-notation.js');
assert.ok(fs.existsSync(miniFile), `找不到小程序谱面组件：${miniFile}`);
const miniDefinition = loadMiniComponent(miniFile);
const miniLayout = miniDefinition.methods.layout;
const miniDefaults = Object.fromEntries(
  Object.entries(miniDefinition.properties).map(([key, property]) => [key, property.value]),
);

/** 用伪造的 `this` 跑小程序 layout()，返回它最后一次 setData 的音符层载荷 */
function runMiniLayout(events, options = {}) {
  const data = { ...miniDefaults, compact: true, drum: false, tone: '', ...options };
  let payload = null;
  const context = {
    data,
    setData(patch) {
      Object.assign(data, patch);
      if (Array.isArray(patch.notes)) payload = patch;
    },
  };
  miniLayout.call(context, events);
  assert.ok(payload, '小程序 layout() 没有产出 notes 载荷');
  return payload;
}

// ---------------------------------------------------------------- App 端几何
const moduleCache = new Map();
function loadTypeScript(file) {
  const resolved = path.resolve(file);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;
  const module = { exports: {} };
  moduleCache.set(resolved, module);
  const compiled = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (request) => {
    if (!request.startsWith('.')) return require(request);
    const base = path.resolve(path.dirname(resolved), request);
    const candidate = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find((item) => fs.existsSync(item) && fs.statSync(item).isFile());
    assert.ok(candidate, `找不到模块：${request}（来自 ${path.relative(iosRoot, resolved)}）`);
    return /\.tsx?$/.test(candidate) ? loadTypeScript(candidate) : require(candidate);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}

const { buildStaffGeometry, staffBlackHeadWidth } = loadTypeScript(path.join(iosRoot, 'src/core/staff-notation-geometry.ts'));
const iosLayout = loadTypeScript(path.join(iosRoot, 'src/core/staff-layout.ts'));
const LINE_GAP = iosLayout.STAFF_LINE_GAP;
/** 小程序 notes[].x 是「黑符头列的左缘」，App 的 centerX 是音符中心 —— 相差半个列宽 */
const BLACK_HEAD_HALF = staffBlackHeadWidth() / 2;
const TOLERANCE = 0.02;

// ---------------------------------------------------------------- 比对工具
let comparisons = 0;
function near(actual, expected, label) {
  comparisons += 1;
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= TOLERANCE,
    `${label}：App ${actual} ≠ 小程序 ${expected}`);
}
function same(actual, expected, label) {
  comparisons += 1;
  assert.deepEqual(actual, expected, label);
}
function sameKeys(miniList, iosList, label) {
  comparisons += 1;
  assert.deepEqual([...miniList.map((item) => item.key)].sort(), [...iosList.map((item) => item.key)].sort(), `${label} 元素集合不一致`);
}

function compareFixture(name, events, options = {}) {
  // 小程序 answer-staff 固定传 width=630（设计宽，不是容器宽）；两端必须用同一个 width 才有可比性
  const width = Number(options.width) || iosLayout.DEFAULT_STAFF_WIDTH_RPX;
  const mine = runMiniLayout(events, { ...options, width });
  const ios = buildStaffGeometry(events, {
    width,
    meter: options.meter || '',
    beamMeter: options.beamMeter || '',
    keySignature: options.keySignature || '',
    barCount: Number(options.barCount) || 0,
    answerSlots: Number(options.answerSlots) || 0,
  });
  const at = (label) => `${name} · ${label}`;

  // ---- 小节线 ----
  same(ios.bars, mine.bars.map((bar) => bar.x), at('小节线 x'));

  // ---- 符头 ----
  comparisons += 1;
  assert.equal(ios.heads.length, mine.notes.length, at('符头数量'));
  sameKeys(mine.notes, ios.heads, at('符头 key'));
  mine.notes.forEach((note, index) => {
    const head = ios.heads[index];
    near(head.centerX, note.x + BLACK_HEAD_HALF, at(`符头[${index}] 中心 x`));
    near(head.headLeft, note.left, at(`符头[${index}] 左缘`));
    near(head.headRight, note.left + note.width, at(`符头[${index}] 右缘`));
    near(head.centerY, note.top + note.height / 2, at(`符头[${index}] 中心 y`));
    same(head.acc, note.acc, at(`符头[${index}] 临时记号`));
    same(head.headKind, note.headKind, at(`符头[${index}] 符头类型`));
    same(head.headKind !== 'black', note.hollow, at(`符头[${index}] 空心`));
    near(head.ledgerX, note.ledgerX, at(`符头[${index}] 加线左缘`));
    same(head.ledgerYs, note.ledgers.map((ledger) => ledger.y), at(`符头[${index}] 加线 y`));
  });

  // ---- 休止符 ----
  comparisons += 1;
  assert.equal(ios.rests.length, mine.rests.length, at('休止符数量'));
  mine.rests.forEach((rest, index) => {
    const mark = ios.rests[index];
    same(mark.kind, rest.kind, at(`休止符[${index}] 类型`));
    near(mark.centerX, rest.left + rest.width / 2, at(`休止符[${index}] 中心 x`));
    near(mark.right, rest.left + rest.width, at(`休止符[${index}] 右缘`));
  });

  // ---- 附点 ----
  sameKeys(mine.dots, ios.dots, at('附点 key'));
  mine.dots.forEach((dot, index) => {
    const mark = ios.dots[index];
    near(mark.noteRightX, dot.left - LINE_GAP * 0.25, at(`附点[${index}] 锚点右缘`));
    near(mark.centerY, dot.top + dot.height / 2, at(`附点[${index}] 中心 y`));
  });

  // ---- 符干 ----
  sameKeys(mine.stems, ios.stems, at('符干 key'));
  mine.stems.forEach((stem, index) => {
    const bar = ios.stems[index];
    near(bar.x, stem.x, at(`符干[${index}] x`));
    near(Math.min(bar.y1, bar.y2), stem.y, at(`符干[${index}] 顶端`));
    near(Math.max(bar.y1, bar.y2), stem.y + stem.h, at(`符干[${index}] 底端`));
  });

  // ---- 连符杠 / 次级符杠 / beamlet ----
  sameKeys(mine.beams, ios.beams, at('符杠 key'));
  mine.beams.forEach((beam, index) => {
    const bar = ios.beams[index];
    near(bar.x1, beam.x, at(`符杠[${index}] 左端`));
    near(bar.x2, beam.x + beam.w, at(`符杠[${index}] 右端`));
    near(bar.y, beam.y, at(`符杠[${index}] y`));
  });

  // ---- 独立符尾 ----
  sameKeys(mine.flags, ios.flags, at('符尾 key'));
  mine.flags.forEach((flag, index) => {
    const tail = ios.flags[index];
    same(tail.direction, flag.direction, at(`符尾[${index}] 方向`));
    same(tail.beamCount >= 2 ? 'sixteenth' : 'eighth', flag.kind, at(`符尾[${index}] 时值`));
    near(tail.stemX, flag.left, at(`符尾[${index}] 锚点 x`));
  });

  // ---- 三连音「3」 ----
  sameKeys(mine.tuplets, ios.tuplets, at('三连音 key'));
  mine.tuplets.forEach((tuplet, index) => {
    const mark = ios.tuplets[index];
    near(mark.x, tuplet.x, at(`三连音[${index}] x`));
    near(mark.top, tuplet.y, at(`三连音[${index}] top`));
  });

  // ---- 连音线 ----
  sameKeys(mine.ties, ios.ties, at('连音线 key'));
  mine.ties.forEach((tie, index) => {
    const arc = ios.ties[index];
    near(arc.left, tie.left, at(`连音线[${index}] 左缘`));
    near(arc.top, tie.top, at(`连音线[${index}] 上缘`));
    near(arc.width, tie.width, at(`连音线[${index}] 宽`));
    near(arc.height, tie.height, at(`连音线[${index}] 高`));
    same(arc.edge, tie.edge, at(`连音线[${index}] 跨系统标记`));
  });

  return { mine, ios };
}

// ---------------------------------------------------------------- 固定样例
const quarter = (midi, extra = {}) => ({ midis: [midi], dur: 1, ...extra });
const eighth = (midi) => ({ midis: [midi], dur: 0.5 });
const ties = [];

ties.push(compareFixture('单音 C4 四分', [quarter(60)]));
ties.push(compareFixture('单音 A5 二分（上加一线）', [{ midis: [81], dur: 2 }]));
ties.push(compareFixture('单音 C4 全音符（下加一线 / 无符干）', [{ midis: [60], dur: 4 }]));
ties.push(compareFixture('F4 全音符（第一间）', [{ midis: [65], dur: 4 }]));
ties.push(compareFixture('二度和弦错位', [{ midis: [61, 63], dur: 2 }]));
ties.push(compareFixture('C 大三和弦', [{ midis: [60, 64, 67], dur: 4 }]));
ties.push(compareFixture('附点四分 + 附点八分休止', [
  { midis: [64], dur: 0.75 },
  { midis: [69], dur: -0.75, rest: true },
]));
ties.push(compareFixture('2/4 四个八分（两条连符杠）', [eighth(69), eighth(69), eighth(69), eighth(69)], { meter: '2/4' }));
ties.push(compareFixture('2/4 十六分组（次级符杠 + beamlet）', [
  { midis: [69], dur: 0.5 }, { midis: [69], dur: 0.25 }, { midis: [69], dur: 0.25 }, { midis: [69], dur: 0.5 },
], { meter: '2/4' }));
ties.push(compareFixture('3/8 三连音（数字 3）', [
  { midis: [69], dur: 1 / 3 }, { midis: [69], dur: 1 / 3 }, { midis: [69], dur: 1 / 3 },
], { meter: '3/8' }));
ties.push(compareFixture('6/8 六音三连音组', Array.from({ length: 6 }, () => ({ midis: [69], dur: 1 / 3 })), { meter: '6/8' }));
ties.push(compareFixture('G 大调：F♯ 不重复标注', [{ midis: [66], dur: 1 }], { keySignature: 'G' }));
ties.push(compareFixture('G 大调：F♮ 必须还原', [{ midis: [65], dur: 1 }], { keySignature: 'G' }));
ties.push(compareFixture('F 大调：B♭ 不重复标注', [{ midis: [70], dur: 1 }], { keySignature: 'F' }));
ties.push(compareFixture('F 大调：B♮ 必须还原', [{ midis: [71], dur: 1 }], { keySignature: 'F' }));
ties.push(compareFixture('多小节（barIndex 0/1）', [
  { midis: [60], dur: 1, barIndex: 0 }, { midis: [62], dur: 1, barIndex: 0 },
  { midis: [64], dur: 1, barIndex: 1 }, { midis: [65], dur: 1, barIndex: 1 },
], { meter: '2/4', barCount: 2 }));
ties.push(compareFixture('跨小节（bar 标记）', [
  { midis: [60], dur: 1 }, { midis: [60], dur: 1 }, { midis: [62], dur: 1, bar: true }, { midis: [62], dur: 1 },
], { meter: '2/4', barCount: 2 }));
ties.push(compareFixture('连音线（同系统内）', [
  { midis: [69], dur: 1, tieToNext: true }, { midis: [69], dur: 1 },
], { meter: '2/4' }));
ties.push(compareFixture('连音线（末尾出弧）', [
  quarter(69), { midis: [69], dur: 1, tieToNext: true },
], { meter: '2/4' }));
ties.push(compareFixture('连音线（入弧）', [
  { midis: [69], dur: 1, tieFromPrevious: true }, quarter(69),
], { meter: '2/4' }));
ties.push(compareFixture('音域两端（G3 / A5）', [
  { midis: [55], dur: 1 }, { midis: [81], dur: 1 },
], { meter: '2/4' }));
ties.push(compareFixture('固定答题区域（三音组 inputSlot）', [
  { midis: [60], dur: 1, inputSlot: 0 }, { midis: [64], dur: 1, inputSlot: 1 }, { midis: [67], dur: 1, inputSlot: 2 },
], { answerSlots: 3 }));
ties.push(compareFixture('空谱面 + 两小节（只画小节线）', [], { barCount: 2 }));
ties.push(compareFixture('空谱面 + 拍号（谱头占位）', [], { meter: '4/4' }));
ties.push(compareFixture('自定义 width（选择题宽谱）', [
  quarter(60), quarter(62), quarter(64), quarter(65),
], { width: 900, barCount: 2, meter: '2/4' }));
ties.push(compareFixture('2/4 混合时值 + 休止 + 连音线', [
  { midis: [60], dur: 0.75, tieToNext: true }, { midis: [60], dur: 0.5 },
  { midis: [69], dur: -0.25, rest: true }, { midis: [67], dur: 0.25 }, { midis: [64], dur: 1, bar: true },
], { meter: '2/4', barCount: 2 }));
ties.push(compareFixture('和弦 + 连音线 + 附点', [
  { midis: [60, 64, 67], dur: 3, tieToNext: true }, { midis: [60, 64], dur: 1 },
], { meter: '4/4' }));

const totalled = ties.reduce((sum, item) => ({ heads: sum.heads + item.ios.heads.length, ties: sum.ties + item.ios.ties.length, bars: sum.bars + item.ios.bars.length }), { heads: 0, ties: 0, bars: 0 });
assert.ok(ties.length >= 25, '对账样例必须覆盖全部标注分支');
assert.ok(totalled.heads >= 60 && totalled.bars >= 5 && totalled.ties >= 5, `样例覆盖不足：${JSON.stringify(totalled)}`);

// ---------------------------------------------------------------- 单一绘制出口
const read = (relative) => fs.readFileSync(path.join(iosRoot, relative), 'utf8');
const SURFACES = {
  'src/components/answer-staff.tsx': '答题谱',
  'src/components/notation-editor.tsx': '听记谱面编辑器',
  'src/components/staff-preview.tsx': '谱例预览',
};
for (const [file, label] of Object.entries(SURFACES)) {
  const source = read(file);
  assert.match(source, /from '@\/components\/staff-notation'/, `${label}（${file}）没有走共享绘制出口`);
  assert.doesNotMatch(source, /react-native-svg/, `${label}（${file}）仍然自带 SVG 绘制`);
  assert.doesNotMatch(source, /STAFF_LINE_YS\.map|accidentalColumns|COMPACT_STAFF_HEIGHT|MUSIC_STAFF_VIEW_BOX|chordHeadOffsets/, `${label}（${file}）仍有旧版谱面几何残留`);
}
const notation = read('src/components/staff-notation.tsx');
assert.match(notation, /buildStaffGeometry\(/, '共享绘制组件必须使用单源几何');
assert.match(notation, /geometry\.ties\.map/, '共享绘制组件必须画连音线');
assert.match(notation, /preserveAspectRatio="none"/, '共享绘制组件必须用 rpx viewBox 拉伸（等价小程序绝对 rpx 定位）');
assert.match(read('src/core/staff-layout.ts'), /RPX_TO_PT = 0\.5/, '1rpx = 0.5pt 的换算必须仍在单源里');

console.log(`五线谱标注跨端对账通过：${ties.length} 组样例、${comparisons} 项字段与小程序 layout() 逐值一致（符头 ${totalled.heads} / 小节线 ${totalled.bars} / 连音线 ${totalled.ties}）。`);
