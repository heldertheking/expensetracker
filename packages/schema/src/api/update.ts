/**
 * The fields of `patch` that are sent and differ from `existing`. Updates are PATCH-like: an
 * absent field means "keep", so only sent fields can change anything.
 */
function changedFields<T extends object, K extends keyof T>(
  existing: T,
  patch: Partial<Pick<T, K>>,
  keys: readonly K[],
): K[] {
  return keys.filter((key) => patch[key] !== undefined && patch[key] !== existing[key]);
}

const NOTHING_CHANGED = 'nothing changed: every value sent equals the current one';

export { changedFields, NOTHING_CHANGED };
