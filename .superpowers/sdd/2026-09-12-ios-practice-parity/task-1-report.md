# Task 1: Practice parity contract

## Status

Implemented the practice parity smoke contract and registered `npm run test:practice-parity`.

## Changes

- Added `scripts/practice-parity-smoke.cjs`.
- Added the `test:practice-parity` npm script.
- The smoke contract checks required practice phase/label markers, rejects legacy audio/debug text, requires stored volume wiring to `PianoKeyboard`, and requires layout-meter forwarding for continuation systems.

## Verification

- `node scripts/practice-parity-smoke.cjs` — expected FAIL: the current implementation is missing the `上一题` marker; the contract also captures the missing stored-volume prop wiring.
- `npm run typecheck` — PASS.
- `npm run test:core` — PASS.

## Concerns

The parity smoke test is intentionally red until the practice implementation adds previous-question restoration and passes stored volume to `PianoKeyboard`. No question/scoring/audio-core behavior was changed.

## Review fix round 1

Addressed all review findings:

- Previous-question parity now requires a `previous()` handler, decrementing index, answer restoration, and a `上一题` Pressable wired to that handler.
- Volume visibility now rejects the existing compact-feedback conditional and requires an unconditional volume row.
- `PianoKeyboard` volume matching is bounded to its opening tag.
- Every rendered `TimedAnswerStaff` opening tag is enumerated and checked for layout-meter forwarding and continuation display-meter behavior, including standard-answer rendering.
- Forbidden audio/debug checks inspect only rendered text/accessibility JSX paths after removing comments.

Covering test file: `scripts/practice-parity-smoke.cjs`

Exact commands and relevant outputs:

```text
node scripts/practice-parity-smoke.cjs
exit=1
AssertionError [ERR_ASSERTION]: practice parity marker missing: 上一题

npm run typecheck
exit=0
tsc --noEmit

npm run test:core
exit=0
核心冒烟测试通过：题目去重、和弦同时起音与难度比例、四句式旋律和音频渲染均正常。
```
