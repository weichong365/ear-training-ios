/**
 * 顶部（状态栏下沿）与底部 tabBar 上沿的分隔线必须是**同一条**。
 *
 * 用户口径：「底部导航栏的上沿有一条边线，请把这条边线同步到顶部状态栏的下沿。」
 *
 * 三条闸门：
 *  1) 令牌级 —— `Brand.hairline` 必须**逐值等于**底部那条线的原值，粗细也必须同样是
 *     `StyleSheet.hairlineWidth`。底部 tabBar 上沿线是框架画的，真源全在 node_modules 里，
 *     脚本直接读：`BottomTabBar.js` 的 `borderTopWidth: StyleSheet.hairlineWidth` +
 *     `borderColor: colors.border`，而 `colors.border` 来自内联的 `DefaultTheme`。
 *     ⚠️ 别再退回 `rgba(0,0,0,.15)`：顶部那一段落在 cream(#F7F7F1) 上、首页那段落在纯白上，
 *     半透明色会被底色带偏（≈211 vs ≈217），不透明色两端才恒定。
 *  2) 真源级 —— 底部那条线**不动**：它来自框架默认 theme，`(tabs)/_layout.tsx` 必须继续
 *     不设 tabBarStyle（覆盖会连默认布局与底部安全区一起顶掉，scripts/answer-smoke.mjs:98 守着），
 *     所以这里断言的是「未被覆盖」+「sceneStyle 仍给无顶栏的 Tab 页留出 insets.top」。
 *     顶部四处落点（首页自绘顶栏 / 错题·我的·举手三页状态栏下沿 / Stack header 下沿）
 *     必须引用 Brand.hairline —— 谁把顶部单独改深改浅，闸门 1 就会红。
 *  3) 结构级 —— `(tabs)` 与 `province-select` 是 headerShown:false，content 从屏幕顶开始，
 *     给它们画 header 下沿的分隔线会跑到状态栏上方，必须留在 HEADERLESS_ROUTES 里被排除。
 *
 * 顶部几类落点为什么各不相同（都是结构决定的，不是随意选择）：
 *   · 首页 —— 自绘顶栏（SafeAreaView + nav），线画在 SafeAreaView 的 borderBottom 上；
 *   · 错题/我的/举手 —— 没有顶栏，状态栏那一条靠 `(tabs)/_layout.tsx : sceneStyle.paddingTop`
 *     露底色；ScrollView 顶边正好落在 paddingTop（= insets.top）处，所以给 ScrollView
 *     加 borderTop 就等于把线贴在状态栏下方；
 *   · 子页（practice / exam / …）—— 有原生 header，线画在 `contentStyle` 的 borderTop 上，
 *     紧贴 header 下沿；headerShadowVisible:false 已关掉系统自带的那条，不会叠成两条。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const iosRoot = path.resolve(__dirname, '..');

/** 注释里会出现反向说明（例如「不是 #D8D8D8 而是令牌」），字面扫描必须剥掉注释 */
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const readCode = (...segments) => stripComments(fs.readFileSync(path.join(iosRoot, ...segments), 'utf8'));

// ---------------------------------------------------------------- 闸门 1：令牌级
// 底部那条线的粗细与颜色都是框架给的，真源在 node_modules 里，直接读而不是抄常量：
//   BottomTabBar.js:  { borderTopWidth: StyleSheet.hairlineWidth }
//   BottomTabBar.js:  { borderColor: colors.border } ← colors 来自 DefaultTheme
const barFile = path.join(iosRoot,
  'node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabBar.js');
assert.ok(fs.existsSync(barFile),
  '找不到 BottomTabBar.js（框架结构变了），无法核验底部那条线的真源，请复核本脚本');
const barSource = fs.readFileSync(barFile, 'utf8');
assert.match(barSource, /borderTopWidth:\s*react_native_1\.StyleSheet\.hairlineWidth/,
  '底部 tabBar 上沿线的粗细不再是 StyleSheet.hairlineWidth —— 顶部那条要跟着改');
assert.match(barSource, /borderColor:\s*colors\.border/,
  '底部 tabBar 上沿线的颜色不再取 colors.border —— 顶部那条要跟着改');

const defaultThemeFile = path.join(iosRoot,
  'node_modules/expo-router/build/react-navigation/native/theming/DefaultTheme.js');
assert.ok(fs.existsSync(defaultThemeFile),
  '找不到 expo-router 内联的 React Navigation 默认主题，框架结构变了，请复核本脚本');
const frameworkBorder = fs.readFileSync(defaultThemeFile, 'utf8')
  .match(/border:\s*'rgb\((\d+),\s*(\d+),\s*(\d+)\)'/);
assert.ok(frameworkBorder, '无法从框架默认主题读出 colors.border（框架实现变了，请复核本脚本）');
const frameworkRgb = frameworkBorder.slice(1, 4).map(Number);

const themeCode = fs.readFileSync(path.join(iosRoot, 'src', 'constants', 'theme.ts'), 'utf8');
const hairline = themeCode.match(/hairline:\s*'([^']+)'/)?.[1];
assert.ok(hairline, 'theme.ts 必须提供 Brand.hairline（顶部/底部共用的窗口分隔线）');

const channel = hairline.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
assert.ok(channel,
  `Brand.hairline 必须是**不透明** rgb(r, g, b)，当前为 ${hairline} —— ` +
  '半透明色会被底色带偏（顶部那段在 cream 上、首页那段在纯白上，同一个值会显示成两种灰）');
const tokenRgb = channel.slice(1, 4).map(Number);
assert.strictEqual(new Set(tokenRgb).size, 1,
  `Brand.hairline 必须是中性灰（R=G=B），当前 rgb(${tokenRgb.join(',')})`);
assert.deepStrictEqual(tokenRgb, frameworkRgb,
  `Brand.hairline = rgb(${tokenRgb.join(',')}) 必须**逐值等于**底部那条线的原值 ` +
  `rgb(${frameworkRgb.join(',')})（框架 DefaultTheme.colors.border）—— 近似值在两种底色上会分叉`);
console.log(`   · 令牌交叉验证：Brand.hairline = ${hairline}，` +
  `底部框架默认 colors.border = rgb(${frameworkRgb.join(',')})，粗细同为 hairlineWidth ⇒ 顶底逐值相同`);

const assertBorder = (label, source, side) => {
  assert.match(source, new RegExp(`${side}Width:\\s*StyleSheet\\.hairlineWidth`),
    `${label} 的 ${side}Width 必须用 StyleSheet.hairlineWidth（1 物理像素细线）`);
  assert.match(source, new RegExp(`${side}Color:\\s*Brand\\.hairline`),
    `${label} 的 ${side}Color 必须引用 Brand.hairline —— 顶部与底部必须是同一条线`);
};

// ---------------------------------------------------------------- 闸门 2：底部真源 + 顶部落点
const tabsLayout = readCode('src', 'app', '(tabs)', '_layout.tsx');
assert.doesNotMatch(tabsLayout, /tabBarStyle|tabBar\s*=|safeAreaInsets/,
  '底部 tabBar 必须保留框架默认布局与那条默认上沿线，不得覆盖 tabBarStyle');
assert.match(tabsLayout, /paddingTop:\s*route\.name === 'index' \? 0 : insets\.top/,
  'sceneStyle 必须继续给无顶栏的 Tab 页留出 insets.top —— 那条线就贴在它的下沿，不留就没有状态栏区');

// 四个 Tab 页从布局文件推导，避免硬编码漏页
const tabNames = [...tabsLayout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map(([, name]) => name);
assert.deepEqual(tabNames, ['index', 'wrongbook', 'stats', 'about'],
  'App 四个 Tab 的键名与顺序变了，请复核本脚本的顶部落点推导');

for (const name of tabNames) {
  const source = readCode('src', 'app', '(tabs)', `${name}.tsx`);
  if (name === 'index') {
    // 首页有自绘顶栏：线画在 SafeAreaView 的底边
    const safe = source.match(/safe:\s*\{[^}]*\}/);
    assert.ok(safe, '(tabs)/index.tsx 必须保留 styles.safe（自绘顶栏容器）');
    assertBorder('首页自绘顶栏', safe[0], 'borderBottom');
  } else {
    // 错题/我的/举手 无顶栏：线画在 ScrollView 顶边（正好落在 sceneStyle 的 paddingTop 处）
    const page = source.match(/page:\s*\{[^}]*\}/);
    assert.ok(page, `(tabs)/${name}.tsx 必须保留 styles.page（页面根滚动容器）`);
    assertBorder(`${name} 页状态栏下沿`, page[0], 'borderTop');
  }
}

// 子页：Stack header 下沿
const rootLayout = readCode('src', 'app', '_layout.tsx');
const contentStyle = rootLayout.match(/contentStyle:\s*\{[^}]*\}/);
assert.ok(contentStyle, '_layout.tsx 必须保留 Stack 的 contentStyle（子页 header 下沿的分隔线挂在这里）');
assertBorder('子页 header 下沿', contentStyle[0], 'borderTop');

// ---------------------------------------------------------------- 闸门 3：结构级
const headerless = rootLayout.match(/HEADERLESS_ROUTES\s*=\s*new Set\(\[([^\]]*)\]\)/);
assert.ok(headerless, '_layout.tsx 必须声明 HEADERLESS_ROUTES 并用于排除无 header 的路由');
const headerlessNames = [...headerless[1].matchAll(/'([^']+)'/g)].map(([, name]) => name);
for (const name of ['(tabs)', 'province-select']) {
  assert.ok(headerlessNames.includes(name),
    `${name} 是 headerShown:false，必须留在 HEADERLESS_ROUTES 里 —— 否则分隔线会被画到状态栏上方`);
}
assert.match(rootLayout, /HEADERLESS_ROUTES\.has\(route\.name\)[\s\S]{0,200}?borderTopWidth/,
  'contentStyle 必须按 HEADERLESS_ROUTES 条件性地加分隔线，不能无条件加');

console.log(`顶部 ⇄ 底部窗口分隔线对账通过：Brand.hairline = ${hairline}（底部框架默认 rgb(${frameworkRgb.join(',')})），` +
  `顶部 5 处落点（首页顶栏 + 3 个 Tab 页状态栏下沿 + 子页 header 下沿）同源，` +
  `底部 tabBar 保持框架默认未被覆盖，headerless 路由（${headerlessNames.join(' / ')}）已排除。`);
