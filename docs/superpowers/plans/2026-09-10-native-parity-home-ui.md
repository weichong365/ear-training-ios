# Native Parity Home UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the confirmed mini-program home visuals into the iOS App while retaining native navigation, safe areas, and accessibility.

**Architecture:** Keep the existing `index.tsx` screen and SVG icon components. Encode the confirmed icon geometry in `HandIcon`, keep layout tokens in the existing theme, and prove the visual invariants with source-level smoke checks plus Simulator screenshots.

**Tech Stack:** Expo 57, React Native 0.86, React Native SVG, Expo Router, Node smoke tests

**Spec:** `docs/superpowers/specs/2026-09-10-miniprogram-native-parity-design.md`

## Global Constraints

- Do not add dependencies or a second theme system.
- Preserve iOS safe areas, native navigation, Dynamic Type, VoiceOver labels, and Apple subscription behavior.
- Do not add the WeChat capsule navigation control.
- Home training icons must be vector-based, visually centered, and independent from staff-notation glyphs.

---

### Task 1: Lock the home visual contract

**Files:**
- Modify: `scripts/answer-smoke.mjs`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: `src/app/index.tsx`, `src/components/hand-icon.tsx`
- Produces: source assertions for the final hero, membership inset, and icon construction

- [ ] **Step 1: Add failing source assertions**

```js
const homeSource = readFileSync(new URL('../src/app/index.tsx', import.meta.url), 'utf8');
const handIconSource = readFileSync(new URL('../src/components/hand-icon.tsx', import.meta.url), 'utf8');
assert.match(homeSource, /heroDivider/, '首页数据区必须包含渐隐分割线');
assert.match(homeSource, /heroWave/, '首页英雄卡必须保留受限波形');
assert.match(homeSource, /memberStatusButton/, '会员按钮必须使用受约束的独立样式');
assert.doesNotMatch(handIconSource, /melody-clef-reference\.png/, '首页旋律图标必须使用独立 SVG，不能复用谱面素材');
```

- [ ] **Step 2: Run the smoke check and verify the new contract fails**

Run: `npm run test:answers`

Expected: FAIL on at least one newly added home assertion.

- [ ] **Step 3: Commit the failing contract**

```bash
git add scripts/answer-smoke.mjs
git commit -m "test: define native home parity contract"
```

### Task 2: Finish the hand-drawn icon set

**Files:**
- Modify: `src/components/hand-icon.tsx`
- Modify: `src/components/app-icon.tsx`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: `HandIconName`, `HandIconProps`
- Produces: `HandIcon({ name, size, color })` with eight centered training glyphs and four consistent navigation glyphs

- [ ] **Step 1: Replace the raster treble branch with SVG geometry**

Use the existing `48 × 48` viewBox, `SW = 1.7`, rounded caps and joins. Keep the treble glyph inside `x=11..37`, `y=4..44` and render it only for `name === 'treble'`.

```tsx
{name === 'treble' && (
  <G fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M27 43c-7 0-10-5-8-10 2-5 10-6 14-2 4 4 1 11-5 11-7 0-11-8-8-16 3-10 13-15 12-21-1-4-5-2-6 2-2 7 4 14 7 21" />
    <Line x1="27" y1="13" x2="27" y2="43" />
  </G>
)}
```

- [ ] **Step 2: Normalize each training glyph's optical box**

Keep all visible geometry within a centered `36 × 36` optical box. Preserve the confirmed single hollow notehead, three-note group, interval pair, three vertically touching hollow whole notes, rhythm marks, paper, and target whose plus remains inside the innermost circle.

- [ ] **Step 3: Simplify and normalize the four bottom navigation glyphs**

In `AppIcon`, use one shared `size` and `strokeWidth`; make both headphone cups filled, reduce wrongbook interior lines, move the upper profile line downward so it does not touch the body, and keep the raised-hand path rounded.

- [ ] **Step 4: Run the smoke check**

Run: `npm run test:answers`

Expected: PASS.

- [ ] **Step 5: Commit the icon set**

```bash
git add src/components/hand-icon.tsx src/components/app-icon.tsx scripts/answer-smoke.mjs
git commit -m "feat: align native home icon set"
```

### Task 3: Match the confirmed hero and membership layout

**Files:**
- Modify: `src/app/index.tsx`
- Modify: `src/constants/theme.ts`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: `Brand`, `Radius`, existing practice statistics and subscription state
- Produces: C-style hero with `heroWave`, `heroDivider`, and bounded `memberStatusButton`

- [ ] **Step 1: Keep the hero hierarchy and constrain decoration below the metrics**

Add the waveform as an absolutely positioned decorative view with `pointerEvents="none"`, `bottom: 0`, `height: 28`, and a clipping parent. Keep metric text above it with `zIndex: 1`.

- [ ] **Step 2: Add the centered fading divider**

Insert a separator between “累计练习” and “正确率” using a 1.2-point central line whose opacity fades at both ends; do not alter the current hero background, typography, or data.

- [ ] **Step 3: Bound the membership button inside the white bar**

Use `flex: 0`, `width: '44%'`, `maxWidth: 210`, `minWidth: 132`, and `marginRight: 10`. The white container keeps `paddingHorizontal: 10`, making the right inset equal to the left content inset on compact phones.

- [ ] **Step 4: Run static and type checks**

Run: `npm run test:answers`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the home layout**

```bash
git add src/app/index.tsx src/constants/theme.ts scripts/answer-smoke.mjs
git commit -m "feat: match confirmed native home layout"
```

### Task 4: Perform iPhone visual verification

**Files:**
- Verify: `src/app/index.tsx`
- Verify: `src/components/hand-icon.tsx`
- Verify: `src/components/app-icon.tsx`

**Interfaces:**
- Consumes: completed home implementation
- Produces: screenshots proving compact and regular-width layouts

- [ ] **Step 1: Start the iOS build on the available iPhone Simulator**

Run the repository's normal Expo iOS launch command and open the home screen.

- [ ] **Step 2: Capture compact-width and regular-width screenshots**

Verify: no hero overlap; divider is centered; waveform stays below data; member button remains inside the white bar; eight icons and four navigation icons share an optical size.

- [ ] **Step 3: Run final checks and commit only any visual corrections**

Run: `npm run lint && npm run typecheck && npm run test:answers`

Expected: all commands PASS.

```bash
git add src/app/index.tsx src/components/hand-icon.tsx src/components/app-icon.tsx src/constants/theme.ts
git commit -m "fix: polish native home parity"
```
