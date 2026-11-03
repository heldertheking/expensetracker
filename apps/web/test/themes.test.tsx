import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { THEME_STORAGE_KEY } from '../src/theme';
import * as f from './fixtures';
import { http, HttpResponse, server } from './server';
import { renderApp } from './render';

type Listener = (event: { matches: boolean }) => void;

/** A controllable matchMedia: tests flip queries and notify listeners like the OS would. */
function mockMatchMedia(initial: Record<string, boolean> = {}) {
  const state = { ...initial };
  const listeners = new Set<Listener>();
  const byQuery = new Map<Listener, string>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return Boolean(state[query]);
    },
    media: query,
    addEventListener: (_: string, l: Listener) => {
      listeners.add(l);
      byQuery.set(l, query);
    },
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }));
  return (query: string, matches: boolean) => {
    state[query] = matches;
    act(() => listeners.forEach((l) => l({ matches: Boolean(state[byQuery.get(l) ?? '']) })));
  };
}

const DARK = '(prefers-color-scheme: dark)';
const CONTRAST = '(prefers-contrast: more)';
const FORCED = '(forced-colors: active)';

function mockApi() {
  server.use(
    http.get('/api/accounts', () => HttpResponse.json(f.accounts())),
    http.get('/api/stats', () => HttpResponse.json(f.sampleStats())),
    http.get('/api/projects', () => HttpResponse.json(f.projectList())),
    http.get('/api/events', () => HttpResponse.json(f.page([]))),
  );
}

const activeTheme = () => document.documentElement.dataset.theme;

async function choose(user: ReturnType<typeof renderApp>['user'], name: string) {
  await user.click(screen.getByRole('button', { name: 'Theme' }));
  await user.click(await screen.findByRole('menuitemradio', { name }));
}

describe('theme switcher', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockApi();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to the light theme with System selected', async () => {
    mockMatchMedia();
    const { user } = renderApp('/');
    expect(activeTheme()).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Theme' }));
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('switches themes and updates the page colors', async () => {
    mockMatchMedia();
    const { user } = renderApp('/');
    const light = getComputedStyle(document.body).backgroundColor;
    await choose(user, 'Dark');
    expect(activeTheme()).toBe('dark');
    expect(getComputedStyle(document.body).backgroundColor).not.toBe(light);
    await choose(user, 'High contrast');
    expect(activeTheme()).toBe('high-contrast');
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(0, 0, 0)');
  });

  it('persists an explicit choice across a remount', async () => {
    mockMatchMedia();
    const first = renderApp('/');
    await choose(first.user, 'High contrast');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('high-contrast');
    first.unmount();
    delete document.documentElement.dataset.theme;
    renderApp('/');
    expect(activeTheme()).toBe('high-contrast');
  });

  it('follows the OS settings live while System is selected', () => {
    const setMedia = mockMatchMedia();
    renderApp('/');
    expect(activeTheme()).toBe('light');
    setMedia(DARK, true);
    expect(activeTheme()).toBe('dark');
    setMedia(CONTRAST, true);
    expect(activeTheme()).toBe('high-contrast');
    setMedia(CONTRAST, false);
    setMedia(FORCED, true);
    expect(activeTheme()).toBe('high-contrast');
  });

  it('ignores OS changes once a theme is chosen explicitly', async () => {
    const setMedia = mockMatchMedia();
    const { user } = renderApp('/');
    await choose(user, 'Light');
    setMedia(DARK, true);
    expect(activeTheme()).toBe('light');
  });

  it('starts in the OS theme before any interaction', () => {
    mockMatchMedia({ [DARK]: true });
    renderApp('/');
    expect(activeTheme()).toBe('dark');
  });

  it('falls back to System when storage throws', async () => {
    mockMatchMedia();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { user } = renderApp('/');
    expect(activeTheme()).toBe('light');
    await choose(user, 'Dark');
    expect(activeTheme()).toBe('dark');
  });

  it('is reachable by keyboard and announces the checked item', async () => {
    mockMatchMedia();
    const { user } = renderApp('/');
    const trigger = screen.getByRole('button', { name: 'Theme' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menu', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(4);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(activeTheme()).toBe('dark'));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitemradio', { name: 'Dark' })).toBeChecked();
  });

  it.each(['light', 'dark', 'high-contrast'])(
    'renders the charts in the %s theme',
    async (name) => {
      mockMatchMedia();
      window.localStorage.setItem(THEME_STORAGE_KEY, name);
      renderApp('/');
      expect(await screen.findByRole('img', { name: 'Balance over time' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Income vs. expenses' })).toBeInTheDocument();
      expect(activeTheme()).toBe(name);
    },
  );
});
