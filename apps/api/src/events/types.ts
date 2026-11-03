import type {
  BusinessEvent,
  BusinessEventOf,
  BusinessEventType,
  CreateProjectRequest,
  CreateTransactionRequest,
  ProjectRecord,
  Transaction,
  UpdateProjectRequest,
  UpdateTransactionRequest,
} from '@expensetracker/schema';

/** What a route dispatches with each business event: the parsed request plus the target id. */
interface EventData {
  CreateTransactionEvent: CreateTransactionRequest;
  UpdateTransactionEvent: { id: string; patch: UpdateTransactionRequest };
  DeleteTransactionEvent: { id: string };
  CreateProjectEvent: CreateProjectRequest;
  UpdateProjectEvent: { id: string; patch: UpdateProjectRequest };
  DeleteProjectEvent: { id: string };
}

/** What the bus hands back to the route: the record as stored after the event. */
interface EventResult {
  CreateTransactionEvent: Transaction;
  UpdateTransactionEvent: Transaction;
  DeleteTransactionEvent: Transaction;
  CreateProjectEvent: ProjectRecord;
  UpdateProjectEvent: ProjectRecord;
  DeleteProjectEvent: ProjectRecord;
}

type EventPayload<T extends BusinessEventType> = BusinessEventOf<T>['payload'];

interface HandlerOutcome<T extends BusinessEventType> {
  result: EventResult[T];
  payload: EventPayload<T>; // recorded in the event log
}

/**
 * One handler per business event. `validate` runs the rules that need data and returns what
 * `handle` needs (e.g. the stored record), so nothing is loaded twice. Both run inside the
 * event's transaction; throwing from either rolls everything back.
 */
interface EventHandler<T extends BusinessEventType, V = unknown> {
  validate(data: EventData[T]): V;
  handle(data: EventData[T], validated: V): HandlerOutcome<T>;
}

type EventHandlers = { [T in BusinessEventType]: EventHandler<T> };

/** Notified with every recorded event after its transaction has committed. */
type Subscriber = (event: BusinessEvent) => void;

export type {
  EventData,
  EventHandler,
  EventHandlers,
  EventPayload,
  EventResult,
  HandlerOutcome,
  Subscriber,
};
