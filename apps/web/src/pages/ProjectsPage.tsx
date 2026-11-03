import { useState } from 'react';
import type { Project } from '@expensetracker/schema';
import { deleteProject, listProjects } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import { formatChf } from '../lib/money';
import { Link } from '../router';
import { BudgetMeter } from '../components/BudgetMeter';
import { ConfirmDialog, Modal } from '../components/Modal';
import { ProjectForm } from '../components/ProjectForm';
import { EmptyState, ErrorState, Loading } from '../components/States';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; project: Project }
  | { kind: 'delete'; project: Project }
  | null;

export function ProjectsPage() {
  const projects = useApi((signal) => listProjects(signal), 'projects');
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const done = () => {
    close();
    projects.reload();
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">
            Tag transactions from either account with a project to track what they were for.
          </p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => setDialog({ kind: 'create' })}
        >
          New project
        </button>
      </header>

      {projects.error !== undefined ? (
        <ErrorState
          error={projects.error}
          title="Could not load projects"
          onRetry={projects.reload}
        />
      ) : projects.data === undefined ? (
        <Loading label="Loading projects" />
      ) : projects.data.length === 0 ? (
        <EmptyState
          title="No projects yet"
          action={
            <button
              type="button"
              className="button primary"
              onClick={() => setDialog({ kind: 'create' })}
            >
              Create a project
            </button>
          }
        >
          A project groups transactions, e.g. a holiday or a renovation, and can have a budget.
        </EmptyState>
      ) : (
        <ul className="project-grid">
          {projects.data.map((project) => (
            <li
              key={project.id}
              className={`card project-card ${project.overBudget ? 'is-over' : ''}`}
            >
              <h2 className="card-title">
                <Link to={`/projects/${project.id}`}>{project.name}</Link>
              </h2>
              {project.description && <p className="muted clamp">{project.description}</p>}
              <BudgetMeter project={project} />
              <dl className="project-totals">
                <div>
                  <dt>Spent</dt>
                  <dd>{formatChf(project.expenseCents)}</dd>
                </div>
                <div>
                  <dt>Refilled</dt>
                  <dd>{formatChf(project.incomeCents)}</dd>
                </div>
              </dl>
              <div className="card-actions">
                <button
                  type="button"
                  className="button ghost small"
                  aria-label={`Edit ${project.name}`}
                  onClick={() => setDialog({ kind: 'edit', project })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="button ghost small danger-text"
                  aria-label={`Delete ${project.name}`}
                  onClick={() => setDialog({ kind: 'delete', project })}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete project?"
          message={`“${dialog.project.name}” will be deleted. A project that still has tagged transactions cannot be deleted.`}
          confirmLabel="Delete project"
          onConfirm={async () => {
            await deleteProject(dialog.project.id);
            done();
          }}
          onClose={close}
        />
      )}
      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <Modal title={dialog.kind === 'edit' ? 'Edit project' : 'New project'} onClose={close}>
          <ProjectForm
            project={dialog.kind === 'edit' ? dialog.project : undefined}
            onSaved={done}
            onCancel={close}
          />
        </Modal>
      )}
    </div>
  );
}
