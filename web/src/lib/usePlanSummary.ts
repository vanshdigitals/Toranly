import { useEffect, useMemo, useState } from 'react';
import { fetchPlanSummary, type ApiPlan, type SummaryResponse } from '../api/plan';
import { calculateBudgetMetrics, type OverallBudgetMetrics } from '../domain/budget';
import type { Plan } from '../domain/plan';

/** 'server' = figures from POST /plan/summary; 'device' = the browser's own calculation. */
export type SummarySource = 'pending' | 'server' | 'device';

const DEBOUNCE_MS = 400;

function fromServer(summary: SummaryResponse): OverallBudgetMetrics {
  const b = summary.budget;
  return {
    totalAllocatedPaise: b.allocatedPaise,
    totalPlannedPaise: b.plannedPaise,
    totalQuotedPaise: b.quotedPaise,
    totalPaidPaise: b.paidPaise,
    totalCommittedPaise: b.committedPaise,
    totalRemainingPaise: b.remainingPaise,
    overallStatus: b.status,
    percentCommitted: b.percentCommitted,
    categories: summary.categories.map((c) => ({
      categoryId: c.categoryId,
      key: c.key,
      label: c.label,
      allocatedPaise: c.allocatedPaise,
      plannedPaise: c.plannedPaise,
      quotedPaise: c.quotedPaise,
      paidPaise: c.paidPaise,
      committedPaise: c.committedPaise,
      remainingPaise: c.remainingPaise,
      status: c.status,
      percentCommitted: c.percentCommitted,
    })),
  };
}

/**
 * Budget totals and status for a plan. The backend result is the source of truth; the
 * browser's calculation is shown instantly while the request runs (after each edit) and kept
 * when the backend cannot be reached.
 */
export function usePlanSummary(plan: Plan | null): {
  metrics: OverallBudgetMetrics;
  source: SummarySource;
} {
  const local = useMemo(
    () => calculateBudgetMetrics(plan?.budgetCategories ?? [], plan?.expenses ?? []),
    [plan?.budgetCategories, plan?.expenses],
  );
  const [server, setServer] = useState<{ plan: Plan; metrics: OverallBudgetMetrics } | null>(null);
  const [failedFor, setFailedFor] = useState<Plan | null>(null);

  useEffect(() => {
    if (!plan) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPlanSummary(plan as ApiPlan, controller.signal)
        .then((summary) => setServer({ plan, metrics: fromServer(summary) }))
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setFailedFor(plan);
          void err;
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [plan]);

  if (plan && server?.plan === plan) return { metrics: server.metrics, source: 'server' };
  if (plan && failedFor === plan) return { metrics: local, source: 'device' };
  return { metrics: local, source: 'pending' };
}
