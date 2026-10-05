import { createMMKV } from 'react-native-mmkv';
import type { MMKV } from 'react-native-mmkv';
import type { IStorage } from './IStorage';

export class MmkvStorage implements IStorage {
  private readonly mmkv: MMKV;

  constructor(id = 'tile-match') {
    this.mmkv = createMMKV({ id });
  }

  getString(key: string): string | undefined {
    return this.mmkv.getString(key);
  }

  setString(key: string, value: string): void {
    this.mmkv.set(key, value);
  }

  getNumber(key: string): number | undefined {
    return this.mmkv.getNumber(key);
  }

  setNumber(key: string, value: number): void {
    this.mmkv.set(key, value);
  }

  contains(key: string): boolean {
    return this.mmkv.contains(key);
  }

  delete(key: string): void {
    this.mmkv.remove(key);
  }

  keys(): string[] {
    return this.mmkv.getAllKeys();
  }

  clear(): void {
    this.mmkv.clearAll();
  }
}
