import { z } from 'zod';

// No eval-based fast path: the production CSP blocks `new Function`, and zod's probe for it
// would log a CSP violation on every page.
z.config({ jitless: true });

export const CanonicalEventTypeSchema = z.enum([
  'wedding',
  'engagement',
  'birthday',
  'anniversary',
  'community',
  'family',
]);

export type CanonicalEventType = z.infer<typeof CanonicalEventTypeSchema>;

const EventPreferencesSchema = z.object({
  themeWords: z.array(z.string()).default([]),
  dietFocus: z.array(z.string()).default([]),
  customs: z.array(z.string()).default([]),
  avoidColours: z.array(z.string()).default([]),
  notes: z.string().max(500).default(''),
});

export type EventPreferences = z.infer<typeof EventPreferencesSchema>;

const EventDetailsSchema = z.object({
  type: CanonicalEventTypeSchema,
  title: z.string().min(1).max(120),
  eventDate: z.string().nullable().default(null),
  timezone: z.string().default('Asia/Kolkata'),
  city: z.string().max(80).nullable().default(null),
  guestEstimate: z.number().int().min(0).max(10000).default(0),
  budgetTotalPaise: z.number().int().min(0).nullable().default(null),
  currency: z.literal('INR').default('INR'),
  preferences: EventPreferencesSchema.default({
    themeWords: [],
    dietFocus: [],
    customs: [],
    avoidColours: [],
    notes: '',
  }),
});

export type EventDetails = z.infer<typeof EventDetailsSchema>;

export const FunctionItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  position: z.number().int().default(1),
});

export type FunctionItem = z.infer<typeof FunctionItemSchema>;

export const BudgetCategorySchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  allocatedPaise: z.number().int().min(0),
  position: z.number().int().default(1),
  /** 'ai' once an accepted AI budget split set this amount (shown as "AI idea"). */
  source: z.enum(['template', 'user', 'ai']).optional(),
});

export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

export const ExpenseKindSchema = z.enum(['planned', 'quoted', 'paid']);
export type ExpenseKind = z.infer<typeof ExpenseKindSchema>;

export const ExpenseItemSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  vendorId: z.string().optional(),
  description: z.string().min(1).max(120),
  amountPaise: z.number().int().min(0),
  kind: ExpenseKindSchema,
  spentOn: z.string().optional(),
  note: z.string().max(500).optional(),
});

export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;

const TaskDateModeSchema = z.enum(['relative', 'fixed']);
const TaskStatusSchema = z.enum(['open', 'done']);
const TaskSourceSchema = z.enum(['template', 'user', 'ai']);

export const TaskItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  notes: z.string().max(1000).optional(),
  categoryKey: z.string().optional(),
  offsetDays: z.number().int().optional(),
  dueDate: z.string().optional(),
  dateMode: TaskDateModeSchema.default('relative'),
  isMilestone: z.boolean().default(false),
  status: TaskStatusSchema.default('open'),
  completedAt: z.string().optional(),
  source: TaskSourceSchema.default('template'),
  position: z.number().int().default(1),
  dependsOn: z.array(z.string()).default([]),
});

export type TaskItem = z.infer<typeof TaskItemSchema>;

const VendorStatusSchema = z.enum(['shortlisted', 'booked', 'dropped']);

export const VendorItemSchema = z.object({
  id: z.string(),
  categoryKey: z.string(),
  name: z.string().min(1).max(120),
  phone: z.string().optional(),
  email: z.string().optional(),
  status: VendorStatusSchema.default('shortlisted'),
  notes: z.string().optional(),
});

export type VendorItem = z.infer<typeof VendorItemSchema>;

export const QuoteUnitSchema = z.enum(['total', 'per_plate', 'per_guest']);
export type QuoteUnit = z.infer<typeof QuoteUnitSchema>;

export const QuoteItemSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  amountPaise: z.number().int().min(0),
  unit: QuoteUnitSchema.default('total'),
  units: z.number().int().optional(),
  inclusions: z.array(z.string()).default([]),
  validUntil: z.string().optional(),
});

export type QuoteItem = z.infer<typeof QuoteItemSchema>;

const GuestsSummarySchema = z
  .object({
    total: z.number().int().min(0),
    veg: z.number().int().min(0).default(0),
    nonVeg: z.number().int().min(0).default(0),
    jain: z.number().int().min(0).default(0),
    eggetarian: z.number().int().min(0).default(0),
    vegan: z.number().int().min(0).default(0),
    allergyTags: z.array(z.string()).default([]),
    accessibilityNeeds: z.array(z.string()).default([]),
  })
  .nullable();

export type GuestsSummary = z.infer<typeof GuestsSummarySchema>;

export const ScheduleItemSchema = z.object({
  id: z.string(),
  functionId: z.string(),
  startTime: z.string(),
  durationMin: z.number().int().min(1),
  title: z.string().min(1).max(120),
  notes: z.string().optional(),
  position: z.number().int().default(1),
});

export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

export const IdeaKindSchema = z.enum(['theme', 'decor', 'menu', 'saving', 'other']);
export type IdeaKind = z.infer<typeof IdeaKindSchema>;
const IdeaSourceSchema = z.enum(['ai', 'user']);
export type IdeaSource = z.infer<typeof IdeaSourceSchema>;

export const IdeaItemSchema = z.object({
  id: z.string(),
  kind: IdeaKindSchema,
  title: z.string().min(1).max(120),
  body: z.string().optional(),
  dietTags: z.array(z.string()).default([]),
  estimateMinPaise: z.number().int().min(0).optional(),
  estimateMaxPaise: z.number().int().min(0).optional(),
  source: IdeaSourceSchema.default('user'),
  confirmed: z.boolean().optional(),
  personalized: z.boolean().optional(),
  personalNote: z.string().optional(),
});

export type IdeaItem = z.infer<typeof IdeaItemSchema>;

/**
 * Plan Document Schema (schemaVersion 1)
 * Source of truth for browser-stored celebration plans
 */
export const PlanSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  wizardStep: z.number().int().min(1).max(4).default(1),
  status: z.enum(['draft', 'active', 'completed']).default('draft'),
  event: EventDetailsSchema,
  functions: z.array(FunctionItemSchema).default([]),
  budgetCategories: z.array(BudgetCategorySchema).default([]),
  expenses: z.array(ExpenseItemSchema).default([]),
  tasks: z.array(TaskItemSchema).default([]),
  vendors: z.array(VendorItemSchema).default([]),
  quotes: z.array(QuoteItemSchema).default([]),
  guests: GuestsSummarySchema.default(null),
  scheduleItems: z.array(ScheduleItemSchema).default([]),
  ideas: z.array(IdeaItemSchema).default([]),
});

export type Plan = z.infer<typeof PlanSchema>;

/**
 * Snapshot Schema (for recovery / version history)
 */
export const PlanSnapshotSchema = z.object({
  id: z.string(),
  planId: z.string(),
  createdAt: z.string(),
  plan: PlanSchema,
});

export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;

/**
 * Backup format schema (.toranly.json)
 */
export const ToranlyBackupSchema = z.object({
  format: z.literal('toranly-backup'),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  plans: z.array(z.unknown()),
});

export type ToranlyBackup = z.infer<typeof ToranlyBackupSchema>;

/**
 * Migration helper for versioned documents
 * Handles legacy v0 or unversioned drafts, upgrading to v1 baseline.
 */
export function migrate(raw: unknown): Plan {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid plan document: not an object');
  }

  const obj = raw as Record<string, unknown>;

  // If already schemaVersion 1
  if (obj.schemaVersion === 1) {
    return PlanSchema.parse(obj);
  }

  // Legacy prototype format or older draft upgrade:
  const now = new Date().toISOString();
  const rawId = (obj.id || obj.eventId || `plan-${Date.now()}`) as string;
  const rawType = (obj.type || obj.canonicalType || 'wedding') as CanonicalEventType;
  const rawTitle = (obj.title || obj.eventName || 'Our Celebration') as string;
  const rawDate = (obj.eventDate || null) as string | null;
  const rawCity = (obj.city || null) as string | null;
  const rawGuests = typeof obj.guestEstimate === 'number' ? obj.guestEstimate : 0;
  const rawBudget =
    typeof obj.budgetTotalPaise === 'number'
      ? obj.budgetTotalPaise
      : typeof obj.budgetTotal === 'number'
        ? obj.budgetTotal * 100
        : null;

  const rawPref =
    typeof obj.preferences === 'object' && obj.preferences !== null
      ? (obj.preferences as Record<string, unknown>)
      : {};
  const rawDiet =
    typeof obj.dietBreakdown === 'object' && obj.dietBreakdown !== null
      ? (obj.dietBreakdown as Record<string, unknown>)
      : null;

  const upgraded = {
    schemaVersion: 1,
    id: rawId,
    createdAt: (obj.createdAt as string) || now,
    updatedAt: (obj.updatedAt as string) || now,
    wizardStep:
      typeof obj.wizardStep === 'number'
        ? obj.wizardStep
        : typeof obj.step === 'number'
          ? obj.step
          : 1,
    status: (obj.status as 'draft' | 'active' | 'completed') || 'draft',
    event: {
      type: rawType,
      title: rawTitle,
      eventDate: rawDate,
      timezone: 'Asia/Kolkata',
      city: rawCity,
      guestEstimate: rawGuests,
      budgetTotalPaise: rawBudget,
      currency: 'INR',
      preferences: {
        themeWords: Array.isArray(rawPref.themeWords) ? (rawPref.themeWords as string[]) : [],
        dietFocus: Array.isArray(rawPref.dietFocus) ? (rawPref.dietFocus as string[]) : [],
        customs: Array.isArray(rawPref.customs) ? (rawPref.customs as string[]) : [],
        avoidColours: Array.isArray(rawPref.avoidColours) ? (rawPref.avoidColours as string[]) : [],
        notes: typeof rawPref.notes === 'string' ? rawPref.notes : '',
      },
    },
    functions: Array.isArray(obj.functions) ? obj.functions : [],
    budgetCategories: Array.isArray(obj.budgetCategories) ? obj.budgetCategories : [],
    expenses: Array.isArray(obj.expenses) ? obj.expenses : [],
    tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
    vendors: Array.isArray(obj.vendors) ? obj.vendors : [],
    quotes: Array.isArray(obj.quotes) ? obj.quotes : [],
    guests: (() => {
      const g = obj.guests as Record<string, unknown> | null | undefined;
      if (g) {
        return {
          total:
            typeof g.total === 'number'
              ? g.total
              : typeof g.expectedTotal === 'number'
                ? g.expectedTotal
                : rawGuests,
          veg: typeof g.veg === 'number' ? g.veg : 0,
          nonVeg: typeof g.nonVeg === 'number' ? g.nonVeg : 0,
          jain: typeof g.jain === 'number' ? g.jain : 0,
          eggetarian: typeof g.eggetarian === 'number' ? g.eggetarian : 0,
          vegan: typeof g.vegan === 'number' ? g.vegan : 0,
          allergyTags: Array.isArray(g.allergyTags) ? g.allergyTags : [],
          accessibilityNeeds: Array.isArray(g.accessibilityNeeds) ? g.accessibilityNeeds : [],
        };
      }
      if (rawDiet) {
        return {
          total: rawGuests,
          veg: typeof rawDiet.veg === 'number' ? rawDiet.veg : 0,
          nonVeg: typeof rawDiet.nonVeg === 'number' ? rawDiet.nonVeg : 0,
          jain: typeof rawDiet.jain === 'number' ? rawDiet.jain : 0,
          eggetarian: typeof rawDiet.eggetarian === 'number' ? rawDiet.eggetarian : 0,
          vegan: typeof rawDiet.vegan === 'number' ? rawDiet.vegan : 0,
          allergyTags: [],
          accessibilityNeeds: [],
        };
      }
      return null;
    })(),
    scheduleItems: Array.isArray(obj.scheduleItems) ? obj.scheduleItems : [],
    ideas: Array.isArray(obj.ideas) ? obj.ideas : [],
  };

  return PlanSchema.parse(upgraded);
}
