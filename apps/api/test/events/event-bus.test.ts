import { BUSINESS_EVENT_TYPES } from '@expensetracker/schema';
import type { BusinessEvent, BusinessEventType } from '@expensetracker/schema';
import { describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../../src/db/database.js';
import { createEventBus } from '../../src/events/event-bus.js';
import type { EventBusOptions } from '../../src/events/event-bus.js';
import type { EventHandler, EventHandlers } from '../../src/events/types.js';
import type { NewBusinessEvent } from '../../src/repositories/event-repository.js';
import { createEventRepository } from '../../src/repositories/event-repository.js';
import { createProjectRepository } from '../../src/repositories/project-repository.js';
import { createUserRepository } from '../../src/repositories/user-repository.js';
import { makeProject, uuid } from '../fixtures.js';

const OCCURRED_AT = new Date('2026-11-03T10:00:00.000Z');
const USER_ID = uuid(900);
const project = makeProject();

/** A fake handler for any event type that records each stage in `log`. */
function fakeHandler(log: string[], name: string): EventHandler<BusinessEventType> {
  return {
    validate: (userId, data) => {
      log.push(`${name}.validate(${userId})`);
      return { validated: data };
    },
    handle: (userId, _data, validated) => {
      log.push(`${name}.handle(${userId},${JSON.stringify(validated)})`);
      return { result: project, payload: { project } } as never;
    },
  };
}

function fakeHandlers(log: string[]): EventHandlers {
  return Object.fromEntries(
    BUSINESS_EVENT_TYPES.map((type) => [type, fakeHandler(log, type)]),
  ) as EventHandlers;
}

/** A bus over fakes: the transaction and the event log only record what happens. */
function setup(overrides: Partial<EventBusOptions> = {}) {
  const log: string[] = [];
  let sequence = 0;
  const options: EventBusOptions = {
    handlers: fakeHandlers(log),
    transaction: (work) => {
      log.push('begin');
      try {
        const result = work();
        log.push('commit');
        return result;
      } catch (error) {
        log.push('rollback');
        throw error;
      }
    },
    appendEvent: (event: NewBusinessEvent) => {
      log.push(`append ${event.type}`);
      return { ...event, sequence: ++sequence } as BusinessEvent;
    },
    clock: () => OCCURRED_AT,
    newId: () => uuid(1),
    ...overrides,
  };
  return { log, bus: createEventBus(options) };
}

describe('createEventBus', () => {
  it('fails at startup when an event type has no handler', () => {
    const handlers: Partial<EventHandlers> = fakeHandlers([]);
    delete handlers.DeleteProjectEvent;
    delete handlers.UpdateTransactionEvent;

    expect(() => setup({ handlers })).toThrow(
      'no handler registered for UpdateTransactionEvent, DeleteProjectEvent',
    );
  });

  it('runs validate, handle and append in that order inside one transaction', () => {
    const { bus, log } = setup();

    bus.dispatch(USER_ID, 'DeleteProjectEvent', { id: project.id });

    expect(log).toEqual([
      'begin',
      `DeleteProjectEvent.validate(${USER_ID})`,
      `DeleteProjectEvent.handle(${USER_ID},{"validated":{"id":"${project.id}"}})`,
      'append DeleteProjectEvent',
      'commit',
    ]);
  });

  it('returns the result of the handler', () => {
    const { bus } = setup();

    expect(
      bus.dispatch(USER_ID, 'CreateProjectEvent', {
        name: 'x',
        description: '',
        budgetCents: null,
      }),
    ).toBe(project);
  });

  it('appends the payload with userId, a new id and the time of the clock', () => {
    const appendEvent = vi.fn(
      (event: NewBusinessEvent) => ({ ...event, sequence: 1 }) as BusinessEvent,
    );
    const { bus } = setup({ appendEvent });

    bus.dispatch(USER_ID, 'UpdateProjectEvent', { id: project.id, patch: { name: 'New' } });

    expect(appendEvent).toHaveBeenCalledWith({
      id: uuid(1),
      userId: USER_ID,
      type: 'UpdateProjectEvent',
      occurredAt: OCCURRED_AT,
      payload: { project },
    });
  });

  it('stops before handling and rolls back when validation fails', () => {
    const log: string[] = [];
    const handlers = fakeHandlers(log);
    handlers.CreateProjectEvent = {
      ...handlers.CreateProjectEvent,
      validate: () => {
        throw new Error('invalid');
      },
    };
    const { bus, log: busLog } = setup({ handlers });

    expect(() =>
      bus.dispatch(USER_ID, 'CreateProjectEvent', {
        name: 'x',
        description: '',
        budgetCents: null,
      }),
    ).toThrow('invalid');
    expect(busLog).toEqual(['begin', 'rollback']);
  });

  it('rolls back and notifies nobody when the handler throws', () => {
    const handlers = fakeHandlers([]);
    handlers.DeleteProjectEvent = {
      validate: () => undefined,
      handle: () => {
        throw new Error('handler failed');
      },
    };
    const subscriber = vi.fn();
    const { bus, log } = setup({ handlers, subscribers: [subscriber] });

    expect(() => bus.dispatch(USER_ID, 'DeleteProjectEvent', { id: project.id })).toThrow(
      'handler failed',
    );
    expect(log).toEqual(['begin', 'rollback']);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('rolls back when appending to the event log throws', () => {
    const { bus, log } = setup({
      appendEvent: () => {
        throw new Error('log is full');
      },
    });

    expect(() => bus.dispatch(USER_ID, 'DeleteProjectEvent', { id: project.id })).toThrow(
      'log is full',
    );
    expect(log.at(-1)).toBe('rollback');
  });

  it('notifies subscribers with the recorded event after the commit', () => {
    const order: string[] = [];
    const { bus, log } = setup({
      subscribers: [(event) => order.push(`${log.at(-1)}: ${event.type} #${event.sequence}`)],
    });

    bus.dispatch(USER_ID, 'DeleteProjectEvent', { id: project.id });

    expect(order).toEqual(['commit: DeleteProjectEvent #1']);
  });

  it('keeps the write and reports the error when a subscriber throws', () => {
    const onSubscriberError = vi.fn();
    const after = vi.fn();
    const { bus, log } = setup({
      subscribers: [
        () => {
          throw new Error('subscriber failed');
        },
        after,
      ],
      onSubscriberError,
    });

    expect(bus.dispatch(USER_ID, 'DeleteProjectEvent', { id: project.id })).toBe(project);
    expect(log).toContain('commit');
    expect(onSubscriberError).toHaveBeenCalledWith(
      new Error('subscriber failed'),
      expect.objectContaining({ type: 'DeleteProjectEvent', sequence: 1 }),
    );
    expect(after).toHaveBeenCalledOnce();
  });

  it('logs a failing subscriber to the console by default', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { bus } = setup({
      subscribers: [
        () => {
          throw new Error('boom');
        },
      ],
    });

    bus.dispatch(USER_ID, 'DeleteProjectEvent', { id: project.id });

    expect(error).toHaveBeenCalledWith(
      'subscriber failed for DeleteProjectEvent #1',
      new Error('boom'),
    );
    error.mockRestore();
  });

  it('subscribes and unsubscribes at runtime', () => {
    const subscriber = vi.fn();
    const { bus } = setup();

    const unsubscribe = bus.subscribe(subscriber);
    bus.dispatch(USER_ID, 'DeleteProjectEvent', { id: project.id });
    unsubscribe();
    unsubscribe();
    bus.dispatch(USER_ID, 'DeleteProjectEvent', { id: project.id });

    expect(subscriber).toHaveBeenCalledOnce();
  });
});

describe('event bus with SQLite', () => {
  function sqliteSetup(appendFails: boolean) {
    const db = openDatabase();
    const users = createUserRepository(db);
    users.insert({
      id: USER_ID,
      email: 'alice@example.com',
      displayName: 'Alice',
      passwordHash: 'scrypt$1024$8$1$aaaa$bbbb',
      createdAt: OCCURRED_AT,
      updatedAt: OCCURRED_AT,
    });
    const projects = createProjectRepository(db);
    const events = createEventRepository(db);
    const handlers = fakeHandlers([]);
    handlers.CreateProjectEvent = {
      validate: () => undefined,
      handle: (userId) => {
        projects.insert(userId, project);
        return { result: project, payload: { project } };
      },
    };
    const bus = createEventBus({
      handlers,
      transaction: (work) => db.transaction(work)(),
      appendEvent: appendFails
        ? () => {
            throw new Error('append failed');
          }
        : events.append,
      clock: () => OCCURRED_AT,
      newId: () => uuid(1),
    });
    return { db, projects, events, bus };
  }

  const request = { name: 'Holiday', description: '', budgetCents: null };

  it('stores the state change and the recorded event together', () => {
    const { db, projects, events, bus } = sqliteSetup(false);

    bus.dispatch(USER_ID, 'CreateProjectEvent', request);

    expect(projects.findById(USER_ID, project.id)).toEqual(project);
    expect(events.list(USER_ID, { limit: 10, offset: 0 }).items).toEqual([
      {
        id: uuid(1),
        userId: USER_ID,
        sequence: 1,
        type: 'CreateProjectEvent',
        occurredAt: OCCURRED_AT,
        payload: { project },
      },
    ]);
    db.close();
  });

  it('undoes the state change when the event cannot be appended', () => {
    const { db, projects, bus } = sqliteSetup(true);

    expect(() => bus.dispatch(USER_ID, 'CreateProjectEvent', request)).toThrow('append failed');
    expect(projects.findById(USER_ID, project.id)).toBeUndefined();
    db.close();
  });
});
