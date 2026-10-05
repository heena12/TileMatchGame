import type { IStorage } from './IStorage';
import { WebStorage } from './WebStorage';

/** Web build: localStorage. Picked automatically by the bundler over createDefaultStorage.ts. */
export function createDefaultStorage(id: string): IStorage {
  return new WebStorage(id);
}
