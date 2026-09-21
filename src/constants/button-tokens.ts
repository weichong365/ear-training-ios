/**
 * 按钮尺寸令牌 —— 与小程序 wxss 1:1（rpx ÷ 2 = pt）。
 *
 * 口径（2026-09-15 与用户确认）：
 *   1. 几何（最小高/宽、内边距、圆角、边框宽、行间距）严格照搬小程序；
 *   2. 字号同样照搬，但设 9pt 底线 —— 小程序考试页部分芯片是 14–17rpx（7–8.5pt），
 *      iOS 真机上不可读，低于 9pt 一律抬到 9；
 *   3. 几何缩小后触控区会低于 Apple 的 44pt 建议，用 hitSlopFor() 补足。
 *
 * 小程序用 line-height 撑高、没有写 height 的芯片，这里折算成等值 minHeight：
 *   高度 = 上下内边距 × 2 + 字号 × 1.2 + 边框 × 2（rpx），再 ÷ 2。
 *
 * ⚠️ 密集工具栏里的芯片（如拍号/时值/休止）**不要**加 hitSlop —— 相邻间距只有
 *    4–8rpx（2–4pt），补到 44pt 会互相抢点击。这类控件的实际触控高度见
 *    tmp/button-sync-20260915/parity-report.txt，已如实列出，未编造达标。
 *
 * 来源：app.wxss；pages 下 index / practice / wrongbook / stats / about / province-select 六个页面；
 *      subpackages 下 exam 与 membership 两个分包；components 下 piano-keyboard 与 answer-staff。
 * 改完任一侧后，重跑 `python tmp/button-sync-20260915/parity.py` 复核本文件（68 条几何 + 6 条折算高）。
 */

/** Apple HIG 的最小可点面积。 */
export const TOUCH_TARGET = 44;

/** 视觉高度/宽度 < 44pt 时补足触控区；相邻间距 < 16pt 的密集芯片不要调用。 */
export function hitSlopFor(height: number, width = TOUCH_TARGET) {
  const vertical = Math.max(0, Math.round((TOUCH_TARGET - height) / 2));
  const horizontal = Math.max(0, Math.round((TOUCH_TARGET - width) / 2));
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}

/** 只补上下 —— 左右紧邻其它按钮（按钮行 / 网格）时用这个，避免抢邻键的点击。 */
export function hitSlopVertical(height: number) {
  const vertical = Math.max(0, Math.round((TOUCH_TARGET - height) / 2));
  return { top: vertical, bottom: vertical };
}

export const Btn = {
  /** app.wxss 的全局按钮 */
  global: {
    /** .btn-primary · 88rpx / 0 40rpx / 24rpx / 29rpx w600 */
    primary: { minHeight: 44, paddingHorizontal: 20, borderRadius: 12, fontSize: 14.5, fontWeight: '600' },
    /** .btn-plain · 86rpx / 0 38rpx / 24rpx / 28rpx w600 / 2rpx 描边 */
    plain: { minHeight: 43, paddingHorizontal: 19, borderRadius: 12, fontSize: 14, fontWeight: '600', borderWidth: 1 },
    /**
     * 行内文字链接（订阅条款 / 隐私政策 / 恢复购买 / Apple EULA）—— 小程序没有可点链接，
     * 只有一行不可点的 .footer-tip（20rpx）。这里沿用该字号，盒高按 .undo-link 收窄，
     * 触控区靠 hitSlopVertical(24) 补到 44pt。
     */
    textLink: { minHeight: 24, paddingVertical: 4, paddingHorizontal: 4, fontSize: 10, fontWeight: '800' },
  },

  /** pages/index —— 首页 */
  home: {
    /** .province-bar · 76rpx / 9 20 9 22rpx / 20rpx */
    provinceBar: { minHeight: 38, paddingVertical: 4.5, paddingLeft: 11, paddingRight: 10, borderRadius: 10 },
    /** .usage-strip · 64rpx / 9rpx 0 / 18rpx */
    usageStrip: { minHeight: 32, paddingVertical: 4.5, borderRadius: 9 },
    /** .invite-button · height 46rpx / 0 10rpx / 13rpx / 22rpx w700 */
    inviteButton: { height: 23, paddingHorizontal: 5, borderRadius: 6.5, fontSize: 11, fontWeight: '700' },
    /** .usage-title 22rpx w700 · .usage-meta 19rpx */
    usageTitle: { fontSize: 11, fontWeight: '700' },
    usageMeta: { fontSize: 9.5 },
    /** .mode-card · 行下限 128rpx / 14 30 14 14rpx / 22rpx */
    modeCard: { minHeight: 64, paddingVertical: 7, paddingLeft: 7, paddingRight: 15, borderRadius: 11 },
    /** .mode-icon 96rpx 方 · margin-right 16rpx */
    modeIcon: { width: 48, height: 48, marginRight: 8 },
    /** .mode-icon-asset 85rpx 方 */
    modeIconAsset: { width: 42.5, height: 42.5 },
    /** .mode-name 30rpx w700 */
    modeName: { fontSize: 15, fontWeight: '700' },
    /** .card-arrow 9rpx 方 · right 17rpx · 2rpx 描边 */
    cardArrow: { width: 4.5, height: 4.5, right: 8.5, borderWidth: 1 },
  },

  /** pages/practice —— 练习页 */
  practice: {
    /** .play-btn · padding 17 19rpx / 22rpx（内容高 54rpx 图标 → 整条 88rpx = 44pt） */
    playButton: { paddingVertical: 8.5, paddingHorizontal: 9.5, borderRadius: 11 },
    /** .play-icon-wrap 54rpx 方 / 6rpx / margin-right 14rpx */
    playIconWrap: { width: 27, height: 27, borderRadius: 3, marginRight: 7 },
    /** .choice-pill · min-width 70rpx / 8 13rpx / 13rpx / 20rpx → 折算高 42rpx */
    choicePill: {
      minWidth: 35, minHeight: 21, paddingVertical: 4, paddingHorizontal: 6.5,
      borderRadius: 6.5, borderWidth: 0.5, fontSize: 10, fontWeight: '700',
    },
    /** .key-pill · min-width 148rpx */
    keyPill: { minWidth: 74 },
    /** .duration-pill · 96rpx × 52rpx / 0 11rpx / 13rpx / 19rpx */
    durationPill: {
      minWidth: 48, height: 26, paddingHorizontal: 5.5,
      borderRadius: 6.5, borderWidth: 0.5, fontSize: 9.5, fontWeight: '700',
    },
    /** .rest-pill · 112rpx × 52rpx / 13rpx / 18rpx w800 */
    restPill: { width: 56, height: 26, borderRadius: 6.5, borderWidth: 0.5, fontSize: 9, fontWeight: '800' },
    /** .undo-link · 8 13rpx / 13rpx / 20rpx */
    undoLink: { minHeight: 24, paddingVertical: 4, paddingHorizontal: 6.5, borderRadius: 6.5, fontSize: 10, fontWeight: '800' },
    /** .duration-toolbar · padding 10rpx / 17rpx / gap 10rpx */
    durationToolbar: { padding: 5, borderRadius: 8.5, gap: 5 },
    /** .submit-btn · 82rpx / 18rpx / 26rpx */
    submit: { minHeight: 41, borderRadius: 9, fontSize: 13 },
    /** .fb-btn · width auto / 76rpx / 0 24rpx / 18rpx / 26rpx */
    feedback: { minHeight: 38, paddingHorizontal: 12, borderRadius: 9, fontSize: 13 },
    /** .volume-row 20rpx（小程序用 slider，无步进按钮 → 就近取 .choice-pill 盒） */
    volumeRow: { fontSize: 10 },
  },

  /** pages/wrongbook —— 错题本 */
  wrongbook: {
    /** .group-head · padding 24 25rpx */
    groupHead: { paddingVertical: 12, paddingHorizontal: 12.5 },
    /** .group-practice 21rpx */
    groupPractice: { fontSize: 10.5 },
    /** .wrong-item · padding 21 24rpx */
    wrongItem: { paddingVertical: 10.5, paddingHorizontal: 12 },
    /** .review-btn · 9 14rpx / 13rpx / 19rpx w600 → 折算高 40.8rpx */
    reviewButton: {
      minHeight: 20.5, paddingVertical: 4.5, paddingHorizontal: 7,
      borderRadius: 6.5, fontSize: 9.5, fontWeight: '600',
    },
    /** .btn-primary.empty-btn · width 300rpx / 25rpx */
    emptyButton: { width: 150, minHeight: 44, borderRadius: 12, fontSize: 12.5 },
  },

  /** pages/about —— 关于页（linkButton/clearButton 为 App 独有，就近取 .info-card 盒） */
  about: {
    /** .info-card · 92rpx / 16 18rpx / 22rpx */
    infoCard: { minHeight: 46, paddingVertical: 8, paddingHorizontal: 9, borderRadius: 11 },
    /** .invite-button 同行令牌 */
    inviteButton: { height: 23, paddingHorizontal: 5, borderRadius: 6.5, fontSize: 11, fontWeight: '700' },
    /** .contact-title-btn 无尺寸（透明的标题行），行高由 info-title 决定 */
    contactTitle: { minHeight: 0, padding: 0 },
  },

  /** pages/province-select —— 省份选择 */
  provinceSelect: {
    /** .province-card · calc(50% - 7rpx) / 76rpx / 24 44 24 20rpx / 22rpx */
    card: {
      minHeight: 38, paddingVertical: 12, paddingLeft: 10, paddingRight: 22,
      borderRadius: 11, borderWidth: 0.5,
    },
    /** 导航返回按钮无小程序对应（小程序走原生导航栏），保持 44pt 图标钮 */
    back: { width: TOUCH_TARGET, height: TOUCH_TARGET },
  },

  /** subpackages/exam —— 考试页（exam.tsx + exam-paper.tsx 共用） */
  exam: {
    /** .province-pill · 12 8rpx / 10rpx / 18rpx → 折算高 47.6rpx */
    provincePill: {
      minHeight: 24, paddingVertical: 6, paddingHorizontal: 4,
      borderRadius: 5, borderWidth: 0.5, fontSize: 9,
    },
    /** .province-confirm · height 68rpx / 0 / 10rpx / 22rpx w700 */
    provinceConfirm: { height: 34, borderRadius: 5, fontSize: 11, fontWeight: '700' },
    /** .province-picker · 24 20 22rpx / 16rpx */
    provincePicker: { paddingTop: 12, paddingBottom: 11, paddingHorizontal: 10, borderRadius: 8 },
    /** .audio-action · 42rpx / min-width 74rpx / 0 11rpx / 999rpx / 16rpx → 抬到 9pt */
    audioAction: {
      minHeight: 21, minWidth: 37, paddingHorizontal: 5.5,
      borderRadius: 999, fontSize: 9,
    },
    /** .section-play · 56rpx / min-width 116rpx / 0 14rpx / 999rpx / 18rpx */
    sectionPlay: {
      minHeight: 28, minWidth: 58, paddingHorizontal: 7,
      borderRadius: 999, fontSize: 9,
    },
    /** .interval-fill-play · 92rpx × 42rpx / 0 11rpx / 999rpx / 16rpx → 抬到 9pt */
    intervalFillPlay: {
      width: 46, minWidth: 46, minHeight: 21, paddingHorizontal: 5.5,
      borderRadius: 999, fontSize: 9,
    },
    /** .interval-option · min-height 32rpx / 4rpx 0 / 10rpx / 16rpx → 抬到 9pt */
    intervalOption: {
      minHeight: 16, paddingVertical: 2, borderRadius: 5,
      borderWidth: 0.5, fontSize: 9,
    },
    /** .quality-option · 6 2rpx / 7rpx / 14rpx → 折算高 30.8rpx，字号抬到 9pt */
    qualityOption: {
      minHeight: 15.5, paddingVertical: 3, paddingHorizontal: 1,
      borderRadius: 3.5, borderWidth: 0.5, fontSize: 9,
    },
    /** .choice-option · padding 9rpx / 11rpx / 2rpx 描边 */
    choiceOption: { padding: 4.5, borderRadius: 5.5, borderWidth: 1 },
    /** .choice-option-label · 30rpx 圆 / 16rpx w700 → 抬到 9pt */
    choiceLabel: { width: 15, height: 15, borderRadius: 7.5, fontSize: 9, fontWeight: '700' },
    /** 考试页 .choice-pill · 7 12rpx / 8rpx / 18rpx → 折算高 37.6rpx */
    choicePill: {
      minHeight: 19, paddingVertical: 3.5, paddingHorizontal: 6,
      borderRadius: 4, borderWidth: 0.5, fontSize: 9,
    },
    /** 考试页 .duration-pill · 7 10rpx / 8rpx / 17rpx → 折算高 36.4rpx */
    durationPill: {
      minHeight: 18, paddingVertical: 3.5, paddingHorizontal: 5,
      borderRadius: 4, borderWidth: 0.5, fontSize: 9,
    },
    /** 考试页 .rest-pill · 7 12rpx / 8rpx / 17rpx */
    restPill: {
      minHeight: 18, paddingVertical: 3.5, paddingHorizontal: 6,
      borderRadius: 4, borderWidth: 0.5, fontSize: 9,
    },
    /** .mini-action · 5 7rpx / 16rpx w500 → 折算高 29.2rpx，字号抬到 9pt */
    miniAction: { minHeight: 14.5, paddingVertical: 2.5, paddingHorizontal: 3.5, fontSize: 9, fontWeight: '500' },
    /** .undo-link（考试页只有颜色：18rpx? → #4841c7 w700），盒取练习页同款 */
    undoLink: { minHeight: 24, paddingVertical: 4, paddingHorizontal: 6.5, borderRadius: 6.5, fontSize: 10, fontWeight: '700' },
    /** .submit-paper · height 84rpx / 10rpx / 26rpx w800 */
    submitPaper: { height: 42, borderRadius: 5, fontSize: 13, fontWeight: '800' },
    /** .restart-button · height 66rpx / 8rpx / 22rpx w700 */
    restartButton: { height: 33, borderRadius: 4, fontSize: 11, fontWeight: '700' },
  },

  /** subpackages/membership —— 会员页（iOS 订阅页的最近似参照） */
  membership: {
    /** .purchase-btn · height 96rpx / 22rpx / 30rpx w700 */
    purchase: { height: 48, borderRadius: 11, fontSize: 15, fontWeight: '700' },
    /** .plan-card · padding 26 18 22rpx / 22rpx */
    planCard: { paddingVertical: 13, paddingHorizontal: 9, borderRadius: 11 },
    /** .plan-tag · 4 14rpx / 14rpx / 18rpx w700 */
    planTag: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 7, fontSize: 9, fontWeight: '700' },
  },

  /** components/answer-staff —— 谱面临时记号浮层（answer-staff.tsx / staff-preview.tsx 共用） */
  staff: {
    /** .accidental-menu · height 44rpx / padding 4rpx / gap 4rpx / 10rpx / 1rpx 描边 */
    accidentalMenu: { padding: 2, gap: 2, borderWidth: 0.5, borderRadius: 5 },
    /** .accidental-choice · 46 × 34rpx / 7rpx */
    accidentalChoice: { width: 23, height: 17, borderRadius: 3.5 },
    /** .choice-glyph · 24 × 32rpx / 30rpx */
    accidentalGlyph: { fontSize: 15 },
    /**
     * 浮层菜单的触控补偿。不能直接用 hitSlopVertical(17)：菜单下缘离谱面顶边只有约 5pt，
     * 再往下补会吞掉「点击谱面写音」的那一下。改成 12+6 = 35pt 纵向可点，横向因三枚
     * 芯片只隔 2pt 不补。
     */
    accidentalHitSlop: { top: 12, bottom: 6 },
  },

  /** components/piano-keyboard —— 钢琴键盘（非按钮，但同属可点控件） */
  piano: {
    /** .keyboard · height 300rpx / 5rpx / 7rpx */
    keyboard: { height: 150, padding: 2.5, borderRadius: 3.5 },
    /** .white · border-radius 1rpx 1rpx 3rpx 3rpx */
    whiteKey: { borderBottomLeftRadius: 1.5, borderBottomRightRadius: 1.5 },
    /** .black · height 59% / border-radius 0 0 2rpx 2rpx */
    blackKey: { borderBottomLeftRadius: 1, borderBottomRightRadius: 1 },
    /** .key-label 20rpx */
    keyLabel: { fontSize: 10 },
  },
} as const;
