import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { matchRoute, navigate } from '../src/router';
import * as f from './fixtures';
import { http, HttpResponse, server } from './server';
import { renderApp } from './render';

describe('matchRoute', () => {
  it.each([
    ['/', { name: 'dashboard' }],
    ['/transactions', { name: 'transactions' }],
    ['/transactions/', { name: 'transactions' }],
    ['/projects', { name: 'projects' }],
    ['/projects/abc', { name: 'project', id: 'abc' }],
    ['/activity', { name: 'activity' }],
    ['/nope', { name: 'notFound' }],
    ['/projects/a/b', { name: 'notFound' }],
  ])('%s', (path, route) => {
    expect(matchRoute(path)).toEqual(route);
  });
});

function mockAll() {
  server.use(
    http.get('/api/accounts', () => HttpResponse.json(f.accounts())),
    http.get('/api/stats', () => HttpResponse.json(f.sampleStats())),
    http.get('/api/projects', () => HttpResponse.json(f.projectList())),
    http.get('/api/projects/:id', () => HttpResponse.json(f.projects.holiday)),
    http.get('/api/events', () => HttpResponse.json(f.page([]))),
    http.get('/api/transactions', () => HttpResponse.json(f.page([]))),
  );
}

describe('App navigation', () => {
  it('navigates between pages with the main navigation', async () => {
    mockAll();
    const { user } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('link', { name: 'Transactions' }));
    expect(screen.getByRole('heading', { name: 'Transactions', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/transactions');
    expect(document.title).toBe('Transactions · Expense Tracker');

    await user.click(screen.getByRole('link', { name: 'Projects' }));
    await user.click(await screen.findByRole('link', { name: 'Holiday' }));
    expect(window.location.pathname).toBe(`/projects/${f.PROJECT_IDS.holiday}`);
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('link', { name: 'Activity' }));
    expect(screen.getByRole('heading', { name: 'Activity', level: 1 })).toBeInTheDocument();

    act(() => window.history.back());
    // jsdom fires popstate asynchronously
    await screen.findByRole('link', { name: '← All projects' });
  });

  it('leaves modified clicks to the browser', async () => {
    mockAll();
    renderApp('/');
    const link = await screen.findByRole('link', { name: 'Activity' });
    fireEvent.click(link, { ctrlKey: true });
    expect(window.location.pathname).toBe('/');
  });

  it('shows a not-found page for unknown paths', async () => {
    renderApp('/does-not-exist');
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    act(() => navigate('/does-not-exist'));
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute('href', '/');
  });
});
