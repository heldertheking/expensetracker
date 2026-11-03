import { z } from 'zod';

/**
 * Fields a client may not send. The field is optional so a request without it is fine, but any
 * value fails with a message that says why, instead of a generic "unrecognized key".
 */
function readonlyFields<const K extends string>(keys: readonly K[], reason: string) {
  return Object.fromEntries(
    keys.map((key) => [key, z.never({ error: `${key} ${reason}` }).optional()]),
  ) as Record<K, z.ZodOptional<z.ZodNever>>;
}

const SERVER_MANAGED = 'is managed by the server and cannot be set';

export { readonlyFields, SERVER_MANAGED };
