import { z } from 'zod';

/**
 * Server-managed instant. A `Date` on the server, an ISO 8601 date-time string on the wire; both
 * become a `Date`, so one schema works on both sides of JSON. Unlike a bare `z.coerce.date()` it
 * rejects `null`, numbers and booleans, so a missing timestamp cannot pass as 1970-01-01.
 */
const Timestamp = z.union([z.date(), z.iso.datetime({ offset: true })]).pipe(z.coerce.date());

export { Timestamp };
