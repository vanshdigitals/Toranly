/**
 * Turns validated AI items (AI_SCHEMAS.md §4, snake_case as the backend returns them) into
 * changes to the local plan. Nothing here talks to the network: the AI plan tab shows
 * `describeAiItem` and `previewAiChanges` for review, then `applyAiItems` writes everything
 * the visitor accepted in one step.
 */
import type { AiItem } from '../api/ai';
import type { BudgetCategory, IdeaItem, IdeaKind, Plan, ScheduleItem, TaskItem } from './plan';
import { formatPaise } from './money';
import { calculateDueDate } from './timeline';

/** Where an accepted item lands in the planner. */
export type AiTarget = 'budget' | 'timeline' | 'ideas' | 'schedule';

export interface AiItemView {
  title: string;
  detail?: string;
  /** Money estimate text; always shown with an "Estimate" chip. */
  estimate?: string;
  target: AiTarget;
}

const TARGET_LABEL: Record<AiTarget, string> = {
  budget: 'Budget',
  timeline: 'Timeline',
  ideas: 'Ideas',
  schedule: 'Schedule',
};

export function targetLabel(target: AiTarget): string {
  return TARGET_LABEL[target];
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

function inrRange(min: number | null, max: number | null): string | undefined {
  if (min === null && max === null) return undefined;
  const lo = formatPaise(Math.round((min ?? max ?? 0) * 100));
  const hi = formatPaise(Math.round((max ?? min ?? 0) * 100));
  return lo === hi ? lo : `${lo} – ${hi}`;
}

/** Budget base for AI shares: the plan's total, or the sum of allocations without one. */
function budgetBase(plan: Plan): number {
  return (
    plan.event.budgetTotalPaise ??
    plan.budgetCategories.reduce((sum, c) => sum + c.allocatedPaise, 0)
  );
}

function shareToPaise(plan: Plan, sharePct: number): number {
  return Math.round((budgetBase(plan) * sharePct) / 100);
}

export function describeAiItem(item: AiItem, plan: Plan): AiItemView {
  switch (item.kind) {
    case 'budget_share': {
      const pct = num(item.share_pct) ?? 0;
      return {
        title: `${str(item.label)}: ${pct}% of budget`,
        detail: str(item.rationale),
        estimate: formatPaise(shareToPaise(plan, pct)),
        target: 'budget',
      };
    }
    case 'task': {
      const offset = num(item.offset_days);
      const deps = strings(item.depends_on_titles);
      return {
        title: str(item.title),
        detail: [
          offset !== null ? `${offset} days before the celebration` : '',
          item.is_milestone ? 'Milestone' : '',
          deps.length ? `After: ${deps.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        target: 'timeline',
      };
    }
    case 'vendor_category': {
      const qs = strings(item.questions_to_ask);
      return {
        title: `Book ${str(item.label)}`,
        detail: [
          `${num(item.book_by_offset_days) ?? 0} days before the celebration`,
          qs.length ? `Ask: ${qs.join(' ')}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        target: 'timeline',
      };
    }
    case 'schedule_item':
      return {
        title: `${str(item.start_time)} ${str(item.title)}`,
        detail: `${str(item.function_name)} · ${num(item.duration_min) ?? 0} min`,
        target: 'schedule',
      };
    default: {
      const idea = aiItemToIdea(item, 'preview');
      return {
        title: idea.title,
        detail: idea.body,
        estimate: inrRange(
          num(item.estimate_inr_min ?? item.estimate_saving_inr_min),
          num(item.estimate_inr_max ?? item.estimate_saving_inr_max),
        ),
        target: 'ideas',
      };
    }
  }
}

/** An AI theme, decor, menu or saving item as an Idea (source "ai"). */
export function aiItemToIdea(item: AiItem, id: string): IdeaItem {
  let kind: IdeaKind = 'other';
  let title = str(item.title);
  let body = str(item.description);
  if (item.kind === 'theme_idea') {
    kind = 'theme';
    const palette = strings(item.palette_words);
    if (palette.length) body = `${body} Palette: ${palette.join(', ')}.`.trim();
  } else if (item.kind === 'decor_idea') {
    kind = 'decor';
  } else if (item.kind === 'menu_item') {
    kind = 'menu';
    title = str(item.dish_name);
    body = [str(item.course).replace('_', ' '), str(item.allergen_notes)]
      .filter(Boolean)
      .join(' · ');
  } else if (item.kind === 'saving_idea') {
    kind = 'saving';
    title = str(item.idea);
    body = str(item.trade_off);
  }
  const min = num(item.estimate_inr_min ?? item.estimate_saving_inr_min);
  const max = num(item.estimate_inr_max ?? item.estimate_saving_inr_max);
  return {
    id,
    kind,
    title: (title || 'Celebration idea').slice(0, 120),
    body: body || undefined,
    dietTags: item.kind === 'menu_item' ? strings(item.diet_tags) : [],
    estimateMinPaise: min !== null ? Math.round(min * 100) : undefined,
    estimateMaxPaise: max !== null ? Math.round(max * 100) : undefined,
    source: 'ai',
    confirmed: false,
  };
}

export interface AiChange {
  target: AiTarget;
  text: string;
  /** Budget changes show current and new amounts. */
  from?: string;
  to?: string;
}

/** Exactly what `applyAiItems` will change, for the confirmation dialog. */
export function previewAiChanges(plan: Plan, items: AiItem[]): AiChange[] {
  return items.map((item) => {
    if (item.kind === 'budget_share') {
      const key = str(item.category_key);
      const existing = plan.budgetCategories.find((c) => c.key === key);
      const next = formatPaise(shareToPaise(plan, num(item.share_pct) ?? 0));
      return existing
        ? {
            target: 'budget',
            text: `${existing.label} budget`,
            from: formatPaise(existing.allocatedPaise),
            to: next,
          }
        : { target: 'budget', text: `New budget category "${str(item.label)}"`, to: next };
    }
    if (item.kind === 'schedule_item') {
      const fn = findFunction(plan, str(item.function_name));
      return {
        target: 'schedule',
        text: fn
          ? `Add "${str(item.title)}" at ${str(item.start_time)} to ${fn.name}`
          : `Skipped "${str(item.title)}": add the function "${str(item.function_name)}" first`,
      };
    }
    const view = describeAiItem(item, plan);
    return { target: view.target, text: `Add "${view.title}"` };
  });
}

function findFunction(plan: Plan, name: string) {
  const wanted = name.trim().toLowerCase();
  return plan.functions.find((f) => f.name.trim().toLowerCase() === wanted);
}

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Applies the accepted items to a copy of the plan (one save, one autosave). */
export function applyAiItems(plan: Plan, items: AiItem[]): Plan {
  const budgetCategories: BudgetCategory[] = plan.budgetCategories.map((c) => ({ ...c }));
  const tasks: TaskItem[] = [...plan.tasks];
  const ideas: IdeaItem[] = [...plan.ideas];
  const scheduleItems: ScheduleItem[] = [...plan.scheduleItems];
  const titleKey = (t: string) => t.trim().toLowerCase();

  const addTask = (task: Omit<TaskItem, 'id' | 'position' | 'status' | 'dateMode' | 'source'>) => {
    if (tasks.some((t) => titleKey(t.title) === titleKey(task.title))) return;
    tasks.push({
      ...task,
      id: uid('task'),
      position: tasks.length + 1,
      status: 'open',
      dateMode: 'relative',
      source: 'ai',
    });
  };
  const dueFor = (offset: number) =>
    plan.event.eventDate ? calculateDueDate(plan.event.eventDate, offset) : undefined;

  for (const item of items) {
    if (item.kind === 'budget_share') {
      const key = str(item.category_key);
      const allocatedPaise = shareToPaise(plan, num(item.share_pct) ?? 0);
      const existing = budgetCategories.find((c) => c.key === key);
      if (existing) {
        existing.allocatedPaise = allocatedPaise;
        existing.source = 'ai';
      } else {
        budgetCategories.push({
          id: `cat-${key}-${plan.id}`,
          key,
          label: str(item.label) || key,
          allocatedPaise,
          position: budgetCategories.length + 1,
          source: 'ai',
        });
      }
    } else if (item.kind === 'task') {
      const offset = num(item.offset_days) ?? 0;
      const deps = strings(item.depends_on_titles).map(titleKey);
      addTask({
        title: str(item.title).slice(0, 120),
        categoryKey: str(item.category_key) || undefined,
        offsetDays: offset,
        dueDate: dueFor(offset),
        isMilestone: item.is_milestone === true,
        dependsOn: tasks.filter((t) => deps.includes(titleKey(t.title))).map((t) => t.id),
      });
    } else if (item.kind === 'vendor_category') {
      const offset = num(item.book_by_offset_days) ?? 0;
      const qs = strings(item.questions_to_ask);
      addTask({
        title: `Book ${str(item.label)}`.slice(0, 120),
        categoryKey: str(item.category_key) || undefined,
        offsetDays: offset,
        dueDate: dueFor(offset),
        isMilestone: false,
        dependsOn: [],
        notes: qs.length ? `Questions to ask: ${qs.join(' ')}` : undefined,
      });
    } else if (item.kind === 'schedule_item') {
      const fn = findFunction(plan, str(item.function_name));
      if (!fn) continue;
      scheduleItems.push({
        id: uid('sched'),
        functionId: fn.id,
        startTime: str(item.start_time),
        durationMin: num(item.duration_min) ?? 30,
        title: str(item.title).slice(0, 120),
        position: scheduleItems.filter((s) => s.functionId === fn.id).length + 1,
      });
    } else {
      ideas.push(aiItemToIdea(item, uid('idea')));
    }
  }

  return { ...plan, budgetCategories, tasks, ideas, scheduleItems };
}
