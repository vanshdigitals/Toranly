import { describe, it, expect } from 'vitest';
import { splitMoneyLargestRemainder, formatPaise, rupeesToPaise } from '../money';
import { calculateBudgetMetrics, getBudgetStatus } from '../budget';
import {
  calculateDueDate,
  previewDateChange,
  detectTaskCycle,
  checkTaskCompletionGate,
  isTaskOverdue,
} from '../timeline';
import { normalizeAndCompareQuotes } from '../quotes';
import { validateDietaryCounts, checkDietaryCoverage } from '../guests';
import { detectScheduleOverlaps } from '../schedule';
import { generatePlanFromTemplate } from '../templates';
import { escapeCsvCell, generateBudgetCsv, generateTasksCsv, generateDietaryCsv } from '../export';
import type { TaskItem } from '../plan';

describe('Domain: Money Arithmetic & Split', () => {
  it('splits money with largest-remainder so the sum exactly matches total paise', () => {
    const totalPaise = 100000; // ₹1,000.00
    const shares = [
      { key: 'cat1', sharePercent: 33.33, position: 1 },
      { key: 'cat2', sharePercent: 33.33, position: 2 },
      { key: 'cat3', sharePercent: 33.34, position: 3 },
    ];

    const result = splitMoneyLargestRemainder(totalPaise, shares);
    const sumAllocated = result.reduce((sum, item) => sum + item.allocatedPaise, 0);

    expect(sumAllocated).toBe(totalPaise);
    expect(result).toHaveLength(3);
  });

  it('handles zero or negative budget gracefully', () => {
    const shares = [{ key: 'venue', sharePercent: 100, position: 1 }];
    const resultZero = splitMoneyLargestRemainder(0, shares);
    expect(resultZero[0].allocatedPaise).toBe(0);

    const resultNeg = splitMoneyLargestRemainder(-500, shares);
    expect(resultNeg[0].allocatedPaise).toBe(0);
  });

  it('formats paise into Indian Rupee strings and compact notation', () => {
    const paise = rupeesToPaise(1800000); // 18 Lakhs
    expect(formatPaise(paise)).toBe('₹18,00,000');
    expect(formatPaise(paise, { compact: true })).toBe('₹18 L');

    const crorePaise = rupeesToPaise(15000000); // 1.5 Cr
    expect(formatPaise(crorePaise, { compact: true })).toBe('₹1.5 Cr');
  });
});

describe('Domain: Budget Status & Metrics', () => {
  it('correctly calculates ok, warning (>=90%), and over (>100%) thresholds', () => {
    const allocated = 100000; // 1000 INR

    expect(getBudgetStatus(allocated, 85000)).toBe('ok');
    expect(getBudgetStatus(allocated, 90000)).toBe('warning');
    expect(getBudgetStatus(allocated, 99999)).toBe('warning');
    expect(getBudgetStatus(allocated, 100000)).toBe('warning');
    expect(getBudgetStatus(allocated, 100001)).toBe('over');
  });

  it('calculates committed as max(planned, quoted, paid)', () => {
    const categories = [
      { id: 'cat-1', key: 'venue', label: 'Venue', allocatedPaise: 500000, position: 1 },
    ];
    const expenses = [
      {
        id: 'e1',
        categoryId: 'cat-1',
        description: 'Deposit',
        amountPaise: 200000,
        kind: 'paid' as const,
      },
      {
        id: 'e2',
        categoryId: 'cat-1',
        description: 'Estimate',
        amountPaise: 350000,
        kind: 'planned' as const,
      },
      {
        id: 'e3',
        categoryId: 'cat-1',
        description: 'Quote',
        amountPaise: 460000,
        kind: 'quoted' as const,
      },
    ];

    const metrics = calculateBudgetMetrics(categories, expenses);
    // max(350000, 460000, 200000) = 460000 (which is 92% of 500000 -> warning)
    expect(metrics.categories[0].committedPaise).toBe(460000);
    expect(metrics.categories[0].status).toBe('warning');
    expect(metrics.categories[0].remainingPaise).toBe(40000);
  });
});

describe('Domain: Timeline & Dependencies', () => {
  it('computes due date correctly from offset days', () => {
    expect(calculateDueDate('2026-12-31', 10)).toBe('2026-12-21');
    expect(calculateDueDate('2026-01-10', 10)).toBe('2025-12-31'); // wraps back to previous year
  });

  it('detects circular dependencies via Kahn algorithm', () => {
    const normalTasks: TaskItem[] = [
      {
        id: 't1',
        title: 'Task 1',
        dependsOn: [],
        dateMode: 'relative',
        isMilestone: false,
        status: 'open',
        source: 'template',
        position: 1,
      },
      {
        id: 't2',
        title: 'Task 2',
        dependsOn: ['t1'],
        dateMode: 'relative',
        isMilestone: false,
        status: 'open',
        source: 'template',
        position: 2,
      },
    ];
    expect(detectTaskCycle(normalTasks).hasCycle).toBe(false);

    const cyclicTasks: TaskItem[] = [
      {
        id: 't1',
        title: 'Task 1',
        dependsOn: ['t3'],
        dateMode: 'relative',
        isMilestone: false,
        status: 'open',
        source: 'template',
        position: 1,
      },
      {
        id: 't2',
        title: 'Task 2',
        dependsOn: ['t1'],
        dateMode: 'relative',
        isMilestone: false,
        status: 'open',
        source: 'template',
        position: 2,
      },
      {
        id: 't3',
        title: 'Task 3',
        dependsOn: ['t2'],
        dateMode: 'relative',
        isMilestone: false,
        status: 'open',
        source: 'template',
        position: 3,
      },
    ];
    const cycleRes = detectTaskCycle(cyclicTasks);
    expect(cycleRes.hasCycle).toBe(true);
    expect(cycleRes.cycleTaskIds).toContain('t1');
    expect(cycleRes.cycleTaskIds).toContain('t2');
    expect(cycleRes.cycleTaskIds).toContain('t3');
  });

  it('blocks completion when open dependencies exist', () => {
    const allTasks: TaskItem[] = [
      {
        id: 't1',
        title: 'Venue booking',
        dependsOn: [],
        dateMode: 'relative',
        isMilestone: false,
        status: 'open',
        source: 'template',
        position: 1,
      },
      {
        id: 't2',
        title: 'Send invites',
        dependsOn: ['t1'],
        dateMode: 'relative',
        isMilestone: false,
        status: 'open',
        source: 'template',
        position: 2,
      },
    ];

    const gateOpen = checkTaskCompletionGate(allTasks[1], allTasks);
    expect(gateOpen.canComplete).toBe(false);
    expect(gateOpen.blockingTasks[0].title).toBe('Venue booking');

    allTasks[0].status = 'done';
    const gateClosed = checkTaskCompletionGate(allTasks[1], allTasks);
    expect(gateClosed.canComplete).toBe(true);
  });

  it('detects overdue tasks correctly', () => {
    expect(isTaskOverdue('2020-01-01', 'open')).toBe(true);
    expect(isTaskOverdue('2020-01-01', 'done')).toBe(false);
    expect(isTaskOverdue('2099-01-01', 'open')).toBe(false);
  });

  it('previews date shift and warns about overdue tasks', () => {
    const tasks: TaskItem[] = [
      {
        id: 't1',
        title: 'Task A',
        offsetDays: 30,
        dueDate: '2026-10-01',
        dateMode: 'relative',
        isMilestone: false,
        status: 'open',
        source: 'template',
        position: 1,
        dependsOn: [],
      },
    ];

    const preview = previewDateChange(tasks, '2026-11-01', '2026-12-01');
    expect(preview.deltaDays).toBe(30);
    expect(preview.relativeTasksShifted[0].newDueDate).toBe('2026-11-01');
  });
});

describe('Domain: Quotes Normalisation & Comparison', () => {
  it('normalizes per_plate quotes and identifies the cheapest option', () => {
    const quotes = [
      { id: 'q1', vendorId: 'v1', amountPaise: 150000, unit: 'per_plate' as const, inclusions: [] }, // ₹1500/plate * 200 = ₹3,00,000
      { id: 'q2', vendorId: 'v2', amountPaise: 25000000, unit: 'total' as const, inclusions: [] }, // ₹2,50,000 total
    ];

    const result = normalizeAndCompareQuotes(quotes, 200);
    expect(result[0].totalCalculatedPaise).toBe(30000000);
    expect(result[1].totalCalculatedPaise).toBe(25000000);
    expect(result[1].isCheapest).toBe(true);
    expect(result[0].isCheapest).toBe(false);
  });
});

describe('Domain: Guests & Dietary Validation', () => {
  it('validates diet breakdown sum matches expected total', () => {
    const breakdown = { veg: 100, nonVeg: 50, jain: 30, eggetarian: 20, vegan: 0 };
    const valid = validateDietaryCounts(200, breakdown);
    expect(valid.valid).toBe(true);
    expect(valid.difference).toBe(0);

    const invalid = validateDietaryCounts(250, breakdown);
    expect(invalid.valid).toBe(false);
    expect(invalid.difference).toBe(-50);
  });

  it('checks dietary coverage against menu ideas', () => {
    const breakdown = { veg: 100, nonVeg: 50, jain: 20, eggetarian: 0, vegan: 0 };
    const ideas = [
      {
        id: 'i1',
        kind: 'menu' as const,
        title: 'Dal Baati',
        dietTags: ['veg', 'jain'],
        source: 'user' as const,
      },
    ];

    const coverage = checkDietaryCoverage(breakdown, ideas);
    expect(coverage.coveredDiets).toContain('veg');
    expect(coverage.coveredDiets).toContain('jain');
    expect(coverage.uncoveredDiets).toContain('nonVeg');
    expect(coverage.isFullyCovered).toBe(false);
  });
});

describe('Domain: Schedule Overlaps', () => {
  it('detects overlapping time blocks within the same function', () => {
    const items = [
      {
        id: 's1',
        functionId: 'fn1',
        startTime: '18:00',
        durationMin: 60,
        title: 'Toast',
        position: 1,
      },
      {
        id: 's2',
        functionId: 'fn1',
        startTime: '18:30',
        durationMin: 45,
        title: 'Cake Cutting',
        position: 2,
      },
      {
        id: 's3',
        functionId: 'fn2',
        startTime: '18:00',
        durationMin: 60,
        title: 'Welcome',
        position: 1,
      },
    ];

    const overlaps = detectScheduleOverlaps(items);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].itemA.id).toBe('s1');
    expect(overlaps[0].itemB.id).toBe('s2');
  });
});

describe('Domain: Templates & CSV Export', () => {
  it('generates a valid plan from canonical wedding template', () => {
    const plan = generatePlanFromTemplate({
      type: 'wedding',
      title: 'Ananya & Kabir Wedding',
      eventDate: '2026-12-15',
      guestEstimate: 200,
      budgetTotalPaise: 200000000,
    });

    expect(plan.event.title).toBe('Ananya & Kabir Wedding');
    expect(plan.budgetCategories.length).toBeGreaterThan(5);
    expect(plan.tasks.length).toBeGreaterThan(5);
    expect(plan.schemaVersion).toBe(1);
  });

  it('escapes Excel formula injection characters in CSV cells', () => {
    expect(escapeCsvCell('=SUM(A1:A10)')).toBe(`'=SUM(A1:A10)`);
    expect(escapeCsvCell('+12345')).toBe(`'+12345`);
    expect(escapeCsvCell('-cmd /c calc')).toBe(`'-cmd /c calc`);
    expect(escapeCsvCell('@evil')).toBe(`'@evil`);
    expect(escapeCsvCell('Normal Title')).toBe('Normal Title');
    expect(escapeCsvCell('Hello, "World"')).toBe('"Hello, ""World"""');
  });

  it('generates valid budget and tasks CSV with UTF-8 BOM', () => {
    const plan = generatePlanFromTemplate({
      type: 'wedding',
      title: 'Test Plan',
      eventDate: '2026-11-20',
      guestEstimate: 100,
      budgetTotalPaise: 100000000,
    });

    const budgetCsv = generateBudgetCsv(plan);
    expect(budgetCsv.startsWith('\uFEFF')).toBe(true);
    expect(budgetCsv).toContain('Category,Allocated (INR),Committed (INR)');

    const tasksCsv = generateTasksCsv(plan);
    expect(tasksCsv.startsWith('\uFEFF')).toBe(true);
    expect(tasksCsv).toContain('Task Title,Category,Due Date');

    const dietaryCsv = generateDietaryCsv(plan);
    expect(dietaryCsv.startsWith('\uFEFF')).toBe(true);
    expect(dietaryCsv).toContain('TORANLY EVENT DIETARY & ACCESSIBILITY BRIEF');
    expect(dietaryCsv).toContain('Pure Veg');
    expect(dietaryCsv).toContain('Jain');
  });
});
