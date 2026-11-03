import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import {
  CreateProjectRequest,
  PROJECT_DESCRIPTION_MAX,
  PROJECT_NAME_MAX,
  UpdateProjectRequest,
  toValidationIssues,
  validateProjectUpdate,
} from '@expensetracker/schema';
import type { Project } from '@expensetracker/schema';
import { createProject, updateProject } from '../api/endpoints';
import { ApiRequestError, errorMessage } from '../api/client';
import { formatChf, parseFrancsToCents } from '../lib/money';
import { issuesToFieldErrors } from '../lib/issues';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const FIELD_NAMES = { budgetCents: 'budget' };

interface ProjectFormProps {
  project?: Project;
  onSaved: (project: Project) => void;
  onCancel: () => void;
}

export function ProjectForm({ project, onSaved, onCancel }: ProjectFormProps) {
  const id = useId();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [budget, setBudget] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const build = (): { body: object } | { errors: Record<string, string> } => {
    const toErrors = (issues: { path: string; message: string }[]) => ({
      errors: issuesToFieldErrors(issues, FIELD_NAMES),
    });
    if (!project) {
      let budgetCents: number | null = null;
      if (budget.trim() !== '') {
        const parsed = parseFrancsToCents(budget);
        if (!parsed.ok) return { errors: { budget: parsed.error } };
        budgetCents = parsed.cents;
      }
      const parsed = CreateProjectRequest.safeParse({ name, description, budgetCents });
      return parsed.success ? { body: parsed.data } : toErrors(toValidationIssues(parsed.error));
    }
    const patch: Record<string, string> = {};
    if (name.trim() !== project.name) patch.name = name;
    if (description.trim() !== project.description) patch.description = description;
    if (Object.keys(patch).length === 0) return { errors: { '': 'Nothing changed' } };
    const parsed = UpdateProjectRequest.safeParse(patch);
    if (!parsed.success) return toErrors(toValidationIssues(parsed.error));
    const issues = validateProjectUpdate(project, parsed.data);
    return issues.length > 0 ? toErrors(issues) : { body: parsed.data };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = build();
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const saved = project
        ? await updateProject(project.id, result.body as UpdateProjectRequest)
        : await createProject(result.body as CreateProjectRequest);
      onSaved(saved);
    } catch (error) {
      const fieldErrors =
        error instanceof ApiRequestError
          ? error.fieldErrors(FIELD_NAMES)
          : ({} as Record<string, string>);
      setErrors(Object.keys(fieldErrors).length > 0 ? fieldErrors : { '': errorMessage(error) });
      setSubmitting(false);
    }
  };

  return (
    <Stack component="form" spacing={2.5} onSubmit={submit} noValidate sx={{ pt: 1 }}>
      {errors[''] && <Alert severity="error">{errors['']}</Alert>}
      <TextField
        id={`${id}-name`}
        label="Name"
        fullWidth
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={Boolean(errors.name)}
        helperText={errors.name}
        slotProps={{ htmlInput: { maxLength: PROJECT_NAME_MAX } }}
      />
      <TextField
        id={`${id}-description`}
        label="Description (optional)"
        fullWidth
        multiline
        minRows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={Boolean(errors.description)}
        helperText={errors.description}
        slotProps={{ htmlInput: { maxLength: PROJECT_DESCRIPTION_MAX } }}
      />
      {project ? (
        <Box>
          <Typography variant="body2" color="text.secondary">
            Budget
          </Typography>
          <Typography>
            {project.budgetCents === null ? 'No budget' : formatChf(project.budgetCents)}{' '}
            <Typography component="span" variant="body2" color="text.secondary">
              (fixed at creation, cannot be changed)
            </Typography>
          </Typography>
        </Box>
      ) : (
        <TextField
          id={`${id}-budget`}
          label="Budget in CHF (optional)"
          fullWidth
          autoComplete="off"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          error={Boolean(errors.budget)}
          helperText={
            errors.budget ??
            'The initial budget is fixed once the project is created and cannot be changed later. Leave empty for no budget.'
          }
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        />
      )}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </Button>
      </Stack>
    </Stack>
  );
}
