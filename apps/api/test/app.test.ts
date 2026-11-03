import { ApiErrorSchema, HealthSchema } from '@expensetracker/schema';
import { describe, expect, it, vi } from 'vitest';
import { setupApi, transactionBody } from './api/helpers.js';

describe('GET /api/health', () => {
  it('returns 200 with the server status', async () => {
    const { api } = setupApi();

    const response = await api.get('/api/health');

    expect(response.status).toBe(200);
    expect(HealthSchema.parse(response.body)).toMatchObject({
      status: 'ok',
      timestamp: new Date('2026-11-03T10:00:00.000Z'),
    });
  });
});

describe('errors', () => {
  it('answers an unknown route under /api with not_found', async () => {
    const { api } = setupApi();

    const response = await api.get('/api/nothing/here');

    expect(response.status).toBe(404);
    expect(ApiErrorSchema.parse(response.body).error).toEqual({
      code: 'not_found',
      message: 'no route for GET /api/nothing/here',
      issues: [],
    });
  });

  it('answers an unsupported method on a known path with not_found', async () => {
    const { api } = setupApi();

    const response = await api.put('/api/projects');

    expect(response.status).toBe(404);
    expect(ApiErrorSchema.parse(response.body).error.code).toBe('not_found');
  });

  it('answers malformed JSON with a validation_error', async () => {
    const { api } = setupApi();

    const response = await api
      .post('/api/transactions')
      .set('Content-Type', 'application/json')
      .send('{"account": "main",');

    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(response.body).error).toEqual({
      code: 'validation_error',
      message: 'request body is not valid JSON',
      issues: [],
    });
  });

  it('answers a request without a body with a validation_error', async () => {
    const { api } = setupApi();

    const response = await api.post('/api/projects');

    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(response.body).error.code).toBe('validation_error');
  });

  it('answers a too large body with its status and a validation_error', async () => {
    const { api } = setupApi();

    const response = await api
      .post('/api/projects')
      .send({ name: 'x', description: 'y'.repeat(200_000) });

    expect(response.status).toBe(413);
    expect(ApiErrorSchema.parse(response.body).error.code).toBe('validation_error');
  });

  it('answers an unexpected failure with 500 and reports it', async () => {
    const log = vi.fn();
    const { api } = setupApi({
      log,
      clock: () => {
        throw new Error('clock broke');
      },
    });

    const response = await api.get('/api/health');

    expect(response.status).toBe(500);
    expect(ApiErrorSchema.parse(response.body).error).toMatchObject({
      code: 'internal_error',
      message: 'internal server error',
    });
    expect(log).toHaveBeenCalledWith('unexpected error', new Error('clock broke'));
  });
});

describe('subscribers', () => {
  it('see every committed event, and a failing one does not undo the write', async () => {
    const log = vi.fn();
    const seen: string[] = [];
    const { api } = setupApi({
      log,
      subscribers: [
        (event) => seen.push(event.type),
        () => {
          throw new Error('subscriber broke');
        },
      ],
    });

    const created = await api.post('/api/transactions').send(transactionBody());

    expect(created.status).toBe(201);
    expect(seen).toEqual(['CreateTransactionEvent']);
    expect(log).toHaveBeenCalledWith(
      'subscriber failed for CreateTransactionEvent #1',
      new Error('subscriber broke'),
    );
    expect((await api.get(`/api/transactions/${created.body.id}`)).status).toBe(200);
  });
});
