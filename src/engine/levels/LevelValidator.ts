import { LevelValidationError, validateLevel } from '../core/level';
import { TRAY_SIZE } from '../core/rules';
import type { LevelData } from './LevelData';
import { solve } from './SolvabilityChecker';

export const DEFAULT_NODE_BUDGET = 200_000;

export type ValidationStatus =
  | 'ok'
  | 'invalid'
  | 'unsolvable'
  | 'budget_exhausted';

export interface ValidationResult {
  readonly status: ValidationStatus;
  readonly ok: boolean;
  readonly message?: string;
  readonly nodes: number;
}

/**
 * Offline check used by tooling and CI: the level obeys the rules AND a winning
 * play exists with the slack the level claims. Never runs on the device.
 */
export function validateLevelData(
  level: LevelData,
  nodeBudget = DEFAULT_NODE_BUDGET,
): ValidationResult {
  try {
    validateLevel(level);
  } catch (error) {
    if (error instanceof LevelValidationError) {
      return { status: 'invalid', ok: false, message: error.message, nodes: 0 };
    }
    throw error;
  }
  if (
    !Number.isInteger(level.validatedSlack) ||
    level.validatedSlack < 0 ||
    level.validatedSlack > TRAY_SIZE - 1
  ) {
    return {
      status: 'invalid',
      ok: false,
      message: `validatedSlack ${level.validatedSlack} out of range`,
      nodes: 0,
    };
  }

  const result = solve(
    level.tiles,
    TRAY_SIZE - level.validatedSlack,
    nodeBudget,
  );
  if (result.status === 'solvable') {
    return { status: 'ok', ok: true, nodes: result.nodes };
  }
  return {
    status: result.status,
    ok: false,
    message:
      result.status === 'unsolvable'
        ? `No winning play with slack ${level.validatedSlack}`
        : `Search budget of ${nodeBudget} nodes exhausted`,
    nodes: result.nodes,
  };
}
