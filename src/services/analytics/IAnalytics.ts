/** Events from GAME_DESIGN 13.8 that exist so far. No personal data in any event. */
export type AnalyticsEvent =
  | { readonly name: 'app_open' }
  | { readonly name: 'level_start'; readonly levelId: number }
  | {
      readonly name: 'level_complete';
      readonly levelId: number;
      readonly stars: number;
      readonly score: number;
      readonly moves: number;
    }
  | {
      readonly name: 'booster_used';
      readonly levelId: number;
      readonly booster: string;
      /** Whether it came from stock or was bought with coins on the spot. */
      readonly paidWith: 'inventory' | 'coins';
    }
  | {
      readonly name: 'level_resume';
      readonly levelId: number;
      /** Moves already made when the saved game was picked up again. */
      readonly moves: number;
    }
  | {
      readonly name: 'tutorial_step';
      readonly levelId: number;
      /** 1-based number of the step just finished. */
      readonly step: number;
    }
  | {
      readonly name: 'tutorial_skip';
      readonly levelId: number;
      /** Steps already finished when the player skipped. */
      readonly atStep: number;
    }
  | {
      readonly name: 'level_revive';
      readonly levelId: number;
      readonly coins: number;
    }
  | {
      readonly name: 'level_fail';
      readonly levelId: number;
      readonly peakTray: number;
      readonly remainingTiles: number;
    };

/** Implemented by a real backend in Phase 13; consent gating arrives in Phase 12. */
export interface IAnalytics {
  track(event: AnalyticsEvent): void;
}
