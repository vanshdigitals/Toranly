import type { DietBreakdown, EventPreferences, WizardData, ToranlyEvent } from '../types/wizard';
import { getCategoryById, resolveCategoryId } from '../types/wizard';

const DRAFT_STORAGE_KEY = 'toranly_wizard_draft';
const EVENTS_STORAGE_KEY = 'toranly_events';

export const DEFAULT_DIET_BREAKDOWN: DietBreakdown = {
  veg: 0,
  jain: 0,
  nonVeg: 0,
  eggetarian: 0,
  vegan: 0,
};

export const DEFAULT_PREFERENCES: EventPreferences = {
  themeWords: [],
  avoidColours: [],
  customs: [],
  notes: '',
};

/**
 * Get a default future date (e.g. 110 days in future) formatted YYYY-MM-DD
 */
export function getDefaultFutureDate(daysAhead = 110): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

/**
 * Default initial wizard state
 */
export function createInitialWizardData(rawType?: string | null): WizardData {
  const cat = getCategoryById(rawType || 'wedding');
  return {
    eventId: `evt-${Date.now().toString(36)}`,
    step: 1,
    categoryId: cat.id,
    categoryName: cat.name,
    canonicalType: cat.canonicalType,
    // A new plan starts empty: everything shown later comes from what the visitor types.
    eventName: '',
    eventDate: '',
    city: '',
    functions: [],
    budgetTotal: 0,
    currency: 'INR',
    guestEstimate: 0,
    dietBreakdown: { ...DEFAULT_DIET_BREAKDOWN },
    preferences: { ...DEFAULT_PREFERENCES },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Format INR with standard Indian grouping (e.g. ₹18,00,000)
 */
export function formatINR(rupees: number, includeWords = true): string {
  if (isNaN(rupees)) return '₹0';
  const abs = Math.abs(rupees);

  // Indian numbering formatter
  const formattedNumber = abs.toLocaleString('en-IN');
  const prefix = rupees < 0 ? '-₹' : '₹';
  const fullStr = `${prefix}${formattedNumber}`;

  if (!includeWords || abs < 100000) {
    return fullStr;
  }

  // Add Lakh or Crore suffix helper
  if (abs >= 10000000) {
    const cr = (abs / 10000000).toFixed(2).replace(/\.00$/, '');
    return `${fullStr} (${cr} Crore)`;
  }
  const lakh = (abs / 100000).toFixed(2).replace(/\.00$/, '');
  return `${fullStr} (${lakh} Lakh)`;
}

/**
 * Calculate days remaining until event date
 */
export function calculateDaysRemaining(eventDateStr: string): number {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(eventDateStr);
    eventDate.setHours(0, 0, 0, 0);
    const diffMs = eventDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

// -------------------------------------------------------------
// LOCAL STORAGE PERSISTENCE
// -------------------------------------------------------------

/**
 * Read current wizard draft
 */
export function getWizardDraft(initialType?: string | null): WizardData {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // If an explicit type was passed and doesn't match draft, reconcile category
        if (initialType && resolveCategoryId(initialType) !== parsed.categoryId) {
          const updatedCat = getCategoryById(initialType);
          return {
            ...parsed,
            categoryId: updatedCat.id,
            categoryName: updatedCat.name,
            canonicalType: updatedCat.canonicalType,
          };
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read wizard draft', err);
  }
  return createInitialWizardData(initialType);
}

/**
 * Save wizard draft
 */
export function saveWizardDraft(updates: Partial<WizardData>): WizardData {
  const current = getWizardDraft();
  const next: WizardData = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Could not save wizard draft', err);
  }
  return next;
}

/**
 * Reset wizard draft
 */
export function resetWizardDraft(rawType?: string | null): WizardData {
  const fresh = createInitialWizardData(rawType);
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(fresh));
  } catch (err) {
    console.warn('Could not reset wizard draft', err);
  }
  return fresh;
}

/**
 * Clear wizard draft
 */
export function clearWizardDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (err) {
    console.warn('Could not clear wizard draft', err);
  }
}

/**
 * Get all saved events
 */
export function getAllEvents(): ToranlyEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not load events', err);
  }
  return [];
}

/**
 * Remove a legacy event record (if any) so a deleted plan is not migrated back from localStorage.
 */
export function removeEvent(id: string): void {
  try {
    const events = getAllEvents();
    const remaining = events.filter((e) => e.id !== id);
    if (remaining.length !== events.length) {
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(remaining));
    }
  } catch (err) {
    console.warn('Could not remove legacy event', err);
  }
}
