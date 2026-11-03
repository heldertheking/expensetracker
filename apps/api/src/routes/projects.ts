import { Router } from 'express';
import {
  CreateProjectRequest,
  ProjectListResponse,
  ProjectParams,
  ProjectResponse,
  UpdateProjectRequest,
} from '@expensetracker/schema';
import { authenticatedUserId } from '../auth/security.js';
import type { EventBus } from '../events/event-bus.js';
import type { ProjectService } from '../services/read-services.js';
import { parseInput, sendParsed } from './http.js';

/** `/api/projects`: reads through the service, writes as business events through the bus. */
function projectsRouter(deps: { bus: EventBus; projects: ProjectService }): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const userId = authenticatedUserId(req);
    sendParsed(res, 200, ProjectListResponse, { items: deps.projects.list(userId) });
  });

  router.post('/', (req, res) => {
    const userId = authenticatedUserId(req);
    const request = parseInput(CreateProjectRequest, req.body);
    const created = deps.bus.dispatch(userId, 'CreateProjectEvent', request);
    sendParsed(res, 201, ProjectResponse, deps.projects.get(userId, created.id));
  });

  router.get('/:id', (req, res) => {
    const userId = authenticatedUserId(req);
    const { id } = parseInput(ProjectParams, req.params);
    sendParsed(res, 200, ProjectResponse, deps.projects.get(userId, id));
  });

  router.patch('/:id', (req, res) => {
    const userId = authenticatedUserId(req);
    const { id } = parseInput(ProjectParams, req.params);
    const patch = parseInput(UpdateProjectRequest, req.body);
    deps.bus.dispatch(userId, 'UpdateProjectEvent', { id, patch });
    sendParsed(res, 200, ProjectResponse, deps.projects.get(userId, id));
  });

  router.delete('/:id', (req, res) => {
    const userId = authenticatedUserId(req);
    const { id } = parseInput(ProjectParams, req.params);
    deps.bus.dispatch(userId, 'DeleteProjectEvent', { id });
    res.status(204).end();
  });

  return router;
}

export { projectsRouter };
