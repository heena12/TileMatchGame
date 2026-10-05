/** Key/value persistence. Implementations: MMKV (app), in-memory (tests), cloud-backed (later). */
export interface IStorage {
  getString(key: string): string | undefined;
  setString(key: string, value: string): void;
  getNumber(key: string): number | undefined;
  setNumber(key: string, value: number): void;
  contains(key: string): boolean;
  delete(key: string): void;
  keys(): string[];
  clear(): void;
}
