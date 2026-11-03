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
import { Field } from './FormField';

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
    <form className="form" onSubmit={submit} noValidate>
      {errors[''] && (
        <p className="form-error" role="alert">
          {errors['']}
        </p>
      )}
      <Field id={`${id}-name`} label="Name" error={errors.name}>
        {(aria) => (
          <input
            {...aria}
            type="text"
            maxLength={PROJECT_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      <Field id={`${id}-description`} label="Description (optional)" error={errors.description}>
        {(aria) => (
          <textarea
            {...aria}
            rows={3}
            maxLength={PROJECT_DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>
      {project ? (
        <div className="field">
          <span className="label">Budget</span>
          <p className="readonly-value">
            {project.budgetCents === null ? 'No budget' : formatChf(project.budgetCents)}{' '}
            <span className="muted">(fixed at creation, cannot be changed)</span>
          </p>
        </div>
      ) : (
        <Field
          id={`${id}-budget`}
          label="Budget in CHF (optional)"
          error={errors.budget}
          hint="The initial budget is fixed once the project is created and cannot be changed later. Leave empty for no budget."
        >
          {(aria) => (
            <input
              {...aria}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          )}
        </Field>
      )}
      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </button>
      </div>
    </form>
  );
}
