import { z } from 'zod';

/** Server-managed instant. Coerced so one schema works on both sides of JSON. */
const Timestamp = z.coerce.date();

export { Timestamp };
