import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import * as f from './fixtures';
import { http, HttpResponse, recordGet, server } from './server';
import { renderApp } from './render';

function mockProjects(items = Object.values(f.projects)) {
  const list = recordGet('/api/projects', f.projectList(items));
  server.use(list.handler);
  return list;
}

function card(name: string) {
  return screen.getByRole('link', { name }).closest('li')!;
}

describe('Projects page', () => {
  it('shows budget usage per project and flags over-budget ones', async () => {
    mockProjects();
    renderApp('/projects');
    await screen.findByRole('link', { name: 'Holiday' });

    const holiday = within(card('Holiday'));
    expect(holiday.getByRole('meter', { name: 'Budget used for Holiday' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(holiday.getByText('25%')).toBeInTheDocument();
    expect(holiday.queryByText('Over budget')).not.toBeInTheDocument();

    const renovation = within(card('Renovation'));
    expect(renovation.getByText('Over budget')).toBeInTheDocument();
    expect(renovation.getByText('125%')).toBeInTheDocument();
    expect(renovation.getByText('CHF 50.00')).toBeInTheDocument(); // refilled by tagged income

    const course = within(card('Language course'));
    expect(course.queryByRole('meter')).not.toBeInTheDocument();
    expect(course.getByText('No budget · CHF 300.00 spent')).toBeInTheDocument();
  });

  it('shows an empty state without projects', async () => {
    mockProjects([]);
    renderApp('/projects');
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('creates a project with a budget fixed at creation', async () => {
    const list = mockProjects();
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/projects', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(f.projects.holiday, { status: 201 });
      }),
    );
    const { user } = renderApp('/projects');
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    const dialog = screen.getByRole('dialog', { name: 'New project' });
    const budget = within(dialog).getByLabelText('Budget in CHF (optional)');
    expect(budget).toHaveAccessibleDescription(/fixed once the project is created/);

    await user.type(within(dialog).getByLabelText('Name'), 'Bike');
    await user.type(within(dialog).getByLabelText('Description (optional)'), 'New gravel bike');
    await user.type(budget, '1500');
    const loads = list.urls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ name: 'Bike', description: 'New gravel bike', budgetCents: 150000 }]);
    await waitFor(() => expect(list.urls.length).toBeGreaterThan(loads));
  });

  it('creates a project without a budget and validates the name', async () => {
    mockProjects();
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/projects', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(f.projects.course, { status: 201 });
      }),
    );
    const { user } = renderApp('/projects');
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Budget in CHF (optional)'), 'lots');
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }));
    expect(within(dialog).getByLabelText('Budget in CHF (optional)')).toBeInvalid();

    await user.clear(within(dialog).getByLabelText('Budget in CHF (optional)'));
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }));
    expect(within(dialog).getByLabelText('Name')).toBeInvalid();

    await user.type(within(dialog).getByLabelText('Name'), 'Course');
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }));
    await waitFor(() =>
      expect(bodies).toEqual([{ name: 'Course', description: '', budgetCents: null }]),
    );
  });

  it('edits name and description, showing the budget as fixed', async () => {
    mockProjects();
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/projects/:id', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(f.projects.holiday);
      }),
    );
    const { user } = renderApp('/projects');
    await user.click(await screen.findByRole('button', { name: 'Edit Holiday' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit project' });
    expect(within(dialog).queryByLabelText(/Budget in CHF/)).not.toBeInTheDocument();
    expect(within(dialog).getByText("CHF 2'000.00")).toBeInTheDocument();
    expect(within(dialog).getByText('(fixed at creation, cannot be changed)')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Nothing changed');

    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Summer holiday');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodies).toEqual([{ name: 'Summer holiday' }]));
  });

  it('shows server field errors in the project form', async () => {
    mockProjects();
    server.use(
      http.post('/api/projects', () =>
        HttpResponse.json(
          f.apiError('validation_error', 'Invalid', [{ path: 'name', message: 'name is taken' }]),
          { status: 400 },
        ),
      ),
    );
    const { user } = renderApp('/projects');
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Holiday');
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }));
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Name')).toHaveAccessibleDescription('name is taken'),
    );
  });

  it('shows the conflict message when a project still has tagged transactions', async () => {
    mockProjects();
    server.use(
      http.delete('/api/projects/:id', () =>
        HttpResponse.json(
          f.apiError('conflict', 'Project "Holiday" still has 4 tagged transactions'),
          { status: 409 },
        ),
      ),
    );
    const { user } = renderApp('/projects');
    await user.click(await screen.findByRole('button', { name: 'Delete Holiday' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete project?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete project' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Project "Holiday" still has 4 tagged transactions',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('deletes a project without transactions', async () => {
    const list = mockProjects();
    server.use(http.delete('/api/projects/:id', () => new HttpResponse(null, { status: 204 })));
    const { user } = renderApp('/projects');
    await user.click(await screen.findByRole('button', { name: 'Delete Language course' }));
    const loads = list.urls.length;
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(list.urls.length).toBeGreaterThan(loads));
  });
});

describe('Project detail', () => {
  const p = f.projects.renovation;
  const tagged = [
    f.transaction({ description: 'Tiles', amountCents: 80000, projectId: p.id }),
    f.transaction({
      description: 'Paint from savings',
      account: 'savings',
      amountCents: 50000,
      projectId: p.id,
    }),
    f.transaction({
      description: 'Sold old oven',
      type: 'income',
      amountCents: 5000,
      projectId: p.id,
    }),
  ];

  it('shows totals and the tagged transactions from both accounts', async () => {
    mockProjects();
    const list = recordGet('/api/transactions', f.page(tagged));
    server.use(
      http.get('/api/projects/:id', () => HttpResponse.json(p)),
      list.handler,
    );
    renderApp(`/projects/${p.id}`);
    expect(
      await screen.findByRole('heading', { name: 'Renovation', level: 1 }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Budget' })).getByText("CHF 1'000.00"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Remaining' })).getByText('CHF -250.00'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Over budget').length).toBeGreaterThan(0);

    const table = await screen.findByRole('table', { name: 'Transactions tagged with Renovation' });
    expect(within(table).getByText('Paint from savings')).toBeInTheDocument();
    expect(within(table).getAllByText('Main')).toHaveLength(2);
    expect(within(table).getAllByText('Savings')).toHaveLength(1);
    expect(Object.fromEntries(list.urls[0]!.searchParams)).toMatchObject({ projectId: p.id });
  });

  it('pre-tags a new transaction with the project', async () => {
    mockProjects();
    const bodies: { projectId?: string }[] = [];
    server.use(
      http.get('/api/projects/:id', () => HttpResponse.json(p)),
      http.get('/api/transactions', () => HttpResponse.json(f.page([]))),
      http.post('/api/transactions', async ({ request }) => {
        bodies.push((await request.json()) as { projectId?: string });
        return HttpResponse.json(tagged[0], { status: 201 });
      }),
    );
    const { user } = renderApp(`/projects/${p.id}`);
    expect(await screen.findByText('No tagged transactions yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New tagged transaction' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Project (optional)')).toHaveValue(p.id);
    await user.click(within(dialog).getByRole('radio', { name: 'Savings' }));
    await user.type(within(dialog).getByLabelText('Amount (CHF)'), '10');
    await user.type(within(dialog).getByLabelText('Description'), 'Screws');
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(bodies[0]?.projectId).toBe(p.id));
  });

  it('shows "not found" for an unknown project', async () => {
    mockProjects();
    server.use(
      http.get('/api/projects/:id', () =>
        HttpResponse.json(f.apiError('not_found', 'Project not found'), { status: 404 }),
      ),
      http.get('/api/transactions', () => HttpResponse.json(f.page([]))),
    );
    renderApp(`/projects/${f.uuid(999)}`);
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← All projects' })).toBeInTheDocument();
  });
});
