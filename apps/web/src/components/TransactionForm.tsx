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
import { ChoiceField } from './ChoiceField';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

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
    setErrors((current) => {
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
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

  const helper = (name: string, hint?: string) => errors[name] ?? hint;

  return (
    <Stack component="form" spacing={2.5} onSubmit={submit} noValidate sx={{ pt: 1 }}>
      {errors[''] && <Alert severity="error">{errors['']}</Alert>}

      {isEdit ? (
        <Box>
          <Typography variant="body2" color="text.secondary">
            Account
          </Typography>
          <Typography>
            {ACCOUNT_LABELS[transaction.account]}{' '}
            <Typography component="span" variant="body2" color="text.secondary">
              (cannot be changed after creation)
            </Typography>
          </Typography>
        </Box>
      ) : (
        <ChoiceField
          label="Account"
          value={values.account}
          options={ACCOUNTS.map((account) => ({ value: account, label: ACCOUNT_LABELS[account] }))}
          onChange={(account) => set('account', account)}
          error={errors.account}
        />
      )}

      <ChoiceField
        label="Type"
        value={values.type}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
        onChange={(type) => set('type', type)}
        error={errors.type}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          id={`${id}-amount`}
          label="Amount (CHF)"
          fullWidth
          autoComplete="off"
          value={values.amount}
          onChange={(e) => set('amount', e.target.value)}
          error={Boolean(errors.amount)}
          helperText={helper('amount', 'In francs, e.g. 12.50')}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        />
        <TextField
          id={`${id}-date`}
          label="Date"
          type="date"
          fullWidth
          value={values.date}
          onChange={(e) => set('date', e.target.value)}
          error={Boolean(errors.date)}
          helperText={helper('date')}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: toIsoDate(new Date()) } }}
        />
      </Stack>

      <TextField
        id={`${id}-description`}
        label="Description"
        fullWidth
        value={values.description}
        onChange={(e) => set('description', e.target.value)}
        error={Boolean(errors.description)}
        helperText={helper('description')}
        slotProps={{ htmlInput: { maxLength: TRANSACTION_DESCRIPTION_MAX } }}
      />

      <TextField
        id={`${id}-project`}
        select
        label="Project (optional)"
        fullWidth
        value={values.projectId}
        onChange={(e) => set('projectId', e.target.value)}
        error={Boolean(errors.projectId)}
        helperText={helper(
          'projectId',
          "Tagged expenses use up the project's budget, tagged income refills it.",
        )}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        <option value="">No project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </TextField>

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
        </Button>
      </Stack>
    </Stack>
  );
}
