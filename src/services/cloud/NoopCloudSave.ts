import type {
  CloudSnapshot,
  ICloudSaveService,
  PushResult,
} from './ICloudSaveService';

/** Used until a cloud provider is connected. Reports itself as unavailable. */
export class NoopCloudSave implements ICloudSaveService {
  readonly isAvailable = false;

  async pull(): Promise<CloudSnapshot | null> {
    return null;
  }

  async push(
    _payload: string,
    _baseRevision: string | null,
  ): Promise<PushResult> {
    throw new Error('Cloud save is not connected');
  }
}
