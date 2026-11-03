import {
  CreateProjectRequest,
  CreateTransactionRequest,
  EventListResponse,
  ProjectListResponse,
  StatsResponse,
} from '@expensetracker/schema';
import { describe, expect, it } from 'vitest';
import { createApp, createCore } from '../src/app.js';
import { openDatabase } from '../src/db/database.js';
import { DEMO_USER, generateSeedData, SECOND_DEMO_USER, SEED_MONTHS } from '../src/seed/data.js';
import { seedDatabase } from '../src/seed/seed.js';
import { clientWithSession, FAST_SCRYPT } from './api/helpers.js';

const TODAY = new Date('2026-10-14T09:00:00.000Z');

describe('generateSeedData', () => {
  const data = generateSeedData(TODAY);

  it('creates valid projects, one of them without a budget', () => {
    for (const project of data.projects) CreateProjectRequest.parse(project);

    expect(data.projects.map((p) => p.budgetCents === null)).toContain(true);
  });

  it('creates only valid transactions, oldest first, none after today', () => {
    for (const { project, ...transaction } of data.transactions) {
      void project;
      CreateTransactionRequest.parse({ ...transaction, projectId: null });
    }
    const dates = data.transactions.map((t) => t.date);

    expect(dates).toEqual([...dates].sort());
    expect(dates.at(-1)! <= '2026-10-14').toBe(true);
  });

  it(`covers ${SEED_MONTHS} months up to today, on both accounts`, () => {
    const months = new Set(data.transactions.map((t) => t.date.slice(0, 7)));

    expect(months.size).toBe(SEED_MONTHS);
    expect([...months].sort()[0]).toBe('2025-11');
    expect(new Set(data.transactions.map((t) => t.account))).toEqual(new Set(['main', 'savings']));
  });

  it('tags transactions only with seeded projects', () => {
    const names = new Set(data.projects.map((p) => p.name));
    const tags = data.transactions.flatMap((t) => (t.project ? [t.project] : []));

    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every((tag) => names.has(tag))).toBe(true);
  });

  it('is deterministic for the same day', () => {
    expect(generateSeedData(TODAY)).toEqual(data);
  });

  it('adds a year-end bonus and quarterly interest', () => {
    const descriptions = data.transactions.map((t) => t.description);

    expect(descriptions).toContain('Year-end bonus');
    expect(descriptions).toContain('Interest');
  });
});

describe('seedDatabase', () => {
  async function seeded() {
    const db = openDatabase();
    const clock = () => new Date('2026-10-14T09:00:00.000Z');
    const core = createCore({ db, clock, scryptParams: FAST_SCRYPT });
    const counts = await seedDatabase(core, generateSeedData(TODAY));
    const app = createApp({ db, clock, scryptParams: FAST_SCRYPT });
    const demoSession = core.sessions.issue(counts.users[0]!);
    const secondSession = core.sessions.issue(counts.users[1]!);
    return {
      db,
      core,
      counts,
      api: clientWithSession(app, demoSession.token),
      secondApi: clientWithSession(app, secondSession.token),
    };
  }

  it('writes every record through the event bus and creates two isolated demo users', async () => {
    const { counts, api, secondApi } = await seeded();

    expect(counts.users.map((u) => u.email)).toEqual([DEMO_USER.email, SECOND_DEMO_USER.email]);
    const events = EventListResponse.parse((await api.get('/api/events?limit=1')).body);
    expect(events.total).toBe(counts.projects + counts.transactions);
    expect(counts.projects).toBe(3);

    const secondProjects = ProjectListResponse.parse((await secondApi.get('/api/projects')).body);
    expect(secondProjects.items.map((p) => p.name)).toEqual(['Weekend trip']);
  });

  it('makes one project go over budget and keeps another within it', async () => {
    const { api } = await seeded();

    const { items } = ProjectListResponse.parse((await api.get('/api/projects')).body);
    const byName = Object.fromEntries(items.map((p) => [p.name, p]));
    expect(byName['Summer holiday']).toMatchObject({ overBudget: true, remainingCents: -40_500 });
    expect(byName['New bike']).toMatchObject({ overBudget: false, remainingCents: 72_000 });
  });

  it('gives statistics that satisfy the contract with every month filled', async () => {
    const { api } = await seeded();

    const stats = StatsResponse.parse((await api.get('/api/stats')).body);
    expect(stats.monthly.every((m) => m.expenseCents > 0)).toBe(true);
    // The salary arrives on the 25th, so only the current month may still lack income.
    expect(stats.monthly.slice(0, -1).every((m) => m.incomeCents > 0)).toBe(true);
    expect(stats.expenseByProject.length).toBe(4);
    expect(stats.balances.at(-1)!.savingsCents).toBeGreaterThan(0);
  });

  it('refuses to seed a database that already holds data', async () => {
    const { db } = await seeded();

    await expect(
      seedDatabase(createCore({ db, scryptParams: FAST_SCRYPT }), generateSeedData(TODAY)),
    ).rejects.toThrow(/already holds data/);
  });

  it('rejects seed data that tags an unknown project', async () => {
    const db = openDatabase();
    const data = generateSeedData(TODAY);
    data.transactions[0]!.project = 'Nope';

    await expect(seedDatabase(createCore({ db, scryptParams: FAST_SCRYPT }), data)).rejects.toThrow(
      'unknown project "Nope"',
    );
  });

  it('leaves the database empty when seeding fails part-way, so it can be retried', async () => {
    const db = openDatabase();
    const core = createCore({ db, scryptParams: FAST_SCRYPT });
    const broken = generateSeedData(TODAY);
    broken.transactions.at(-1)!.project = 'Nope';

    await expect(seedDatabase(core, broken)).rejects.toThrow('unknown project "Nope"');
    expect(core.repositories.users.count()).toBe(0);

    const retry = await seedDatabase(core, generateSeedData(TODAY));
    expect(retry.projects).toBeGreaterThan(0);
  });
});
