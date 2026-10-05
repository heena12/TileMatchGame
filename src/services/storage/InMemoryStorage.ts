import type { IStorage } from './IStorage';

export class InMemoryStorage implements IStorage {
  private readonly values = new Map<string, string | number>();

  getString(key: string): string | undefined {
    const value = this.values.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  setString(key: string, value: string): void {
    this.values.set(key, value);
  }

  getNumber(key: string): number | undefined {
    const value = this.values.get(key);
    return typeof value === 'number' ? value : undefined;
  }

  setNumber(key: string, value: number): void {
    this.values.set(key, value);
  }

  contains(key: string): boolean {
    return this.values.has(key);
  }

  delete(key: string): void {
    this.values.delete(key);
  }

  keys(): string[] {
    return Array.from(this.values.keys());
  }

  clear(): void {
    this.values.clear();
  }
}
