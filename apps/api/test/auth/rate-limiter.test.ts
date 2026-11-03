import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../src/auth/rate-limiter.js';

const MINUTE = 60_000;

function setup(limit = 3, windowMs = 15 * MINUTE, maxKeys?: number) {
  let now = Date.parse('2026-11-03T10:00:00.000Z');
  const limiter = createRateLimiter({
    limit,
    windowMs,
    maxKeys,
    clock: () => new Date(now),
  });
  return { limiter, advance: (ms: number) => (now += ms) };
}

describe('rate limiter', () => {
  it('allows up to the limit and then blocks the key', () => {
    const { limiter } = setup(3);

    for (let i = 0; i < 3; i++) {
      expect(limiter.retryAfterSeconds('a')).toBe(0);
      limiter.hit('a');
    }

    expect(limiter.retryAfterSeconds('a')).toBe(15 * 60);
  });

  it('keeps keys apart', () => {
    const { limiter } = setup(1);
    limiter.hit('a');

    expect(limiter.retryAfterSeconds('a')).toBeGreaterThan(0);
    expect(limiter.retryAfterSeconds('b')).toBe(0);
  });

  it('slides: the oldest hit leaves the window first', () => {
    const { limiter, advance } = setup(2, 10 * MINUTE);
    limiter.hit('a');
    advance(4 * MINUTE);
    limiter.hit('a');

    advance(1 * MINUTE);
    expect(limiter.retryAfterSeconds('a')).toBe(5 * 60); // first hit expires at minute 10

    advance(5 * MINUTE);
    expect(limiter.retryAfterSeconds('a')).toBe(0);
    limiter.hit('a');
    expect(limiter.retryAfterSeconds('a')).toBe(4 * 60); // second hit expires at minute 14
  });

  it('rounds the wait up to whole seconds', () => {
    const { limiter, advance } = setup(1, MINUTE);
    limiter.hit('a');
    advance(59_500);

    expect(limiter.retryAfterSeconds('a')).toBe(1);
  });

  it('forgives the latest hit, and reset clears the key', () => {
    const { limiter } = setup(2);
    limiter.hit('a');
    limiter.hit('a');

    limiter.forgive('a');
    expect(limiter.retryAfterSeconds('a')).toBe(0);

    limiter.hit('a');
    limiter.reset('a');
    limiter.hit('a');
    expect(limiter.retryAfterSeconds('a')).toBe(0);
    limiter.forgive('missing'); // no-op
  });

  it('bounds its memory: beyond maxKeys it drops expired keys, then the oldest', () => {
    const { limiter, advance } = setup(1, MINUTE, 2);
    limiter.hit('old');
    advance(2 * MINUTE);
    limiter.hit('a');
    limiter.hit('b'); // 'old' has expired and is dropped
    expect(limiter.size()).toBe(2);

    limiter.hit('c'); // nothing expired: the oldest key ('a') goes
    expect(limiter.size()).toBe(2);
    expect(limiter.retryAfterSeconds('a')).toBe(0);
    expect(limiter.retryAfterSeconds('c')).toBeGreaterThan(0);
  });
});
