import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const {
  answerIsComplete,
  emptyExamAnswer,
  formatCorrectAnswer,
  formatExamAnswer,
  scoreQuestion,
} = await import('../src/core/exam-answer.ts');
const {
  ANSWER_STAFF_HEIGHT,
  naturalMidiFromStaffTapY,
  staffSvgYFromWrittenMidi,
  staffViewBoxWidth,
  writtenMidiFromStaffSvgY,
} = await import('../src/core/staff-coordinate.ts');
const {
  augmentationDotY,
  barlineBounds,
  chordHeadOffsets,
  durationNotation,
  fitTupletBeamY,
  ledgerLineYs,
  noteheadStemStart,
  noteheadStemX,
  STAFF_LINE_YS,
  STAFF_MIDDLE_LINE_Y,
  STAFF_STROKE_WIDTH,
  staffStepFromWrittenMidi,
  stemDirectionForWrittenMidis,
} = await import('../src/core/music-notation.ts');
const {
  ACCIDENTAL_GAP,
  DEFAULT_STAFF_WIDTH_RPX,
  FIXED_BAR_LEFT_COMPACT,
  FIXED_BAR_RIGHT_COMPACT,
  LEDGER_WIDTH,
  RPX_TO_PT,
  SECOND_HEAD_DX,
  STAFF_FIRST_LINE_Y,
  STAFF_HEIGHT_RPX,
  STAFF_LAST_LINE_Y,
  STAFF_LINE_GAP,
  STAFF_LINE_TOP,
  STAFF_STEP_GAP,
  STEM_LENGTH,
  TIE_HEIGHT,
  barlineHeight,
  barlineTop,
  emptyTextCenterY,
  glyphSize,
  horizontalLayout,
  noteheadBox,
} = await import('../src/core/staff-layout.ts');
const { buildStaffGeometry } = await import('../src/core/staff-notation-geometry.ts');
const {
  accidentalGlyphForPitch,
  accidentalGlyphForKeySignature,
  defaultPitchSpelling,
  formatPitchSpelling,
  naturalMidiForPitchSpelling,
  staffAccidental,
} = await import('../src/core/pitch-spelling.ts');
const { eventSignature, practiceAnswerCorrect, targetTimedEvents } = await import('../src/core/answer-sync.ts');
const { DEFAULT_AUDIO_VOLUME, parseStoredVolume } = await import('../src/core/audio-settings.ts');
const { pianoPlaybackConfig } = await import('../src/core/piano-playback.ts');
const require = createRequire(import.meta.url);
const questionCore = require('../src/core/legacy/question.js');
const pcmRenderer = require('../src/core/legacy/pcm-renderer.js');
const projectSource = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const { midiToName } = require('../src/core/legacy/theory.js');

const tabsLayoutUrl = new URL('../src/app/(tabs)/_layout.tsx', import.meta.url);
assert.ok(existsSync(tabsLayoutUrl), '首页、错题、我的、举手必须接入同一个原生 Tabs 路由组');
const tabsSource = readFileSync(tabsLayoutUrl, 'utf8');
const rootLayoutSource = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
const tabScreens = [...tabsSource.matchAll(/<Tabs\.Screen\b[\s\S]*?\/>/g)].map(([screen]) => ({
  name: screen.match(/name="([^"]+)"/)?.[1],
  title: screen.match(/title:\s*'([^']+)'/)?.[1],
  icon: screen.match(/tabBarIcon:\s*miniTabIcon\('([^']+)'\)/)?.[1],
}));
assert.deepEqual(tabScreens, [
  { name: 'index', title: '首页', icon: 'index' },
  { name: 'wrongbook', title: '错题', icon: 'wrongbook' },
  { name: 'stats', title: '我的', icon: 'stats' },
  { name: 'about', title: '举手', icon: 'about' },
], '四个原生标签必须保持公开路由、顺序、可读标签和图标对应关系');
assert.match(tabsSource, /import\s*\{\s*Tabs\s*\}\s*from 'expo-router'/);
assert.match(tabsSource, /headerShown:\s*false/);
assert.match(tabsSource, /tabBarActiveTintColor:\s*Brand\.forest/);
assert.match(tabsSource, /tabBarInactiveTintColor:\s*Brand\.disabled/);
assert.equal((tabsSource.match(/tabBarIcon:\s*miniTabIcon\('(?:index|wrongbook|stats|about)'\)/g) || []).length, 4, '四个标签必须全部使用小程序原图图标');
assert.doesNotMatch(tabsSource, /<AppIcon\b/, '底部导航不得再用手绘或 SF Symbol 图标（必须是小程序原图）');
assert.match(tabsSource, /<Image\b[\s\S]*?TAB_ICONS\[key\]\.active[\s\S]*?TAB_ICONS\[key\]\.normal/, '底部导航必须按 focused 在选中/未选中原图之间切换');
assert.doesNotMatch(tabsSource, /tintColor/, '原图已带小程序配色（#a7b0ad / #1f6f5b），不得再 tint');
// 否定断言必须扫「代码」而不是「源码文本」：`(tabs)/_layout.tsx` 里会写反面说明
// （「不要在这里覆盖底部导航栏的样式」之类的注释），对全文断言会把说明文字误判成违规。
// stripComments 定义在本文件下方，是函数声明（提升），此处可安全前向引用。
assert.doesNotMatch(stripComments(tabsSource), /tabBar\s*=|tabBarStyle|safeAreaInsets/, '标签栏必须保留框架默认布局及底部安全区');
for (const name of ['index', 'wrongbook', 'stats', 'about']) {
  assert.ok(existsSync(new URL(`../src/app/(tabs)/${name}.tsx`, import.meta.url)), `${name} 页面必须位于 Tabs 组内`);
  assert.equal(existsSync(new URL(`../src/app/${name}.tsx`, import.meta.url)), false, `${name} 不能重复注册根路由`);
}
assert.equal((rootLayoutSource.match(/<Stack\.Screen name="\(tabs\)" options=\{\{ headerShown: false \}\}/g) || []).length, 1);
assert.doesNotMatch(rootLayoutSource, /<Stack\.Screen name="(?:index|wrongbook|stats|about)"/);
for (const name of ['practice', 'exam', 'exam-paper', 'province-select', 'subscribe', 'terms', 'support']) {
  assert.ok(existsSync(new URL(`../src/app/${name}.tsx`, import.meta.url)), `${name} 详情流程必须留在根 Stack`);
}
const resolverSource = rootLayoutSource.match(/function publicRouteFromSegments\(segments: string\[\]\)\s*\{[\s\S]*?\n\}/)?.[0];
assert.ok(resolverSource, '根布局必须提供可验证的纯公开路由解析函数');
const { transpile } = require('typescript');
const publicRouteFromSegments = new Function(`${transpile(resolverSource)}; return publicRouteFromSegments;`)();
for (const [segments, expected] of [
  [[], undefined], [['(tabs)'], undefined], [['(tabs)', 'index'], 'index'],
  [['(tabs)', 'wrongbook'], 'wrongbook'], [['(tabs)', 'stats'], 'stats'],
  [['(outer)', '(tabs)', 'about'], 'about'], [['practice'], 'practice'],
  [['province-select'], 'province-select'],
]) {
  assert.equal(publicRouteFromSegments(segments), expected, `分组路由 ${segments.join('/')} 解析错误`);
}
assert.equal((rootLayoutSource.match(/const route = publicRouteFromSegments\(segments\);/g) || []).length, 2, '订阅和省份守卫都必须使用公开路由');
assert.doesNotMatch(rootLayoutSource, /segments\[0\]/, '权限守卫不能把路由组当作公开页面');

const homeSource = readFileSync(new URL('../src/app/(tabs)/index.tsx', import.meta.url), 'utf8');
const themeSource = readFileSync(new URL('../src/constants/theme.ts', import.meta.url), 'utf8');
const handIconSource = readFileSync(new URL('../src/components/hand-icon.tsx', import.meta.url), 'utf8');
const appIconSource = readFileSync(new URL('../src/components/app-icon.tsx', import.meta.url), 'utf8');
const provinceSource = readFileSync(new URL('../src/core/provinces.ts', import.meta.url), 'utf8');

const iconBranch = (source, name, nextName) => {
  const start = source.indexOf(`{name === '${name}' && (`);
  const end = source.indexOf(`{name === '${nextName}' && (`, start + 1);
  assert.notEqual(start, -1, `缺少 ${name} SVG 图标分支`);
  assert.notEqual(end, -1, `无法确定 ${name} SVG 图标分支边界`);
  return source.slice(start, end);
};
const tagCount = (source, tag) => (source.match(new RegExp(`<${tag}\\b`, 'g')) || []).length;
const propNumber = (source, prop) => {
  const match = source.match(new RegExp(`${prop}=\\{(-?\\d+(?:\\.\\d+)?)\\}`));
  assert.ok(match, `${prop} 必须使用可验证的数值坐标`);
  return Number(match[1]);
};
const relativeLuminance = (hex) => {
  const channels = hex.slice(1).match(/../g).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};
const contrastRatio = (foreground, background) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
};

const singleIconBranch = iconBranch(handIconSource, 'single-note', 'triplet');
const tripletIconBranch = iconBranch(handIconSource, 'triplet', 'interval');
const intervalIconBranch = iconBranch(handIconSource, 'interval', 'chord');
const chordIconBranch = iconBranch(handIconSource, 'chord', 'rhythm');
const rhythmIconBranch = iconBranch(handIconSource, 'rhythm', 'mixed');
const mixedIconBranch = iconBranch(handIconSource, 'mixed', 'target');
const targetIconBranch = iconBranch(handIconSource, 'target', 'book');

assert.match(handIconSource, /const SW = 1\.7;/, '训练图标必须保留统一 1.7 笔画');
assert.match(singleIconBranch, /\(\s*<G>\s*<Ellipse\b/, '单音边界计算要求符头与符干不再叠加外层旋转');
assert.equal(tagCount(singleIconBranch, 'Ellipse'), 1, '单音图标必须只有一个空心符头');
assert.equal(tagCount(singleIconBranch, 'Line'), 1, '单音图标必须只有一根符干');
assert.match(singleIconBranch, /<Ellipse\b[^>]*stroke=\{color\}[^>]*strokeWidth=\{SW\}[^>]*fill="none"/, '单音符头必须空心并使用统一笔画');
assert.equal(tagCount(tripletIconBranch, 'Ellipse'), 3, '音组图标必须包含三个符头');
assert.equal(tagCount(tripletIconBranch, 'Line'), 3, '音组图标必须包含三根符干');
assert.match(tripletIconBranch, /<G fill=\{color\} stroke=\{color\} strokeWidth=\{SW\} strokeLinecap="round">/, '音组三音必须使用统一实心圆角笔画');
assert.equal(tagCount(intervalIconBranch, 'Ellipse'), 2, '音程图标必须包含两个符头');
assert.equal((intervalIconBranch.match(/<Ellipse\b[^>]*fill=\{color\}/g) || []).length, 2, '音程的两个符头必须实心');
assert.equal(tagCount(intervalIconBranch, 'Line'), 2, '音程图标必须包含两根符干');
assert.equal(tagCount(chordIconBranch, 'Ellipse'), 3, '和弦图标必须包含三个符头');
assert.equal((chordIconBranch.match(/<Ellipse\b[^>]*fill="none"/g) || []).length, 3, '和弦的三个符头必须空心');
assert.equal(tagCount(chordIconBranch, 'Line'), 0, '全音符和弦不能带符干');
assert.equal(tagCount(rhythmIconBranch, 'Line'), 5, '节奏图标必须包含四条交叉线和一条下划线');
assert.equal((rhythmIconBranch.match(/strokeLinecap="round"/g) || []).length, 5, '节奏线端必须全部圆润');
assert.equal(tagCount(mixedIconBranch, 'Rect'), 1, '模拟考试图标必须包含纸张轮廓');
assert.equal(tagCount(mixedIconBranch, 'Path'), 1, '模拟考试图标必须包含折角');
assert.equal(tagCount(mixedIconBranch, 'Line'), 2, '模拟考试图标必须包含两条答题线');
assert.equal(tagCount(mixedIconBranch, 'Ellipse'), 2, '模拟考试图标必须包含两个音符标记');
assert.equal(tagCount(targetIconBranch, 'Circle'), 3, '智能强化图标必须包含三个同心圆');
assert.equal(tagCount(targetIconBranch, 'Line'), 2, '智能强化靶心必须使用两条线组成加号');
assert.match(handIconSource, /M27 43c-7 0-10-5-8-10 2-5 10-6 14-2 4 4 1 11-5 11-7 0-11-8-8-16 3-10 13-15 12-21-1-4-5-2-6 2-2 7 4 14 7 21/, '首页高音谱号没有使用确认的矢量轮廓');
assert.match(handIconSource, /<Line x1=\{21\} y1=\{24\} x2=\{27\} y2=\{24\}/, '智能强化靶心横线必须留在最内圈内');
assert.match(handIconSource, /<Line x1=\{24\} y1=\{21\} x2=\{24\} y2=\{27\}/, '智能强化靶心竖线必须留在最内圈内');

const singleEllipse = singleIconBranch.match(/<Ellipse\b[^>]*\/>/)?.[0] || '';
const singleStem = singleIconBranch.match(/<Line\b[^>]*\/>/)?.[0] || '';
const singleRotation = Number(singleEllipse.match(/transform="rotate\((-?\d+(?:\.\d+)?)/)?.[1]);
assert.ok(Number.isFinite(singleRotation), '单音符头必须提供可验证的旋转角度');
const radians = singleRotation * Math.PI / 180;
const ellipseHalfWidth = Math.hypot(propNumber(singleEllipse, 'rx') * Math.cos(radians), propNumber(singleEllipse, 'ry') * Math.sin(radians)) + 1.7 / 2;
const ellipseHalfHeight = Math.hypot(propNumber(singleEllipse, 'rx') * Math.sin(radians), propNumber(singleEllipse, 'ry') * Math.cos(radians)) + 1.7 / 2;
const singleBounds = {
  left: Math.min(propNumber(singleEllipse, 'cx') - ellipseHalfWidth, propNumber(singleStem, 'x1') - 1.7 / 2),
  right: Math.max(propNumber(singleEllipse, 'cx') + ellipseHalfWidth, propNumber(singleStem, 'x1') + 1.7 / 2),
  top: Math.min(propNumber(singleEllipse, 'cy') - ellipseHalfHeight, propNumber(singleStem, 'y1') - 1.7 / 2),
  bottom: Math.max(propNumber(singleEllipse, 'cy') + ellipseHalfHeight, propNumber(singleStem, 'y2') + 1.7 / 2),
};
assert.ok(singleBounds.left >= 6 && singleBounds.right <= 42 && singleBounds.top >= 6 && singleBounds.bottom <= 42, `单音图标可见边界超出 36×36 光学校准框：${JSON.stringify(singleBounds)}`);
assert.ok(Math.abs((singleBounds.left + singleBounds.right) / 2 - 24) <= 0.25, `单音图标没有水平居中：${JSON.stringify(singleBounds)}`);

// ⚠️ 断言要扫「代码」而不是「源码文本」：注释里常把已经删掉的东西当反面说明写下来
// （例如「历史上这里有个 NAV_VIEW_BOX 手绘分支，已删除」），对全文断言会把说明文字
// 误判成违规。本文件与 tab-icon-smoke.cjs 都踩过这个坑。
// ⚠️ 用函数声明（不是 const 箭头函数）：本文件顶部第 98 行那条否定断言也要用它，
// 函数声明会提升，const 会因 TDZ 直接抛 ReferenceError。
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
const appIconCode = stripComments(appIconSource);

// 底部导航图标改用小程序原图之后，这里只守「App 端手绘那一套已彻底删除」；
// 字节级一致性、25pt 盒子口径、顺序/文案与 app.json 的对应，由 scripts/tab-icon-smoke.cjs 负责。
assert.doesNotMatch(appIconCode, /NAV_VIEW_BOX|NAV_STROKE_WIDTH|NavigationIconName/, '手绘导航图标分支必须已删除（底部导航改用小程序原图）');
assert.doesNotMatch(appIconCode, /react-native-svg/, 'AppIcon 不得再引用 react-native-svg');
for (const handDrawn of ['headphones', 'wrongbookTab', 'profile', 'hand']) {
  assert.doesNotMatch(appIconCode, new RegExp(`name === '${handDrawn}'`), `${handDrawn} 不得再作为 AppIcon 的手绘分支存在`);
}
assert.match(appIconCode, /wrongbook: \['checklist', 'fact_check'\]/, '非导航错题图标必须继续使用原生符号');
assert.doesNotMatch(appIconCode, /name === 'wrongbook'(?:\s*\|\||\s*&&)/, '导航分支不能截获非导航 wrongbook 图标');
assert.match(provinceSource, /group:\s*\{[^\r\n]*icon:\s*['"]triplet['"]/, '旋律音组必须使用独立三音图标');
assert.match(homeSource, /<LinearGradient\b[^>]*style=\{styles\.heroDivider\}[^>]*\/?>(?:[\s\S]*?)?/, '首页数据区必须渲染渐隐分割线样式');
assert.match(homeSource, /heroDivider\s*:\s*\{/, '首页必须定义渐隐分割线样式');
assert.match(homeSource, /<View\b[^>]*style=\{styles\.heroWave\}[^>]*\/?>(?:[\s\S]*?)?/, '首页英雄卡必须渲染受限波形样式');
assert.match(homeSource, /heroWave\s*:\s*\{/, '首页必须定义受限波形样式');
assert.match(homeSource, /memberStatusButton\s*:\s*\{/, '会员按钮必须定义受约束的独立样式');
assert.match(homeSource, /<View\b[^>]*pointerEvents="none"[^>]*style=\{styles\.heroWave\}/, '首页波形必须是不可交互的装饰层');
assert.match(homeSource, /hero\s*:\s*\{[^\r\n]*overflow:\s*['"]hidden['"]/, '首页英雄卡必须裁切底部波形');
assert.match(homeSource, /heroWave\s*:\s*\{[^\r\n]*position:\s*['"]absolute['"][^\r\n]*bottom:\s*0[^\r\n]*height:\s*40/, '首页波形必须固定在英雄卡底部受限区域');
assert.match(homeSource, /heroData\s*:\s*\{[^\r\n]*zIndex:\s*1/, '首页数据文字必须位于波形之上');
assert.match(homeSource, /<LinearGradient\b[^>]*colors=\{\[[^\]]*rgba\(255,255,255,0\)[^\]]*rgba\(255,255,255,\.28\)[^\]]*rgba\(255,255,255,0\)[^\]]*\]\}[^>]*style=\{styles\.heroDivider\}/, '首页数据分割线必须向两端渐隐');
assert.match(homeSource, /heroDivider\s*:\s*\{[^\r\n]*width:\s*1\.2/, '首页数据分割线中心宽度必须为 1.2 点');
assert.match(homeSource, /memberStatusBar\s*:\s*\{[^\r\n]*paddingHorizontal:\s*8[^\r\n]*backgroundColor:\s*Brand\.ivory/, '会员状态条必须保留白色内边距');
assert.match(homeSource, /memberStatusButton\s*:\s*\{[^\r\n]*width:\s*['"]40%['"][^\r\n]*\.\.\.Btn\.home\.inviteButton/, '会员按钮必须复用小程序 .invite-button（46rpx）的共享尺寸令牌');
assert.match(homeSource, /hitSlop=\{hitSlopFor\(Btn\.home\.inviteButton\.height\)\}[\s\S]{0,240}?styles\.memberStatusButton/, '会员按钮缩到 46rpx 后必须用 hitSlop 补回 44pt 触控区');
const memberMetaStyle = homeSource.match(/memberStatusMeta\s*:\s*\{([^\r\n]*)\}/)?.[1] || '';
const memberMetaColor = memberMetaStyle.match(/color:\s*['"](#[0-9a-fA-F]{6})['"]/)?.[1];
assert.ok(memberMetaColor, '会员元数据必须使用局部十六进制颜色');
const memberBarBackground = themeSource.match(/\bivory:\s*['"](#[0-9a-fA-F]{6})['"]/)?.[1];
assert.ok(memberBarBackground, '会员状态条背景必须使用可验证的 Brand.ivory 颜色');
assert.ok(contrastRatio(memberMetaColor, memberBarBackground) >= 4.5, `会员元数据与状态条背景对比度必须至少为 4.5:1（实际为 ${contrastRatio(memberMetaColor, memberBarBackground).toFixed(2)}:1）`);
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

const rhythmBar = [1, -0.5, 0.5];
const rhythmQuestion = { ...base, type: 'rhythm', meter: '2/4', beats: Array.from({ length: 6 }, () => rhythmBar).flat(), answerMode: 'rhythm' };
const rhythmAnswer = {
  ...emptyExamAnswer(),
  meter: '2/4',
  events: Array.from({ length: 6 }, () => [
    { midi: 69, duration: 1 },
    { midi: 69, duration: 0.5, rest: true },
    { midi: 69, duration: 0.5 },
  ]).flat(),
};
assert.equal(scoreQuestion(rhythmQuestion, rhythmAnswer).score, 4);
assert.equal(answerIsComplete(rhythmQuestion, rhythmAnswer), true);

const melodyQuestion = {
  ...base,
  type: 'melody',
  meter: '2/4',
  keySignature: 'G',
  midis: Array.from({ length: 8 }, () => [67, 69]).flat(),
  durs: Array.from({ length: 16 }, () => 1),
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
assert.equal(scoreQuestion(twoBarQuestion, oneBarCorrect).score, 2.33, '模拟考节奏题没有按拍号 2 分 + 每个正确小节分摊剩余分计分');
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

const nearEquals = (actual, expected, label) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= 0.005,
  `${label}：${actual} ≠ ${expected}`,
);

// 谱面画布高 70pt（140rpx），触摸点经 [0.05,1.5] 之外的换算必须回到同一个自然音。
// viewBox 与渲染盒的换算对所有画布高都成立（1 单位 = 画布高/140 pt），
// 所以 70pt（当前）与 122pt（旧紧凑谱）都要能往返。
const naturalMidis = [55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];
naturalMidis.forEach((midi) => {
  for (const renderedHeight of [ANSWER_STAFF_HEIGHT, 122]) {
    const renderedTapY = staffSvgYFromWrittenMidi(midi) * renderedHeight / STAFF_HEIGHT_RPX;
    assert.equal(naturalMidiFromStaffTapY(renderedTapY, renderedHeight, 55, 81), midi,
      `${renderedHeight}pt 画布上点击没有回到 MIDI ${midi}`);
  }
  assert.equal(writtenMidiFromStaffSvgY(staffSvgYFromWrittenMidi(midi)), midi, `记谱音高必须往返一致：${midi}`);
});

// 谱线锚点来自小程序 staff-layout.js：lineTop 30 / lineGap 15 / 第一线（E4）= 91
assert.equal(STAFF_LINE_TOP, 30, '高音谱表必须使用小程序紧凑谱的 lineTop');
assert.equal(STAFF_LINE_GAP, 15, '高音谱表必须使用小程序紧凑谱的 lineGap');
assert.equal(STAFF_STEP_GAP, 7.5, '相邻音级间距必须等于半个谱线间距');
assert.deepEqual(STAFF_LINE_YS, [31, 46, 61, 76, 91], '五线谱必须固定使用五个共享 rpx 线中心');
assert.equal(STAFF_FIRST_LINE_Y, 91, 'E4 第一线必须落在 y=91');
assert.equal(STAFF_LAST_LINE_Y, 31, '最顶线必须落在 y=31');
assert.equal(STAFF_HEIGHT_RPX, 140, '谱面内容高必须是 140rpx');
assert.equal(RPX_TO_PT, 0.5, '1rpx 必须等于 0.5pt');
assert.equal(ANSWER_STAFF_HEIGHT, 70, '画布渲染高必须是 140rpx = 70pt');
assert.equal(staffViewBoxWidth(375), 750, '375pt 宽的容器必须映射成 750rpx 的 viewBox');
assert.equal(barlineTop(), 31, '小节线必须从最顶线中心开始');
assert.equal(barlineTop() + barlineHeight(), 91, '小节线必须在第一线中心结束');
assert.equal(emptyTextCenterY(), 61, '空态文字必须垂直居中于第三线');
assert.equal(staffSvgYFromWrittenMidi(64), 91, 'E4 必须落在高音谱表第一线');
assert.equal(staffSvgYFromWrittenMidi(67), 76, 'G4 必须落在高音谱表第二线');
assert.equal(staffSvgYFromWrittenMidi(77), 31, 'F5 必须落在高音谱表第五线');
assert.equal(defaultPitchSpelling(80), 'G#5', 'MIDI 80 不应回退成 C5');
assert.equal(naturalMidiForPitchSpelling(80), 79, 'G#5 必须写在 G5 的谱位');
assert.equal(staffSvgYFromWrittenMidi(naturalMidiForPitchSpelling(80)), 23.5, 'G#5 谱位必须位于第五线上方的间');
assert.equal(accidentalGlyphForPitch(80), '♯', 'G#5 谱面必须显示升号');
assert.equal(accidentalGlyphForKeySignature(66, 'F#4', 'G'), '', 'G 大调中 F♯ 不应重复标临时升号');
assert.equal(accidentalGlyphForKeySignature(65, 'Fn4', 'G'), '♮', 'G 大调中 F♮ 必须显示还原号');
assert.equal(accidentalGlyphForKeySignature(70, 'Bb4', 'F'), '', 'F 大调中 B♭ 不应重复标临时降号');
assert.equal(formatPitchSpelling(80), 'G♯5', '谱面与答案文本必须使用同一音名');
assert.equal(staffAccidental(66, 'F#4', 'G'), '', 'staffAccidental 必须与 accidentalGlyphForKeySignature 同判');
assert.equal(staffAccidental(65, 'F4', 'G'), 'n', 'G 大调里被调号改变的自然音必须落还原号');
assert.equal(staffAccidental(61, 'C#4', 'G'), '#', '调号外临时记号必须保留');
assert.deepEqual(ledgerLineYs(60), [106], '中央 C 必须显示第一条下加线');
assert.deepEqual(ledgerLineYs(57), [106, 121], '下加二线必须与下加一线保持标准谱线间距');
assert.equal(ledgerLineYs(57)[1] - ledgerLineYs(57)[0], STAFF_LINE_GAP, '相邻下加线间距必须等于共享谱线距');
assert.equal(barlineBounds().top, STAFF_LINE_YS[0], '小节线必须从第一线中心开始');
assert.equal(barlineBounds().bottom, STAFF_LINE_YS[4], '小节线必须在第五线中心结束');
assert.deepEqual(ledgerLineYs(81), [16], 'A5 必须显示第一条上加线');
assert.deepEqual(ledgerLineYs(79), [], 'G5 位于第五线上方的间，不应误加线');
assert.deepEqual(noteheadStemStart(40, 40, 6, 'up', STAFF_LINE_GAP), { x: 43, y: 41 }, '向上符干起点必须与符头几何重叠');
assert.deepEqual(noteheadStemStart(40, 40, 6, 'down', STAFF_LINE_GAP), { x: 37, y: 39 }, '向下符干起点必须与符头几何重叠');
assert.equal(STAFF_STROKE_WIDTH, 2, '五线谱主线与加线必须使用统一 2rpx 线宽');
assert.equal(noteheadStemX(100, 5.9, 'up', STAFF_LINE_GAP), 102.9, 'iOS 向上符干没有伸入符头右侧');
assert.equal(noteheadStemX(100, 5.9, 'down', STAFF_LINE_GAP), 97.1, 'iOS 向下符干没有伸入符头左侧');
assert.equal(fitTupletBeamY(6, 'up', STAFF_HEIGHT_RPX, 18, 4, 4), 22, 'iOS 三连音横梁没有为上方数字预留空间');
assert.equal(fitTupletBeamY(128, 'down', STAFF_HEIGHT_RPX, 18, 4, 4), 114, 'iOS 下方三连音标记可能越出谱面');

// 升号在小程序里是「字形缩 0.9 档 + 锚点不动」；App 侧合并进 glyphSize 的 sharpScale。
assert.equal(glyphSize('sharp').width / (249 * STAFF_LINE_GAP / 250), 0.9, '升号必须缩小 10%');
nearEquals(glyphSize('flat').width, 226 * STAFF_LINE_GAP / 250, '降号必须保持原始缩放');
nearEquals(glyphSize('natural').width, 168 * STAFF_LINE_GAP / 250, '还原号必须保持原始缩放');
assert.equal(noteheadBox('black', 0, 0).width, 17.7, '实心符头列宽必须是 295 × 15/250');
nearEquals(noteheadBox('whole', 0, 0).width, 25.32, '全音符头宽度必须是 422 × 15/250');
assert.equal(LEDGER_WIDTH, 31.2, '加线宽必须与小程序 .staff-compact .ledger 一致');
assert.equal(SECOND_HEAD_DX, 12.96, '二度错位位移必须与小程序一致');
assert.equal(STEM_LENGTH, 45.36, '紧凑谱符干长度必须与小程序一致');
assert.equal(TIE_HEIGHT, 10, '紧凑谱连音线盒高必须与小程序一致');
assert.equal(ACCIDENTAL_GAP, 5, '临时记号右缘间距必须与小程序一致');

// ⚠️ 关键不变量：小程序 noteheadGlyph 收到的是「黑符头列左缘」，
// App 侧收到「音符中心」。两种入参算出的 bbox 左缘必须逐值相同，
// 否则整个「以中心为锚点」的符干/加线/附点/命中层都会整体偏移。
const columnLeft = 300 - noteheadBox('black', 0, 0).width / 2;
const round2 = (value) => Math.round(value * 100) / 100;
assert.equal(noteheadBox('whole', 300, 91).left,
  round2(columnLeft - (noteheadBox('whole', 0, 0).width - noteheadBox('black', 0, 0).width) / 2),
  '全音符头重定位后左缘必须与小程序一致');
assert.equal(noteheadBox('black', 300, 91).left, round2(columnLeft), '实心符头左缘必须与小程序一致');
// 三处谱面必须共用同一个绘制出口；几何只能在 staff-notation-geometry 里算一次。
const rendererComponents = ['src/components/answer-staff.tsx', 'src/components/notation-editor.tsx', 'src/components/staff-preview.tsx'];
for (const component of rendererComponents) {
  const source = projectSource(component);
  assert.match(source, /from '@\/components\/staff-notation'/, `${component} 没有走共享谱面绘制出口`);
  assert.doesNotMatch(source, /react-native-svg/, `${component} 仍自带 SVG 绘制`);
  assert.doesNotMatch(source, /STAFF_LINE_YS\.map|accidentalColumns|COMPACT_STAFF_HEIGHT|MUSIC_STAFF_VIEW_BOX|chordHeadOffsets|noteheadStemX\(/, `${component} 仍有旧版谱面几何残留`);
  assert.doesNotMatch(source, /Platform\.OS/, `${component} 仍包含平台专属谱面定位`);
}
const notationSource = projectSource('src/components/staff-notation.tsx');
assert.match(notationSource, /buildStaffGeometry\(/, '共享绘制组件必须使用单源几何');
assert.match(notationSource, /preserveAspectRatio="none"/, '共享绘制组件必须用 rpx viewBox 拉伸（等价小程序绝对 rpx 定位）');
assert.match(notationSource, /geometry\.ties\.map/, '共享绘制组件必须画连音线');
assert.equal((notationSource.match(/STAFF_LINE_YS\.map\(/g) || []).length, 1, '五条谱线只允许在一个地方绘制');
// 绘制顺序必须复刻小程序 staff-notation.wxml：
// 谱号 → 调号 → 拍号 → 谱线 → 小节线 → (加线 → 临时记号 → 符头) → 休止符 → 连音线 → 符干 → 符杠 → 符尾 → 附点 → 三连音
// ⚠️ 只能在 JSX 内容里找标记：import 语句里也有这些组件名。
const drawOrder = ['header.clefGlyph', 'header.keyGlyph', 'header.meterGlyphs', 'STAFF_LINE_YS.map', 'geometry.bars.map',
  'head.ledgerYs.map', 'MusicAccidental', 'MusicNotehead', 'geometry.rests.map', 'geometry.ties.map',
  'geometry.stems.map', 'geometry.beams.map', 'geometry.flags.map', 'geometry.dots.map', 'geometry.tuplets.map'];
const jsxContent = notationSource.slice(notationSource.indexOf('const content = ('));
assert.ok(jsxContent.length > 0, '无法定位共享绘制组件的 JSX 内容');
drawOrder.forEach((marker, index) => {
  const position = jsxContent.indexOf(marker);
  assert.notEqual(position, -1, `共享绘制组件缺少 ${marker} 分支`);
  if (index > 0) {
    assert.ok(jsxContent.indexOf(drawOrder[index - 1]) < position, `${marker} 必须晚于 ${drawOrder[index - 1]} 绘制（小程序 wxml 顺序）`);
  }
});
const glyphSource = projectSource('src/components/music-glyphs.tsx');
assert.match(glyphSource, /export function MusicAccidental\(/, '共享字形组件缺少 SVG 临时记号');
assert.match(glyphSource, /from '@\/core\/music-glyph-paths'/, '临时记号必须用 Bravura 轮廓，不能退回字体基线');
assert.doesNotMatch(glyphSource, /<SvgText[^>]*>\s*[♯♭♮]\s*<\/SvgText>/, '临时记号不能以字体基线定位');
for (const component of ['src/components/answer-staff.tsx', 'src/components/notation-editor.tsx']) {
  const source = projectSource(component);
  assert.match(source, /buildStaffGeometry\(/, `${component} 的命中层没有复用共享几何`);
  assert.doesNotMatch(source, /noteheadStemStart\(|noteheadStemX\(/, `${component} 不应再自己算符干锚点`);
}
const previewSource = projectSource('src/components/staff-preview.tsx');
assert.match(previewSource, /dur: 4/, '全音符预览必须落成 dur=4（全音符无符干）');
assert.doesNotMatch(previewSource, /harmonicStemDirection|stemHeadX|MUSIC_STAFF_VIEW_BOX/, '谱例预览不应再自己算和弦符干轴');
const notation = projectSource('src/components/notation-editor.tsx');
assert.match(notation, /isFinalSystem: boolean;/, '分行谱表必须显式接收是否为最终系统');
const fourBarSystemCount = Math.ceil(4 / 2);
assert.deepEqual(Array.from({ length: fourBarSystemCount }, (_, systemIndex) => systemIndex === fourBarSystemCount - 1), [false, true], '四小节谱面只能在第二系统显示终止线对');
assert.equal((notation.match(/isFinalSystem=\{systemIndex === systems - 1\}/g) || []).length, 3, '作答行、标准答案行、只读预览行都必须只把最后一个系统标成终止系统');
assert.equal((notation.match(/isFinalSystem(?!=)/g) || []).length, 4, '单谱面（staffWidth）分支必须无条件按终止系统绘制');
assert.equal(notation.match(/last=\{isFinalSystem\}/)?.[0], 'last={isFinalSystem}', '终止线对必须由共享组件按 last 决定，调用方不再自己画线');
assert.equal((notationSource.match(/endline-thin|endline-thick/g) || []).length, 2, '细粗两道终止线只允许在共享组件里绘制');

// ---- 单源几何的数值契约（rpx）----
assert.equal(STAFF_MIDDLE_LINE_Y, 61, '第三线必须是谱面中线');
assert.equal(durationNotation(4).headKind, 'whole', '四拍时值必须使用全音符头');
assert.equal(durationNotation(4).hasStem, false, '全音符不能显示符干');
assert.equal(durationNotation(2).headKind, 'half', '二拍时值必须使用二分音符头');
assert.equal(durationNotation(2).hasStem, true, '二分音符必须显示符干');
assert.equal(durationNotation(1 / 3).tuplet, true, '三连音必须在时值表里显式标记');
assert.equal(stemDirectionForWrittenMidis([71]), 'down', '第三线 B4 的符干必须向下');
assert.equal(stemDirectionForWrittenMidis([69]), 'up', '第三线下方 A4 的符干必须向上');
assert.deepEqual(chordHeadOffsets([60, 62, 64]), [0, SECOND_HEAD_DX, 0], '连续二度和弦的符头必须交替错位');
assert.equal(augmentationDotY(64), 83.5, '在线上的 E4 附点必须移入上方间');
assert.equal(augmentationDotY(65), 83.5, '在间上的 F4 附点必须保持同一高度');
assert.deepEqual(horizontalLayout([{ midis: [60], dur: 1 }], { width: DEFAULT_STAFF_WIDTH_RPX }).centers, [296.1], '单音必须落在容器 47% 处');
assert.deepEqual(horizontalLayout([], { width: DEFAULT_STAFF_WIDTH_RPX, barCount: 2 }).bars, [367], '两小节空谱面必须只有一条内部分隔线');
assert.deepEqual(
  [0, 1, 2].map((slot) => horizontalLayout(
    [{ midis: [60], dur: 1, inputSlot: slot }], { width: DEFAULT_STAFF_WIDTH_RPX, answerSlots: 3 }).centers[0]),
  [153.33, 344, 534.67], '固定答题区域的槽位锚点必须等分容器');
assert.equal(FIXED_BAR_LEFT_COMPACT + (DEFAULT_STAFF_WIDTH_RPX - FIXED_BAR_LEFT_COMPACT - FIXED_BAR_RIGHT_COMPACT) / 2,
  367, '小节分栏的左界必须让出谱头宽度（112rpx）');

const singleNote = buildStaffGeometry([{ midis: [60], dur: 1 }], { width: DEFAULT_STAFF_WIDTH_RPX });
assert.deepEqual(Object.keys(singleNote).sort(), ['barIndices', 'bars', 'beams', 'dots', 'flags', 'heads', 'rests', 'stems', 'targets', 'ties', 'tuplets'], '共享几何必须产出全部标注层');
assert.equal(singleNote.heads.length, 1);
nearEquals(singleNote.heads[0].centerX, 296.1, '中央 C 符头中心 x');
nearEquals(singleNote.heads[0].centerY, 106, '中央 C 符头中心 y（第一线）');
nearEquals(singleNote.heads[0].headLeft, 287.25, '中央 C 符头左缘');
nearEquals(singleNote.heads[0].headRight, 304.95, '中央 C 符头右缘');
nearEquals(singleNote.heads[0].ledgerX, 280.5, '中央 C 下加线左缘');
assert.deepEqual(singleNote.heads[0].ledgerYs, [106], '中央 C 必须显示下加一线');
assert.equal(singleNote.heads[0].acc, '', 'C4 不需要临时记号');
assert.equal(singleNote.heads[0].headKind, 'black', '四分音符必须使用实心符头');
nearEquals(singleNote.targets[0].x, 296.1, '命中层 x 必须与符头中心同源');
nearEquals(singleNote.targets[0].y, 106, '命中层 y 必须与符头中心同源');
assert.deepEqual(
  [singleNote.targets[0].eventIndex, singleNote.targets[0].noteIndex, singleNote.targets[0].midi, singleNote.targets[0].step],
  [0, 0, 60, -2], '命中层必须带上事件下标、原始音下标与音级');
assert.equal(singleNote.stems.length, 1, '四分音符必须有一根符干');
assert.equal(singleNote.stems[0].key, 's-0');
nearEquals(singleNote.stems[0].x, 301.95, '符干必须落在符头重叠区');
nearEquals(singleNote.stems[0].y1, 60.64, '向上符干顶端必须比符头高 45.36rpx');
nearEquals(singleNote.stems[0].y2, 106, '向上符干必须起于符头中心');
assert.deepEqual(singleNote.flags, [], '四分音符不能画符尾');
assert.deepEqual(singleNote.beams, [], '单音不能画符杠');
assert.deepEqual(singleNote.ties, [], '没有连音标记时不能画连音线');

const keyedSharp = buildStaffGeometry([{ midis: [66], dur: 1 }], { width: DEFAULT_STAFF_WIDTH_RPX, keySignature: 'G' });
const keyedNatural = buildStaffGeometry([{ midis: [65], dur: 1 }], { width: DEFAULT_STAFF_WIDTH_RPX, keySignature: 'G' });
assert.equal(keyedSharp.heads[0].acc, '', '调号已含的 F♯ 不能重复标临时升号');
assert.equal(keyedNatural.heads[0].acc, 'n', '被调号改变的自然音必须显示还原号');

const tied = buildStaffGeometry([
  { midis: [69], dur: 1, tieToNext: true }, { midis: [69], dur: 1 },
], { width: DEFAULT_STAFF_WIDTH_RPX, meter: '2/4' });
assert.equal(tied.ties.length, 1, '连至下一音必须画一条连音线');
assert.equal(tied.ties[0].key, 'tie-out-0');
assert.equal(tied.ties[0].edge, 'complete', '两音都在本系统内时必须画完整弧');
assert.equal(tied.ties[0].height, TIE_HEIGHT, '连音线盒高必须与小程序一致');
assert.equal(tied.ties[0].width > 0, true, '连音线必须有正宽度');
const outgoing = buildStaffGeometry([{ midis: [69], dur: 1, tieToNext: true }], { width: DEFAULT_STAFF_WIDTH_RPX, meter: '2/4' });
assert.equal(outgoing.ties[0].edge, 'outgoing', '系统末音的连音线必须标成出弧');
assert.equal(round2(outgoing.ties[0].width), 32, '跨系统出弧必须保留 32rpx 兜底弧长');
const incoming = buildStaffGeometry([{ midis: [69], dur: 1, tieFromPrevious: true }], { width: DEFAULT_STAFF_WIDTH_RPX, meter: '2/4' });
assert.equal(incoming.ties[0].key, 'tie-in-0', '由上一系统连入必须画入弧');

const restful = buildStaffGeometry([
  { midis: [64], dur: 0.75 }, { midis: [69], dur: -0.75, rest: true },
], { width: DEFAULT_STAFF_WIDTH_RPX, meter: '2/4' });
assert.equal(restful.rests.length, 1, '负时值必须渲染成休止符');
assert.equal(restful.rests[0].kind, 'eighth', '附点八分休止必须用八分休止字形');
assert.equal(restful.dots.length, 2, '附点音符与附点休止必须各带一个附点');
assert.equal(restful.stems.length, 1, '休止符不能生成符干');

const fixedSharpQuestion = { type: 'single', midis: [80] };
const fixedSharpNotes = pcmRenderer.buildQuestionTimeline(fixedSharpQuestion).events
  .filter((event) => event.type === 'note' && event.start > 1);
assert.deepEqual(fixedSharpNotes.map((event) => event.midi), [80], 'G#5 音频没有使用与题目一致的 MIDI 80');
assert.equal(midiToName(80), '#G5', 'G#5 的答案文本与 MIDI 80 不一致');

assert.equal(DEFAULT_AUDIO_VOLUME, 80);
assert.equal(parseStoredVolume(''), 80, '首次安装不应被空缓存静音');
assert.equal(parseStoredVolume('0'), 0, '用户保存的静音设置必须保留');
assert.equal(parseStoredVolume(150), 100);
assert.equal(parseStoredVolume(-10), 0);

for (let midi = 55; midi <= 81; midi++) {
  assert.deepEqual(pianoPlaybackConfig(midi), { sampleMidi: midi, playbackRate: 1 },
    `复盘钢琴 MIDI ${midi} 必须直接播放对应采样，不能变速移调`);
}
assert.equal(pianoPlaybackConfig(54), null);
assert.equal(pianoPlaybackConfig(82), null);
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
    } else {
      // 节奏 / 旋律的「标准答案」由 answer-sync.targetTimedEvents 定义：题库原题优先
      // （带连音线标记），退回 beats/durs。测试直接用同一份，保证判题依据的
      // 就是学生看到的谱面，不会出现「谱面画对了却判错」。
      generatedAnswer = {
        ...generatedAnswer,
        meter: question.meter,
        keySignature: question.keySignature,
        events: targetTimedEvents(question),
      };
    }
    assert.equal(scoreQuestion(question, generatedAnswer).correct, true, `${type} 的真实生成题未能判定正确`);
  }
}

// 连音线必须参与判题 —— 小程序 practice.js: eventSignature 的第 3 段就是 tieToNext。
assert.equal(eventSignature({ midi: 69, duration: 1, tieToNext: true }), '69:1:1', '连出的音符签名必须带 1');
assert.equal(eventSignature({ midi: 69, duration: 1 }), '69:1:0', '未连的音符签名必须带 0');
assert.equal(eventSignature({ midi: 69, duration: -1, rest: true, tieToNext: true }), 'r:1', '休止符不得把连音线写进签名');
const tiedRhythmQuestion = {
  ...base,
  type: 'rhythm',
  meter: '2/4',
  beatsPerBar: 2,
  barCount: 1,
  beats: [1, 1],
  rhythmEvents: [[{ duration: 1, tieToNext: true }, { duration: 1 }]],
};
const tiedStandardAnswer = { ...emptyExamAnswer(), meter: '2/4', events: targetTimedEvents(tiedRhythmQuestion) };
assert.equal(tiedStandardAnswer.events[0].tieToNext, true, '题库原题的连音线必须透传到标准答案');
assert.equal(tiedStandardAnswer.events[1].tieFromPrevious, true, '连入的音符必须自动带上 tieFromPrevious');
assert.equal(answerIsComplete(tiedRhythmQuestion, tiedStandardAnswer), true);
assert.equal(scoreQuestion(tiedRhythmQuestion, tiedStandardAnswer).correct, true, '带连音线的标准答案必须判对');
assert.equal(
  scoreQuestion(tiedRhythmQuestion, {
    ...tiedStandardAnswer,
    events: tiedStandardAnswer.events.map((event) => ({ ...event, tieToNext: false, tieFromPrevious: false })),
  }).correct,
  false,
  '漏掉连音线必须判错（与小程序 eventSignature 一致）',
);

const connectionQuestion = {
  ...base,
  type: 'intervalConnection',
  chords: [[60, 64], [62, 69]],
  answer: [[60, 64], [62, 69]],
};
assert.equal(scoreQuestion(connectionQuestion, { ...emptyExamAnswer(), pitches: [64, 60, 69, 62] }).correct, true);

console.log('答题评分测试通过：真实随机题、谱面坐标、音高、音程连接、和弦、节奏、旋律与四选一均正常。');
