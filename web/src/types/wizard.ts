import React from 'react';
import {
  HeartHandshake,
  Cake,
  Gem,
  Heart,
  Users,
  Home,
  Baby,
  Flower2,
  Sparkles,
} from 'lucide-react';

export type CanonicalEventType =
  'wedding' | 'engagement' | 'birthday' | 'anniversary' | 'community' | 'family';

export interface EventCategory {
  id: string;
  name: string;
  canonicalType: CanonicalEventType;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
  }>;
  defaultPlaceholder: string;
  description?: string;
}

/**
 * Exactly 9 practical categories specified in Toranly requirements.
 * Excludes unrelated business/corporate conferences, workshops, etc.
 */
export const EVENT_CATEGORIES: EventCategory[] = [
  {
    id: 'wedding',
    name: 'Wedding',
    canonicalType: 'wedding',
    icon: HeartHandshake,
    defaultPlaceholder: "Ananya & Rohan's Wedding",
    description: 'Plan ceremonies, sangeet, reception, and guest catering.',
  },
  {
    id: 'birthday',
    name: 'Birthday',
    canonicalType: 'birthday',
    icon: Cake,
    defaultPlaceholder: "Aarav's 30th Birthday Celebration",
    description: 'Milestone years, themed parties, cakes, and entertainment.',
  },
  {
    id: 'engagement',
    name: 'Engagement',
    canonicalType: 'engagement',
    icon: Gem,
    defaultPlaceholder: "Priya & Kabir's Ring Ceremony",
    description: 'Rings exchange, intimate venue, dinner, and photography.',
  },
  {
    id: 'anniversary',
    name: 'Anniversary',
    canonicalType: 'anniversary',
    icon: Heart,
    defaultPlaceholder: 'Sharma Family 25th Silver Anniversary',
    description: 'Couple milestones, nostalgic gatherings, and dinners.',
  },
  {
    id: 'community',
    name: 'Community Event',
    canonicalType: 'community',
    icon: Users,
    defaultPlaceholder: 'Vasant Vihar Diwali Mela & Cultural Evening',
    description: 'Neighbourhood festivals, poojas, cultural nights, and fairs.',
  },
  {
    id: 'family',
    name: 'Family Gathering',
    canonicalType: 'family',
    icon: Home,
    defaultPlaceholder: 'Gupta Family Summer Reunion & Lunch',
    description: 'Housewarmings, reunions, festive dinners, and get-togethers.',
  },
  {
    id: 'baby-shower',
    name: 'Baby Shower',
    canonicalType: 'family',
    icon: Baby,
    defaultPlaceholder: "Rhea's Godh Bharai / Baby Shower",
    description: 'Blessing ceremonies, sweet treats, decor, and family games.',
  },
  {
    id: 'religious-cultural',
    name: 'Religious & Cultural Celebration',
    canonicalType: 'community',
    icon: Flower2,
    defaultPlaceholder: 'Ganesh Utsav & Satyanarayan Pooja',
    description: 'Havan, kirtan, festive feasts, and spiritual gatherings.',
  },
  {
    id: 'other',
    name: 'Other Celebration',
    canonicalType: 'community',
    icon: Sparkles,
    defaultPlaceholder: 'Our Special Weekend Celebration',
    description: 'Bespoke personal festivities and joyous gatherings.',
  },
];

/**
 * Documented aliases to resolve URLs like ?type=weddings or ?type=birthdays cleanly.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  wedding: 'wedding',
  weddings: 'wedding',
  birthday: 'birthday',
  birthdays: 'birthday',
  engagement: 'engagement',
  engagements: 'engagement',
  anniversary: 'anniversary',
  anniversaries: 'anniversary',
  community: 'community',
  'community-event': 'community',
  family: 'family',
  'family-gathering': 'family',
  'baby-shower': 'baby-shower',
  babyshower: 'baby-shower',
  'religious-cultural': 'religious-cultural',
  religious: 'religious-cultural',
  cultural: 'religious-cultural',
  other: 'other',
};

export function resolveCategoryId(rawType?: string | null): string {
  if (!rawType) return 'wedding';
  const clean = rawType.trim().toLowerCase();
  return CATEGORY_ALIASES[clean] || 'wedding';
}

export function getCategoryById(id: string): EventCategory {
  const resolved = resolveCategoryId(id);
  return EVENT_CATEGORIES.find((c) => c.id === resolved) || EVENT_CATEGORIES[0];
}

/**
 * Step 2: Event Sub-Function (D-11 modal & S-05 step 2)
 */
export interface EventFunction {
  id: string;
  name: string;
  date: string;
  startTime?: string;
  endTime?: string;
  position: number;
}

/**
 * Step 3: Dietary Distribution
 */
export interface DietBreakdown {
  veg: number;
  jain: number;
  nonVeg: number;
  eggetarian: number;
  vegan: number;
}

/**
 * Step 4: Event Preferences
 */
export interface EventPreferences {
  themeWords: string[];
  avoidColours: string[];
  customs: string[];
  notes: string;
}

/**
 * Core Wizard State (Data collected across all 4 steps)
 */
export interface WizardData {
  eventId: string;
  step: number;
  categoryId: string;
  categoryName: string;
  canonicalType: CanonicalEventType;
  eventName: string;
  eventDate: string; // YYYY-MM-DD
  city: string;
  functions: EventFunction[];
  budgetTotal: number; // in INR rupees
  currency: string; // Fixed 'INR'
  guestEstimate: number;
  dietBreakdown: DietBreakdown;
  preferences: EventPreferences;
  updatedAt: string;
}

/**
 * Post-wizard Generated Planning Models
 */
export interface BudgetCategoryItem {
  id: string;
  key: string;
  label: string;
  sharePercent: number;
  allocatedPaise: number;
  committedPaise: number;
  paidPaise: number;
  remainingPaise: number;
  status: 'ok' | 'warning' | 'over';
  position: number;
}

export interface TaskItem {
  id: string;
  title: string;
  categoryKey?: string;
  offsetDays: number;
  dueDate: string;
  isMilestone: boolean;
  status: 'open' | 'done';
  dependencyHint?: string;
}

export interface VendorItem {
  id: string;
  name: string;
  category: string;
  status: 'booked' | 'shortlisted' | 'dropped';
  amountPaise: number;
}

export interface ToranlyEvent {
  id: string;
  type: CanonicalEventType;
  categoryId: string;
  title: string;
  eventDate: string;
  city: string;
  timezone: string;
  currency: string;
  budgetTotalPaise: number;
  guestEstimate: number;
  dietBreakdown: DietBreakdown;
  functions: EventFunction[];
  preferences: EventPreferences;
  budgetCategories: BudgetCategoryItem[];
  tasks: TaskItem[];
  vendors: VendorItem[];
  status: 'draft' | 'active' | 'completed';
  starterPlanDismissed: boolean;
  createdAt: string;
  updatedAt: string;
}
