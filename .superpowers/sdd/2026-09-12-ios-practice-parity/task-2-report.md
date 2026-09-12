# Task 2: Recoverable practice session and question navigation

## Status

Implemented and verified.

## Changes

- Added a versioned active-practice session store with serialized questions, index, score, session id, and per-question snapshots.
- Restores the five feedback-relevant fields for both backward and forward navigation; unanswered questions reset to their blank state.
- Persists only resumable session data, clears it on completed results and restart, and retains the existing submission lock so repeated taps cannot add score or wrongbook records.
- Added feedback navigation controls in the requested order, with accessible labels, disabled states, and existing 48 pt minimum control height.
- Extended storage smoke coverage for the persistence key, restore paths, submission lock, and wrongbook deduplication.
- Satisfied the already-committed practice parity contract's stored-volume row and keyboard prop requirements.

## Verification

```text
npm run test:storage
exit=0
local data smoke passed

npm run test:practice-parity
exit=0
practice parity contract passed (5 source files checked)

npm run typecheck
exit=0
tsc --noEmit
```

## Review fix round 2

- Added the smallest executable completion seam used by the practice submit handler. It records each finalized question index and returns the unchanged score on a second completion; the storage smoke test executes both submissions and asserts that score remains unchanged.
- Snapshot normalization now requires the full persisted answer shape before applying the existing answer normalizer. It rejects the whole session for a missing answer, non-finite highlight key, or unknown highlight state instead of silently repairing malformed snapshot structure.
- Added near-complete malformed fixtures for a missing `answer` and an invalid highlight enum.

Exact commands and output:

```text
npm run test:storage
exit=0
local data smoke passed

npm run test:practice-parity
exit=0
practice parity contract passed (5 source files checked)

npm run typecheck
exit=0
tsc --noEmit
```

## Self-review

- Confirmed snapshot persistence excludes playing, preparation, timers, and error messages.
- Confirmed missing snapshots retain their array index and reset before navigation rather than overwriting restored state.
- Confirmed restarting drops the restored session reference before generating the new group.
- `git diff --check` completed without whitespace errors.

## Review fix round 1

- Replaced source-text persistence checks with executable coverage: the smoke test transpiles the local storage service against an in-memory AsyncStorage implementation, verifies a versioned JSON round trip, answered and unanswered snapshot restoration, clearing for restart, and duplicate submission suppression for both records and wrongbook entries.
- Moved practice-session normalization into the existing Node-compatible normalizer so the same executable test validates the production restore path.
- Invalid snapshot objects now reject the entire active session. Valid snapshots normalize their answer with the existing answer normalizer, preserving serialized pitch holes and their original snapshot indexes.
- Added a per-question submission key as a persistence backstop alongside the existing `submitting` ref, so a duplicate retry cannot create another record or increase wrongbook error count.

Exact commands and output:

```text
npm run test:storage
exit=0
local data smoke passed

npm run test:practice-parity
exit=0
practice parity contract passed (5 source files checked)

npm run typecheck
exit=0
tsc --noEmit
```
