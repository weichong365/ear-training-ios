# Piano and Staff Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the iOS review piano and every iOS staff renderer match the mini-program's geometry, UI states, and notation behavior.

**Architecture:** Keep practice and exam screens as flow owners while moving all reusable musical geometry into pure functions in `src/core/music-notation.ts`. The three native staff surfaces consume those functions, and `PianoKeyboard` owns only keyboard geometry, rendering, touch, and accessibility. Existing audio, question, scoring, storage, and subscription behavior remain unchanged.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, `react-native-svg`, Node smoke-test harnesses.

**Spec:** `docs/superpowers/specs/2026-09-12-piano-staff-parity-design.md`

## Global Constraints

- Modify only `ios-app/`; the mini-program remains the reference implementation.
- Preserve G3–A5, 27 samples, stored volume, and 1.85-second playback.
- Preserve current question generation, scoring, storage, navigation, and Apple subscription behavior.
- Use native React Native/SVG rendering; add no dependency and no music-font positioning.
- Keep every interactive target at least 44×44 pt and expose state through VoiceOver as well as color.
- Verify both a 320-point narrow phone width and a regular iPhone width; physical-device sound and final pixel checks remain TestFlight acceptance items.

---

### Task 1: Lock the Mini-Program Geometry Contract

**Files:**
- Modify: `scripts/practice-parity-smoke.cjs`
- Modify: `src/core/music-notation.ts`

**Interfaces:**
- Consumes: the current mini-program constants and rules in `../components/staff-layout.js`, `../components/staff-notation/staff-notation.js`, and `../components/piano-keyboard/piano-keyboard.js`.
- Produces: `STAFF_LINE_YS`, `STAFF_STROKE_WIDTH`, `staffSvgYFromWrittenMidi()`, `writtenMidiFromStaffSvgY()`, `ledgerLineYs()`, `barlineBounds()`, `noteheadStemStart()`, `beamGroupAtBeat()`, plus pure keyboard geometry helpers `pianoWhiteMidis()`, `pianoBlackKeys()` and `pianoKeyLayout()`.

- [ ] **Step 1: Write failing geometry assertions**

Add runtime assertions that compare the App contract to explicit mini-program fixtures:

```js
assert.deepEqual(notation.STAFF_LINE_YS, [32, 40, 48, 56, 64]);
assert.equal(notation.staffSvgYFromWrittenMidi(64), 64);
assert.deepEqual(notation.ledgerLineYs(60), [72]);
assert.deepEqual(notation.ledgerLineYs(57), [72, 80]);
assert.deepEqual(notation.barlineBounds(), { top: 32, bottom: 64 });
assert.equal(notation.writtenMidiFromStaffSvgY(notation.staffSvgYFromWrittenMidi(69)), 69);
assert.equal(notation.pianoWhiteMidis(55, 81).length, 16);
assert.equal(notation.pianoBlackKeys(55, 81).length, 11);
```

Also assert equal ledger spacing/stroke, exact barline bounds, round-trip note placement for every natural written position from G3 through A5, and beam groups for 2/4, 4/4, 3/8, and 6/8.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:practice-parity`

Expected: FAIL because exported keyboard geometry and any mismatched mini-program coordinates are not yet implemented.

- [ ] **Step 3: Implement the minimum pure geometry**

Add compact pure functions to `music-notation.ts`; each must derive positions from the same staff step and line-spacing constants rather than duplicate numeric offsets. Keyboard layout must return percentage positions so no key requires a minimum width:

```ts
export type PianoKeyLayout = { midi: number; leftPercent: number; widthPercent: number };
export function pianoWhiteMidis(startMidi = 55, endMidi = 81): number[];
export function pianoBlackKeys(startMidi = 55, endMidi = 81): PianoKeyLayout[];
export function writtenMidiFromStaffSvgY(y: number): number;
```

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:practice-parity`

Expected: PASS with all staff, beam, and keyboard fixture assertions satisfied.

- [ ] **Step 5: Commit**

```text
git add scripts/practice-parity-smoke.cjs src/core/music-notation.ts
git commit -m "test: lock piano and staff geometry parity"
```

---

### Task 2: Synchronize the Review Piano

**Files:**
- Modify: `src/components/piano-keyboard.tsx`
- Modify: `src/app/practice.tsx`
- Modify: `scripts/practice-parity-smoke.cjs`

**Interfaces:**
- Consumes: `pianoWhiteMidis()`, `pianoBlackKeys()` and the existing `onKeyPress(midi)` callback.
- Produces: `PianoKeyboard({ startMidi?: number, endMidi?: number, disabled?, compact?, highlights?, volume?, onKeyPress? })` with mini-program-equivalent geometry and state rendering.

- [ ] **Step 1: Write failing piano UI and lifecycle tests**

Render G3–A5 and assert 16 flexible white keys, 11 absolutely positioned black keys, bottom labels, no horizontal overflow at 320 points, and keys with at least 44-point effective touch height. Render the practice lock state and assert:

```js
assert.equal(lockCover.props.accessibilityLabel, '复盘钢琴待解锁，提交答案后解锁');
assert.equal(flattenStyle(lockCover.props.style).alignItems, 'center');
assert.equal(flattenStyle(lockCover.props.style).justifyContent, 'center');
assert.equal(keyboard().props.disabled, true);
```

Retain existing tests for delayed audio start, playback end, failure cleanup, rapid taps, highlights, and VoiceOver announcements.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:practice-parity`

Expected: FAIL on the mini-program key proportions, centered lock treatment, or new range helpers.

- [ ] **Step 3: Implement the piano parity UI**

Replace component-local key-position arithmetic with the Task 1 helpers. Match the mini-program stage, white/black key proportions, bottom labels, disabled scrim, pressed/highlight colors, and centered translucent lock tile. Keep the practice screen as the sole owner of audio start/end and pass `startMidi={55}` and `endMidi={81}` explicitly.

- [ ] **Step 4: Verify GREEN and type safety**

Run: `npm run test:practice-parity`

Run: `npm run typecheck`

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```text
git add src/components/piano-keyboard.tsx src/app/practice.tsx scripts/practice-parity-smoke.cjs
git commit -m "feat: sync review piano with mini program"
```

---

### Task 3: Unify Basic and Preview Staff Rendering

**Files:**
- Modify: `src/components/music-glyphs.tsx`
- Modify: `src/components/answer-staff.tsx`
- Modify: `src/components/staff-preview.tsx`
- Modify: `scripts/practice-parity-smoke.cjs`

**Interfaces:**
- Consumes: the Task 1 staff geometry functions.
- Produces: common visual placement for clef, staff lines, noteheads, accidentals, ledger lines, stems, barlines, and empty prompt across editable answers and read-only previews.

- [ ] **Step 1: Add failing renderer assertions**

For `AnswerStaff` and `StaffPreview`, inspect rendered SVG nodes and assert:

```js
assert.deepEqual(staffLines.map(lineY), notation.STAFF_LINE_YS);
assert.ok(ledgerLines.every((line) => line.props.strokeWidth === notation.STAFF_STROKE_WIDTH));
assert.deepEqual(barlines.map(bounds), [{ y1: 32, y2: 64 }]);
assert.ok(stems.every((stem) => overlapsItsNotehead(stem, noteheads)));
```

Add fixtures for whole notes on the first space, first line, upper/lower ledger lines, a stacked chord with accidental collision columns, and the centered “播放题目后开始作答” prompt.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:practice-parity`

Expected: FAIL on at least one renderer-specific duplicated coordinate or glyph placement.

- [ ] **Step 3: Implement shared placement**

Make both components use the same logical `viewBox`, line array, barline bounds, notehead center, accidental anchor, ledger extents, and stem-overlap helper. Preserve each component's editing/read-only API and existing feedback colors. Music symbols remain explicit SVG paths/components from `music-glyphs.tsx`.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:practice-parity`

Run: `npm run test:answers`

Expected: both commands exit 0 and the answer-scoring fixtures remain unchanged.

- [ ] **Step 5: Commit**

```text
git add src/components/music-glyphs.tsx src/components/answer-staff.tsx src/components/staff-preview.tsx scripts/practice-parity-smoke.cjs
git commit -m "feat: unify basic staff rendering"
```

---

### Task 4: Synchronize Timed Rhythm and Melody Staffs

**Files:**
- Modify: `src/components/notation-editor.tsx`
- Modify: `scripts/practice-parity-smoke.cjs`

**Interfaces:**
- Consumes: the shared geometry and glyph functions from Tasks 1 and 3, plus existing `NotationEvent`, meter, key-signature, and bar-index data.
- Produces: `TimedAnswerStaff`, `NotationStaff`, and `NotationEditor` with identical layout rules in practice, exams, continuation systems, and standard-answer blocks.

- [ ] **Step 1: Add failing timed-notation fixtures**

Assert precise placement for key signatures, time signatures, rests, dots, tuplets, stems, flags, beams, barlines, and final double bars. Fixtures must include:

```js
timedFixture('2/4', [0.5, 0.5, 0.5, 0.5], 2);
timedFixture('4/4', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 4);
timedFixture('3/8', [1 / 3, 1 / 3, 1 / 3], 1);
timedFixture('6/8', [1 / 3, 1 / 3, 1 / 3, 1 / 3, 1 / 3, 1 / 3], 2);
```

For each fixture assert beams stop when `beamGroup` changes and at every barline. Repeat with the visible meter omitted but `capacityMeter` retained. Assert all terminal lines use `barlineBounds()` and that the thick final line changes only stroke width, never height.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:practice-parity`

Expected: FAIL on remaining timed-renderer coordinates or missing parity cases.

- [ ] **Step 3: Implement timed parity**

Refactor `buildStemLayout()` only as far as needed to consume the common geometry and explicit measure-local beam groups. Align rest/dot/tuplet anchors to the mini-program contract. Keep `capacityMeter` as the layout meter for continuation rows while `meter` controls only visible time-signature text.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:practice-parity`

Run: `npm run test:answers`

Run: `npm run test:provinces`

Expected: all three commands exit 0.

- [ ] **Step 5: Commit**

```text
git add src/components/notation-editor.tsx scripts/practice-parity-smoke.cjs
git commit -m "feat: sync timed notation with mini program"
```

---

### Task 5: Integrate Every Flow and Perform Native-Style QA

**Files:**
- Modify if required by failing tests: `src/app/practice.tsx`
- Modify if required by failing tests: `src/app/exam-paper.tsx`
- Modify: `scripts/practice-parity-smoke.cjs`
- Modify if parity baselines change intentionally: `scripts/answer-smoke.mjs`

**Interfaces:**
- Consumes: the synchronized `PianoKeyboard`, `AnswerStaff`, `StaffPreview`, `NotationStaff`, and `NotationEditor`.
- Produces: consistent practice, wrong-answer retry, mock-exam, choice-preview, user-answer, and standard-answer experiences.

- [ ] **Step 1: Add failing flow coverage**

Render each consuming route and assert it uses a shared component rather than local SVG geometry. Cover ready, playing, answering, correct feedback, wrong feedback, and finished phases. Verify the locked keyboard cannot be focused or pressed and the unlocked keyboard remains disabled only while question/answer audio is active.

- [ ] **Step 2: Run the flow test and verify RED**

Run: `npm run test:practice-parity`

Expected: FAIL only where a remaining flow bypasses a shared component or exposes an incorrect state.

- [ ] **Step 3: Make the minimum integration edits**

Replace only confirmed duplicate/bypassing render paths. Do not change page navigation, scoring, persistence, subscription gates, or question generation.

- [ ] **Step 4: Run the complete automated verification**

Run in order:

```text
npm run typecheck
npm run lint
npm run test:core
npm run test:provinces
npm run test:answers
npm run test:storage
npm run test:province-tier
npm run test:sample-range
npm run test:practice-parity
npm run test:home-parity
node scripts/audio-lifecycle-smoke.cjs
npm run export:web
```

Expected: every command exits 0; lint has no new error or warning beyond the four pre-existing warnings in `practice.tsx` and `local-data.ts`.

- [ ] **Step 5: Perform one batched visual inspection**

Render a representative single-note question, ledger-line note, wrong-answer comparison, 6/8 melody continuation row, locked piano, and unlocked/highlighted piano at 320-point and regular iPhone widths. Check geometry, clipping, centered lock, touch labels, and scroll behavior together. Apply one bounded correction batch if needed, then perform one confirmation pass.

- [ ] **Step 6: Record hardware acceptance limits**

State explicitly that the browser/native preview verifies layout and synthesized interaction, while final sound, VoiceOver speech, and physical pixel rounding require TestFlight verification on the user's iPhone.

- [ ] **Step 7: Commit**

```text
git add src/app/practice.tsx src/app/exam-paper.tsx scripts/practice-parity-smoke.cjs scripts/answer-smoke.mjs
git commit -m "test: verify piano and staff parity across flows"
```
