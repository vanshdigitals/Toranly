import { describe, expect, it } from 'vitest';
import type { AiItem } from '../../api/ai';
import { applyAiItems, describeAiItem, previewAiChanges } from '../aiApply';
import { generatePlanFromTemplate } from '../templates';

const plan = generatePlanFromTemplate({
  id: 'p1',
  type: 'wedding',
  title: 'Test wedding',
  eventDate: '2027-03-14',
  city: 'Pune',
  guestEstimate: 180,
  budgetTotalPaise: 100_000_00, // ₹1,00,000
});

const venueShare: AiItem = {
  kind: 'budget_share',
  category_key: 'venue',
  label: 'Venue',
  share_pct: 40,
  rationale: 'Venues are the largest cost.',
};
const task: AiItem = {
  kind: 'task',
  title: 'Book mehendi artist',
  offset_days: 30,
  category_key: 'decor',
  is_milestone: false,
  depends_on_titles: [],
};
const menu: AiItem = {
  kind: 'menu_item',
  course: 'main',
  dish_name: 'Paneer tikka',
  diet_tags: ['veg', 'jain'],
  allergen_notes: 'Dairy',
};
const saving: AiItem = {
  kind: 'saving_idea',
  category_key: 'decor',
  idea: 'Reuse ceremony flowers at the reception',
  estimate_saving_inr_min: 5000,
  estimate_saving_inr_max: 12000,
  trade_off: 'Less variety',
};

describe('applyAiItems', () => {
  it('sets an existing category from the AI share and marks it as an AI idea', () => {
    const next = applyAiItems(plan, [venueShare]);
    const venue = next.budgetCategories.find((c) => c.key === 'venue')!;
    expect(venue.allocatedPaise).toBe(40_000_00);
    expect(venue.source).toBe('ai');
    expect(next.budgetCategories).toHaveLength(plan.budgetCategories.length);
  });

  it('adds tasks with source "ai" and a due date counted back from the event', () => {
    const next = applyAiItems(plan, [task]);
    const added = next.tasks.find((t) => t.title === 'Book mehendi artist')!;
    expect(added.source).toBe('ai');
    expect(added.dueDate).toBe('2027-02-12');
    expect(next.tasks).toHaveLength(plan.tasks.length + 1);
  });

  it('does not duplicate a task that already exists', () => {
    const existing = { ...task, title: plan.tasks[0].title };
    expect(applyAiItems(plan, [existing]).tasks).toHaveLength(plan.tasks.length);
  });

  it('adds menu and saving items to Ideas as AI ideas with paise estimates', () => {
    const next = applyAiItems(plan, [menu, saving]);
    const [dish, save] = next.ideas.slice(-2);
    expect(dish).toMatchObject({ kind: 'menu', title: 'Paneer tikka', source: 'ai' });
    expect(dish.dietTags).toEqual(['veg', 'jain']);
    expect(save).toMatchObject({ kind: 'saving', estimateMinPaise: 500000, source: 'ai' });
  });

  it('skips schedule items for a function the plan does not have', () => {
    const item: AiItem = {
      kind: 'schedule_item',
      function_name: 'Not a function',
      start_time: '10:00',
      duration_min: 30,
      title: 'Welcome',
    };
    expect(applyAiItems(plan, [item]).scheduleItems).toHaveLength(0);
    expect(previewAiChanges(plan, [item])[0].text).toMatch(/^Skipped/);
  });

  it('never changes the plan it was given', () => {
    const before = JSON.stringify(plan);
    applyAiItems(plan, [venueShare, task, menu]);
    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe('previewAiChanges', () => {
  it('shows the current and new amount for budget changes', () => {
    const [change] = previewAiChanges(plan, [venueShare]);
    expect(change.target).toBe('budget');
    expect(change.from).toBeTruthy();
    expect(change.to).toBe(describeAiItem(venueShare, plan).estimate);
  });
});
