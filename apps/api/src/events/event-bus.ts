import { BUSINESS_EVENT_TYPES } from '@expensetracker/schema';
import type { BusinessEvent, BusinessEventType } from '@expensetracker/schema';
import type { NewBusinessEvent } from '../repositories/event-repository.js';
import type { EventData, EventHandler, EventHandlers, EventResult, Subscriber } from './types.js';

interface EventBusOptions {
  /** Must contain a handler for every business event type, or the bus refuses to start. */
  handlers: Partial<EventHandlers>;
  /** Runs `work` in one database transaction: commit on return, roll back on throw. */
  transaction: <R>(work: () => R) => R;
  /** Appends to the event log and returns the stored event with its sequence. */
  appendEvent: (event: NewBusinessEvent) => BusinessEvent;
  clock: () => Date;
  newId: () => string;
  subscribers?: Subscriber[];
  /** Called when a subscriber throws. The write has already been committed and stays. */
  onSubscriberError?: (error: unknown, event: BusinessEvent) => void;
}

interface EventBus {
  dispatch<T extends BusinessEventType>(type: T, data: EventData[T]): EventResult[T];
  /** Returns a function that removes the subscriber again. */
  subscribe(subscriber: Subscriber): () => void;
}

const reportSubscriberError = (error: unknown, event: BusinessEvent) => {
  console.error(`subscriber failed for ${event.type} #${event.sequence}`, error);
};

/**
 * Runs every business event through the same pipeline: validate, handle and append to the
 * event log in one transaction, then notify the subscribers after the commit.
 */
function createEventBus(options: EventBusOptions): EventBus {
  const missing = BUSINESS_EVENT_TYPES.filter((type) => options.handlers[type] === undefined);
  if (missing.length > 0) {
    throw new Error(`no handler registered for ${missing.join(', ')}`);
  }
  const handlers = options.handlers as EventHandlers;
  const subscribers = [...(options.subscribers ?? [])];
  const onSubscriberError = options.onSubscriberError ?? reportSubscriberError;

  function notify(event: BusinessEvent) {
    for (const subscriber of [...subscribers]) {
      try {
        subscriber(event);
      } catch (error) {
        onSubscriberError(error, event);
      }
    }
  }

  return {
    dispatch<T extends BusinessEventType>(type: T, data: EventData[T]): EventResult[T] {
      const handler = handlers[type] as EventHandler<T>;

      const { result, event } = options.transaction(() => {
        const validated = handler.validate(data);
        const outcome = handler.handle(data, validated);
        const event = options.appendEvent({
          id: options.newId(),
          type,
          occurredAt: options.clock(),
          payload: outcome.payload,
        } as NewBusinessEvent);
        return { result: outcome.result, event };
      });

      notify(event);
      return result;
    },

    subscribe(subscriber: Subscriber) {
      subscribers.push(subscriber);
      return () => {
        const index = subscribers.indexOf(subscriber);
        if (index >= 0) subscribers.splice(index, 1);
      };
    },
  };
}

export { createEventBus };
export type { EventBus, EventBusOptions };
