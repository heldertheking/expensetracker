import { describe, expect, it } from 'vitest';
import { ApiRequestError, ContractError, errorMessage, withQuery } from '../src/api/client';
import {
  createProject,
  createTransaction,
  deleteProject,
  deleteTransaction,
  getAccounts,
  getHealth,
  getProject,
  getStats,
  getTransaction,
  listEvents,
  listProjects,
  listTransactions,
  updateProject,
  updateTransaction,
} from '../src/api/endpoints';
import * as f from './fixtures';
import { http, HttpResponse, recordGet, server } from './server';

describe('withQuery', () => {
  it('skips empty values and encodes the rest', () => {
    expect(withQuery('/api/x', { a: 'main', b: undefined, c: null, d: '', e: 0 })).toBe(
      '/api/x?a=main&e=0',
    );
    expect(withQuery('/api/x')).toBe('/api/x');
  });
});

describe('API client: parsing', () => {
  it('parses responses with the schema, turning timestamps into Dates', async () => {
    const t = f.transaction();
    server.use(http.get('/api/transactions/:id', () => HttpResponse.json(t)));
    const parsed = await getTransaction(t.id);
    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.createdAt.toISOString()).toBe(t.createdAt);
    expect(parsed.amountCents).toBe(4550);
  });

  it('sends list filters as query parameters', async () => {
    const { handler, urls } = recordGet('/api/transactions', f.page([], { limit: 20, offset: 40 }));
    server.use(handler);
    await listTransactions({
      account: 'savings',
      projectId: f.PROJECT_IDS.holiday,
      limit: 20,
      offset: 40,
    });
    const params = Object.fromEntries(urls[0]!.searchParams);
    expect(params).toEqual({
      account: 'savings',
      projectId: f.PROJECT_IDS.holiday,
      limit: '20',
      offset: '40',
    });
  });

  it('reads every endpoint through its schema', async () => {
    const p = f.projects.holiday;
    server.use(
      http.get('/api/health', () =>
        HttpResponse.json({ status: 'ok', uptime: 1, timestamp: '2026-06-15T12:00:00.000Z' }),
      ),
      http.get('/api/accounts', () => HttpResponse.json(f.accounts())),
      http.get('/api/stats', () => HttpResponse.json(f.sampleStats())),
      http.get('/api/events', () => HttpResponse.json(f.page(f.sampleEvents()))),
      http.get('/api/projects', () => HttpResponse.json(f.projectList())),
      http.get('/api/projects/:id', () => HttpResponse.json(p)),
    );
    expect((await getHealth()).status).toBe('ok');
    expect((await getAccounts()).total.balanceCents).toBe(1376550);
    expect((await getStats({ from: '2026-06-01', to: '2026-08-31' })).monthly).toHaveLength(3);
    expect((await listEvents({ limit: 20 })).items).toHaveLength(6);
    expect(await listProjects()).toHaveLength(3);
    expect((await getProject(p.id)).name).toBe('Holiday');
  });

  it('sends writes as JSON and parses the result', async () => {
    const bodies: unknown[] = [];
    const t = f.transaction();
    const p = f.projects.holiday;
    server.use(
      http.post('/api/transactions', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(t, { status: 201 });
      }),
      http.patch('/api/transactions/:id', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(t);
      }),
      http.delete('/api/transactions/:id', () => new HttpResponse(null, { status: 204 })),
      http.post('/api/projects', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(p, { status: 201 });
      }),
      http.patch('/api/projects/:id', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(p);
      }),
      http.delete('/api/projects/:id', () => new HttpResponse(null, { status: 204 })),
    );
    const body = {
      account: 'main' as const,
      type: 'expense' as const,
      amountCents: 4550,
      date: '2026-06-14',
      description: 'Groceries',
      projectId: null,
    };
    expect((await createTransaction(body)).id).toBe(t.id);
    await updateTransaction(t.id, { description: 'Food' });
    await expect(deleteTransaction(t.id)).resolves.toBeUndefined();
    await createProject({ name: 'Holiday', description: '', budgetCents: 200000 });
    await updateProject(p.id, { name: 'Trip' });
    await expect(deleteProject(p.id)).resolves.toBeUndefined();
    expect(bodies).toEqual([
      body,
      { description: 'Food' },
      { name: 'Holiday', description: '', budgetCents: 200000 },
      { name: 'Trip' },
    ]);
  });

  it('rejects a response that violates the schema', async () => {
    // remainingCents does not match budget - expense + income
    const broken = { ...f.projects.holiday, remainingCents: 1 };
    server.use(http.get('/api/projects/:id', () => HttpResponse.json(broken)));
    const error = await getProject(broken.id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContractError);
    expect(errorMessage(error)).toMatch(/unexpected response/);
  });

  it('rejects a list page whose size does not match the contract', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json(f.page([f.transaction()], { total: 5, limit: 20 })),
      ),
    );
    await expect(listTransactions()).rejects.toBeInstanceOf(ContractError);
  });

  it('rejects date-only timestamps', async () => {
    const t = { ...f.transaction(), createdAt: '2026-06-15' };
    server.use(http.get('/api/transactions/:id', () => HttpResponse.json(t)));
    await expect(getTransaction(t.id)).rejects.toBeInstanceOf(ContractError);
  });
});

describe('API client: errors', () => {
  it('maps an error body to a typed error with field issues', async () => {
    server.use(
      http.post('/api/transactions', () =>
        HttpResponse.json(
          f.apiError('validation_error', 'Invalid request', [
            { path: 'amountCents', message: 'Too small' },
            { path: 'date', message: 'date must not be in the future' },
            { path: 'date', message: 'second issue on date' },
            { path: '', message: 'whole request' },
          ]),
          { status: 400 },
        ),
      ),
    );
    const error = (await createTransaction({
      account: 'main',
      type: 'expense',
      amountCents: 1,
      date: '2026-06-14',
      description: 'x',
      projectId: null,
    }).catch((e: unknown) => e)) as ApiRequestError;
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('validation_error');
    expect(error.message).toBe('Invalid request');
    expect(error.issues).toHaveLength(4);
    expect(error.fieldErrors({ amountCents: 'amount' })).toEqual({
      amount: 'Too small',
      date: 'date must not be in the future',
      '': 'whole request',
    });
  });

  it('keeps the message of a conflict', async () => {
    server.use(
      http.delete('/api/projects/:id', () =>
        HttpResponse.json(f.apiError('conflict', 'Project still has 3 tagged transactions'), {
          status: 409,
        }),
      ),
    );
    const error = (await deleteProject(f.PROJECT_IDS.holiday).catch(
      (e: unknown) => e,
    )) as ApiRequestError;
    expect(error.code).toBe('conflict');
    expect(error.status).toBe(409);
    expect(errorMessage(error)).toBe('Project still has 3 tagged transactions');
  });

  it('falls back to a generic error when the error body is not the contract shape', async () => {
    server.use(http.get('/api/accounts', () => new HttpResponse('Bad gateway', { status: 502 })));
    const error = (await getAccounts().catch((e: unknown) => e)) as ApiRequestError;
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.code).toBe('unknown');
    expect(error.status).toBe(502);
    expect(error.message).toBe('Request failed with status 502');
  });

  it('reports a network failure', async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.error()));
    const error = (await getAccounts().catch((e: unknown) => e)) as ApiRequestError;
    expect(error.code).toBe('network');
    expect(error.status).toBe(0);
  });

  it('lets aborts through unchanged', async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.json(f.accounts())));
    const controller = new AbortController();
    controller.abort();
    const error = await getAccounts(controller.signal).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(ApiRequestError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('describes unknown errors', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('weird')).toBe('Something went wrong');
  });
});
