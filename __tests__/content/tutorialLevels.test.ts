import { GameEngine, parseLevelData, solve, validateLevelData } from '@engine';
import type { LevelData } from '@engine';
import {
  TUTORIAL_LEVELS,
  TUTORIAL_LEVEL_IDS,
} from '@services/levels/tutorialLevels';
import { createLevelSource } from '@services/levels/createLevelSource';
import { APP_CONFIG } from '@config/constants';
import { isStringKey } from '@ui/i18n/strings';

const ids = [...TUTORIAL_LEVEL_IDS];
const parsed = (id: number): LevelData =>
  parseLevelData(JSON.parse(JSON.stringify(TUTORIAL_LEVELS[id])));

describe('tutorial content', () => {
  it('has exactly the levels the app treats as tutorial', () => {
    expect(ids).toEqual(
      Array.from({ length: APP_CONFIG.tutorialLevels }, (_, i) => i + 1),
    );
  });

  describe.each(ids)('level %i', id => {
    it('parses and follows the approved tutorial tier (3-4 types, 18-30 tiles, 1-2 layers)', () => {
      const level = parsed(id);
      const types = new Set(level.tiles.map(t => t.typeId)).size;
      const layers = Math.max(...level.tiles.map(t => t.layer)) + 1;
      expect(level.levelId).toBe(id);
      expect(types).toBeGreaterThanOrEqual(3);
      expect(types).toBeLessThanOrEqual(4);
      expect(level.tiles.length).toBeGreaterThanOrEqual(18);
      expect(level.tiles.length).toBeLessThanOrEqual(30);
      expect(layers).toBeLessThanOrEqual(2);
      expect(level.validatedSlack).toBe(3);
    });

    it('is solvable with 3 spare tray slots', () => {
      expect(validateLevelData(parsed(id)).status).toBe('ok');
    });

    it('stays on the 8 x 10 board', () => {
      parsed(id).tiles.forEach(t => {
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x + 1).toBeLessThanOrEqual(8);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y + 1).toBeLessThanOrEqual(10);
      });
    });

    it('has steps whose message keys all exist in the string table', () => {
      const steps = parsed(id).tutorial ?? [];
      expect(steps.length).toBeGreaterThan(0);
      steps.forEach(step => {
        expect(isStringKey(step.messageKey)).toBe(true);
        expect(step.messageKey.startsWith(`tutorial.l${id}.`)).toBe(true);
      });
    });

    it('can be played step by step on the real engine, keeping the tray small', () => {
      const level = parsed(id);
      const engine = new GameEngine(level);
      let peak = 0;
      for (const step of level.tutorial ?? []) {
        if (step.waitFor === 'tap') {
          continue;
        }
        const tileId = step.highlightTileIds[0] as number;
        expect(engine.getFreeTileIds()).toContain(tileId);
        const events = engine.dispatch({ type: 'SELECT_TILE', tileId });
        expect(events[0]?.type).toBe('TILE_SELECTED');
        peak = Math.max(peak, engine.getState().tray.length);
      }
      expect(peak).toBeLessThanOrEqual(4);
      expect(engine.getState().status).toBe('playing');
    });

    it('gives a solution that stays within 4 tray slots', () => {
      const level = parsed(id);
      expect(solve(level.tiles, 4, 100000).status).toBe('solvable');
    });
  });

  it('teaches one thing at a time: the covered-tile level really has covered tiles', () => {
    const level = parsed(3);
    const engine = new GameEngine(level);
    expect(engine.getFreeTileIds().length).toBeLessThan(level.tiles.length);
  });

  it('never grants a booster preview it cannot back up (level 9 only mentions them)', () => {
    const steps = parsed(9).tutorial ?? [];
    expect(steps).toHaveLength(1);
    expect(steps[0]?.waitFor).toBe('tap');
  });
});

describe('createLevelSource', () => {
  const source = createLevelSource();

  it('serves the fixed tutorial levels for 1 to 10', async () => {
    for (const id of ids) {
      const level = await source.getLevel(id);
      expect(level.tutorial?.length).toBeGreaterThan(0);
      expect(level.tiles).toEqual(parsed(id).tiles);
    }
  });

  it('hands over to generated levels from level 11', async () => {
    const level = await source.getLevel(11);
    expect(level.levelId).toBe(11);
    expect(level.tutorial).toBeUndefined();
    expect(level.tiles.length).toBeGreaterThan(0);
  });

  it('keeps generating far beyond the tutorial', async () => {
    const level = await source.getLevel(4321);
    expect(level.levelId).toBe(4321);
  });
});
