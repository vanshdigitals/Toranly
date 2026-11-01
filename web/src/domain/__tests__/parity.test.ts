/**
 * Parity with the Python engines (backend/app/domain).
 * Both suites read backend/tests/parity/fixtures/*.json and must produce `expected`.
 * Cases with `tsDivergence` document a known difference in this TypeScript code; they are
 * expected to fail here (it.fails) until the difference is resolved on purpose.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { splitMoneyLargestRemainder } from '../money';
import { getBudgetStatus, calculateBudgetMetrics } from '../budget';
import {
  calculateDueDate,
  previewDateChange,
  detectTaskCycle,
  checkTaskCompletionGate,
} from '../timeline';
import { normalizeAndCompareQuotes } from '../quotes';
import { validateDietaryCounts, checkDietaryCoverage } from '../guests';
import { detectScheduleOverlaps } from '../schedule';
import { generatePlanFromTemplate } from '../templates';
import type {
  BudgetCategory,
  ExpenseItem,
  IdeaItem,
  QuoteItem,
  ScheduleItem,
  TaskItem,
  CanonicalEventType,
} from '../plan';

// Fixtures are untyped JSON shared with pytest; each case below reads the fields it needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FixtureInput = Record<string, any>;

interface ParityCase {
  name: string;
  fn: string;
  input: FixtureInput;
  expected: unknown;
  tsDivergence: string | null;
}

const FIXTURES = import.meta.glob<ParityCase[]>(
  '../../../../backend/tests/parity/fixtures/*.json',
  { eager: true, import: 'default' },
);

function loadCases(): { group: string; cases: ParityCase[] }[] {
  return Object.keys(FIXTURES)
    .sort()
    .map((path) => ({
      group: path
        .split('/')
        .pop()!
        .replace(/\.json$/, ''),
      cases: FIXTURES[path],
    }));
}

function task(t: FixtureInput): TaskItem {
  return {
    id: t.id,
    title: t.title ?? '',
    offsetDays: t.offsetDays,
    dueDate: t.dueDate ?? undefined,
    dateMode: t.dateMode ?? 'relative',
    isMilestone: false,
    status: t.status ?? 'open',
    source: 'template',
    position: 1,
    dependsOn: t.dependsOn ?? [],
  };
}

function run(fn: string, input: FixtureInput): unknown {
  switch (fn) {
    case 'split':
      return splitMoneyLargestRemainder(input.totalPaise, input.shares).map((a) => ({
        key: a.key,
        allocatedPaise: a.allocatedPaise,
      }));
    case 'budgetStatus':
      return getBudgetStatus(input.allocatedPaise, input.committedPaise);
    case 'budgetMetrics': {
      const m = calculateBudgetMetrics(
        input.categories as BudgetCategory[],
        input.expenses as ExpenseItem[],
      );
      return {
        totalAllocatedPaise: m.totalAllocatedPaise,
        totalPlannedPaise: m.totalPlannedPaise,
        totalQuotedPaise: m.totalQuotedPaise,
        totalPaidPaise: m.totalPaidPaise,
        totalCommittedPaise: m.totalCommittedPaise,
        totalRemainingPaise: m.totalRemainingPaise,
        overallStatus: m.overallStatus,
        percentCommitted: m.percentCommitted,
        categories: m.categories,
      };
    }
    case 'dueDate':
      return calculateDueDate(input.eventDate, input.offsetDays);
    case 'datePreview': {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${input.today}T06:30:00.000Z`));
      const p = previewDateChange(input.tasks.map(task), input.oldEventDate, input.newEventDate);
      return {
        deltaDays: p.deltaDays,
        shifted: p.relativeTasksShifted.map((s) => ({
          id: s.id,
          title: s.title,
          oldDueDate: s.oldDueDate,
          newDueDate: s.newDueDate,
          offsetDays: s.offsetDays ?? null,
          becomesOverdue: s.becomesOverdue,
        })),
        fixedUnchanged: p.fixedTasksUnchanged.map((f) => ({
          id: f.id,
          title: f.title,
          dueDate: f.dueDate ?? null,
        })),
        overdueCount: p.overdueCount,
      };
    }
    case 'cycle': {
      const r = detectTaskCycle(input.tasks.map(task));
      return { hasCycle: r.hasCycle, cycleTaskIds: r.cycleTaskIds ?? [] };
    }
    case 'gate': {
      const tasks = input.tasks.map(task);
      const g = checkTaskCompletionGate(
        tasks.find((t: TaskItem) => t.id === input.taskId)!,
        tasks,
      );
      return { canComplete: g.canComplete, blockingTaskIds: g.blockingTasks.map((t) => t.id) };
    }
    case 'quotes':
      return normalizeAndCompareQuotes(input.quotes as QuoteItem[], input.guestCount).map((q) => ({
        id: q.id,
        totalPaise: q.totalCalculatedPaise,
        perGuestPaise: q.perGuestPaise,
        isCheapest: q.isCheapest,
      }));
    case 'dietCounts':
      return validateDietaryCounts(input.expectedTotal, input.breakdown);
    case 'dietCoverage': {
      const c = checkDietaryCoverage(input.breakdown, input.ideas as IdeaItem[]);
      return {
        covered: c.coveredDiets,
        uncovered: c.uncoveredDiets,
        fullyCovered: c.isFullyCovered,
      };
    }
    case 'scheduleOverlaps':
      return detectScheduleOverlaps(input.items as ScheduleItem[]).map((o) => ({
        itemAId: o.itemA.id,
        itemBId: o.itemB.id,
        functionId: o.functionId,
      }));
    case 'template': {
      const plan = generatePlanFromTemplate({
        id: 'parity',
        type: input.type as CanonicalEventType,
        title: 'Parity',
        eventDate: input.eventDate,
        budgetTotalPaise: input.budgetTotalPaise,
      });
      const positionById = new Map(plan.tasks.map((t) => [t.id, t.position]));
      return {
        categories: plan.budgetCategories.map((c) => ({
          key: c.key,
          label: c.label,
          allocatedPaise: c.allocatedPaise,
          position: c.position,
        })),
        tasks: plan.tasks.map((t) => ({
          title: t.title,
          categoryKey: t.categoryKey,
          offsetDays: t.offsetDays,
          dueDate: t.dueDate ?? null,
          isMilestone: t.isMilestone,
          dependsOnPositions: t.dependsOn.map((id) => positionById.get(id)),
        })),
      };
    }
    default:
      throw new Error(`unknown parity function ${fn}`);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

const groups = loadCases();

describe('Parity with Python domain engines', () => {
  it('finds the shared fixtures', () => {
    expect(groups.length).toBeGreaterThan(0);
  });

  for (const { group, cases } of groups) {
    describe(group, () => {
      for (const c of cases) {
        if (c.tsDivergence) {
          it.fails(`${c.name} [known divergence: ${c.tsDivergence}]`, () => {
            expect(run(c.fn, c.input)).toEqual(c.expected);
          });
        } else {
          it(c.name, () => {
            expect(run(c.fn, c.input)).toEqual(c.expected);
          });
        }
      }
    });
  }
});
