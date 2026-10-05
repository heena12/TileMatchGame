# Notifications (local come-back reminders)

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). No engine code is touched.

## Flow

1. App starts: `ReminderService.start()` cancels anything pending. If the switch is on and the tutorial is finished, it asks for system permission once.
2. Player leaves the app (`background`): if the switch is on, the tutorial is done and permission is granted, three reminders are scheduled at 18:00 local: a daily-reward or streak-at-risk reminder (today if the reward is unclaimed and 18:00 has not passed, otherwise tomorrow), and come-back reminders 3 and 7 days later with text in the current language.
3. Player returns (`active`): everything pending is cancelled.
4. Settings switch turned on: system permission is requested; if refused, the switch is turned back off. Turned off: pending reminders are cancelled.

## Pieces

| File | Role |
|---|---|
| `src/services/notifications/INotificationService.ts` | Port: permission, `replaceAll`, `cancelAll`. Never rejects. |
| `NotifeeNotifications.ts` | `@notifee/react-native` adapter (timestamp triggers, one Android channel). |
| `NoopNotifications.ts`, `createNotifications(.web).ts` | Web and missing-native-module fallback. |
| `RecordingNotifications.ts` | Test double. |
| `src/services/lifecycle/*` | `IAppLifecycle` port, `AppStateLifecycle`, `ManualLifecycle` (tests). |
| `src/state/reminders/reminderPlan.ts` | Pure: templates (data) and `planReminders(leftAt)`. |
| `src/state/reminders/ReminderService.ts` | Orchestrates settings, progress, lifecycle and the port. |
| `src/app/di/container.ts` | Wires it; `notifications` and `lifecycle` are injectable. |

Future: a remote push adapter implements the same port (or a sibling token-registration port) with no change to the rules above.

## Native setup still to verify on a device

- Android: `POST_NOTIFICATIONS` is declared in the manifest. Rebuild the app so notifee links.
- iOS: run `pod install`; no extra capability is needed for local notifications.
- Tapping a reminder only opens the app; deep-linking is not built.

## Tests

`__tests__/state/reminders.test.ts` (plan and service rules) and `__tests__/services/notifee.test.ts` (adapter against a fake SDK).

## Daily reward and streak

- Rules (pure): `src/state/daily/dailyReward.ts`. One claim per local calendar day; consecutive days extend the streak, a missed day (or a clock set back) restarts at day 1. The reward follows a 7-day cycle defined in `src/config/dailyReward.ts`.
- Storage: the record (`lastClaimDay`, `streak`) is part of the progress document (schema v3, migration v2 -> v3 adds an empty record), so it is saved with progress and synced by cloud save. `progress.claimDailyReward()` credits the reward, extends the streak and saves in one step.
- Merge rule (`mergeDailyRecords`): the more recent claim wins, then the longer streak. Wallet and inventory still follow the existing "newer document wins" rule, so a claim never pays out twice across devices.
- UI: a gift button on Home (shown once the tutorial is finished, with a red badge while a reward is waiting) opens `DailyRewardModal`: the 7-day row, today's reward and a Claim button. It also opens by itself the first time Home is shown in a launch while a reward is waiting (not again if dismissed).
- Streak-at-risk text is used when the streak is 2+ and would still be alive when the reminder fires.
