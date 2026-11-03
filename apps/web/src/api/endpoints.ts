import {
  AccountsResponse,
  EventListResponse,
  HealthSchema,
  ProjectListResponse,
  ProjectResponse,
  StatsResponse,
  TransactionListResponse,
  TransactionResponse,
} from '@expensetracker/schema';
import type {
  CreateProjectRequest,
  CreateTransactionRequest,
  Health,
  ListEventsQuery,
  ListTransactionsQuery,
  Project,
  StatsQuery,
  Transaction,
  UpdateProjectRequest,
  UpdateTransactionRequest,
} from '@expensetracker/schema';
import { request, requestNoContent, withQuery } from './client';

type Signal = AbortSignal | undefined;

export const getHealth = (signal?: Signal): Promise<Health> =>
  request(HealthSchema, '/api/health', { signal });

export const getAccounts = (signal?: Signal): Promise<AccountsResponse> =>
  request(AccountsResponse, '/api/accounts', { signal });

export const getStats = (query: StatsQuery = {}, signal?: Signal): Promise<StatsResponse> =>
  request(StatsResponse, withQuery('/api/stats', query), { signal });

export const listEvents = (
  query: Partial<ListEventsQuery> = {},
  signal?: Signal,
): Promise<EventListResponse> =>
  request(EventListResponse, withQuery('/api/events', query), { signal });

// Projects

export const listProjects = async (signal?: Signal): Promise<Project[]> =>
  (await request(ProjectListResponse, '/api/projects', { signal })).items;

export const getProject = (id: string, signal?: Signal): Promise<Project> =>
  request(ProjectResponse, `/api/projects/${encodeURIComponent(id)}`, { signal });

export const createProject = (body: CreateProjectRequest): Promise<Project> =>
  request(ProjectResponse, '/api/projects', { method: 'POST', body });

export const updateProject = (id: string, body: UpdateProjectRequest): Promise<Project> =>
  request(ProjectResponse, `/api/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body });

export const deleteProject = (id: string): Promise<void> =>
  requestNoContent(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Transactions

export const listTransactions = (
  query: Partial<ListTransactionsQuery> = {},
  signal?: Signal,
): Promise<TransactionListResponse> =>
  request(TransactionListResponse, withQuery('/api/transactions', query), { signal });

export const getTransaction = (id: string, signal?: Signal): Promise<Transaction> =>
  request(TransactionResponse, `/api/transactions/${encodeURIComponent(id)}`, { signal });

export const createTransaction = (body: CreateTransactionRequest): Promise<Transaction> =>
  request(TransactionResponse, '/api/transactions', { method: 'POST', body });

export const updateTransaction = (
  id: string,
  body: UpdateTransactionRequest,
): Promise<Transaction> =>
  request(TransactionResponse, `/api/transactions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });

export const deleteTransaction = (id: string): Promise<void> =>
  requestNoContent(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
