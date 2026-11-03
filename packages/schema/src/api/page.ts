import { z } from 'zod';

/**
 * A page of a list. Exactly the items that exist at that position are returned:
 * `min(limit, max(0, total - offset))`, so a page past the end is a valid, empty page.
 */
function page<T extends z.ZodType>(item: T) {
  return z
    .object({
      items: z.array(item),
      total: z.number().int().nonnegative(),
      limit: z.number().int().min(1),
      offset: z.number().int().nonnegative(),
    })
    .refine((p) => p.items.length === Math.min(p.limit, Math.max(0, p.total - p.offset)), {
      error: 'items must hold min(limit, total - offset) entries',
      path: ['items'],
    });
}

export { page };
