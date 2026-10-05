import type { IStorage } from './IStorage';

/**
 * Browser storage behind IStorage, for the web build only. Keys are prefixed
 * with the storage id so several stores can share one origin. Falls back to
 * memory when localStorage is unavailable (private mode, blocked storage).
 */
export class WebStorage implements IStorage {
  private readonly prefix: string;
  private readonly fallback = new Map<string, string>();

  constructor(id = 'tile-match') {
    this.prefix = `${id}:`;
  }

  private read(key: string): string | undefined {
    try {
      return globalThis.localStorage.getItem(this.prefix + key) ?? undefined;
    } catch {
      return this.fallback.get(key);
    }
  }

  private write(key: string, value: string): void {
    try {
      globalThis.localStorage.setItem(this.prefix + key, value);
    } catch {
      this.fallback.set(key, value);
    }
  }

  getString(key: string): string | undefined {
    const value = this.read(key);
    return value !== undefined && !value.startsWith('n:')
      ? value.slice(2)
      : undefined;
  }

  setString(key: string, value: string): void {
    this.write(key, `s:${value}`);
  }

  getNumber(key: string): number | undefined {
    const value = this.read(key);
    return value !== undefined && value.startsWith('n:')
      ? Number(value.slice(2))
      : undefined;
  }

  setNumber(key: string, value: number): void {
    this.write(key, `n:${value}`);
  }

  contains(key: string): boolean {
    return this.read(key) !== undefined;
  }

  delete(key: string): void {
    try {
      globalThis.localStorage.removeItem(this.prefix + key);
    } catch {
      this.fallback.delete(key);
    }
  }

  keys(): string[] {
    try {
      const storage = globalThis.localStorage;
      const result: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const name = storage.key(i);
        if (name?.startsWith(this.prefix)) {
          result.push(name.slice(this.prefix.length));
        }
      }
      return result;
    } catch {
      return Array.from(this.fallback.keys());
    }
  }

  clear(): void {
    this.keys().forEach(key => this.delete(key));
  }
}
