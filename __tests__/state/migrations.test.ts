import { readVersioned } from '@state/persistence/migrations';
import type { Doc } from '@state/persistence/migrations';

const doc = (o: Doc) => JSON.stringify(o);

describe('readVersioned', () => {
  it('reports nothing stored', () => {
    expect(readVersioned(undefined, 1, {})).toEqual({ kind: 'none' });
    expect(readVersioned('', 1, {})).toEqual({ kind: 'none' });
  });

  it('returns a current-version document untouched', () => {
    const out = readVersioned(doc({ schemaVersion: 2, a: 1 }), 2, {});
    expect(out).toEqual({
      kind: 'ok',
      doc: { schemaVersion: 2, a: 1 },
      migrated: false,
    });
  });

  it('runs one step to upgrade by one version and stamps the new version', () => {
    const out = readVersioned(doc({ schemaVersion: 1, name: 'x' }), 2, {
      1: d => ({ ...d, extra: true }),
    });
    expect(out).toEqual({
      kind: 'ok',
      doc: { schemaVersion: 2, name: 'x', extra: true },
      migrated: true,
    });
  });

  it('chains several steps in order', () => {
    const order: number[] = [];
    const step =
      (id: number, change: (n: number) => number) =>
      (d: Doc): Doc => {
        order.push(id);
        return { ...d, n: change(d.n as number) };
      };
    const out = readVersioned(doc({ schemaVersion: 1, n: 0 }), 4, {
      1: step(1, n => n + 1),
      2: step(2, n => n * 10),
      3: step(3, n => n + 5),
    });
    expect(order).toEqual([1, 2, 3]);
    expect(out).toMatchObject({
      kind: 'ok',
      migrated: true,
      doc: { schemaVersion: 4, n: 15 },
    });
  });

  it('starts from the stored version, skipping older steps', () => {
    const one = jest.fn((d: Doc) => d);
    const two = jest.fn((d: Doc) => ({ ...d, two: true }));
    const out = readVersioned(doc({ schemaVersion: 2 }), 3, { 1: one, 2: two });
    expect(one).not.toHaveBeenCalled();
    expect(two).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({
      kind: 'ok',
      doc: { schemaVersion: 3, two: true },
    });
  });

  it('does not let a step change the version itself', () => {
    const out = readVersioned(doc({ schemaVersion: 1 }), 2, {
      1: d => ({ ...d, schemaVersion: 99 }),
    });
    expect(out).toMatchObject({ kind: 'ok', doc: { schemaVersion: 2 } });
  });

  it('does not modify the parsed input object', () => {
    const raw = doc({ schemaVersion: 1, list: [1] });
    const before = JSON.parse(raw);
    readVersioned(raw, 2, { 1: d => ({ ...d, added: 1 }) });
    expect(JSON.parse(raw)).toEqual(before);
  });

  it('recognises a document from a newer app', () => {
    expect(readVersioned(doc({ schemaVersion: 5 }), 2, {})).toEqual({
      kind: 'future',
      version: 5,
    });
  });

  it.each([
    ['broken JSON', '{nope', /not valid JSON/],
    ['a JSON string', '"hello"', /not an object/],
    ['a JSON number', '42', /not an object/],
    ['an array', '[1,2]', /not an object/],
    ['null', 'null', /not an object/],
    ['no version', '{"a":1}', /schemaVersion/],
    ['a text version', '{"schemaVersion":"1"}', /schemaVersion/],
    ['a fractional version', '{"schemaVersion":1.5}', /schemaVersion/],
    ['version zero', '{"schemaVersion":0}', /schemaVersion/],
    ['a negative version', '{"schemaVersion":-2}', /schemaVersion/],
  ])('calls %s corrupt', (_name, raw, reason) => {
    const out = readVersioned(raw, 2, {});
    expect(out.kind).toBe('corrupt');
    expect((out as { reason: string }).reason).toMatch(reason);
  });

  it('calls a document corrupt when a migration step is missing', () => {
    const out = readVersioned(doc({ schemaVersion: 1 }), 3, {
      2: d => d,
    });
    expect(out).toEqual({
      kind: 'corrupt',
      reason: 'no migration from version 1',
    });
  });

  it('calls a document corrupt when a migration throws', () => {
    const out = readVersioned(doc({ schemaVersion: 1 }), 2, {
      1: () => {
        throw new Error('bad data');
      },
    });
    expect(out).toEqual({
      kind: 'corrupt',
      reason: 'migration from version 1 failed',
    });
  });
});
