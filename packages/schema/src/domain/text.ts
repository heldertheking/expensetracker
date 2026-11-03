import { z } from 'zod';

/** Trimmed, non-blank text with an upper bound. */
const text = (max: number) => z.string().trim().min(1).max(max);

export { text };
