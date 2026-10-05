export type Doc = Record<string, unknown>;

/**
 * Upgrades a document by exactly one version (v -> v + 1). It returns the
 * upgraded fields; the runner stamps the new `schemaVersion` itself.
 */
export type MigrationStep = (doc: Doc) => Doc;

export type ReadOutcome =
  /** Nothing was stored. */
  | { readonly kind: 'none' }
  /** A readable document at the current version. `migrated` is true if it was upgraded on the way. */
  | { readonly kind: 'ok'; readonly doc: Doc; readonly migrated: boolean }
  /** Stored, but not usable: bad JSON, wrong shape, invalid version or a broken migration. */
  | { readonly kind: 'corrupt'; readonly reason: string }
  /** Written by a newer version of the app. */
  | { readonly kind: 'future'; readonly version: number };

const isObject = (v: unknown): v is Doc =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a stored document and brings it up to `currentVersion`. Pure: it never
 * touches storage, so loading can never overwrite anything.
 *
 * `steps[v]` upgrades version v to v + 1.
 */
export function readVersioned(
  raw: string | undefined,
  currentVersion: number,
  steps: Readonly<Record<number, MigrationStep>>,
): ReadOutcome {
  if (raw === undefined || raw === '') {
    return { kind: 'none' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt', reason: 'not valid JSON' };
  }
  if (!isObject(parsed)) {
    return { kind: 'corrupt', reason: 'not an object' };
  }

  const version = parsed.schemaVersion;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return { kind: 'corrupt', reason: 'missing or invalid schemaVersion' };
  }
  if (version > currentVersion) {
    return { kind: 'future', version };
  }

  let doc: Doc = parsed;
  for (let v = version; v < currentVersion; v++) {
    const step = steps[v];
    if (!step) {
      return { kind: 'corrupt', reason: `no migration from version ${v}` };
    }
    try {
      doc = { ...step(doc), schemaVersion: v + 1 };
    } catch {
      return { kind: 'corrupt', reason: `migration from version ${v} failed` };
    }
  }
  return { kind: 'ok', doc, migrated: version < currentVersion };
}
