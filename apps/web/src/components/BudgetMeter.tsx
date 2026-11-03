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
 * over-budget project fills completely in the critical color and carries an icon and a label, so
 * the state never relies on color alone.
 */
export function BudgetMeter({ project }: { project: Project }) {
  const usage = budgetUsage(project);
  if (usage === null) {
    return <p className="budget-text muted">{budgetText(project)}</p>;
  }
  const percent = Math.round(usage * 100);
  const fill = Math.min(100, Math.max(0, percent));
  const state = project.overBudget ? 'over' : percent >= 90 ? 'near' : 'ok';
  return (
    <div className={`budget budget-${state}`}>
      <div
        className="meter"
        role="meter"
        aria-label={`Budget used for ${project.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.max(0, percent)}
        aria-valuetext={`${percent}% used. ${budgetText(project)}`}
      >
        <span className="meter-fill" style={{ width: `${fill}%` }} />
      </div>
      <p className="budget-text">
        {project.overBudget && (
          <span className="badge badge-critical">
            <span aria-hidden="true">▲ </span>Over budget
          </span>
        )}
        <span>{budgetText(project)}</span>
        <span className="budget-percent">{percent}%</span>
      </p>
    </div>
  );
}
