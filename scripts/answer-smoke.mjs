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
  naturalMidiFromStaffTapY,
  staffSvgYFromWrittenMidi,
} = await import('../src/core/staff-coordinate.ts');
const {
  augmentationDotY,
  accidentalScale,
  barlineBounds,
  chordHeadOffsets,
  durationNotation,
  ledgerLineYs,
  noteheadStemStart,
  STAFF_LINE_GAP,
  STAFF_LINE_YS,
  stemDirectionForWrittenMidis,
  STAFF_STROKE_WIDTH,
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

const tabsLayoutUrl = new URL('../src/app/(tabs)/_layout.tsx', import.meta.url);
assert.ok(existsSync(tabsLayoutUrl), '首页、错题、我的、举手必须接入同一个原生 Tabs 路由组');
const tabsSource = readFileSync(tabsLayoutUrl, 'utf8');
const rootLayoutSource = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
const tabScreens = [...tabsSource.matchAll(/<Tabs\.Screen\b[\s\S]*?\/>/g)].map(([screen]) => ({
  name: screen.match(/name="([^"]+)"/)?.[1],
  title: screen.match(/title:\s*'([^']+)'/)?.[1],
  icon: screen.match(/<AppIcon name="([^"]+)"/)?.[1],
}));
assert.deepEqual(tabScreens, [
  { name: 'index', title: '首页', icon: 'headphones' },
  { name: 'wrongbook', title: '错题', icon: 'wrongbookTab' },
  { name: 'stats', title: '我的', icon: 'profile' },
  { name: 'about', title: '举手', icon: 'hand' },
], '四个原生标签必须保持公开路由、顺序、可读标签和图标对应关系');
assert.match(tabsSource, /import\s*\{\s*Tabs\s*\}\s*from 'expo-router'/);
assert.match(tabsSource, /headerShown:\s*false/);
assert.match(tabsSource, /tabBarActiveTintColor:\s*Brand\.forest/);
assert.match(tabsSource, /tabBarInactiveTintColor:\s*Brand\.disabled/);
assert.equal((tabsSource.match(/<AppIcon name="[^"]+" size=\{24\} color=\{color\}/g) || []).length, 4, '标签图标必须遵循选中颜色且统一为 24 点');
assert.doesNotMatch(tabsSource, /tabBar\s*=|tabBarStyle|safeAreaInsets/, '标签栏必须保留框架默认布局及底部安全区');
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

assert.match(appIconSource, /const NAV_VIEW_BOX = 48;/, '底部导航图标必须共享同一画布尺寸');
assert.match(appIconSource, /const NAV_STROKE_WIDTH = 2\.6;/, '底部导航图标必须共享同一笔画宽度');
assert.match(appIconSource, /<G fill="none" stroke=\{color\} strokeWidth=\{NAV_STROKE_WIDTH\} strokeLinecap="round" strokeLinejoin="round">/, '底部导航图标必须共享圆角笔画');
const headphonesIconBranch = iconBranch(appIconSource, 'headphones', 'wrongbookTab');
const wrongbookTabIconBranch = iconBranch(appIconSource, 'wrongbookTab', 'profile');
const profileIconBranch = iconBranch(appIconSource, 'profile', 'hand');
assert.equal(tagCount(headphonesIconBranch, 'Rect'), 2, '耳机图标必须包含两个耳罩');
assert.equal((headphonesIconBranch.match(/<Rect\b[^>]*fill=\{color\} stroke="none"/g) || []).length, 2, '两个耳罩必须全部实心');
assert.equal(tagCount(wrongbookTabIconBranch, 'Rect'), 1, '导航错题本必须保留一个书本轮廓');
assert.equal(tagCount(wrongbookTabIconBranch, 'Line'), 1, '导航错题本只能保留一条内页线');
assert.equal(tagCount(profileIconBranch, 'Circle'), 1, '我的图标必须保留头像轮廓');
assert.equal(tagCount(profileIconBranch, 'Path'), 1, '我的图标必须保留身体轮廓');
assert.equal(tagCount(profileIconBranch, 'Line'), 2, '我的图标必须保留两条分离横线');
assert.match(profileIconBranch, /<Line x1=\{34\} y1=\{33\} x2=\{41\} y2=\{33\}/, '我的图标上方横线必须与身体保持间隙');
assert.match(appIconSource, /\{name === 'hand' && \([\s\S]*?<Path\b/, '举手图标必须使用矢量路径');
assert.match(appIconSource, /wrongbook: \['checklist', 'fact_check'\]/, '非导航错题图标必须继续使用原生符号');
assert.doesNotMatch(appIconSource, /name === 'wrongbook'(?:\s*\|\||\s*&&)/, '导航分支不能截获非导航 wrongbook 图标');
assert.match(provinceSource, /group:\s*\{[^\r\n]*icon:\s*['"]triplet['"]/, '旋律音组必须使用独立三音图标');
assert.match(homeSource, /<LinearGradient\b[^>]*style=\{styles\.heroDivider\}[^>]*\/?>(?:[\s\S]*?)?/, '首页数据区必须渲染渐隐分割线样式');
assert.match(homeSource, /heroDivider\s*:\s*\{/, '首页必须定义渐隐分割线样式');
assert.match(homeSource, /<View\b[^>]*style=\{styles\.heroWave\}[^>]*\/?>(?:[\s\S]*?)?/, '首页英雄卡必须渲染受限波形样式');
assert.match(homeSource, /heroWave\s*:\s*\{/, '首页必须定义受限波形样式');
assert.match(homeSource, /<Pressable\b[^>]*style=\{[^\r\n]*styles\.memberStatusButton[^\r\n]*\}/, '会员按钮必须应用独立样式');
assert.match(homeSource, /memberStatusButton\s*:\s*\{/, '会员按钮必须定义受约束的独立样式');
assert.match(homeSource, /<View\b[^>]*pointerEvents="none"[^>]*style=\{styles\.heroWave\}/, '首页波形必须是不可交互的装饰层');
assert.match(homeSource, /hero\s*:\s*\{[^\r\n]*overflow:\s*['"]hidden['"]/, '首页英雄卡必须裁切底部波形');
assert.match(homeSource, /heroWave\s*:\s*\{[^\r\n]*position:\s*['"]absolute['"][^\r\n]*bottom:\s*0[^\r\n]*height:\s*28/, '首页波形必须固定在英雄卡底部 28 点区域');
assert.match(homeSource, /heroData\s*:\s*\{[^\r\n]*zIndex:\s*1/, '首页数据文字必须位于波形之上');
assert.match(homeSource, /<LinearGradient\b[^>]*colors=\{\[[^\]]*rgba\(255,255,255,0\)[^\]]*rgba\(255,255,255,\.28\)[^\]]*rgba\(255,255,255,0\)[^\]]*\]\}[^>]*style=\{styles\.heroDivider\}/, '首页数据分割线必须向两端渐隐');
assert.match(homeSource, /heroDivider\s*:\s*\{[^\r\n]*width:\s*1\.2/, '首页数据分割线中心宽度必须为 1.2 点');
assert.match(homeSource, /memberStatusBar\s*:\s*\{[^\r\n]*paddingHorizontal:\s*10[^\r\n]*backgroundColor:\s*Brand\.ivory/, '会员状态条必须保留 10 点白色内边距');
assert.match(homeSource, /memberStatusButton\s*:\s*\{[^\r\n]*flex:\s*0[^\r\n]*width:\s*['"]44%['"][^\r\n]*maxWidth:\s*210[^\r\n]*minWidth:\s*132[^\r\n]*marginRight:\s*10/, '会员按钮必须在紧凑屏幕内保持确认的宽度和右边距');
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
assert.deepEqual(STAFF_LINE_YS, [28, 38, 48, 58, 68], '五线谱必须固定使用五个共享 SVG 线中心');
assert.deepEqual(ledgerLineYs(60), [78], '中央 C 必须显示第一条下加线');
assert.equal(ledgerLineYs(57)[1] - ledgerLineYs(57)[0], STAFF_LINE_GAP, '相邻下加线间距必须等于共享谱线距');
assert.equal(barlineBounds().top, STAFF_LINE_YS[0], '小节线必须从第一线中心开始');
assert.equal(barlineBounds().bottom, STAFF_LINE_YS[4], '小节线必须在第五线中心结束');
assert.deepEqual(noteheadStemStart(40, 40, 6, 'up'), { x: 44, y: 41 }, '向上符干起点必须与符头几何重叠');
assert.deepEqual(noteheadStemStart(40, 40, 6, 'down'), { x: 36, y: 39 }, '向下符干起点必须与符头几何重叠');
assert.equal(accidentalScale('sharp'), 0.9, '升号必须缩小 10%');
assert.deepEqual(ledgerLineYs(81), [18], 'A5 必须显示第一条上加线');
assert.equal(STAFF_STROKE_WIDTH, 1, '五线谱主线与加线必须使用统一线宽');
assert.equal(accidentalScale('flat'), 1, '降号必须保持原始缩放');
assert.equal(accidentalScale('natural'), 1, '还原号必须保持原始缩放');
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
