import { Router } from 'express';
import {
  CreateProjectRequest,
  ProjectListResponse,
  ProjectParams,
  ProjectResponse,
  UpdateProjectRequest,
} from '@expensetracker/schema';
import type { EventBus } from '../events/event-bus.js';
import type { ProjectService } from '../services/read-services.js';
import { parseInput, sendParsed } from './http.js';

/** `/api/projects`: reads through the service, writes as business events through the bus. */
function projectsRouter(deps: { bus: EventBus; projects: ProjectService }): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    sendParsed(res, 200, ProjectListResponse, { items: deps.projects.list() });
  });

  router.post('/', (req, res) => {
    const request = parseInput(CreateProjectRequest, req.body);
    const created = deps.bus.dispatch('CreateProjectEvent', request);
    sendParsed(res, 201, ProjectResponse, deps.projects.get(created.id));
  });

  router.get('/:id', (req, res) => {
    const { id } = parseInput(ProjectParams, req.params);
    sendParsed(res, 200, ProjectResponse, deps.projects.get(id));
  });

  router.patch('/:id', (req, res) => {
    const { id } = parseInput(ProjectParams, req.params);
    const patch = parseInput(UpdateProjectRequest, req.body);
    deps.bus.dispatch('UpdateProjectEvent', { id, patch });
    sendParsed(res, 200, ProjectResponse, deps.projects.get(id));
  });

  router.delete('/:id', (req, res) => {
    const { id } = parseInput(ProjectParams, req.params);
    deps.bus.dispatch('DeleteProjectEvent', { id });
    res.status(204).end();
  });

  return router;
}

export { projectsRouter };
