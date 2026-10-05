import { GameEngine, LevelValidationError } from '@engine';
import { level, row, tile } from './helpers';

describe('level validation', () => {
  it('accepts a valid level', () => {
    expect(() => new GameEngine(level(row(1, 3, 1)))).not.toThrow();
  });

  it('rejects an empty level', () => {
    expect(() => new GameEngine(level([]))).toThrow(LevelValidationError);
  });

  it('rejects duplicate tile ids', () => {
    const tiles = [tile(1, 1, 0), tile(1, 1, 1), tile(2, 1, 2)];
    expect(() => new GameEngine(level(tiles))).toThrow(/Duplicate tile id 1/);
  });

  it('rejects a type count that is not a multiple of 3', () => {
    expect(() => new GameEngine(level(row(1, 4, 1)))).toThrow(/multiple of 3/);
  });

  it('rejects overlapping tiles on the same layer', () => {
    const tiles = [tile(1, 1, 0, 0), tile(2, 1, 0.5, 0), tile(3, 1, 5, 0)];
    expect(() => new GameEngine(level(tiles))).toThrow(/overlap/);
  });

  it('allows overlap across layers', () => {
    const tiles = [
      tile(1, 1, 0, 0, 0),
      tile(2, 1, 0.5, 0, 1),
      tile(3, 1, 5, 0),
    ];
    expect(() => new GameEngine(level(tiles))).not.toThrow();
  });
});
