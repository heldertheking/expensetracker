import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ACCOUNTS,
  CreateTransactionRequest,
  TRANSACTION_DESCRIPTION_MAX,
  UpdateTransactionRequest,
  toValidationIssues,
  validateTransactionUpdate,
} from '@expensetracker/schema';
import type { Account, Project, Transaction, TransactionType } from '@expensetracker/schema';
import { createTransaction, updateTransaction } from '../api/endpoints';
import { ApiRequestError, errorMessage } from '../api/client';
import { centsToFrancsInput, parseFrancsToCents } from '../lib/money';
import { toIsoDate } from '../lib/dates';
import { ACCOUNT_LABELS } from '../lib/events';
import { issuesToFieldErrors } from '../lib/issues';
import { Field } from './FormField';

/** Request fields that a form field shows errors for under another name. */
const FIELD_NAMES = { amountCents: 'amount' };

interface TransactionFormProps {
  /** Edit this transaction; without it the form creates a new one. */
  transaction?: Transaction;
  projects: Project[];
  /** Preselects a project tag for a new transaction. */
  defaultProjectId?: string | null;
  onSaved: (transaction: Transaction) => void;
  onCancel: () => void;
}

interface Values {
  account: Account | '';
  type: TransactionType;
  amount: string;
  date: string;
  description: string;
  projectId: string;
}

function initialValues(transaction?: Transaction, defaultProjectId?: string | null): Values {
  if (transaction) {
    return {
      account: transaction.account,
      type: transaction.type,
      amount: centsToFrancsInput(transaction.amountCents),
      date: transaction.date,
      description: transaction.description,
      projectId: transaction.projectId ?? '',
    };
  }
  return {
    account: '',
    type: 'expense',
    amount: '',
    date: toIsoDate(new Date()),
    description: '',
    projectId: defaultProjectId ?? '',
  };
}

export function TransactionForm({
  transaction,
  projects,
  defaultProjectId,
  onSaved,
  onCancel,
}: TransactionFormProps) {
  const id = useId();
  const [values, setValues] = useState<Values>(() => initialValues(transaction, defaultProjectId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const isEdit = transaction !== undefined;

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _removed, ...rest }) => rest);
  };

  /** Builds the request body, or returns the errors found before sending anything. */
  const build = (): { body: object } | { errors: Record<string, string> } => {
    const found: Record<string, string> = {};
    if (!isEdit && values.account === '') found.account = 'Choose the account for this transaction';
    const amount = parseFrancsToCents(values.amount);
    if (!amount.ok) found.amount = amount.error;
    if (Object.keys(found).length > 0 || !amount.ok) return { errors: found };

    const projectId = values.projectId === '' ? null : values.projectId;
    if (!transaction) {
      const body = {
        account: values.account,
        type: values.type,
        amountCents: amount.cents,
        date: values.date,
        description: values.description,
        projectId,
      };
      const parsed = CreateTransactionRequest.safeParse(body);
      return parsed.success
        ? { body: parsed.data }
        : { errors: issuesToFieldErrors(toValidationIssues(parsed.error), FIELD_NAMES) };
    }

    // PATCH: only what changed; a type change always resends the amount to confirm it.
    const patch: Record<string, unknown> = {};
    if (values.type !== transaction.type) patch.type = values.type;
    if (amount.cents !== transaction.amountCents || patch.type !== undefined) {
      patch.amountCents = amount.cents;
    }
    if (values.date !== transaction.date) patch.date = values.date;
    if (values.description.trim() !== transaction.description) {
      patch.description = values.description;
    }
    if (projectId !== transaction.projectId) patch.projectId = projectId;
    if (Object.keys(patch).length === 0) return { errors: { '': 'Nothing changed' } };
    const parsed = UpdateTransactionRequest.safeParse(patch);
    if (!parsed.success) {
      return { errors: issuesToFieldErrors(toValidationIssues(parsed.error), FIELD_NAMES) };
    }
    const issues = validateTransactionUpdate(transaction, parsed.data);
    if (issues.length > 0) return { errors: issuesToFieldErrors(issues, FIELD_NAMES) };
    return { body: parsed.data };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = build();
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const saved = transaction
        ? await updateTransaction(transaction.id, result.body as UpdateTransactionRequest)
        : await createTransaction(result.body as CreateTransactionRequest);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const fieldErrors = error.fieldErrors(FIELD_NAMES);
        setErrors(
          Object.keys(fieldErrors).length > 0 ? fieldErrors : { '': error.message || 'Failed' },
        );
      } else {
        setErrors({ '': errorMessage(error) });
      }
      setSubmitting(false);
    }
  };

  const fieldIds = (name: string) => `${id}-${name}`;

  return (
    <form className="form" onSubmit={submit} noValidate>
      {errors[''] && (
        <p className="form-error" role="alert">
          {errors['']}
        </p>
      )}

      {isEdit ? (
        <div className="field">
          <span className="label">Account</span>
          <p className="readonly-value">
            {ACCOUNT_LABELS[transaction.account]}{' '}
            <span className="muted">(cannot be changed after creation)</span>
          </p>
        </div>
      ) : (
        <fieldset
          className={`field choice-group ${errors.account ? 'has-error' : ''}`}
          aria-describedby={errors.account ? fieldIds('account-error') : undefined}
        >
          <legend>Account</legend>
          <div className="choices">
            {ACCOUNTS.map((account) => (
              <label key={account} className="choice">
                <input
                  type="radio"
                  name="account"
                  value={account}
                  checked={values.account === account}
                  onChange={() => set('account', account)}
                  aria-invalid={Boolean(errors.account)}
                />
                {ACCOUNT_LABELS[account]}
              </label>
            ))}
          </div>
          {errors.account && (
            <p id={fieldIds('account-error')} className="field-error">
              {errors.account}
            </p>
          )}
        </fieldset>
      )}

      <fieldset className={`field choice-group ${errors.type ? 'has-error' : ''}`}>
        <legend>Type</legend>
        <div className="choices">
          {(['expense', 'income'] as const).map((type) => (
            <label key={type} className="choice">
              <input
                type="radio"
                name="type"
                value={type}
                checked={values.type === type}
                onChange={() => set('type', type)}
              />
              {type === 'income' ? 'Income' : 'Expense'}
            </label>
          ))}
        </div>
        {errors.type && <p className="field-error">{errors.type}</p>}
      </fieldset>

      <div className="field-row">
        <Field
          id={fieldIds('amount')}
          label="Amount (CHF)"
          error={errors.amount}
          hint="In francs, e.g. 12.50"
        >
          {(aria) => (
            <input
              {...aria}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.amount}
              onChange={(e) => set('amount', e.target.value)}
            />
          )}
        </Field>
        <Field id={fieldIds('date')} label="Date" error={errors.date}>
          {(aria) => (
            <input
              {...aria}
              type="date"
              value={values.date}
              max={toIsoDate(new Date())}
              onChange={(e) => set('date', e.target.value)}
            />
          )}
        </Field>
      </div>

      <Field id={fieldIds('description')} label="Description" error={errors.description}>
        {(aria) => (
          <input
            {...aria}
            type="text"
            maxLength={TRANSACTION_DESCRIPTION_MAX}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
          />
        )}
      </Field>

      <Field
        id={fieldIds('project')}
        label="Project (optional)"
        error={errors.projectId}
        hint="Tagged expenses use up the project's budget, tagged income refills it."
      >
        {(aria) => (
          <select
            {...aria}
            value={values.projectId}
            onChange={(e) => set('projectId', e.target.value)}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
        </button>
      </div>
    </form>
  );
}
