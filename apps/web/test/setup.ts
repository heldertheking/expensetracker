import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

/**
 * jsdom has no layout: charts need a ResizeObserver and a non-zero size. The observer stub never
 * fires, and chart containers measure as a fixed 640 x 260 box.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const measure = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('recharts-responsive-container')) {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 640,
      bottom: 260,
      width: 640,
      height: 260,
      toJSON() {},
    };
  }
  return measure.call(this);
};
window.scrollTo = () => {};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.history.replaceState(null, '', '/');
});
afterAll(() => server.close());
