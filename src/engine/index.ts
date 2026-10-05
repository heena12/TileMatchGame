/**
 * Public entry of the Game Engine. Pure TypeScript: no React, React Native,
 * or storage imports are allowed anywhere under src/engine.
 */
export { GameEngine } from './GameEngine';
export { LevelValidationError } from './core/level';
export { TRAY_SIZE, MATCH_SIZE, REVIVE_UNDO } from './core/rules';
export type {
  GameState,
  GameStatus,
  HistoryFrame,
  LevelDefinition,
  Tile,
  TileId,
  TileSpec,
  TileTypeId,
} from './core/types';
export {
  initialScoreState,
  applyEvents,
  calculateClearBonus,
  currentComboLevel,
} from './scoring/ScoreSystem';
export type { ScoreState } from './scoring/ScoreSystem';
export {
  initialCombo,
  registerMatch,
  registerMissedSelection,
} from './scoring/ComboSystem';
export type { ComboState } from './scoring/ComboSystem';
export {
  calculateStars,
  defaultThresholds,
  referenceScore,
} from './scoring/StarSystem';
export type { Stars, StarThresholds, StarInput } from './scoring/StarSystem';
export { calculateReward } from './scoring/RewardSystem';
export type { LevelReward } from './scoring/RewardSystem';
export { evaluateCommandLog } from './scoring/evaluate';
export { MAX_RUN_COMMANDS, verifyRun } from './verification/verifyRun';
export type {
  RunClaim,
  VerifyFailure,
  VerifyResult,
} from './verification/verifyRun';
export type { Evaluation } from './scoring/evaluate';
export {
  LEVEL_SCHEMA_VERSION,
  LevelDataError,
  LevelNotFoundError,
} from './levels/LevelData';
export type { LevelData, TutorialStep, TutorialWait } from './levels/LevelData';
export { parseLevelData } from './levels/parseLevelData';
export { levelFingerprint } from './levels/fingerprint';
export { getDifficultyConfig } from './levels/DifficultyConfig';
export type { DifficultyConfig, Tier } from './levels/DifficultyConfig';
export { generateLevel, LevelGenerationError } from './levels/LevelGenerator';
export type { GenerateOptions } from './levels/LevelGenerator';
export {
  validateLevelData,
  DEFAULT_NODE_BUDGET,
} from './levels/LevelValidator';
export type {
  ValidationResult,
  ValidationStatus,
} from './levels/LevelValidator';
export { solve } from './core/solver';
export { findHint } from './core/hint';
export { findCollectSet } from './core/collect';
export { canShuffleBoard, shuffleBoard } from './core/shuffle';
export { DealError, dealTypes, randomRemovalOrder } from './core/dealing';
export type { DealInput, OpenGroup } from './core/dealing';
export type { SolveResult, SolveStatus } from './core/solver';
export { SeededRandom, hashSeed } from './levels/SeededRandom';
export {
  AuthoredLevelSource,
  GeneratedLevelSource,
  CompositeLevelSource,
} from './levels/LevelSources';
export type { LevelLoader } from './levels/LevelSources';
export { isBoosterCommand } from './commands/commands';
export type {
  Command,
  HintCommand,
  SelectTileCommand,
  ShuffleCommand,
  UndoCommand,
} from './commands/commands';
export type { GameEvent, RejectReason } from './events/events';
export type { IRandom } from './ports/IRandom';
export type { IClock } from './ports/IClock';
export type { ILevelSource } from './ports/ILevelSource';
