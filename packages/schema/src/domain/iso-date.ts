import { z } from 'zod';

/** Calendar date without time (`YYYY-MM-DD`), so it cannot shift with time zones. */
const IsoDate = z.iso.date();

export { IsoDate };
