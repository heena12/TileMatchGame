import type { RunClaim } from '@engine';

export type SubmitOutcome =
  /** The run was verified and counted. `rank` is the player's place on that level, if known. */
  | { readonly status: 'accepted'; readonly rank: number | null }
  /** The run was checked and refused. Sending it again will not help. */
  | { readonly status: 'rejected'; readonly reason: string };

export interface LeaderboardEntry {
  /** 1 is the best. */
  readonly rank: number;
  readonly name: string;
  readonly score: number;
  readonly stars: number;
  readonly moves: number;
  readonly boostersUsed: number;
  /** True for the signed-in player's own entry. */
  readonly isYou: boolean;
}

/**
 * Per-level high scores. The client sends the whole run (the command log), not
 * just a score; the server replays it with the engine's `verifyRun` and takes
 * the score from that, so a number cannot be forged.
 *
 * Network failures reject the promise; the caller keeps the run to try again.
 */
export interface ILeaderboardService {
  /** False for the placeholder used until a provider is connected. */
  readonly isAvailable: boolean;

  submit(run: RunClaim): Promise<SubmitOutcome>;

  /** The best `limit` entries for a level, best first. */
  top(levelId: number, limit: number): Promise<readonly LeaderboardEntry[]>;
}
