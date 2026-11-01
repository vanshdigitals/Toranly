import type { BudgetCategory, ExpenseItem } from './plan';

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface CategoryBudgetMetrics {
  categoryId: string;
  key: string;
  label: string;
  allocatedPaise: number;
  plannedPaise: number;
  quotedPaise: number;
  paidPaise: number;
  committedPaise: number;
  remainingPaise: number;
  status: BudgetStatus;
  percentCommitted: number;
}

export interface OverallBudgetMetrics {
  totalAllocatedPaise: number;
  totalPlannedPaise: number;
  totalQuotedPaise: number;
  totalPaidPaise: number;
  totalCommittedPaise: number;
  totalRemainingPaise: number;
  overallStatus: BudgetStatus;
  percentCommitted: number;
  categories: CategoryBudgetMetrics[];
}

/**
 * Determine the status of a budget allocation based on committed amount.
 * Warning: committed >= 90% of allocated and <= allocated
 * Over: committed > allocated
 * Ok: committed < 90%
 */
export function getBudgetStatus(allocatedPaise: number, committedPaise: number): BudgetStatus {
  if (allocatedPaise <= 0) {
    return committedPaise > 0 ? 'over' : 'ok';
  }

  if (committedPaise > allocatedPaise) {
    return 'over';
  }

  // >= 90%
  // Exact 90% in integer paise (ARCHITECTURE.md §4.2), matching the Python engine.
  if (committedPaise * 10 >= allocatedPaise * 9) {
    return 'warning';
  }

  return 'ok';
}

/**
 * Compute budget metrics for all categories and the overall event.
 * Domain rule: Committed for a category = max(planned, quoted, paid).
 */
export function calculateBudgetMetrics(
  categories: BudgetCategory[],
  expenses: ExpenseItem[] = [],
): OverallBudgetMetrics {
  const categoryMetrics: CategoryBudgetMetrics[] = categories.map((cat) => {
    // Filter expenses matching this category
    const catExpenses = expenses.filter((e) => e.categoryId === cat.id || e.categoryId === cat.key);

    let plannedPaise = 0;
    let quotedPaise = 0;
    let paidPaise = 0;

    for (const exp of catExpenses) {
      if (exp.kind === 'planned') {
        plannedPaise += exp.amountPaise;
      } else if (exp.kind === 'quoted') {
        quotedPaise += exp.amountPaise;
      } else if (exp.kind === 'paid') {
        paidPaise += exp.amountPaise;
      }
    }

    // Committed is max of planned, quoted, paid
    const committedPaise = Math.max(plannedPaise, quotedPaise, paidPaise);
    const remainingPaise = cat.allocatedPaise - committedPaise;
    const status = getBudgetStatus(cat.allocatedPaise, committedPaise);
    const percentCommitted =
      cat.allocatedPaise > 0
        ? Math.min(100, Math.round((committedPaise / cat.allocatedPaise) * 100))
        : 0;

    return {
      categoryId: cat.id,
      key: cat.key,
      label: cat.label,
      allocatedPaise: cat.allocatedPaise,
      plannedPaise,
      quotedPaise,
      paidPaise,
      committedPaise,
      remainingPaise,
      status,
      percentCommitted,
    };
  });

  const totalAllocatedPaise = categories.reduce((sum, c) => sum + c.allocatedPaise, 0);
  const totalPlannedPaise = categoryMetrics.reduce((sum, c) => sum + c.plannedPaise, 0);
  const totalQuotedPaise = categoryMetrics.reduce((sum, c) => sum + c.quotedPaise, 0);
  const totalPaidPaise = categoryMetrics.reduce((sum, c) => sum + c.paidPaise, 0);
  const totalCommittedPaise = categoryMetrics.reduce((sum, c) => sum + c.committedPaise, 0);
  const totalRemainingPaise = totalAllocatedPaise - totalCommittedPaise;

  const overallStatus = getBudgetStatus(totalAllocatedPaise, totalCommittedPaise);
  const percentCommitted =
    totalAllocatedPaise > 0
      ? Math.min(100, Math.round((totalCommittedPaise / totalAllocatedPaise) * 100))
      : 0;

  return {
    totalAllocatedPaise,
    totalPlannedPaise,
    totalQuotedPaise,
    totalPaidPaise,
    totalCommittedPaise,
    totalRemainingPaise,
    overallStatus,
    percentCommitted,
    categories: categoryMetrics,
  };
}
