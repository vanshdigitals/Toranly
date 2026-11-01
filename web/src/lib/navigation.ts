import { isInMemoryStorage, listPlans } from '../storage/db';
import { getAllEvents } from './eventState';

/** Route of the celebration setup wizard, step 1 (always creates a new plan id). */
export const NEW_PLAN_ROUTE = '/events/new';
/** Route of "My Plans". */
export const MY_PLANS_ROUTE = '/events';

/**
 * Saved plans in this browser profile:
 * - 'some': at least one real plan record (IndexedDB, or a legacy localStorage event that
 *   My Plans migrates on open).
 * - 'none': no records.
 * - 'unavailable': storage could not be read and nothing is known to exist.
 * This is browser-local recognition only, not an account login, and is not synced across devices.
 */
export type SavedPlansState = 'none' | 'some' | 'unavailable';

export async function checkSavedPlans(): Promise<SavedPlansState> {
  try {
    const plans = await listPlans();
    if (plans.length > 0) return 'some';
    if (getAllEvents().length > 0) return 'some';
    // listPlans falls back to memory instead of throwing when IndexedDB fails.
    return isInMemoryStorage() ? 'unavailable' : 'none';
  } catch {
    return 'unavailable';
  }
}

export type StartPlanningAction = 'wizard' | 'welcome-back';

/** "Start planning": returning browsers choose; new ones (or unreadable storage) go to the wizard. */
export async function getStartPlanningAction(): Promise<StartPlanningAction> {
  return (await checkSavedPlans()) === 'some' ? 'welcome-back' : 'wizard';
}
