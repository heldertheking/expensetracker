import { useState } from 'react';
import type { Project } from '@expensetracker/schema';
import { deleteProject, listProjects } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import { formatChf } from '../lib/money';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Page, PageHeader } from '../components/Layout';
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

  const create = () => setDialog({ kind: 'create' });

  return (
    <Page>
      <PageHeader
        title="Projects"
        subtitle="Tag transactions from either account with a project to track what they were for."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={create}>
            New project
          </Button>
        }
      />

      {projects.error !== undefined ? (
        <ErrorState
          error={projects.error}
          title="Could not load projects"
          onRetry={projects.reload}
        />
      ) : projects.data === undefined ? (
        <Loading label="Loading projects" />
      ) : projects.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No projects yet"
            action={
              <Button variant="contained" onClick={create}>
                Create a project
              </Button>
            }
          >
            A project groups transactions, e.g. a holiday or a renovation, and can have a budget.
          </EmptyState>
        </Card>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
          }}
        >
          {projects.data.map((project) => (
            <Card
              component="li"
              key={project.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                borderColor: project.overBudget ? 'error.light' : undefined,
              }}
            >
              <CardContent sx={{ flex: 1 }}>
                <Stack spacing={1.5}>
                  <Typography variant="h2">
                    <Link href={`/projects/${project.id}`} underline="hover" color="inherit">
                      {project.name}
                    </Link>
                  </Typography>
                  {project.description && (
                    <Typography variant="body2" color="text.secondary">
                      {project.description}
                    </Typography>
                  )}
                  <BudgetMeter project={project} />
                  <Stack component="dl" direction="row" spacing={3} sx={{ m: 0 }}>
                    <div>
                      <Typography component="dt" variant="caption" color="text.secondary">
                        Spent
                      </Typography>
                      <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
                        {formatChf(project.expenseCents)}
                      </Typography>
                    </div>
                    <div>
                      <Typography component="dt" variant="caption" color="text.secondary">
                        Refilled
                      </Typography>
                      <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
                        {formatChf(project.incomeCents)}
                      </Typography>
                    </div>
                  </Stack>
                </Stack>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  startIcon={<EditOutlinedIcon />}
                  aria-label={`Edit ${project.name}`}
                  onClick={() => setDialog({ kind: 'edit', project })}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlinedIcon />}
                  aria-label={`Delete ${project.name}`}
                  onClick={() => setDialog({ kind: 'delete', project })}
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
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
    </Page>
  );
}
