import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { runStorageContract } from './storageContract';

runStorageContract('InMemoryStorage', () => new InMemoryStorage());
