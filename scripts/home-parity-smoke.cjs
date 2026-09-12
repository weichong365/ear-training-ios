const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
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
    getProvincePracticeModules: () => [
      ['single', '单音听记', 'single-note'], ['group', '音组听记', 'triplet'], ['interval', '音程听记', 'interval'],
      ['chord', '和弦听记', 'chord'], ['rhythm', '节奏听记', 'rhythm'], ['melody', '旋律听记', 'treble'],
    ].map(([type, name, icon]) => ({ type, name, icon, desc: `${name}说明`, tier: 3, tone: 'mint' })),
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

const HomeScreen = load('./src/app/(tabs)/index.tsx').default;
const rendered = nodes(HomeScreen());
const text = rendered.filter((node) => typeof node === 'string' || typeof node === 'number').join('');
const buttons = rendered.filter((node) => node?.type === 'Pressable');
const byLabel = (label) => buttons.find((node) => node.props.accessibilityLabel === label);

assert.ok(text.includes('当前练习按广西题型生成'), 'province selector must match the mini-program sentence order');
assert.ok(byLabel('切换练习省份'), 'province selector must expose one full-width native action');
const hero = rendered.find((node) => node?.type === 'LinearGradient' && node.props.colors?.[0] === '#12372f');
assert.ok(hero, 'hero must use the mini-program forest gradient instead of a photo');
assert.deepEqual(hero.props.colors, ['#12372f', '#23785f']);
assert.ok(text.includes('音乐艺考 · 听音练耳专项训练'), 'hero subtitle must match the mini-program copy');

const cardLabels = ['单音听记', '音组听记', '音程听记', '和弦听记', '节奏听记', '旋律听记', '模拟考试', '智能强化'];
assert.deepEqual(cardLabels.filter((label) => byLabel(label)), cardLabels, 'all eight mini-program cards must be present');
for (const label of cardLabels) {
  const style = flattenStyle(byLabel(label).props.style);
  assert.equal(style.width, '48.4%', `${label} must remain in the two-column grid`);
  assert.ok(style.minHeight >= 96, `${label} must retain the mini-program card stature`);
}
assert.equal(rendered.filter((node) => node?.type === 'Image' && node.props.accessibilityElementsHidden).length, 8, 'all eight cards must reuse the shared mini-program image assets');
assert.ok(!byLabel('错题复盘') && !byLabel('练习统计') && !byLabel('给学长提建议') && !byLabel('关于与音色版权'), 'app-only home extras must be removed');

const memberButton = byLabel('会员有效');
assert.ok(memberButton, 'native subscription action must remain available in the synchronized membership strip');
const memberStyle = flattenStyle(memberButton.props.style);
assert.equal(memberStyle.width, '40%');
assert.ok(memberStyle.minHeight >= 44);

console.log('home parity smoke passed: mini-program hierarchy, 8-card grid, shared assets, membership bounds and native touch targets');
