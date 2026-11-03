import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { THEME_STORAGE_KEY } from '../src/theme';
import * as f from './fixtures';
import { http, HttpResponse, server } from './server';
import { renderApp } from './render';

function mockDashboard() {
  server.use(
    http.get('/api/accounts', () => HttpResponse.json(f.accounts())),
    http.get('/api/stats', () => HttpResponse.json(f.sampleStats())),
    http.get('/api/projects', () => HttpResponse.json(f.projectList())),
    http.get('/api/events', () => HttpResponse.json(f.page([]))),
  );
}

interface MockMediaController {
  setMatches: (query: string, matches: boolean) => void;
  restore: () => void;
}

function installMatchMediaMock(initial: Record<string, boolean> = {}): MockMediaController {
  const original = window.matchMedia;
  const state = new Map<string, boolean>(Object.entries(initial));
  const listeners = new Map<string, Set<() => void>>();

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: state.get(query) ?? false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, cb: () => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(cb);
    },
    removeEventListener: (_type: string, cb: () => void) => {
      listeners.get(query)?.delete(cb);
    },
    dispatchEvent: () => true,
  }));

  return {
    setMatches: (query: string, matches: boolean) => {
      state.set(query, matches);
      for (const cb of listeners.get(query) ?? []) {
        cb();
      }
    },
    restore: () => {
      window.matchMedia = original;
    },
  };
}

describe('ThemeSwitcher in AppBar', () => {
  it('defaults to System (light), switches to Dark and High contrast, and persists across remounts', async () => {
    mockDashboard();
    const { user, unmount } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');

    const trigger = screen.getByRole('button', { name: 'Theme' });
    await user.click(trigger);

    const systemOption = screen.getByRole('menuitemradio', { name: 'System' });
    const darkOption = screen.getByRole('menuitemradio', { name: 'Dark' });
    expect(systemOption).toHaveAttribute('aria-checked', 'true');
    expect(darkOption).toHaveAttribute('aria-checked', 'false');

    await user.click(darkOption);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    unmount();
    const remounted = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');

    await remounted.user.click(screen.getByRole('button', { name: 'Theme' }));
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await remounted.user.click(screen.getByRole('menuitemradio', { name: 'High contrast' }));
    expect(document.documentElement.dataset.theme).toBe('high-contrast');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('high-contrast');

    // Charts still render their accessible regions in high-contrast mode
    expect(screen.getByRole('region', { name: 'Balance over time' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Income vs. expenses' })).toBeInTheDocument();
  });

  it('supports keyboard interaction and follows live OS media query changes in System mode', async () => {
    mockDashboard();
    const media = installMatchMediaMock({ '(prefers-color-scheme: dark)': true });
    try {
      const { user } = renderApp('/');
      expect(
        await screen.findByRole('heading', { name: 'Dashboard', level: 1 }),
      ).toBeInTheDocument();
      expect(document.documentElement.dataset.theme).toBe('dark');

      act(() => {
        media.setMatches('(prefers-contrast: more)', true);
      });
      expect(document.documentElement.dataset.theme).toBe('high-contrast');

      act(() => {
        media.setMatches('(prefers-contrast: more)', false);
        media.setMatches('(prefers-color-scheme: dark)', false);
      });
      expect(document.documentElement.dataset.theme).toBe('light');

      // Keyboard open & close
      const trigger = screen.getByRole('button', { name: 'Theme' });
      trigger.focus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await user.keyboard('{Escape}');
    } finally {
      media.restore();
    }
  });
});
