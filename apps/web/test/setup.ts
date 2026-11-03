import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

/**
 * jsdom has no layout. MUI X Charts needs a ResizeObserver (the stub never fires) and reads the
 * chart container's computed width, which jsdom reports as `100%`; chart containers are given a
 * fixed 640px width instead, so the plots have room to draw.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const computeStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element: Element, pseudo?: string | null) => {
  const style = computeStyle(element, pseudo);
  if (!element.classList.contains('MuiChartsSurface-root')) return style;
  return new Proxy(style, {
    get: (target, key) => {
      if (key === 'width') return '640px';
      const value: unknown = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
};
window.scrollTo = () => {};

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.history.replaceState(null, '', '/');
});
afterAll(() => server.close());
