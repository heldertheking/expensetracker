import type { EventHandlers } from '../types.js';
import type { HandlerDeps } from './deps.js';
import {
  createProjectHandler,
  deleteProjectHandler,
  updateProjectHandler,
} from './project-handlers.js';
import {
  createTransactionHandler,
  deleteTransactionHandler,
  updateTransactionHandler,
} from './transaction-handlers.js';

/** One handler per business event type. */
function createHandlers(deps: HandlerDeps): EventHandlers {
  return {
    CreateTransactionEvent: createTransactionHandler(deps),
    UpdateTransactionEvent: updateTransactionHandler(deps),
    DeleteTransactionEvent: deleteTransactionHandler(deps),
    CreateProjectEvent: createProjectHandler(deps),
    UpdateProjectEvent: updateProjectHandler(deps),
    DeleteProjectEvent: deleteProjectHandler(deps),
  };
}

export { createHandlers };
export type { HandlerDeps };
