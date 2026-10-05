import { verifyRun } from '@engine';
import type { ILevelSource, LevelData, RunClaim } from '@engine';
import type {
  ILeaderboardService,
  LeaderboardEntry,
  SubmitOutcome,
} from '../leaderboard/ILeaderboardService';
import type {
  CloudSnapshot,
  ICloudSaveService,
  PushResult,
} from './ICloudSaveService';

interface ScoreRow {
  readonly playerId: string;
  readonly name: string;
  readonly score: number;
  readonly stars: number;
  readonly moves: number;
  readonly boostersUsed: number;
  /** Order of arrival, to break exact ties. */
  readonly sequence: number;
}

/**
 * A complete "server" kept in memory. It is the reference for what a real
 * backend must do, and it lets every test run two devices against one shared
 * cloud without a network:
 *
 * - saves: one text payload per player, replaced only if the caller names the
 *   current revision (otherwise a conflict comes back with the current one);
 * - leaderboard: verifies each run by replaying it with `verifyRun`, keeps each
 *   player's best per level, ranks by score, then fewer moves, then earlier.
 *
 * `offline` makes every call fail like a dropped connection.
 */
export class InMemoryBackend {
  offline = false;

  private readonly saves = new Map<string, CloudSnapshot>();
  private readonly scores = new Map<number, Map<string, ScoreRow>>();
  private revisionCounter = 0;
  private sequenceCounter = 0;
  /** Optional hook run just before a push is decided, to stage a race in tests. */
  beforePush: ((playerId: string) => void) | null = null;

  /** Total calls that reached the "server", by kind. */
  readonly calls = { pull: 0, push: 0, submit: 0, top: 0 };

  constructor(private readonly levels: ILevelSource<LevelData>) {}

  /** The current stored text for a player, for tests that need to look or tamper. */
  peek(playerId: string): CloudSnapshot | undefined {
    return this.saves.get(playerId);
  }

  /** Puts text straight into a player's cloud slot, as if another device had saved it. */
  plant(playerId: string, payload: string): CloudSnapshot {
    const snapshot = { payload, revision: `r${++this.revisionCounter}` };
    this.saves.set(playerId, snapshot);
    return snapshot;
  }

  /** A client for one signed-in player, as the app would hold it. */
  client(
    playerId: string,
    name: string = playerId,
  ): { cloud: ICloudSaveService; leaderboard: ILeaderboardService } {
    return {
      cloud: new BackendCloud(this, playerId),
      leaderboard: new BackendLeaderboard(this, playerId, name),
    };
  }

  /** @internal */
  guard(): void {
    if (this.offline) {
      throw new Error('Network request failed');
    }
  }

  /** @internal */
  pull(playerId: string): CloudSnapshot | null {
    this.guard();
    this.calls.pull++;
    return this.saves.get(playerId) ?? null;
  }

  /** @internal */
  push(
    playerId: string,
    payload: string,
    baseRevision: string | null,
  ): PushResult {
    // The hook runs first so a test can stage a race or a dropped connection.
    this.beforePush?.(playerId);
    this.guard();
    this.calls.push++;
    const current = this.saves.get(playerId);
    if ((current?.revision ?? null) !== baseRevision) {
      return {
        ok: false,
        reason: 'conflict',
        current: current as CloudSnapshot,
      };
    }
    const snapshot = this.plant(playerId, payload);
    return { ok: true, revision: snapshot.revision };
  }

  /** @internal */
  async submit(
    playerId: string,
    name: string,
    run: RunClaim,
  ): Promise<SubmitOutcome> {
    this.guard();
    this.calls.submit++;
    let level: LevelData;
    try {
      level = await this.levels.getLevel(run.levelId);
    } catch {
      return { status: 'rejected', reason: 'UNKNOWN_LEVEL' };
    }
    const result = verifyRun(level, run);
    if (!result.valid) {
      return { status: 'rejected', reason: result.reason };
    }

    const rows = this.scores.get(run.levelId) ?? new Map<string, ScoreRow>();
    this.scores.set(run.levelId, rows);
    const existing = rows.get(playerId);
    const better =
      !existing ||
      result.score > existing.score ||
      (result.score === existing.score && result.moves < existing.moves);
    if (better) {
      rows.set(playerId, {
        playerId,
        name,
        score: result.score,
        stars: result.stars,
        moves: result.moves,
        boostersUsed: result.boostersUsed,
        sequence: ++this.sequenceCounter,
      });
    }
    const ranked = this.ranked(run.levelId);
    const rank = ranked.findIndex(r => r.playerId === playerId) + 1;
    return { status: 'accepted', rank: rank > 0 ? rank : null };
  }

  /** @internal */
  top(playerId: string, levelId: number, limit: number): LeaderboardEntry[] {
    this.guard();
    this.calls.top++;
    return this.ranked(levelId)
      .slice(0, Math.max(0, limit))
      .map((row, index) => ({
        rank: index + 1,
        name: row.name,
        score: row.score,
        stars: row.stars,
        moves: row.moves,
        boostersUsed: row.boostersUsed,
        isYou: row.playerId === playerId,
      }));
  }

  private ranked(levelId: number): ScoreRow[] {
    return [...(this.scores.get(levelId)?.values() ?? [])].sort(
      (a, b) =>
        b.score - a.score || a.moves - b.moves || a.sequence - b.sequence,
    );
  }
}

class BackendCloud implements ICloudSaveService {
  readonly isAvailable = true;

  constructor(
    private readonly backend: InMemoryBackend,
    private readonly playerId: string,
  ) {}

  async pull(): Promise<CloudSnapshot | null> {
    return this.backend.pull(this.playerId);
  }

  async push(
    payload: string,
    baseRevision: string | null,
  ): Promise<PushResult> {
    return this.backend.push(this.playerId, payload, baseRevision);
  }
}

class BackendLeaderboard implements ILeaderboardService {
  readonly isAvailable = true;

  constructor(
    private readonly backend: InMemoryBackend,
    private readonly playerId: string,
    private readonly name: string,
  ) {}

  submit(run: RunClaim): Promise<SubmitOutcome> {
    return this.backend.submit(this.playerId, this.name, run);
  }

  async top(
    levelId: number,
    limit: number,
  ): Promise<readonly LeaderboardEntry[]> {
    return this.backend.top(this.playerId, levelId, limit);
  }
}
