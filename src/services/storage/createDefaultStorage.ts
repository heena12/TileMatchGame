import type { IStorage } from './IStorage';
import { MmkvStorage } from './MmkvStorage';

/** Native (Android / iOS): MMKV. The web build swaps this file for createDefaultStorage.web.ts. */
export function createDefaultStorage(id: string): IStorage {
  return new MmkvStorage(id);
}
