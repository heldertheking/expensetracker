import express, { Request, Response } from 'express';
import { HealthSchema } from '@expensetracker/schema';

export const app = express();

app.use(express.json());

// Single health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json(
    HealthSchema.parse({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date(),
    }),
  );
});
