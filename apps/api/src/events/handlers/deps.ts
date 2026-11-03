import type { ProjectRepository } from '../../repositories/project-repository.js';
import type { TransactionRepository } from '../../repositories/transaction-repository.js';

/** What the handlers need. Narrow on purpose, so unit tests can mock exactly these methods. */
interface HandlerDeps {
  projects: Pick<ProjectRepository, 'findById' | 'findByName' | 'insert' | 'update' | 'delete'>;
  transactions: Pick<
    TransactionRepository,
    'findById' | 'insert' | 'update' | 'delete' | 'countByProject' | 'totalsByProject'
  >;
  clock: () => Date;
  newId: () => string;
}

export type { HandlerDeps };
