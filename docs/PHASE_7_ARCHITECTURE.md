# Phase 7 Architecture - Animation, Audio and Haptics

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Builds on Phase 6. The engine is untouched.

## Principle
Presentation reacts to what happened; it never decides what happens. Each accepted or rejected tap becomes one **step record** (the engine events plus the tile involved and the tray before). Animation, sound and haptics are all derived from that record, so game state is always correct instantly and effects are purely cosmetic. If an effect fails or is skipped, the game is unaffected.

```
GameController.select --> engine events --> StepRecord { seq, events, tile, trayBefore, comboLevel }
      |                                        |
      |-- FeedbackPlayer --> IAudio (tones), IHaptics (vibration)   [gated by Settings]
      +-- session store lastStep --> UI: planStep(step, geometry) --> AnimationLayer overlay
```

## Pieces

| Area | Files | Role |
|---|---|---|
| Step record | `state/gameSessionStore.ts` | `lastStep` with a rising `seq`; rejected taps produce a step too, so they can get feedback |
| Cues | `state/feedback.ts` | `cuesForEvents` (pure): select, match, combo, reject, win, lose. `FeedbackPlayer` plays them through audio and haptics, honouring the Sound and Haptics settings at play time |
| Audio | `services/audio/*` | `IAudio`; `SynthAudio` builds every sound from oscillators (no asset files) on any Web-Audio-shaped context: the browser's `AudioContext`, or `react-native-audio-api` on Android and iOS. `NoopAudio` is the fallback if no context exists. Audio errors are swallowed so sound can never break play |
| Haptics | `services/haptics/*` | `IHaptics`; vibration patterns through React Native's `Vibration` (works on Android, browser, basic on iOS) |
| Plan | `ui/animation/stepModel.ts` | Pure: turns a step plus measured geometry into flights (tile to tray slot), match bursts and reject flashes |
| Overlay | `ui/animation/AnimationLayer.tsx`, `useStepAnimations.ts` | Reanimated animations on the UI thread in one absolutely positioned layer over the play area; nothing inside the 150 tile views animates, so the board stays cheap |
| Screens | `GameScreen`, `Stars`, combo badge | Result waits for the last effect before showing; stars and combo badge pop in |

## Behaviour
- Select: the tile flies to its tray slot (240 ms) while the tray hides the slot glyph until it lands.
- Match: three ghosts pop and fade at the slots the matched tiles occupied.
- Reject (covered tile): red flash and shake on that tile, error sound and haptic.
- Win / lose: the screen waits 700 ms before opening Result so the last match can be seen.
- Reduced motion (system setting): no overlay animations and no wait; sound and haptics still follow their own settings.

## Known limits
- The tray content is updated instantly. Tiles slide left with no animation after a match (ghosts cover the visual gap).
- Sounds are simple synthesized tones. Recorded sound assets and music are not part of this phase.
- Native audio and haptics were compiled, not heard or felt: no device or emulator is available here.

## Tests
Cue mapping, `FeedbackPlayer` gating by settings, synth notes per cue on a fake audio context (including failure handling), haptic patterns, controller step records and feedback calls, `planStep` geometry, tray slot maths, and UI flows: flights appear on tap and clear, rejects flash, the Result screen waits for the effects, reduced motion skips them.
