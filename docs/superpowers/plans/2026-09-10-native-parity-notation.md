# Native Parity Notation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every staff element use one deterministic SVG coordinate system so note placement and line boundaries remain exact on iOS.

**Architecture:** Centralize staff geometry in `music-notation.ts` and consume it from every notation renderer. Test numeric geometry directly before updating renderers, then verify representative notation in Simulator.

**Tech Stack:** TypeScript, React Native SVG, Node assertions, Expo

**Spec:** `docs/superpowers/specs/2026-09-10-miniprogram-native-parity-design.md`

## Global Constraints

- All staff elements derive from `STAFF_LINE_YS`; font baselines must not position notation.
- Adjacent staff and ledger lines use exactly `STAFF_LINE_GAP = 10` and `STAFF_STROKE_WIDTH = 1`.
- The sharp glyph is 10% smaller than its previous rendered size.
- Bar and final bar lines stop at the centers of the outer staff lines.

---

### Task 1: Expand deterministic notation geometry tests

**Files:**
- Modify: `scripts/answer-smoke.mjs`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: exports from `src/core/music-notation.ts`
- Produces: assertions for anchors, ledger lines, stem joins, accidentals, and bar bounds

- [ ] **Step 1: Add failing numeric assertions**

```js
assert.deepEqual(STAFF_LINE_YS, [28, 38, 48, 58, 68]);
assert.equal(ledgerLineYs(57)[1] - ledgerLineYs(57)[0], STAFF_LINE_GAP);
assert.equal(barlineBounds().top, STAFF_LINE_YS[0]);
assert.equal(barlineBounds().bottom, STAFF_LINE_YS[4]);
assert.deepEqual(noteheadStemStart(40, 6, 'up'), { x: 44, y: 40 });
assert.equal(accidentalScale('sharp'), 0.9);
```

- [ ] **Step 2: Run the test and confirm missing helpers fail**

Run: `npm run test:answers`

Expected: FAIL because `barlineBounds`, `noteheadStemStart`, or `accidentalScale` is not exported.

- [ ] **Step 3: Commit the failing geometry contract**

```bash
git add scripts/answer-smoke.mjs
git commit -m "test: define staff geometry parity"
```

### Task 2: Centralize all staff geometry helpers

**Files:**
- Modify: `src/core/music-notation.ts`
- Modify: `src/core/staff-coordinate.ts`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Produces: `barlineBounds(): { top: number; bottom: number }`
- Produces: `noteheadStemStart(noteY: number, halfWidth: number, direction: StemDirection): { x: number; y: number }`
- Produces: `accidentalScale(kind: 'sharp' | 'flat' | 'natural'): number`
- Produces: existing `ledgerLineYs(writtenMidi: number): number[]`

- [ ] **Step 1: Implement minimal pure helpers**

```ts
export function barlineBounds() {
  return { top: STAFF_LINE_YS[0], bottom: STAFF_LINE_YS[STAFF_LINE_YS.length - 1] };
}

export function accidentalScale(kind: 'sharp' | 'flat' | 'natural') {
  return kind === 'sharp' ? 0.9 : 1;
}

export function noteheadStemStart(noteY: number, halfWidth: number, direction: StemDirection) {
  return {
    x: noteheadStemX(0, halfWidth, direction),
    y: noteY + (direction === 'up' ? 1 : -1),
  };
}
```

Keep `staffSvgYFromWrittenMidi` as the sole conversion from written pitch to SVG Y.

- [ ] **Step 2: Run the numeric geometry contract**

Run: `npm run test:answers`

Expected: PASS for all pure helper assertions.

- [ ] **Step 3: Commit the shared geometry**

```bash
git add src/core/music-notation.ts src/core/staff-coordinate.ts scripts/answer-smoke.mjs
git commit -m "refactor: centralize staff geometry"
```

### Task 3: Apply shared anchors to every renderer

**Files:**
- Modify: `src/components/music-glyphs.tsx`
- Modify: `src/components/answer-staff.tsx`
- Modify: `src/components/notation-editor.tsx`
- Modify: `src/components/staff-preview.tsx`
- Test: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: `barlineBounds`, `noteheadStemStart`, `accidentalScale`, `ledgerLineYs`, `staffSvgYFromWrittenMidi`
- Produces: identical geometry for editable answers, answer review, previews, and exam choices

- [ ] **Step 1: Render all five staff lines and ledger lines with shared constants**

Use `STAFF_LINE_YS.map(...)`, `STAFF_STROKE_WIDTH`, and `ledgerLineYs(writtenMidi)`. Draw ledger lines before noteheads, with equal `x1/x2` extension around the note center.

- [ ] **Step 2: Join stems to noteheads**

Start each stem one SVG point inside the notehead boundary. Use the same computed stem start for isolated notes, beamed notes, flags, and whole/half note rendering; whole notes remain stemless.

- [ ] **Step 3: Apply accidental and symbol anchors**

Apply `transform` around each accidental's own center; only sharp uses scale `0.9`. Position clef, rest, key signature, time signature, and empty prompt from numeric staff anchors, never text baseline offsets.

- [ ] **Step 4: Clamp bar and final bar lines**

Use `const { top, bottom } = barlineBounds()` for `y1` and `y2` in all three renderers. Keep the final pair's horizontal spacing but give both lines the same vertical bounds.

- [ ] **Step 5: Run smoke and type checks**

Run: `npm run test:answers && npm run typecheck`

Expected: both PASS.

- [ ] **Step 6: Commit renderer parity**

```bash
git add src/components/music-glyphs.tsx src/components/answer-staff.tsx src/components/notation-editor.tsx src/components/staff-preview.tsx scripts/answer-smoke.mjs
git commit -m "fix: unify native staff rendering geometry"
```

### Task 4: Verify representative notation in Simulator

**Files:**
- Verify: `src/components/answer-staff.tsx`
- Verify: `src/components/notation-editor.tsx`
- Verify: `src/components/staff-preview.tsx`

**Interfaces:**
- Consumes: unified SVG renderers
- Produces: visual evidence for line, space, ledger, stem, accidental, and bar cases

- [ ] **Step 1: Open samples covering the geometry boundaries**

Inspect E4 first line, F4 first space, C4 first lower ledger line, A3 second lower ledger line, A5 upper ledger line, sharp notes, upward/downward stems, bar lines, and final bars.

- [ ] **Step 2: Confirm pixel boundaries at 100% scale**

Verify ledger gaps equal staff gaps, line weights match, whole-note centers cross ledger centers, stems overlap noteheads, and bar lines do not cross either outer staff line.

- [ ] **Step 3: Run the complete verification suite**

Run: `npm run lint && npm run typecheck && npm run test:answers && npm run export:web`

Expected: all commands PASS.

- [ ] **Step 4: Commit only required visual corrections**

```bash
git add src/core/music-notation.ts src/core/staff-coordinate.ts src/components/music-glyphs.tsx src/components/answer-staff.tsx src/components/notation-editor.tsx src/components/staff-preview.tsx
git commit -m "fix: finish native notation parity"
```
