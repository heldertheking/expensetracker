import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import * as f from './fixtures';
import { http, HttpResponse, recordGet, server } from './server';
import { renderApp } from './render';

const groceries = f.transaction({ description: 'Groceries', amountCents: 4550 });
const salary = f.transaction({
  description: 'Salary',
  type: 'income',
  amountCents: 520000,
  date: '2026-06-25',
});
const hotel = f.transaction({
  description: 'Hotel Lugano',
  account: 'savings',
  amountCents: 32000,
  projectId: f.PROJECT_IDS.holiday,
});

function mockList(items = [groceries, salary, hotel], total = items.length) {
  const list = recordGet('/api/transactions', (url) =>
    f.page(items.slice(0, Math.max(0, total - Number(url.searchParams.get('offset') ?? 0))), {
      total,
      limit: Number(url.searchParams.get('limit') ?? 50),
      offset: Number(url.searchParams.get('offset') ?? 0),
    }),
  );
  server.use(
    list.handler,
    http.get('/api/projects', () => HttpResponse.json(f.projectList())),
  );
  return list;
}

const lastParams = (urls: URL[]) => Object.fromEntries(urls.at(-1)!.searchParams);

describe('Transactions page: list', () => {
  it('lists transactions with signed amounts, account and project tag', async () => {
    mockList();
    renderApp('/transactions');
    const table = await screen.findByRole('table', { name: 'Transactions, newest first' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('-CHF 45.50')).toBeInTheDocument();
    expect(within(rows[1]!).getByText("+CHF 5'200.00")).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Savings')).toBeInTheDocument();
    expect(within(rows[2]!).getByRole('link', { name: 'Holiday' })).toHaveAttribute(
      'href',
      `/projects/${f.PROJECT_IDS.holiday}`,
    );
  });

  it('filters by account, project and type, starting again at the first page', async () => {
    const list = mockList();
    const { user } = renderApp('/transactions');
    await screen.findByRole('table');
    expect(lastParams(list.urls)).toEqual({ limit: '20', offset: '0' });

    await user.click(screen.getByRole('radio', { name: 'Savings' }));
    await waitFor(() => expect(lastParams(list.urls).account).toBe('savings'));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Project' }), 'Holiday');
    await waitFor(() => expect(lastParams(list.urls).projectId).toBe(f.PROJECT_IDS.holiday));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'Expenses');
    await waitFor(() =>
      expect(lastParams(list.urls)).toEqual({
        account: 'savings',
        projectId: f.PROJECT_IDS.holiday,
        type: 'expense',
        limit: '20',
        offset: '0',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(lastParams(list.urls)).toEqual({ limit: '20', offset: '0' }));
  });

  it('pages through long lists', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      f.transaction({ description: `Item ${i + 1}` }),
    );
    const list = mockList(many, 45);
    const { user } = renderApp('/transactions');
    const nav = await screen.findByRole('navigation', { name: 'Transaction pages' });
    expect(within(nav).getByText('1–20 of 45 · page 1 of 3')).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(within(nav).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastParams(list.urls).offset).toBe('20'));
    expect(await screen.findByText('21–40 of 45 · page 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('41–45 of 45 · page 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(lastParams(list.urls).offset).toBe('20'));
  });

  it('shows an empty state, and a different one when filters match nothing', async () => {
    mockList([]);
    const { user } = renderApp('/transactions');
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Main' }));
    expect(await screen.findByText('No matching transactions')).toBeInTheDocument();
  });

  it('shows an error state when the list cannot be loaded', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json(f.apiError('validation_error', 'limit must be at most 100'), {
          status: 400,
        }),
      ),
      http.get('/api/projects', () => HttpResponse.json(f.projectList())),
    );
    renderApp('/transactions');
    expect(await screen.findByText('Could not load transactions')).toBeInTheDocument();
    expect(screen.getByText('limit must be at most 100')).toBeInTheDocument();
  });
});

describe('Transactions page: create', () => {
  it('requires an account before sending anything', async () => {
    mockList();
    let posted = false;
    server.use(
      http.post('/api/transactions', () => {
        posted = true;
        return HttpResponse.json(groceries, { status: 201 });
      }),
    );
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'New transaction' }));
    const dialog = screen.getByRole('dialog', { name: 'New transaction' });
    await user.type(within(dialog).getByLabelText('Amount (CHF)'), '12.50');
    await user.type(within(dialog).getByLabelText('Description'), 'Lunch');
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    expect(within(dialog).getByText('Choose the account for this transaction')).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Main' })).toBeInvalid();
    expect(posted).toBe(false);
  });

  it('checks the amount and the schema rules in the browser', async () => {
    mockList();
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'New transaction' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Main' }));
    await user.type(within(dialog).getByLabelText('Amount (CHF)'), '12.345');
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
    expect(within(dialog).getByLabelText('Amount (CHF)')).toHaveAccessibleDescription(
      /Use at most two decimal places/,
    );

    await user.clear(within(dialog).getByLabelText('Amount (CHF)'));
    await user.type(within(dialog).getByLabelText('Amount (CHF)'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
    // the description is empty: the schema's own rule reports it on the field
    expect(within(dialog).getByLabelText('Description')).toBeInvalid();
  });

  it('creates a transaction with the amount in cents and reloads the list', async () => {
    const list = mockList();
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/transactions', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(groceries, { status: 201 });
      }),
    );
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'New transaction' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Savings' }));
    await user.click(within(dialog).getByRole('radio', { name: 'Income' }));
    await user.type(within(dialog).getByLabelText('Amount (CHF)'), "1'234.55");
    await user.clear(within(dialog).getByLabelText('Date'));
    await user.type(within(dialog).getByLabelText('Date'), '2026-06-01');
    await user.type(within(dialog).getByLabelText('Description'), '  Bonus  ');
    await user.selectOptions(within(dialog).getByLabelText('Project (optional)'), 'Holiday');
    const loads = list.urls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([
      {
        account: 'savings',
        type: 'income',
        amountCents: 123455,
        date: '2026-06-01',
        description: 'Bonus',
        projectId: f.PROJECT_IDS.holiday,
      },
    ]);
    await waitFor(() => expect(list.urls.length).toBeGreaterThan(loads));
  });

  it('shows validation errors from the server next to each field', async () => {
    mockList();
    server.use(
      http.post('/api/transactions', () =>
        HttpResponse.json(
          f.apiError('unprocessable', 'Request rejected', [
            { path: 'projectId', message: 'project does not exist' },
            { path: 'amountCents', message: 'amount exceeds the limit' },
          ]),
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'New transaction' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Main' }));
    await user.type(within(dialog).getByLabelText('Amount (CHF)'), '20');
    await user.type(within(dialog).getByLabelText('Description'), 'Train');
    await user.selectOptions(within(dialog).getByLabelText('Project (optional)'), 'Holiday');
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    const project = within(dialog).getByLabelText('Project (optional)');
    await waitFor(() => expect(project).toBeInvalid());
    expect(project).toHaveAccessibleDescription(/project does not exist/);
    expect(within(dialog).getByLabelText('Amount (CHF)')).toHaveAccessibleDescription(
      /amount exceeds the limit/,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows a request-wide server error at the top of the form', async () => {
    mockList();
    server.use(
      http.post('/api/transactions', () =>
        HttpResponse.json(f.apiError('conflict', 'Try again later'), { status: 409 }),
      ),
    );
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'New transaction' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Main' }));
    await user.type(within(dialog).getByLabelText('Amount (CHF)'), '20');
    await user.type(within(dialog).getByLabelText('Description'), 'Train');
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Try again later');
  });

  it('closes with Escape or Cancel without saving', async () => {
    mockList();
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'New transaction' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New transaction' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Transactions page: edit and delete', () => {
  it('does not let the account change and sends only what changed', async () => {
    mockList();
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/transactions/:id', async ({ request, params }) => {
        bodies.push({ id: params.id, body: await request.json() });
        return HttpResponse.json({ ...groceries, description: 'Food' });
      }),
    );
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit transaction' });
    expect(within(dialog).queryByRole('radio', { name: 'Main' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('(cannot be changed after creation)')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Amount (CHF)')).toHaveValue('45.50');

    await user.clear(within(dialog).getByLabelText('Description'));
    await user.type(within(dialog).getByLabelText('Description'), 'Food');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ id: groceries.id, body: { description: 'Food' } }]);
  });

  it('resends the amount when the type changes', async () => {
    mockList();
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/transactions/:id', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(groceries);
      }),
    );
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Income' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodies).toEqual([{ type: 'income', amountCents: 4550 }]));
  });

  it('reports when nothing changed instead of sending a request', async () => {
    mockList();
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'Edit Hotel Lugano' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Nothing changed');
  });

  it('removes a project tag with null', async () => {
    mockList();
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/transactions/:id', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ...hotel, projectId: null });
      }),
    );
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'Edit Hotel Lugano' }));
    const dialog = screen.getByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Project (optional)'), 'No project');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodies).toEqual([{ projectId: null }]));
  });

  it('asks for confirmation in the app before deleting', async () => {
    const list = mockList();
    const deleted: string[] = [];
    server.use(
      http.delete('/api/transactions/:id', ({ params }) => {
        deleted.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp('/transactions');
    await user.click(await screen.findByRole('button', { name: 'Delete Groceries' }));
    let confirm = screen.getByRole('alertdialog', { name: 'Delete transaction?' });
    expect(confirm).toHaveTextContent('“Groceries” (expense, CHF 45.50, 14.06.2026)');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(deleted).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Delete Groceries' }));
    confirm = screen.getByRole('alertdialog');
    const loads = list.urls.length;
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(deleted).toEqual([groceries.id]);
    await waitFor(() => expect(list.urls.length).toBeGreaterThan(loads));
  });
});
