# ADR 00x — Criticality-based `silent` flag logic for the notification pipeline

- Status: Accepted
- Date: 2026-06-06
- Area: notification pipeline (`silent flag logic`)

## Context

The notification pipeline asks, for every outbound message, whether it should be delivered
*silently* (Telegram's `disable_notification: true` — no sound/vibration). The original code let
the user mark **any** notification type silent in `TelegramSettings.jsx`, and the transport
(`src/lib/telegram.js#notify`) blindly obeyed that per-type `silent` flag.

**inconsistency identified:** a notification's *importance* and its *silent* setting were
completely decoupled. The audit question — *"silent برای critical events است؟"* ("is silent for
critical events?") — surfaced the logical flaw: a **critical** alert (an application crash, a
`scan_failed` data-integrity failure, a security event) could be delivered silently and missed by
the user, which defeats the entire purpose of a critical alert.

**assumptions documented** — the two sides that disagreed:

- **Side A — transport (`telegram.js`)**: assumed the per-type `silent` flag is the single source
  of truth and must always be honoured as-is.
- **Side B — product requirement**: assumed critical alerts must *always* ring and the user must
  never be able to silence them, while routine notifications stay fully user-configurable.

These two assumptions are mutually inconsistent: under Side A a user can silence a critical alert;
under Side B they cannot. No single unit test caught it because each module was tested in its own
silo.

## Decision (ground truth)

**Side B is the ground truth.** Every notification type is classified into one of three
criticality levels, and the *effective* `silent` flag is derived from that classification:

| Criticality | Types                                                        | Silent policy                         |
|-------------|-------------------------------------------------------------|---------------------------------------|
| `critical`  | `critical_error` (crashes / `scan_failed` / data integrity) | **Always loud** — never silent        |
| `important` | `session_complete`, `exam_result`, `reminder`, `new_login`  | User-configurable (default loud)      |
| `routine`   | `drive_sync`, `daily_summary`                               | User-configurable (default silent)    |

Precedence used to resolve the flag (`resolveSilent(config, type, override)`):

1. If the type is **critical** → `silent = false` (overrides config **and** any caller override).
2. Else if the caller passed an explicit `override` → use it.
3. Else → use the per-type config default.

Unknown/new types default to `routine` (fail-safe: only types we have *explicitly* classified as
critical get the no-silence guarantee, so a new type can never accidentally claim it).

## Where this lives (aligned across tiers)

- **Frontend transport — `src/lib/telegram.js`**: `CRITICALITY`, `NOTIFICATION_CRITICALITY`,
  `getNotificationCriticality`, `isCriticalNotification`, and `resolveSilent` are the single
  implementation; `notify()` uses `resolveSilent()` so the policy is enforced at the send boundary.
- **Frontend UI — `src/components/TelegramSettings.jsx`**: the "بی‌صدا" (silent) checkbox is
  disabled and forced unchecked for critical types, so the UI can never offer a setting the
  transport would override.
- **Backend reference / ground truth — `backend/app/notification_pipeline.py`**: a Python mirror
  of the exact same classification + precedence, exercised by
  `tests/integration/test_notification_pipeline.py` so drift between the documented policy and the
  code is caught by CI.

## Consequences

- A critical alert is guaranteed to ring regardless of user configuration — the core safety
  property the audit asked for.
- Routine/important notifications remain fully user-tunable, so the change does not regress the
  existing "let me silence my daily summary" use case.
- The classification table above is the contract: adding a new notification type requires choosing
  its criticality here (and in the mirrored `NOTIFICATION_CRITICALITY` maps), which keeps the
  pipeline coherent by construction.
