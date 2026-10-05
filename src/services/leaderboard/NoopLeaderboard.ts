import type { RunClaim } from '@engine';
import type {
  ILeaderboardService,
  LeaderboardEntry,
  SubmitOutcome,
} from './ILeaderboardService';

/** Used until a leaderboard provider is connected. Reports itself as unavailable. */
export class NoopLeaderboard implements ILeaderboardService {
  readonly isAvailable = false;

  async submit(_run: RunClaim): Promise<SubmitOutcome> {
    throw new Error('Leaderboard is not connected');
  }

  async top(
    _levelId: number,
    _limit: number,
  ): Promise<readonly LeaderboardEntry[]> {
    return [];
  }
}
