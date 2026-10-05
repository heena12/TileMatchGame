import type { IStorage } from '@services/storage/IStorage';

export function runStorageContract(name: string, create: () => IStorage) {
  describe(`${name} implements IStorage`, () => {
    let s: IStorage;
    beforeEach(() => {
      s = create();
      s.clear();
    });

    it('round-trips strings and numbers', () => {
      s.setString('a', 'x');
      s.setNumber('b', 5);
      expect(s.getString('a')).toBe('x');
      expect(s.getNumber('b')).toBe(5);
    });

    it('returns undefined for missing keys', () => {
      expect(s.getString('nope')).toBeUndefined();
      expect(s.getNumber('nope')).toBeUndefined();
    });

    it('reports contains, keys and delete', () => {
      s.setString('a', '1');
      s.setNumber('b', 2);
      expect(s.contains('a')).toBe(true);
      expect(s.keys().sort()).toEqual(['a', 'b']);
      s.delete('a');
      expect(s.contains('a')).toBe(false);
    });

    it('clears everything', () => {
      s.setString('a', '1');
      s.clear();
      expect(s.keys()).toEqual([]);
    });
  });
}
