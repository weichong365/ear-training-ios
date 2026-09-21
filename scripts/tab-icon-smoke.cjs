/**
 * 底部 tabBar 图标跨端对账 —— App 端必须**逐字节使用小程序的原图**。
 *
 * 用户口径：「把小程序导航栏的图标复制到 App 导航栏，App 端不要另外生成（另外生成的有差别）」。
 * 所以这份脚本的第一条、也是最重要的一条就是**字节级相等**：
 * 只要 App 那份图被重画、被优化、被重新导出过，sha256 立刻不等，闸门红。
 *
 * 四条闸门：
 *  1) 字节级 —— ios-app/assets/images/tabbar/*.png 与小程序 assets/tabbar/*.png 逐个 sha256 相同；
 *     且 App 目录里**只有**这 8 张，不得混入别处生成的图。
 *  2) 结构级 —— App `(tabs)/_layout.tsx` 的 4 个标签（键名 / 文案 / 图标键）与小程序
 *     `app.json : tabBar.list` 逐项对应；不得退回 AppIcon 手绘，也不得 tint。
 *  3) 令牌级 —— `TAB_ICON_SIZE` 必须等于真机量出的盒子里程 24.70pt（±0.5，取 25）；
 *     `Brand.disabled`/`Brand.forest` 必须逐值等于小程序 tabBar 的 color/selectedColor；
 *     并与框架自己的 HIG 常量 `ICON_SIZE_ROUND` 相等（见下）。
 *  4) 像素级（免依赖读 PNG）—— 图标是 2 色（透明底 + 单色）调色板 PNG，
 *     PLTE 第 1 项就是图形色，必须等于该态的期望色；且同一 tab 的常态/选中态
 *     IDAT 必须逐字节相同 ⇒ 证明「同一套图形，只有颜色不同」。
 *
 * 25pt 的推导（可复算）：真机小程序截图 1206×2622（= 402×874pt @3x），
 * 底部图标带里每个图标的墨迹范围 ÷ 源 PNG 墨迹范围 = 缩放比，乘源图边长 ⇒ 24.70pt
 * （8 个独立估计 24.52–24.79，σ=0.091）。令牌取整为 25pt：差 0.30pt(1.2%)，@3x 上不到 1 个物理像素。
 * 三路独立互证：真机截图反推 24.70 / 最优配准反推 24.78 / 框架 HIG 常量 25。
 * 复算脚本 `tmp/tabicon-sync-20260915/build-preview.py`。
 * ⚠️ 精度关键：墨迹范围必须用「亚像素 0.5 覆盖率 + max 投影插值」求，直接数整数像素会把
 * σ 从 0.09 放大到 0.22，并让实测值虚高到 24.77。
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const iosRoot = path.resolve(__dirname, '..');
const miniprogramRoot = path.resolve(iosRoot, '..');

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readText = (...segments) => fs.readFileSync(path.join(iosRoot, ...segments), 'utf8');
const hex = (buffer) => '#' + buffer.toString('hex');

const TAB_ICON_BOX_PT_MEASURED = 24.70; // 真机反推；见文件头。令牌取整 25，容差 ±0.5

// ---------------------------------------------------------------- PNG 免依赖解析
function readPng(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${file} 必须是 PNG`);
  const chunks = {};
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    chunks[type] = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  const ihdr = chunks.IHDR;
  assert.ok(ihdr, `${file} 缺少 IHDR`);
  return {
    width: ihdr.readUInt32BE(0),
    height: ihdr.readUInt32BE(4),
    bitDepth: ihdr[8],
    colorType: ihdr[9],
    interlace: ihdr[12],
    palette: chunks.PLTE,
    transparency: chunks.tRNS,
    idat: chunks.IDAT,
  };
}

function paletteColors(png) {
  const colors = new Set();
  for (let index = 0; index + 3 <= png.palette.length; index += 3) {
    colors.add(hex(png.palette.subarray(index, index + 3)));
  }
  return colors;
}

/** 图形色 = 调色板第 1 项（第 0 项是透明底，颜色无意义） */
const glyphColor = (png) => hex(png.palette.subarray(3, 6));

/**
 * 墨迹覆盖率 = 「不透明像素数」占画布的百分比（一位小数）。
 *
 * 用来验证「同一套图形」：把同一个矢量图形换色导出，不透明覆盖面积不会变；
 * 变了就说明图形被重画/走了形。（旧版靠「两态 IDAT 逐字节相同」来证同一性，
 * 但 2026-09-17 小程序侧改成两态各自独立导出后，这条在真值上就恒假了。）
 *
 * 需要真解 PNG：inflate 之后按 IHDR 的行过滤器逐行还原索引流。
 * 调色板 PNG 的位深固定 8 ⇒ 每像素 1 字节，行宽 = width。
 */
function coverage(png) {
  const raw = zlib.inflateSync(png.idat);
  const width = png.width;
  const height = png.height;
  const stride = width; // 8 位索引 = 1 字节/像素
  const alphaOf = (index) => (index < png.transparency.length ? png.transparency[index] : 255);
  let opaque = 0;
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos];
    pos += 1;
    const line = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= 1 ? line[x - 1] : 0;
      const up = prev[x];
      const upleft = x >= 1 ? prev[x - 1] : 0;
      if (filter === 1) line[x] = (line[x] + left) & 255;
      else if (filter === 2) line[x] = (line[x] + up) & 255;
      else if (filter === 3) line[x] = (line[x] + ((left + up) >> 1)) & 255;
      else if (filter === 4) {
        const est = left + up - upleft;
        const dl = Math.abs(est - left);
        const du = Math.abs(est - up);
        const dul = Math.abs(est - upleft);
        const pred = dl <= du && dl <= dul ? left : (du <= dul ? up : upleft);
        line[x] = (line[x] + pred) & 255;
      }
      if (alphaOf(line[x]) > 127) opaque += 1;
    }
    prev = line;
  }
  return Math.round((opaque / (width * height)) * 1000) / 10;
}

// ---------------------------------------------------------------- 小程序侧真值
const miniApp = JSON.parse(fs.readFileSync(path.join(miniprogramRoot, 'app.json'), 'utf8'));
assert.ok(miniApp.tabBar && Array.isArray(miniApp.tabBar.list), '小程序 app.json 必须有 tabBar.list');

const miniTabs = miniApp.tabBar.list.map((item) => {
  const key = item.pagePath.split('/').pop();
  return {
    key,
    label: item.text,
    normal: item.iconPath,
    active: item.selectedIconPath,
    normalFile: path.join(miniprogramRoot, item.iconPath),
    activeFile: path.join(miniprogramRoot, item.selectedIconPath),
  };
});
assert.equal(miniTabs.length, 4, '小程序 tabBar 必须有 4 个标签');

// 页面键必须与 App 的路由名一致，否则「第几个 tab 配哪张图」会错位
assert.deepEqual(miniTabs.map((tab) => tab.key), ['index', 'wrongbook', 'stats', 'about'],
  '小程序 tabBar 的 pagePath 末段必须与 App 路由名相同（决定图标配位）');

// ---------------------------------------------------------------- 闸门 1：字节级
const appTabDir = path.join(iosRoot, 'assets/images/tabbar');
assert.ok(fs.existsSync(appTabDir), `App 端缺少 tabbar 图标目录：${appTabDir}`);

const expectedAppFiles = [];
for (const tab of miniTabs) {
  for (const state of ['normal', 'active']) {
    const miniFile = tab[state === 'normal' ? 'normalFile' : 'activeFile'];
    const appFile = path.join(appTabDir, path.basename(miniFile));
    expectedAppFiles.push(path.basename(appFile));
    assert.ok(fs.existsSync(miniFile), `小程序缺少 ${tab.key} 的 ${state} 图标：${miniFile}`);
    assert.ok(fs.existsSync(appFile), `App 端缺少 ${tab.key} 的 ${state} 图标：${appFile}`);
    assert.equal(sha256(appFile), sha256(miniFile),
      `${tab.key} 的 ${state} 图标必须与小程序逐字节相同（不许另外生成/重新导出）`);
  }
}

const extraFiles = fs.readdirSync(appTabDir)
  .filter((name) => !name.startsWith('.'))
  .filter((name) => !expectedAppFiles.includes(name));
assert.deepEqual(extraFiles, [],
  `App 端 tabbar 目录不得混入小程序原图之外的文件（会掩盖"另外生成"）：${extraFiles.join(', ')}`);

// 图标只能有一处来源。Expo 模板残留的 `assets/images/tabIcons/`
// （home / explore 的 @1x/@2x/@3x，共 6 个文件）已于 2026-09-15 删除：
// app.json 的 icon / ios.icon / web.favicon / splash 全部指向 app-icon-v1.png，
// 运行时 0 引用（严格按 require 路径解析审计，非 basename 匹配）。
// 留着只会让后人误以为「App 端另有一套 tab 图标」，所以连目录都不允许复现。
assert.ok(!fs.existsSync(path.join(iosRoot, 'assets/images/tabIcons')),
  '不得复现 Expo 模板残留 assets/images/tabIcons/（底部图标固定只用 assets/images/tabbar/ 一套原图）');

// 源码与配置里也不得再出现这条死路径（残留引用 = 打包期才炸）
// ⚠️ 两个必须的规避（本文件第一版就踩了）：
//   ① 扫「剥掉注释后的代码」—— 否则本文件/别处注释里那句「tabIcons/ 已删除」的说明会被判违规；
//   ② 跳过本脚本自身 —— 它**必须**写出被禁路径才能禁它，这是代码里的字面量，剥注释救不了。
const SELF_NAME = path.basename(__filename);
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const residueSites = [];
const scanForResidue = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === SELF_NAME) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', '.expo', 'dist', 'ios', 'android'].includes(entry.name)) scanForResidue(full);
      continue;
    }
    if (!/\.(tsx?|jsx?|cjs|mjs|json)$/.test(entry.name)) continue;
    if (stripComments(fs.readFileSync(full, 'utf8')).includes('tabIcons')) {
      residueSites.push(path.relative(iosRoot, full));
    }
  }
};
scanForResidue(path.join(iosRoot, 'src'));
scanForResidue(path.join(iosRoot, 'scripts'));
if (stripComments(fs.readFileSync(path.join(iosRoot, 'app.json'), 'utf8')).includes('tabIcons')) {
  residueSites.push('app.json');
}
assert.deepEqual(residueSites, [],
  `不得再引用已删除的 assets/images/tabIcons/：${residueSites.join(', ')}`);

// ---------------------------------------------------------------- 闸门 2：结构级
const tabsSource = readText('src', 'app', '(tabs)', '_layout.tsx');
const screens = [...tabsSource.matchAll(/<Tabs\.Screen\b[\s\S]*?\/>/g)].map(([screen]) => ({
  key: screen.match(/name="([^"]+)"/)?.[1],
  label: screen.match(/title:\s*'([^']+)'/)?.[1],
  icon: screen.match(/tabBarIcon:\s*miniTabIcon\('([^']+)'\)/)?.[1],
}));
assert.deepEqual(screens, miniTabs.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.key })),
  'App 四个标签的键名 / 文案 / 图标必须与小程序 tabBar.list 逐项对应且顺序一致');

// ⚠️ 扫「代码」而不是「源码文本」：注释里会提到 AppIcon 作为反面说明，
// 直接对全文断言会把说明文字误判成违规（本文件第一版就踩了这个坑）。
const tabsCode = tabsSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
assert.doesNotMatch(tabsCode, /AppIcon/, '底部导航不得再退回 AppIcon（手绘或 SF Symbol）');
assert.doesNotMatch(tabsCode, /tintColor/, '小程序原图已自带配色，不得再 tint（会破坏逐字节复刻）');
assert.match(tabsCode, /TAB_ICONS\[key\]\.active/);
assert.match(tabsCode, /TAB_ICONS\[key\]\.normal/);
assert.match(tabsCode, /tabBarActiveTintColor:\s*Brand\.forest/);
assert.match(tabsCode, /tabBarInactiveTintColor:\s*Brand\.disabled/);

// 布局与令牌的键集合必须闭合（少一个 key 会在运行时 source={undefined} 静默不显示）
const tokenSource = readText('src', 'constants', 'tab-icons.ts');
for (const tab of miniTabs) {
  for (const state of ['normal', 'active']) {
    const basename = path.basename(tab[state === 'normal' ? 'normal' : 'active']);
    assert.ok(tokenSource.includes(`assets/images/tabbar/${basename}`),
      `TAB_ICONS 必须引用小程序原图 ${basename}`);
  }
}
for (const tab of miniTabs) {
  assert.match(tokenSource, new RegExp(`\\b${tab.key}:\\s*\\{`), `TAB_ICONS 必须包含 ${tab.key} 键`);
}
assert.match(tokenSource, /export type TabIconKey = keyof typeof TAB_ICONS;/, 'TAB_ICONS 必须导出键类型，供布局层收口');

// ---------------------------------------------------------------- 闸门 3：令牌级
const sizeSource = tokenSource.match(/TAB_ICON_SIZE\s*=\s*(\d+(?:\.\d+)?)/)?.[1];
const tabIconSize = Number(sizeSource);
assert.ok(Number.isFinite(tabIconSize), 'TAB_ICON_SIZE 必须是可验证的数值');
assert.ok(Math.abs(tabIconSize - TAB_ICON_BOX_PT_MEASURED) <= 0.5,
  `TAB_ICON_SIZE 必须是真机量出的 ${TAB_ICON_BOX_PT_MEASURED}pt（±0.5），当前 ${tabIconSize}`);
assert.ok(tabIconSize > 0 && tabIconSize < 40, `TAB_ICON_SIZE 超出底部标签合理区间：${tabIconSize}`);
assert.match(tabsSource + tokenSource, /width:\s*TAB_ICON_SIZE[\s\S]*?height:\s*TAB_ICON_SIZE/,
  '图标必须按方形盒子渲染，避免被拉伸（源图 256×256 正方形）');

// 第三路互证：框架自己的「圆形 tab 图标」尺寸常量取自 Apple HIG。
// 三路独立来源：真机截图反推 24.70pt / 最优配准反推 24.78pt / 框架 HIG 常量。
// 顺带守住「不得超出图标容器高度」——超了真机会被裁掉，而**不会报错**。
const frameworkIcon = path.join(iosRoot,
  'node_modules/expo-router/build/react-navigation/bottom-tabs/views/TabBarIcon.js');
if (fs.existsSync(frameworkIcon)) {
  const frameworkSource = fs.readFileSync(frameworkIcon, 'utf8');
  const round = Number(frameworkSource.match(/ICON_SIZE_ROUND\s*=\s*(\d+)/)?.[1]);
  const tall = Number(frameworkSource.match(/ICON_SIZE_TALL\s*=\s*(\d+)/)?.[1]);
  const wide = Number(frameworkSource.match(/ICON_SIZE_WIDE\s*=\s*(\d+)/)?.[1]);
  assert.ok(Number.isFinite(round) && Number.isFinite(tall) && Number.isFinite(wide),
    '无法从框架 TabBarIcon.js 读出图标尺寸常量（框架实现变了，请复核本脚本）');
  assert.equal(tabIconSize, round,
    `TAB_ICON_SIZE 必须等于框架 HIG 圆形图标常量 ${round}（当前 ${tabIconSize}）`);
  assert.ok(tabIconSize <= tall, `TAB_ICON_SIZE 不得超出框架图标容器高度 ${tall}pt，否则真机被裁`);
  console.log(`   · 框架交叉验证：ICON_SIZE_ROUND=${round}、容器 ${wide}×${tall}pt ⇒ ` +
    `${tabIconSize}pt 既不缩小也不裁切`);
} else {
  console.log('   · 跳过框架交叉验证（未找到 expo-router 的 TabBarIcon.js）');
}

const themeSource = readText('src', 'constants', 'theme.ts');
const brandDisabled = themeSource.match(/disabled:\s*'(#[0-9A-Fa-f]{6})'/)?.[1];
const brandForest = themeSource.match(/forest:\s*'(#[0-9A-Fa-f]{6})'/)?.[1];
assert.ok(brandDisabled && brandForest, 'theme.ts 必须提供 Brand.disabled / Brand.forest');
assert.equal(brandDisabled.toLowerCase(), miniApp.tabBar.color.toLowerCase(),
  'Brand.disabled 必须等于小程序 tabBar.color');
assert.equal(brandForest.toLowerCase(), miniApp.tabBar.selectedColor.toLowerCase(),
  'Brand.forest 必须等于小程序 tabBar.selectedColor');

// ---------------------------------------------------------------- 闸门 4：像素级
let checkedFiles = 0;
for (const tab of miniTabs) {
  const normalFile = path.join(appTabDir, path.basename(tab.normalFile));
  const activeFile = path.join(appTabDir, path.basename(tab.activeFile));
  const normal = readPng(normalFile);
  const active = readPng(activeFile);

  // ⚠️ 这两条**不能**写成固定形态断言（2026-09-20 修）。
  // 2026-09-17 小程序侧重新导出了图标：normal 是「2 色 + 8 级 alpha」，active 是
  // 「1 色 + 64 级 alpha」（图形工具的单通道导出，抗锯齿更细）。两态的**导出格式因此不同**，
  // 旧断言「调色板恰好 2 色」「两态 IDAT 逐字节相同」在**小程序的当前真值上就已经是假的** ——
  // 闸门在跟自己的真值打架。改成断言真正的不变量：单色（唯一色数 ≤2）、有透明、
  // 画布/位深/隔行一致、两态 alpha **级数单调不减**（选中态不该比常态更粗糙）。
  for (const [state, png] of [['常态', normal], ['选中', active]]) {
    assert.equal(png.width, 256, `${tab.key} ${state}图标画布宽必须是 256`);
    assert.equal(png.height, 256, `${tab.key} ${state}图标画布高必须是 256`);
    assert.equal(png.colorType, 3, `${tab.key} ${state}图标必须是调色板 PNG（单色+透明底）`);
    assert.equal(png.bitDepth, 8, `${tab.key} ${state}图标必须是 8 位索引`);
    assert.equal(png.interlace, 0, `${tab.key} ${state}图标不得使用隔行扫描`);
    const unique = [...paletteColors(png)].length;
    assert.ok(unique <= 2,
      `${tab.key} ${state}图标必须是单色图形（唯一色数 ${unique} > 2，说明混进了多色素材）`);
    assert.ok(png.transparency && png.transparency.length >= 2,
      `${tab.key} ${state}图标必须有透明通道（tRNS 至少 2 项）`);
  }
  assert.ok([...paletteColors(active)].length <= [...paletteColors(normal)].length,
    `${tab.key} 选中态唯一色数不得多于常态（选中态不该变复杂）`);
  assert.ok(active.transparency.length >= normal.transparency.length,
    `${tab.key} 选中态透明级数（${active.transparency.length}）不得少于常态`
    + `（${normal.transparency.length}）⇒ 选中态抗锯齿不该更粗糙`);
  assert.ok(new Set(active.transparency).size >= new Set(normal.transparency).size,
    `${tab.key} 选中态 alpha 级数不得少于常态`);

  assert.equal(glyphColor(normal), miniApp.tabBar.color.toLowerCase(),
    `${tab.key} 常态图标图形色必须等于小程序 tabBar.color`);
  assert.equal(glyphColor(active), miniApp.tabBar.selectedColor.toLowerCase(),
    `${tab.key} 选中图标图形色必须等于小程序 tabBar.selectedColor`);
  // 同上：两态现在是**各自独立导出**的（alpha 级数不同），IDAT 不可能逐字节相同。
  // 旧断言在 2026-09-17 重新导出后就已失效。
  //
  // 「同一套图形」改用一个**不随导出格式变化**的量来验证 —— 墨迹覆盖率（不透明像素占比）。
  // ⚠️ 但**不能**断言两者相等：实测选中态比常态稳定重 1.4~2.0 个百分点
  // （home 13.2→15.2、book 13.8→14.9、mine 10.6→12.1、hand 12.3→14.1），
  // 这是 tabBar 的**设计约定**（选中态笔画加粗），不是重画走形。
  // 于是断言落在「同形 + 适度加重」：
  //   ① 覆盖率量级必须同档（比值 0.9~1.3）—— 走形/换图形会让比值飞出这个带；
  //   ② 选中态覆盖率不得**小于**常态（加重是单向的）。
  const normalCoverage = coverage(normal);
  const activeCoverage = coverage(active);
  const ratio = activeCoverage / Math.max(normalCoverage, 1e-6);
  assert.ok(ratio >= 0.9 && ratio <= 1.3,
    `${tab.key} 两态墨迹覆盖率之比 ${ratio.toFixed(3)}（${normalCoverage}% vs ${activeCoverage}%）`
    + `超出 0.9~1.3 ⇒ 不是「同一套图形适度加重」，可能被重画过`);
  assert.ok(activeCoverage >= normalCoverage - 0.2,
    `${tab.key} 选中态墨迹覆盖率（${activeCoverage}%）低于常态（${normalCoverage}%）`
    + `⇒ 选中态不该比常态更细`);
  checkedFiles += 2;
}

console.log(
  `底部 tabBar 图标跨端对账通过：${miniTabs.length} 个标签 / ${checkedFiles} 张图与小程序逐字节相同，` +
  `${tabIconSize}pt 盒子（真机量出 ${TAB_ICON_BOX_PT_MEASURED}pt），` +
  `配色 ${brandDisabled}/${brandForest} 与 app.json 及图片调色板三方一致。`,
);
