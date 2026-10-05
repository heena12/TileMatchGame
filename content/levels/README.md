# Authored levels

Place hand-made levels here as `<levelId>.json` in the schema-v1 format (see `src/engine/levels/LevelData.ts`).
Every file is parsed and checked for solvability at its `validatedSlack` by `__tests__/engine/levels/shippedLevels.test.ts`, which runs in CI.
