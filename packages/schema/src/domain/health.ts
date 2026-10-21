import { z } from 'zod';

const HealthSchema = z.object({
  status: z.string(),
  uptime: z.number(),
  timestamp: z.coerce.date(),
});

type Health = z.infer<typeof HealthSchema>;

export { HealthSchema };
export type { Health };
