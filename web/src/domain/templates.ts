import type { CanonicalEventType, Plan, BudgetCategory, TaskItem, FunctionItem } from './plan';
import { PlanSchema } from './plan';
import type { TemplateResponse } from '../api/plan';
import { splitMoneyLargestRemainder } from './money';
import { calculateDueDate } from './timeline';

export interface TemplateDefinition {
  shares: { key: string; label: string; sharePercent: number; position: number }[];
  functions: { name: string; offsetDays: number; startTime: string; endTime: string }[];
  tasks: {
    title: string;
    categoryKey: string;
    offsetDays: number;
    isMilestone: boolean;
    dependsOnIndexes?: number[];
  }[];
}

export const CANONICAL_TEMPLATES: Record<CanonicalEventType, TemplateDefinition> = {
  wedding: {
    shares: [
      { key: 'venue', label: 'Venue & Stays', sharePercent: 28, position: 1 },
      { key: 'catering', label: 'Catering & Dining', sharePercent: 30, position: 2 },
      { key: 'decor', label: 'Decor & Mandap', sharePercent: 14, position: 3 },
      { key: 'attire', label: 'Attire & Jewellery', sharePercent: 10, position: 4 },
      { key: 'photo', label: 'Photography & Film', sharePercent: 8, position: 5 },
      { key: 'entertainment', label: 'Music & Sangeet', sharePercent: 4, position: 6 },
      { key: 'invitations', label: 'Invitations & Favours', sharePercent: 3, position: 7 },
      { key: 'contingency', label: 'Contingency Fund', sharePercent: 3, position: 8 },
    ],
    functions: [
      { name: 'Mehendi & High Tea', offsetDays: 2, startTime: '16:00', endTime: '20:30' },
      { name: 'Sangeet & Cocktail', offsetDays: 1, startTime: '19:30', endTime: '23:45' },
      { name: 'Wedding & Pheras', offsetDays: 0, startTime: '10:00', endTime: '15:00' },
      { name: 'Evening Reception', offsetDays: 0, startTime: '19:30', endTime: '23:30' },
    ],
    tasks: [
      {
        title: 'Shortlist and visit shortlisted venues',
        categoryKey: 'venue',
        offsetDays: 120,
        isMilestone: false,
      },
      {
        title: 'Lock in main venue & dates',
        categoryKey: 'venue',
        offsetDays: 110,
        isMilestone: true,
        dependsOnIndexes: [0],
      },
      {
        title: 'Shortlist candid photographer & videographer',
        categoryKey: 'photo',
        offsetDays: 95,
        isMilestone: false,
      },
      {
        title: 'Book photography team with deposit',
        categoryKey: 'photo',
        offsetDays: 85,
        isMilestone: true,
        dependsOnIndexes: [2],
      },
      {
        title: 'Finalise caterer tasting and menu items',
        categoryKey: 'catering',
        offsetDays: 70,
        isMilestone: true,
      },
      {
        title: 'Send invitations with RSVP links',
        categoryKey: 'invitations',
        offsetDays: 60,
        isMilestone: true,
      },
      {
        title: 'Select bridal attire and schedule first fitting',
        categoryKey: 'attire',
        offsetDays: 45,
        isMilestone: false,
      },
      {
        title: 'Finalise decor stage layout and floral palettes',
        categoryKey: 'decor',
        offsetDays: 30,
        isMilestone: false,
      },
      {
        title: 'Confirm sangeet playlist and sound rehearsal',
        categoryKey: 'entertainment',
        offsetDays: 14,
        isMilestone: false,
      },
      {
        title: 'Final walkthrough with day-of coordinator',
        categoryKey: 'venue',
        offsetDays: 3,
        isMilestone: true,
      },
    ],
  },
  engagement: {
    shares: [
      { key: 'venue', label: 'Venue & Hospitality', sharePercent: 32, position: 1 },
      { key: 'catering', label: 'Food & Bar', sharePercent: 35, position: 2 },
      { key: 'decor', label: 'Stage & Ambient Decor', sharePercent: 15, position: 3 },
      { key: 'attire', label: 'Attire & Rings', sharePercent: 10, position: 4 },
      { key: 'contingency', label: 'Contingency Reserve', sharePercent: 8, position: 5 },
    ],
    functions: [
      { name: 'Ring Ceremony & Dinner', offsetDays: 0, startTime: '18:30', endTime: '23:00' },
    ],
    tasks: [
      {
        title: 'Select engagement venue and banquet hall',
        categoryKey: 'venue',
        offsetDays: 60,
        isMilestone: true,
      },
      {
        title: 'Choose rings and celebratory attire',
        categoryKey: 'attire',
        offsetDays: 45,
        isMilestone: false,
      },
      {
        title: 'Book candid photographer for ceremony',
        categoryKey: 'photo',
        offsetDays: 35,
        isMilestone: false,
      },
      {
        title: 'Send digital invitations and collect RSVPs',
        categoryKey: 'invitations',
        offsetDays: 28,
        isMilestone: true,
      },
      {
        title: 'Confirm menu tastings and live food stations',
        categoryKey: 'catering',
        offsetDays: 12,
        isMilestone: true,
      },
    ],
  },
  birthday: {
    shares: [
      { key: 'venue', label: 'Party Venue', sharePercent: 25, position: 1 },
      { key: 'catering', label: 'Catering & Beverages', sharePercent: 35, position: 2 },
      { key: 'cake', label: 'Custom Cake & Treats', sharePercent: 12, position: 3 },
      { key: 'decor', label: 'Theme Decor & Balloons', sharePercent: 10, position: 4 },
      { key: 'entertainment', label: 'Host, Games & Music', sharePercent: 10, position: 5 },
      { key: 'gifts', label: 'Return Favours', sharePercent: 5, position: 6 },
      { key: 'contingency', label: 'Contingency Reserve', sharePercent: 3, position: 7 },
    ],
    functions: [
      { name: 'Birthday Celebration & Party', offsetDays: 0, startTime: '17:00', endTime: '21:30' },
    ],
    tasks: [
      {
        title: 'Pick party theme and reserve venue',
        categoryKey: 'venue',
        offsetDays: 30,
        isMilestone: true,
      },
      {
        title: 'Order custom birthday cake and flavour tasting',
        categoryKey: 'cake',
        offsetDays: 18,
        isMilestone: false,
      },
      {
        title: 'Send party invitations with RSVP deadline',
        categoryKey: 'invitations',
        offsetDays: 16,
        isMilestone: true,
      },
      {
        title: 'Book entertainer / games host / DJ',
        categoryKey: 'entertainment',
        offsetDays: 12,
        isMilestone: false,
      },
      {
        title: 'Purchase party favours and return gifts',
        categoryKey: 'gifts',
        offsetDays: 7,
        isMilestone: false,
      },
      {
        title: 'Confirm final headcount with catering',
        categoryKey: 'catering',
        offsetDays: 3,
        isMilestone: true,
      },
    ],
  },
  anniversary: {
    shares: [
      { key: 'venue', label: 'Celebration Banquet', sharePercent: 45, position: 1 },
      { key: 'decor', label: 'Floral & Ambient Styling', sharePercent: 20, position: 2 },
      { key: 'photo', label: 'Photography & Album', sharePercent: 15, position: 3 },
      { key: 'gifts', label: 'Mementos & Gifts', sharePercent: 10, position: 4 },
      { key: 'contingency', label: 'Contingency Reserve', sharePercent: 10, position: 5 },
    ],
    functions: [
      { name: 'Anniversary Dinner & Toast', offsetDays: 0, startTime: '19:00', endTime: '23:00' },
    ],
    tasks: [
      {
        title: 'Reserve private dining space or banquet',
        categoryKey: 'venue',
        offsetDays: 35,
        isMilestone: true,
      },
      {
        title: 'Curate nostalgic photo presentation / video',
        categoryKey: 'photo',
        offsetDays: 20,
        isMilestone: false,
      },
      {
        title: 'Send invitations to family and close friends',
        categoryKey: 'invitations',
        offsetDays: 18,
        isMilestone: true,
      },
      {
        title: 'Confirm special anniversary cake and floral centerpiece',
        categoryKey: 'decor',
        offsetDays: 8,
        isMilestone: false,
      },
    ],
  },
  community: {
    shares: [
      { key: 'venue', label: 'Grounds & Sound Infrastructure', sharePercent: 35, position: 1 },
      { key: 'catering', label: 'Community Feasts & Refreshments', sharePercent: 30, position: 2 },
      { key: 'decor', label: 'Marquee, Seating & Lighting', sharePercent: 15, position: 3 },
      { key: 'permits', label: 'Permits, Security & Sanitation', sharePercent: 12, position: 4 },
      { key: 'contingency', label: 'Contingency Fund', sharePercent: 8, position: 5 },
    ],
    functions: [
      { name: 'Community Festival / Utsav', offsetDays: 0, startTime: '09:00', endTime: '21:00' },
    ],
    tasks: [
      {
        title: 'Obtain venue clearance and local municipality permits',
        categoryKey: 'permits',
        offsetDays: 45,
        isMilestone: true,
      },
      {
        title: 'Arrange sound equipment, stage lighting, and generator backup',
        categoryKey: 'venue',
        offsetDays: 30,
        isMilestone: false,
      },
      {
        title: 'Finalise community dining and prasadam preparation plan',
        categoryKey: 'catering',
        offsetDays: 20,
        isMilestone: false,
      },
      {
        title: 'Organise volunteer coordination briefing',
        categoryKey: 'permits',
        offsetDays: 10,
        isMilestone: true,
      },
      {
        title: 'Stage soundcheck and seating setup review',
        categoryKey: 'venue',
        offsetDays: 2,
        isMilestone: false,
      },
    ],
  },
  family: {
    shares: [
      { key: 'catering', label: 'Feast & Traditional Delicacies', sharePercent: 40, position: 1 },
      { key: 'venue', label: 'Venue & Accommodation', sharePercent: 25, position: 2 },
      { key: 'decor', label: 'Traditional Decor & Lighting', sharePercent: 15, position: 3 },
      { key: 'gifts', label: 'Family Mementos & Shagun', sharePercent: 10, position: 4 },
      { key: 'contingency', label: 'Contingency Reserve', sharePercent: 10, position: 5 },
    ],
    functions: [
      {
        name: 'Family Gathering & Festive Meal',
        offsetDays: 0,
        startTime: '11:30',
        endTime: '16:30',
      },
    ],
    tasks: [
      {
        title: 'Confirm gathering venue or home preparation',
        categoryKey: 'venue',
        offsetDays: 40,
        isMilestone: true,
      },
      {
        title: 'Coordinate family travel logistics and stay',
        categoryKey: 'venue',
        offsetDays: 25,
        isMilestone: false,
      },
      {
        title: 'Curate multi-generation family feast menu',
        categoryKey: 'catering',
        offsetDays: 20,
        isMilestone: false,
      },
      {
        title: 'Order festive toran and flower garlands',
        categoryKey: 'decor',
        offsetDays: 6,
        isMilestone: false,
      },
      {
        title: 'Prepare welcome gifts and shagun hampers',
        categoryKey: 'gifts',
        offsetDays: 3,
        isMilestone: true,
      },
    ],
  },
};

export interface PlanGenerationInput {
  id?: string;
  type: CanonicalEventType;
  title: string;
  eventDate: string;
  city?: string;
  guestEstimate?: number;
  budgetTotalPaise?: number;
  preferences?: {
    themeWords?: string[];
    dietFocus?: string[];
    customs?: string[];
    avoidColours?: string[];
    notes?: string;
  };
  dietBreakdown?: {
    veg: number;
    nonVeg: number;
    jain: number;
    eggetarian: number;
    vegan: number;
  };
}

/**
 * Deterministically constructs a complete, valid Plan document from template definitions.
 */
export function generatePlanFromTemplate(input: PlanGenerationInput): Plan {
  const tpl = CANONICAL_TEMPLATES[input.type] || CANONICAL_TEMPLATES.wedding;
  const now = new Date().toISOString();
  const planId =
    input.id || `plan-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const totalPaise = input.budgetTotalPaise ?? null;

  // 1. Split budget with largest remainder method
  const splitCategories = splitMoneyLargestRemainder(totalPaise ?? 0, tpl.shares);

  const budgetCategories: BudgetCategory[] = splitCategories.map((s, idx) => ({
    id: `cat-${s.key}-${planId}`,
    key: s.key,
    label: s.key.charAt(0).toUpperCase() + s.key.slice(1),
    allocatedPaise: s.allocatedPaise,
    position: idx + 1,
  }));

  // Re-attach human-readable labels from template
  for (const cat of budgetCategories) {
    const orig = tpl.shares.find((sh) => sh.key === cat.key);
    if (orig) cat.label = orig.label;
  }

  // 2. Compute functions
  const functions: FunctionItem[] = tpl.functions.map((f, idx) => ({
    id: `fn-${idx + 1}-${planId}`,
    name: f.name,
    date: calculateDueDate(input.eventDate, f.offsetDays),
    startTime: f.startTime,
    endTime: f.endTime,
    position: idx + 1,
  }));

  // 3. Compute tasks with dependency IDs
  const taskIds: string[] = tpl.tasks.map((_, idx) => `task-${idx + 1}-${planId}`);
  const tasks: TaskItem[] = tpl.tasks.map((t, idx) => {
    const dependsOn = (t.dependsOnIndexes || []).map((depIdx) => taskIds[depIdx]).filter(Boolean);

    return {
      id: taskIds[idx],
      title: t.title,
      categoryKey: t.categoryKey,
      offsetDays: t.offsetDays,
      dueDate: input.eventDate ? calculateDueDate(input.eventDate, t.offsetDays) : undefined,
      dateMode: 'relative',
      isMilestone: t.isMilestone,
      status: 'open',
      source: 'template',
      position: idx + 1,
      dependsOn,
    };
  });

  const rawPlan = {
    schemaVersion: 1,
    id: planId,
    createdAt: now,
    updatedAt: now,
    wizardStep: 4,
    status: 'active' as const,
    event: {
      type: input.type,
      title: input.title,
      eventDate: input.eventDate || null,
      timezone: 'Asia/Kolkata',
      city: input.city || null,
      guestEstimate: input.guestEstimate ?? 0,
      budgetTotalPaise: totalPaise,
      currency: 'INR' as const,
      preferences: {
        themeWords: input.preferences?.themeWords || [],
        dietFocus: input.preferences?.dietFocus || [],
        customs: input.preferences?.customs || [],
        avoidColours: input.preferences?.avoidColours || [],
        notes: input.preferences?.notes || '',
      },
    },
    functions,
    budgetCategories,
    expenses: [],
    tasks,
    vendors: [],
    quotes: [],
    guests: input.dietBreakdown
      ? {
          total: input.guestEstimate ?? 0,
          veg: input.dietBreakdown.veg,
          nonVeg: input.dietBreakdown.nonVeg,
          jain: input.dietBreakdown.jain,
          eggetarian: input.dietBreakdown.eggetarian,
          vegan: input.dietBreakdown.vegan,
          allergyTags: [],
          accessibilityNeeds: [],
        }
      : null,
    scheduleItems: [],
    ideas: [],
  };

  return PlanSchema.parse(rawPlan);
}

/**
 * Replaces the browser-built budget split and starter tasks with the backend's
 * POST /plan/template result (the Python template is the source of truth).
 */
export function applyServerTemplate(plan: Plan, tpl: TemplateResponse): Plan {
  const taskId = (position: number) => `task-${position}-${plan.id}`;
  return PlanSchema.parse({
    ...plan,
    budgetCategories: tpl.categories.map((c) => ({
      id: `cat-${c.key}-${plan.id}`,
      key: c.key,
      label: c.label,
      allocatedPaise: c.allocatedPaise,
      position: c.position,
    })),
    tasks: tpl.tasks.map((t) => ({
      id: taskId(t.position),
      title: t.title,
      categoryKey: t.categoryKey,
      offsetDays: t.offsetDays,
      dueDate: t.dueDate ?? undefined,
      dateMode: 'relative',
      isMilestone: t.isMilestone,
      status: 'open',
      source: 'template',
      position: t.position,
      dependsOn: t.dependsOnPositions.map(taskId),
    })),
  });
}
