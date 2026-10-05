import { MmkvStorage } from '@services/storage/MmkvStorage';
import { runStorageContract } from './storageContract';

// react-native-mmkv is replaced by an in-memory fake in jest.setup.js.
runStorageContract('MmkvStorage', () => new MmkvStorage('test'));
