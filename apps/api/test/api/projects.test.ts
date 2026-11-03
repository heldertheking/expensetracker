import {
  ApiErrorSchema,
  EventListResponse,
  ProjectListResponse,
  ProjectResponse,
} from '@expensetracker/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { uuid } from '../fixtures.js';
import { createProject, createTransaction, setupApi } from './helpers.js';
import type { Api } from './helpers.js';

let api: Api;

beforeEach(() => {
  ({ api } = setupApi());
});

const errorOf = (body: unknown) => ApiErrorSchema.parse(body).error;

async function lastEvent() {
  const res = await api.get('/api/events?limit=1');
  return EventListResponse.parse(res.body).items[0]!;
}

describe('POST /api/projects', () => {
  it('creates a project with defaults and zero totals (201)', async () => {
    const res = await api.post('/api/projects').send({ name: '  Holiday  ' });

    expect(res.status).toBe(201);
    expect(ProjectResponse.parse(res.body)).toEqual({
      id: uuid(1000),
      name: 'Holiday',
      description: '',
      budgetCents: null,
      incomeCents: 0,
      expenseCents: 0,
      remainingCents: null,
      overBudget: false,
      createdAt: new Date('2026-11-03T10:00:00.000Z'),
      updatedAt: new Date('2026-11-03T10:00:00.000Z'),
    });
  });

  it('records a CreateProjectEvent', async () => {
    const project = await createProject(api, { budgetCents: 1_000 });

    expect(await lastEvent()).toMatchObject({
      sequence: 1,
      type: 'CreateProjectEvent',
      payload: { project: { id: project.id, budgetCents: 1_000 } },
    });
  });

  it('rejects a duplicate name in any case with 409', async () => {
    await createProject(api, { name: 'Holiday' });

    const res = await api.post('/api/projects').send({ name: 'holiday' });

    expect(res.status).toBe(409);
    expect(errorOf(res.body)).toMatchObject({ code: 'conflict' });
  });

  it.each([
    [{ name: '' }, 'name'],
    [{ name: 'x', budgetCents: 0 }, 'budgetCents'],
    [{ name: 'x', remainingCents: 5 }, 'remainingCents'],
    [{ name: 'x', color: 'red' }, ''],
  ])('rejects %j with a validation_error on %s', async (body, path) => {
    const res = await api.post('/api/projects').send(body);

    expect(res.status).toBe(400);
    const error = errorOf(res.body);
    expect(error.code).toBe('validation_error');
    expect(error.issues.map((i) => i.path)).toContain(path);
  });
});

describe('GET /api/projects', () => {
  it('lists projects by name with their totals', async () => {
    const holiday = await createProject(api, { name: 'Holiday', budgetCents: 10_000 });
    await createProject(api, { name: 'Bike' });
    await createTransaction(api, { projectId: holiday.id, amountCents: 12_000 });
    await createTransaction(api, {
      projectId: holiday.id,
      account: 'savings',
      type: 'income',
      amountCents: 500,
    });

    const res = await api.get('/api/projects');

    expect(res.status).toBe(200);
    const { items } = ProjectListResponse.parse(res.body);
    expect(items.map((p) => p.name)).toEqual(['Bike', 'Holiday']);
    expect(items[1]).toMatchObject({
      incomeCents: 500,
      expenseCents: 12_000,
      remainingCents: -1_500,
      overBudget: true,
    });
  });

  it('lists nothing on an empty database', async () => {
    const res = await api.get('/api/projects');

    expect(ProjectListResponse.parse(res.body)).toEqual({ items: [] });
  });
});

describe('GET /api/projects/:id', () => {
  it('returns one project', async () => {
    const project = await createProject(api);

    const res = await api.get(`/api/projects/${project.id}`);

    expect(res.status).toBe(200);
    expect(ProjectResponse.parse(res.body).name).toBe('Holiday');
  });

  it('answers an unknown id with 404', async () => {
    const res = await api.get(`/api/projects/${uuid(1)}`);

    expect(res.status).toBe(404);
    expect(errorOf(res.body)).toMatchObject({ code: 'not_found' });
  });

  it('answers a malformed id with 400', async () => {
    const res = await api.get('/api/projects/not-a-uuid');

    expect(res.status).toBe(400);
    expect(errorOf(res.body).issues[0]!.path).toBe('id');
  });
});

describe('PATCH /api/projects/:id', () => {
  it('updates name and description and records before and after', async () => {
    const project = await createProject(api, { budgetCents: 5_000 });

    const res = await api
      .patch(`/api/projects/${project.id}`)
      .send({ name: 'Summer', description: 'Two weeks' });

    expect(res.status).toBe(200);
    const updated = ProjectResponse.parse(res.body);
    expect(updated).toMatchObject({ name: 'Summer', description: 'Two weeks', budgetCents: 5_000 });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.createdAt.getTime());
    expect(await lastEvent()).toMatchObject({
      type: 'UpdateProjectEvent',
      payload: { before: { name: 'Holiday' }, after: { name: 'Summer' } },
    });
  });

  it('refuses to change the budget', async () => {
    const project = await createProject(api, { budgetCents: 5_000 });

    const res = await api.patch(`/api/projects/${project.id}`).send({ budgetCents: 9_000 });

    expect(res.status).toBe(400);
    expect(errorOf(res.body).issues).toEqual([
      { path: 'budgetCents', message: 'budgetCents is fixed at creation and cannot be changed' },
    ]);
  });

  it('rejects an update that changes nothing with 400', async () => {
    const project = await createProject(api);

    const res = await api.patch(`/api/projects/${project.id}`).send({ name: 'Holiday' });

    expect(res.status).toBe(400);
    expect(errorOf(res.body).issues[0]!.path).toBe('');
  });

  it('rejects the name of another project with 409', async () => {
    const project = await createProject(api, { name: 'Holiday' });
    await createProject(api, { name: 'Bike' });

    const res = await api.patch(`/api/projects/${project.id}`).send({ name: 'BIKE' });

    expect(res.status).toBe(409);
  });

  it('answers an unknown id with 404', async () => {
    const res = await api.patch(`/api/projects/${uuid(1)}`).send({ name: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('deletes an untagged project (204) and records it', async () => {
    const project = await createProject(api);

    const res = await api.delete(`/api/projects/${project.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect((await api.get(`/api/projects/${project.id}`)).status).toBe(404);
    expect(await lastEvent()).toMatchObject({
      type: 'DeleteProjectEvent',
      payload: { project: { id: project.id } },
    });
  });

  it('refuses to delete a project that still tags transactions (409) and logs nothing', async () => {
    const project = await createProject(api);
    await createTransaction(api, { projectId: project.id });

    const res = await api.delete(`/api/projects/${project.id}`);

    expect(res.status).toBe(409);
    expect(errorOf(res.body).code).toBe('conflict');
    expect((await lastEvent()).type).toBe('CreateTransactionEvent');
  });

  it('answers an unknown id with 404', async () => {
    expect((await api.delete(`/api/projects/${uuid(1)}`)).status).toBe(404);
  });
});
