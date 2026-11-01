import type { Plan } from '../domain/plan';

/**
 * The only plan data that leaves the browser for AI suggestions (AI_SCHEMAS.md §2, NFR-10).
 * Never included: notes (preferences, tasks, expenses, vendors), guest or vendor names,
 * phone numbers, emails, or the exact event date. The server rejects any other field.
 */
export interface PlanContext {
  event_type: Plan['event']['type'];
  month: string;
  days_until_event: number;
  city: string | null;
  guest_band: '1-25' | '26-75' | '76-150' | '151-300' | '301-600' | '600+';
  budget_total_inr: number;
  diet_counts: Partial<Record<DietGroup, number>>;
  functions: string[];
  preferences: {
    theme_words: string[];
    diet_focus: DietGroup[];
    customs: string[];
    avoid_colours: string[];
  };
  existing_category_keys: string[];
  existing_task_titles: string[];
  rejected_reasons: string[];
}

type DietGroup = 'veg' | 'non_veg' | 'jain' | 'eggetarian' | 'vegan';

const DIET_GROUPS: Record<string, DietGroup> = {
  veg: 'veg',
  nonveg: 'non_veg',
  'non-veg': 'non_veg',
  non_veg: 'non_veg',
  jain: 'jain',
  eggetarian: 'eggetarian',
  vegan: 'vegan',
};

function guestBand(count: number): PlanContext['guest_band'] {
  if (count <= 25) return '1-25';
  if (count <= 75) return '26-75';
  if (count <= 150) return '76-150';
  if (count <= 300) return '151-300';
  if (count <= 600) return '301-600';
  return '600+';
}

function clip(values: string[], maxItems: number, maxLength: number): string[] {
  return values
    .map((v) => v.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function buildPlanContext(plan: Plan, today: string): PlanContext {
  const { event } = plan;
  const eventDate = event.eventDate ?? today;
  const guests = plan.guests;
  const dietCounts: PlanContext['diet_counts'] = {};
  if (guests) {
    const entries: [DietGroup, number][] = [
      ['veg', guests.veg],
      ['non_veg', guests.nonVeg],
      ['jain', guests.jain],
      ['eggetarian', guests.eggetarian],
      ['vegan', guests.vegan],
    ];
    for (const [group, count] of entries) if (count > 0) dietCounts[group] = count;
  }
  const dietFocus = Array.from(
    new Set(
      event.preferences.dietFocus
        .map((d) => DIET_GROUPS[d.toLowerCase().trim()])
        .filter((d): d is DietGroup => Boolean(d)),
    ),
  ).slice(0, 5);

  return {
    event_type: event.type,
    month: eventDate.slice(0, 7),
    days_until_event: Math.min(1500, Math.max(0, daysBetween(today, eventDate))),
    city: event.city ? event.city.slice(0, 80) : null,
    guest_band: guestBand(guests?.total || event.guestEstimate),
    budget_total_inr: Math.floor((event.budgetTotalPaise ?? 0) / 100),
    diet_counts: dietCounts,
    functions: clip(
      plan.functions.map((f) => f.name),
      10,
      60,
    ),
    preferences: {
      theme_words: clip(event.preferences.themeWords, 5, 30),
      diet_focus: dietFocus,
      customs: clip(event.preferences.customs, 10, 40),
      avoid_colours: clip(event.preferences.avoidColours, 5, 20),
    },
    existing_category_keys: plan.budgetCategories
      .map((c) => c.key)
      .filter((k) => /^[a-z_]{2,30}$/.test(k))
      .slice(0, 60),
    existing_task_titles: clip(
      plan.tasks.map((t) => t.title),
      200,
      120,
    ),
    rejected_reasons: [],
  };
}
