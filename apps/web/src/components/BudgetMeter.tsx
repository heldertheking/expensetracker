import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { Project } from '@expensetracker/schema';
import { formatChf } from '../lib/money';

/** Share of the budget used, 0..∞ (net of tagged income). Null without a budget. */
export function budgetUsage(project: Project): number | null {
  if (project.budgetCents === null || project.remainingCents === null) return null;
  return (project.budgetCents - project.remainingCents) / project.budgetCents;
}

export function budgetText(project: Project): string {
  if (project.budgetCents === null || project.remainingCents === null) {
    return `No budget · ${formatChf(project.expenseCents)} spent`;
  }
  const used = project.budgetCents - project.remainingCents;
  if (project.overBudget) {
    return `Over budget by ${formatChf(-project.remainingCents)} (${formatChf(used)} of ${formatChf(project.budgetCents)})`;
  }
  return `${formatChf(Math.max(0, used))} of ${formatChf(project.budgetCents)} used · ${formatChf(project.remainingCents)} left`;
}

/**
 * A bullet-style meter: the fill is the used share of the budget, the track the rest. An
 * over-budget project fills completely in the error color and carries an icon and a label, so the
 * state never relies on color alone.
 */
export function BudgetMeter({ project }: { project: Project }) {
  const usage = budgetUsage(project);
  if (usage === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        {budgetText(project)}
      </Typography>
    );
  }
  // income tagged to the project can push net usage below zero; show 0% then
  const percent = Math.max(0, Math.round(usage * 100));
  const fill = Math.min(100, percent);
  const color = project.overBudget ? 'error' : percent >= 90 ? 'warning' : 'primary';
  return (
    <Stack spacing={0.75}>
      <LinearProgress
        variant="determinate"
        value={fill}
        color={color}
        aria-label={`Budget used for ${project.name}`}
        aria-valuetext={`${percent}% used. ${budgetText(project)}`}
      />
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {project.overBudget && (
          <Chip
            size="small"
            color="error"
            variant="outlined"
            icon={<WarningAmberIcon aria-hidden="true" />}
            label="Over budget"
          />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {budgetText(project)}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {percent}%
        </Typography>
      </Stack>
    </Stack>
  );
}
