const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
// 与 src/core/provinces.ts 的 getProvincePracticeModules 同序同名（防 mock 漂移）：
// 6 模块 = 专有框架省（如广西）；7 模块 = 通用模板省（含音程连接，如北京）。
const MODULE_SETS = {
  6: [
    ['single', '单音听记', 'single-note'], ['group', '音组听记', 'triplet'], ['interval', '音程听记', 'interval'],
    ['chord', '和弦听记', 'chord'], ['rhythm', '节奏听记', 'rhythm'], ['melody', '旋律听记', 'treble'],
  ],
  7: [
    ['single', '单音听记', 'single-note'], ['group', '音组听记', 'triplet'], ['interval', '音程听记', 'interval'],
    ['connection', '音程连接', 'interval'], ['chord', '和弦听记', 'chord'], ['rhythm', '节奏听记', 'rhythm'],
    ['melody', '旋律听记', 'treble'],
  ],
};
// 首页平铺规则由模块数决定：专项 + 模拟考试为奇数 → 智能强化补末行右半。
let moduleCount = 6;
const mocks = {
  react: {
    useCallback: (fn) => fn,
    useMemo: (factory) => factory(),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  },
  'react-native': {
    Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (styles) => styles, hairlineWidth: 0.5 }, Text: 'Text', View: 'View',
    Platform: { select: (values) => values.ios ?? values.default },
  },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  'expo-status-bar': { StatusBar: 'StatusBar' },
  'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
  'expo-router': { router: { push() {} }, useFocusEffect() {} },
  '@/components/app-icon': { AppIcon: 'AppIcon' },
  '@/components/hand-icon': { HandIcon: 'HandIcon' },
  '@/core/provinces': {
    PROVINCES: [{ id: 'guangxi', label: '广西', dedicated: true }],
    hasDedicatedFramework: () => true,
    getProvincePracticeModules: () => MODULE_SETS[moduleCount]
      .map(([type, name, icon]) => ({ type, name, icon, desc: `${name}说明`, tier: 3, tone: 'mint' })),
  },
  '@/services/local-data': { getPracticeStats: async () => ({ todayCount: 12, todayAccuracy: 75 }) },
  '@/services/province-context': { useProvince: () => ({ provinceId: 'guangxi' }) },
  '@/services/subscription': { useSubscription: () => ({ ready: true, configured: true, isActive: true }) },
  '@/constants/theme': {
    Brand: { forest: '#1F6F5B', forestDeep: '#173D36', cream: '#F7F7F1', ivory: '#FFFFFF', ink: '#18201E', muted: '#75827E', border: '#DEE6E2', textOnAccent: '#FFFFFF' },
    Radius: { control: 12, card: 16 }, Shadows: { card: {} }, TouchTarget: 44, TypeScale: { caption: 12, footnote: 13, subheadline: 15, title3: 20 },
  },
  '@/global.css': {},
};

const cache = new Map();
function load(request, from = root) {
  if (Object.hasOwn(mocks, request)) return mocks[request];
  if (!request.startsWith('.') && !request.startsWith('@/')) return require(request);
  const base = request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : path.resolve(from, request);
  const file = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  assert.ok(file, `test module not found: ${request}`);
  if (/\.(png|jpe?g)$/.test(file)) return file;
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)((name) => load(name, path.dirname(file)), module, module.exports);
  return module.exports;
}

function nodes(value) {
  if (value == null || typeof value === 'boolean') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (typeof value !== 'object') return [value];
  if (typeof value.type === 'function') return [value, ...nodes(value.type(value.props))];
  return [value, ...nodes(value.props?.children)];
}

function flattenStyle(style) {
  if (typeof style === 'function') return flattenStyle(style({ pressed: false }));
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flattenStyle)) : style || {};
}

/** 按指定专项模块数渲染首页：6 → 7 张（奇数）智能强化补右半；7 → 8 张（偶数）整行独占。 */
function renderHome(count) {
  moduleCount = count;
  cache.clear();
  return nodes(load('./src/app/(tabs)/index.tsx').default());
}

const buttonsOf = (rendered) => rendered.filter((node) => node?.type === 'Pressable');
const labelIn = (rendered, label) => buttonsOf(rendered).find((node) => node.props.accessibilityLabel === label);
const styleOf = (rendered, label) => flattenStyle(labelIn(rendered, label).props.style);

const rendered = renderHome(6);
const text = rendered.filter((node) => typeof node === 'string' || typeof node === 'number').join('');
const buttons = buttonsOf(rendered);
const byLabel = (label) => labelIn(rendered, label);

assert.ok(text.includes('当前练习按广西题型生成'), 'province selector must match the mini-program sentence order');
assert.ok(byLabel('切换练习省份'), 'province selector must expose one full-width native action');
const hero = rendered.find((node) => node?.type === 'LinearGradient' && node.props.colors?.[0] === '#12372f');
assert.ok(hero, 'hero must use the mini-program forest gradient instead of a photo');
assert.deepEqual(hero.props.colors, ['#12372f', '#23785f']);
assert.ok(text.includes('音乐艺考 · 听音练耳专项训练'), 'hero subtitle must match the mini-program copy');

// —— 形态 A：6 个专项 + 模拟考试 = 7 张（奇数）→ 智能强化补末行右半 ——
const shortLabels = ['单音听记', '音组听记', '音程听记', '和弦听记', '节奏听记', '旋律听记', '模拟考试', '智能强化'];
assert.deepEqual(shortLabels.filter((label) => byLabel(label)), shortLabels, 'all eight mini-program cards must be present');
for (const label of shortLabels) {
  const style = styleOf(rendered, label);
  assert.equal(style.width, '48.4%', `${label} must remain in the two-column grid`);
  // 小程序 .mode-grid 的 grid-template-rows: repeat(4, minmax(128rpx, 1fr)) → 行下限 128rpx = 64pt
  assert.ok(style.minHeight >= 64 && style.minHeight < 96, `${label} must sit on the mini-program 128rpx grid row floor instead of the old 96pt card height`);
}
assert.equal(styleOf(rendered, '智能强化').paddingRight, 14, 'short adaptive card must use the mini-program 28rpx right padding');
assert.equal(styleOf(rendered, '智能强化').width, '48.4%', 'odd专项数 must keep 智能强化 in the last half row');
assert.equal(rendered.filter((node) => node?.type === 'Image' && node.props.accessibilityElementsHidden).length, 8, 'all eight cards must reuse the shared mini-program image assets');
const shortAdaptiveText = labelIn(rendered, '智能强化').props.children[1].props.children[1];
assert.equal(shortAdaptiveText.props.numberOfLines, 2, 'short adaptive card clamps its description to two lines');
assert.equal(buttons[buttons.length - 1].props.accessibilityLabel, '智能强化', '智能强化 must stay the last cell so the filler lands on the final row');

// —— 形态 B：7 个专项 + 模拟考试 = 8 张（偶数）→ 智能强化整行独占 ——
const wideRendered = renderHome(7);
const wideLabels = ['单音听记', '音组听记', '音程听记', '音程连接', '和弦听记', '节奏听记', '旋律听记', '模拟考试', '智能强化'];
assert.deepEqual(wideLabels.filter((label) => labelIn(wideRendered, label)), wideLabels, 'seven-module provinces must place 音程连接 after 音程听记');
assert.equal(styleOf(wideRendered, '智能强化').width, '100%', 'even专项数 must stretch 智能强化 across the full row');
assert.equal(styleOf(wideRendered, '智能强化').paddingRight, 22, 'wide adaptive card must use the mini-program 44rpx right padding');
assert.equal(styleOf(wideRendered, '音程连接').width, '48.4%', 'regular cards keep the half-row width when 智能强化 goes wide');
assert.equal(labelIn(wideRendered, '智能强化').props.children[1].props.children[1].props.numberOfLines, 1, 'wide adaptive card clamps its description to one line');
assert.equal(wideRendered.filter((node) => node?.type === 'Image' && node.props.accessibilityElementsHidden).length, 9, 'nine cards must reuse the shared mini-program image assets');
assert.ok(!byLabel('错题复盘') && !byLabel('练习统计') && !byLabel('给学长提建议') && !byLabel('关于与音色版权'), 'app-only home extras must be removed');

const memberButton = byLabel('会员有效');
assert.ok(memberButton, 'native subscription action must remain available in the synchronized membership strip');
const memberStyle = flattenStyle(memberButton.props.style);
assert.equal(memberStyle.width, '40%');
// 小程序 .invite-button height 46rpx = 23pt；缩到 23 后必须靠 hitSlop 补回至少 44pt 触控区
assert.equal(memberStyle.height, 23, 'membership action must match the mini-program 46rpx invite button');
assert.ok((memberStyle.height || 0) + (memberButton.props.hitSlop?.top || 0) + (memberButton.props.hitSlop?.bottom || 0) >= 44,
  'membership action must restore the 44pt touch target through hitSlop');

console.log('home parity smoke passed: province-driven card set, odd/even adaptive filler (short 48.4% / wide 100%), shared assets and mini-program button geometry with hitSlop-restored touch targets');
