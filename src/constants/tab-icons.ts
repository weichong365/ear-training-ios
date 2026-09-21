/**
 * 底部 tabBar 图标 —— **直接使用小程序的原图**，不在 App 端重绘。
 *
 * 来源：小程序 `assets/tabbar/*.png`（由 `app.json : tabBar.list` 引用）。
 * 这 8 个文件是从小程序目录**逐字节复制**过来的；`ios-app/scripts/tab-icon-smoke.cjs`
 * 用 md5 守住这一点 —— 谁改了 App 这份、或小程序换了图却没同步过来，闸门立刻红。
 *
 * ⚠️ **不要再按形状重画一套 SVG。** 历史上 `app-icon.tsx` 就是这么做的（NAV_VIEW_BOX 48 +
 * strokeWidth 2.6 手绘），结果与小程序有肉眼可见的笔触差：例如「我的」头像圆
 * 小程序是 `r = 34/256` → 折到 48 画布应为 6.375，手绘版取了 7；两条横线的起止也各差 1–3 单位。
 * 用户明确要求「不要另外生成（另外生成的有差别）」。
 *
 * ── 渲染尺寸 25pt 是**量出来的**，不是拍脑袋 ──
 * 真机小程序截图 `app-store-upload-source/webwxgetmsgimg.jpg`（1206×2622 = 402×874pt @3x）
 * 底部 tabBar 图标带：把每个图标的墨迹范围与源 PNG 的墨迹范围相除，得到缩放比，
 * 再乘源图边长 ⇒ WeChat 把 256px 画布渲染进 **24.70pt** 的盒子
 * （8 个独立估计：24.52 ~ 24.79pt，σ = 0.091）⇒ 令牌取整 **25pt**（差 0.30pt = 1.2%，
 * @3x 上不到 1 个物理像素，肉眼不可辨）。两条独立路径互证：最优配准反推 24.78pt。
 * 复算：`python tmp/tabicon-sync-20260915/build-preview.py`
 * 图标墨迹约占画布 68%，故 25pt 盒子里的可见图形 ≈ 17pt —— 与截图直接量到的 17.00pt 吻合。
 * ⚠️ 量测精度关键：墨迹范围要用「亚像素 0.5 覆盖率 + max 投影插值」求；直接数整数像素
 * 会把 σ 放大到 0.22 并让结果虚高到 24.77。
 *
 * **第三路互证**：expo-router 打包的 react-navigation 里，底部标签「圆形图标」的常量
 * `ICON_SIZE_ROUND = 25`（注释写明取自 Apple HIG），图标容器是 `31 × 28 pt`。
 * 于是三个独立来源都指向 25：真机反推 24.70 / 最优配准 24.78 / 框架 HIG 25。
 * 25pt 落在 31×28 的容器里不缩不裁 —— 这条由 `tab-icon-smoke.cjs` 守着
 * （超出容器高度会被**静默裁掉**，不报错）。
 * ⚠️ 框架会把 `size`(25) 传给 `tabBarIcon`，但这里仍走显式令牌：
 * 令牌可被断言钉死，隐式依赖框架常量改不报错。
 *
 * ── 配色 ──
 * 小程序 `tabBar.color = #a7b0ad`、`selectedColor = #1f6f5b`，已经烧进两张 PNG 里，
 * 与 `theme.ts` 的 `Brand.disabled` / `Brand.forest` **逐值相同**（对账在 tab-icon-smoke.cjs）。
 * 因此这里按 `focused` 直接切图，**不做 tintColor** —— 与 WeChat 的做法一致（它也是两张图）。
 */

/** 单个 tab 图标的盒子边长（pt）。推导见文件头。 */
export const TAB_ICON_SIZE = 25;

export const TAB_ICONS = {
  index: {
    normal: require('../../assets/images/tabbar/home.png'),
    active: require('../../assets/images/tabbar/home-active.png'),
  },
  wrongbook: {
    normal: require('../../assets/images/tabbar/book.png'),
    active: require('../../assets/images/tabbar/book-active.png'),
  },
  stats: {
    normal: require('../../assets/images/tabbar/mine.png'),
    active: require('../../assets/images/tabbar/mine-active.png'),
  },
  about: {
    normal: require('../../assets/images/tabbar/hand.png'),
    active: require('../../assets/images/tabbar/hand-active.png'),
  },
} as const;

export type TabIconKey = keyof typeof TAB_ICONS;
