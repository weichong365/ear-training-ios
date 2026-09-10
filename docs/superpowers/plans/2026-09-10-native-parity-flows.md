# Native Parity Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the confirmed wrongbook, province, membership, and mock-exam behaviors without replacing native iOS navigation or Apple subscriptions.

**Architecture:** Keep the existing Expo Router screens and contexts. Fix initial-state derivation before rendering, make collapsible state explicit, constrain option-card layout, and retain StoreKit-backed subscription data.

**Tech Stack:** Expo Router, React Native, AsyncStorage, RevenueCat/Apple subscriptions, Node smoke tests

**Spec:** `docs/superpowers/specs/2026-09-10-miniprogram-native-parity-design.md`

## Global Constraints

- Preserve Apple subscription purchase, restore, management, and renewal disclosure behavior.
- Use exact renewal copy: “续费后剩余天数会从当前剩余天数往上叠加。”
- Province-dependent content must not render before province context is ready.
- Wrongbook groups are closed by default.
- Jiangsu melodic-interval option cards must show both rows and full bottom borders.

---

### Task 1: Define flow regressions in smoke checks

**Files:**
- Modify: `scripts/answer-smoke.mjs`
- Modify: `scripts/province-smoke.cjs`
- Test: `scripts/answer-smoke.mjs`
- Test: `scripts/province-smoke.cjs`

**Interfaces:**
- Consumes: screen sources and province framework generation
- Produces: assertions for closed groups, exact copy, stable province gating, and Jiangsu options

- [ ] **Step 1: Add failing wrongbook and membership assertions**

```js
assert.match(wrongbookSource, /expanded\[group\.type\]\s*\?\?\s*false/, '错题分类必须默认闭合');
assert.match(subscribeSource, /续费后剩余天数会从当前剩余天数往上叠加。/);
```

- [ ] **Step 2: Add province and Jiangsu assertions**

Assert that the exam entry waits for `provinceReady`, never initializes to Zhejiang before reading the selected province, and that the Jiangsu melodic-interval question exposes all 12 option labels.

- [ ] **Step 3: Run tests and verify the regressions are detected**

Run: `npm run test:answers && npm run test:provinces`

Expected: FAIL on the current first-group-open behavior or missing exact copy/gating.

- [ ] **Step 4: Commit the failing flow contract**

```bash
git add scripts/answer-smoke.mjs scripts/province-smoke.cjs
git commit -m "test: define native flow parity"
```

### Task 2: Default wrongbook groups to closed

**Files:**
- Modify: `src/app/wrongbook.tsx`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: `expanded: Record<string, boolean>`
- Produces: explicit closed initial state with accessible toggles

- [ ] **Step 1: Remove the first-group fallback**

```tsx
const isOpen = expanded[group.type] ?? false;
```

Keep `accessibilityState={{ expanded: isOpen }}` and the existing user-controlled toggle.

- [ ] **Step 2: Run checks**

Run: `npm run test:answers && npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/wrongbook.tsx scripts/answer-smoke.mjs
git commit -m "fix: collapse native wrongbook groups by default"
```

### Task 3: Align province and membership presentation

**Files:**
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/province-select.tsx`
- Modify: `src/app/subscribe.tsx`
- Modify: `src/app/index.tsx`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: `Brand`, `useProvince`, `useSubscription`
- Produces: unified native header, aligned membership bar, exact renewal copy without a separate background block

- [ ] **Step 1: Use the shared native header configuration for province selection**

Let the Stack render the province screen header with the same `headerStyle`, tint, title weight, back behavior, and safe-area handling as other App pages. Do not reproduce the mini-program top capsule.

- [ ] **Step 2: Apply the exact renewal sentence**

Render “续费后剩余天数会从当前剩余天数往上叠加。” as ordinary supporting text with transparent background. Keep the Apple auto-renewal disclosure adjacent to the purchase action.

- [ ] **Step 3: Reuse the home membership inset rule**

Ensure the member CTA never exceeds its white container and its right inset equals the membership label's left inset.

- [ ] **Step 4: Run checks and commit**

Run: `npm run test:answers && npm run typecheck`

Expected: PASS.

```bash
git add src/app/_layout.tsx src/app/province-select.tsx src/app/subscribe.tsx src/app/index.tsx scripts/answer-smoke.mjs
git commit -m "fix: align native province and membership UI"
```

### Task 4: Remove the mock-exam province flash

**Files:**
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/exam.tsx`
- Modify: `src/services/province-context.tsx`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: `useProvince(): { ready: boolean; provinceId: ProvinceId | null; setProvince(...) }`
- Produces: stable exam initial state derived from the persisted province

- [ ] **Step 1: Add a stable loading branch**

When `provinceReady` is false, render the App background and an accessible activity indicator. Do not render province choices or an exam framework.

- [ ] **Step 2: Derive exam state from selected province**

Initialize local selection only after context is ready. If a persisted province exists, use it immediately; only navigate to province selection when readiness is true and the value is null.

- [ ] **Step 3: Verify entry paths**

Test cold launch with a saved province, cold launch without a province, and return from province selection. In the saved-province case, no province picker frame may appear.

- [ ] **Step 4: Run and commit**

Run: `npm run test:answers && npm run test:provinces && npm run typecheck`

Expected: all PASS.

```bash
git add src/app/_layout.tsx src/app/exam.tsx src/services/province-context.tsx scripts/answer-smoke.mjs
git commit -m "fix: prevent native exam province flash"
```

### Task 5: Prevent Jiangsu option-row clipping

**Files:**
- Modify: `src/app/exam-paper.tsx`
- Test: `scripts/province-smoke.cjs`

**Interfaces:**
- Consumes: existing `ChoiceOption[]` for Jiangsu melodic interval questions
- Produces: wrapping option cards with stable row height and visible borders

- [ ] **Step 1: Set explicit option sizing**

Give each option `minHeight: 44`, `paddingVertical: 8`, `justifyContent: 'center'`, and `overflow: 'visible'`. Give the wrapping list a row gap and bottom padding at least equal to the border width.

- [ ] **Step 2: Keep the option label vertically centered**

Use a fixed readable line height and `includeFontPadding: false` on Android-compatible styles without changing the iOS type scale.

- [ ] **Step 3: Run checks and inspect the Jiangsu paper**

Run: `npm run test:provinces && npm run typecheck`

Expected: PASS; all twelve options render in two complete rows with visible lower borders.

- [ ] **Step 4: Commit**

```bash
git add src/app/exam-paper.tsx scripts/province-smoke.cjs
git commit -m "fix: prevent native exam option clipping"
```

### Task 6: Complete flow verification

**Files:**
- Verify: `src/app/wrongbook.tsx`
- Verify: `src/app/province-select.tsx`
- Verify: `src/app/subscribe.tsx`
- Verify: `src/app/exam.tsx`
- Verify: `src/app/exam-paper.tsx`

**Interfaces:**
- Consumes: completed flow tasks
- Produces: one Simulator acceptance pass

- [ ] **Step 1: Verify all flows on an iPhone Simulator**

Check wrongbook initial collapse, province header, saved-province exam entry, no-province redirect, membership text/background, and the Jiangsu melodic-interval option grid.

- [ ] **Step 2: Verify accessibility basics**

Confirm 44-point targets, meaningful VoiceOver labels, expanded state announcements, readable text at one larger Dynamic Type size, and native back gestures.

- [ ] **Step 3: Run the complete suite**

Run: `npm run lint && npm run typecheck && npm run test:core && npm run test:provinces && npm run test:answers && npm run test:storage && npm run test:province-tier && npm run test:sample-range && npm run export:web`

Expected: every command PASS.

- [ ] **Step 4: Commit only final flow corrections**

```bash
git add src/app/_layout.tsx src/app/wrongbook.tsx src/app/province-select.tsx src/app/subscribe.tsx src/app/exam.tsx src/app/exam-paper.tsx src/services/province-context.tsx
git commit -m "fix: finish native flow parity"
```
