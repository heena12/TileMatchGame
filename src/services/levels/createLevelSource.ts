import {
  AuthoredLevelSource,
  CompositeLevelSource,
  GeneratedLevelSource,
} from '@engine';
import type { ILevelSource, LevelData } from '@engine';
import { TUTORIAL_LEVELS } from './tutorialLevels';

/**
 * The app's level supply: the ten fixed tutorial levels first (parsed and
 * checked like any authored level), then generated levels for the rest.
 * Later batches of hand-made levels plug in ahead of the generator here.
 */
export function createLevelSource(): ILevelSource<LevelData> {
  const authored = new AuthoredLevelSource(async id => TUTORIAL_LEVELS[id]);
  return new CompositeLevelSource([authored, new GeneratedLevelSource()]);
}
