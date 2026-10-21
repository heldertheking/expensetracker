import { z } from 'zod';

/** Money is always integer minor units (cents): no float drift, exact sums. */
const MAX_CENTS = 100_000_000_000;
const MoneyCents = z.number().int().positive().max(MAX_CENTS);

export { MAX_CENTS, MoneyCents };
