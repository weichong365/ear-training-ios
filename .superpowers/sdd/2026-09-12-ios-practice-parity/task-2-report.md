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

## Self-review

- Confirmed snapshot persistence excludes playing, preparation, timers, and error messages.
- Confirmed missing snapshots retain their array index and reset before navigation rather than overwriting restored state.
- Confirmed restarting drops the restored session reference before generating the new group.
- `git diff --check` completed without whitespace errors.
