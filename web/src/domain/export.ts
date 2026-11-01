import type { Plan } from './plan';
import { calculateBudgetMetrics } from './budget';
import { paiseToRupees } from './money';

/**
 * Escapes values against Excel/CSV formula injection attacks.
 * Any string starting with =, +, -, @ is prepended with a single quote.
 * Proper CSV double-quote wrapping is applied.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Formula injection check: starts with =, +, -, @
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // If cell contains commas, quotes, or newlines, wrap in quotes and escape inner quotes
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates a clean UTF-8 encoded CSV for the plan's budget.
 */
export function generateBudgetCsv(plan: Plan): string {
  const metrics = calculateBudgetMetrics(plan.budgetCategories, plan.expenses);

  const headers = [
    'Category',
    'Allocated (INR)',
    'Committed (INR)',
    'Paid (INR)',
    'Remaining (INR)',
    'Status',
  ];

  const rows: string[][] = [headers];

  for (const cat of metrics.categories) {
    rows.push([
      cat.label,
      paiseToRupees(cat.allocatedPaise).toFixed(2),
      paiseToRupees(cat.committedPaise).toFixed(2),
      paiseToRupees(cat.paidPaise).toFixed(2),
      paiseToRupees(cat.remainingPaise).toFixed(2),
      cat.status.toUpperCase(),
    ]);
  }

  // Total summary row
  rows.push([
    'TOTAL',
    paiseToRupees(metrics.totalAllocatedPaise).toFixed(2),
    paiseToRupees(metrics.totalCommittedPaise).toFixed(2),
    paiseToRupees(metrics.totalPaidPaise).toFixed(2),
    paiseToRupees(metrics.totalRemainingPaise).toFixed(2),
    metrics.overallStatus.toUpperCase(),
  ]);

  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  // UTF-8 BOM for Microsoft Excel compatibility
  return `\uFEFF${csvBody}`;
}

/**
 * Generates a clean UTF-8 encoded CSV for the plan's task checklist.
 */
export function generateTasksCsv(plan: Plan): string {
  const taskMap = new Map<string, string>();
  for (const t of plan.tasks) {
    taskMap.set(t.id, t.title);
  }

  const headers = ['Task Title', 'Category', 'Due Date', 'Status', 'Milestone', 'Dependencies'];
  const rows: string[][] = [headers];

  for (const t of plan.tasks) {
    const depTitles = (t.dependsOn || []).map((id) => taskMap.get(id) || id).join('; ');

    rows.push([
      t.title,
      t.categoryKey || 'General',
      t.dueDate || 'Unscheduled',
      t.status.toUpperCase(),
      t.isMilestone ? 'YES' : 'NO',
      depTitles,
    ]);
  }

  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  return `\uFEFF${csvBody}`;
}

/**
 * Generates a clean UTF-8 encoded CSV for the plan's dietary breakdown and accessibility.
 */
export function generateDietaryCsv(plan: Plan): string {
  const g = plan.guests;
  const total = plan.event.guestEstimate || (g ? g.total : 0) || 0;
  const veg = g ? g.veg : 0;
  const nonVeg = g ? g.nonVeg : 0;
  const jain = g ? g.jain : 0;
  const eggetarian = g ? g.eggetarian : 0;
  const vegan = g ? g.vegan : 0;

  const rows: string[][] = [
    ['TORANLY EVENT DIETARY & ACCESSIBILITY BRIEF'],
    ['Event Name', plan.event.title],
    ['Date', plan.event.eventDate || ''],
    ['City', plan.event.city || ''],
    ['Total Headcount', String(total)],
    [],
    ['Dietary Group', 'Headcount', 'Percentage of Total', 'Preparation / Chef Notes'],
    [
      'Pure Veg',
      String(veg),
      total > 0 ? `${Math.round((veg / total) * 100)}%` : '0%',
      'Standard Indian vegetarian',
    ],
    [
      'Non-Veg',
      String(nonVeg),
      total > 0 ? `${Math.round((nonVeg / total) * 100)}%` : '0%',
      'Halal / separate grill & cookware',
    ],
    [
      'Jain',
      String(jain),
      total > 0 ? `${Math.round((jain / total) * 100)}%` : '0%',
      'Strict no onion, garlic, or root vegetables',
    ],
    [
      'Eggetarian',
      String(eggetarian),
      total > 0 ? `${Math.round((eggetarian / total) * 100)}%` : '0%',
      'Vegetarian with eggs allowed (bakery / breakfast)',
    ],
    [
      'Vegan',
      String(vegan),
      total > 0 ? `${Math.round((vegan / total) * 100)}%` : '0%',
      '100% plant-based / zero dairy / zero ghee',
    ],
    [],
    ['ALLERGIES & FOOD SENSITIVITIES'],
    [
      'Allergy Tags',
      g?.allergyTags && g.allergyTags.length > 0 ? g.allergyTags.join('; ') : 'None listed',
    ],
    [],
    ['ACCESSIBILITY & VENUE SUPPORT REQUIREMENTS'],
    ['Requirement', 'Status'],
  ];

  const accessibilityOptions = [
    {
      id: 'ramps',
      label: 'Step-free access & ramps (Mandap entrance, dining courtyard, and restroom corridors)',
    },
    {
      id: 'seating',
      label: 'Seating support & front-row low chairs (Reserved cushioned chairs near havan kund)',
    },
    { id: 'hearing', label: 'Hearing loop / amplified audio near mandap (Clear ceremonial audio)' },
    {
      id: 'visual',
      label: 'Visual assistance & high-contrast signage (Legible dietary markers at live counters)',
    },
    {
      id: 'transit',
      label: 'Elderly mobility transit golf carts (Shuttle between parking and reception)',
    },
  ];

  for (const opt of accessibilityOptions) {
    const isChecked =
      (g?.accessibilityNeeds || []).includes(opt.id) ||
      (g?.accessibilityNeeds || []).includes(opt.label);
    rows.push([opt.label, isChecked ? 'REQUIRED' : 'NOT REQUESTED']);
  }

  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  return `\uFEFF${csvBody}`;
}

/**
 * Helper to download CSV string in browser.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
