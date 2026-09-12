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
