import type { Plan, ToranlyBackup } from '../domain/plan';
import { ToranlyBackupSchema, migrate } from '../domain/plan';
import { getPlan } from './db';
import { ApiError } from '../api/client';
import { LIVE_CHECK_UNAVAILABLE, validatePlan, type ApiPlan } from '../api/plan';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export interface ParsedBackupResult {
  success: boolean;
  plans?: Plan[];
  error?: string;
}

export interface PlanConflict {
  incoming: Plan;
  existing: Plan;
}

export interface ConflictCheckResult {
  conflicts: PlanConflict[];
  nonConflicts: Plan[];
}

/**
 * Generates JSON string of backup for one or multiple plans.
 */
export function exportPlanBackup(planOrPlans: Plan | Plan[]): string {
  const plans = Array.isArray(planOrPlans) ? planOrPlans : [planOrPlans];

  const backupData: ToranlyBackup = {
    format: 'toranly-backup',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    plans,
  };

  ToranlyBackupSchema.parse(backupData);
  return JSON.stringify(backupData, null, 2);
}

/**
 * Triggers a browser download of the backup file.
 */
export function downloadBackupFile(backupJson: string, baseSlug = 'toranly-backup'): void {
  const safeSlug = baseSlug
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const filename = `${safeSlug || 'toranly-backup'}.toranly.json`;
  const blob = new Blob([backupJson], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Safely parses and validates an uploaded backup file string.
 */
export function parseBackupFile(content: string): ParsedBackupResult {
  if (content.length > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: 'Backup file exceeds the 2MB size limit.',
    };
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(content);
  } catch {
    return {
      success: false,
      error: 'Invalid JSON file. Please provide a valid .toranly.json backup.',
    };
  }

  // Validate format using schema
  const parsedBackup = ToranlyBackupSchema.safeParse(rawJson);
  if (!parsedBackup.success) {
    return {
      success: false,
      error:
        'Unrecognised backup format. File must be a valid Toranly backup with format "toranly-backup".',
    };
  }

  // Migrate each plan to ensure complete schema conformance
  try {
    const plans: Plan[] = parsedBackup.data.plans.map((p) => migrate(p));
    if (plans.length === 0) {
      return {
        success: false,
        error: 'The backup file contains no plans.',
      };
    }
    return {
      success: true,
      plans,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown schema error';
    return {
      success: false,
      error: `Plan validation failed: ${message}`,
    };
  }
}

/**
 * Checks incoming plans against existing plans in IndexedDB/storage.
 */
export async function detectPlanConflicts(incomingPlans: Plan[]): Promise<ConflictCheckResult> {
  const conflicts: PlanConflict[] = [];
  const nonConflicts: Plan[] = [];

  for (const plan of incomingPlans) {
    const existing = await getPlan(plan.id);
    if (existing) {
      conflicts.push({ incoming: plan, existing });
    } else {
      nonConflicts.push(plan);
    }
  }

  return { conflicts, nonConflicts };
}

export type ServerCheckResult = { ok: true; notice?: string } | { ok: false; error: string };

/**
 * Checks plans with POST /plan/validate (dependency cycles, dates, money, references).
 * Errors block the action; when the backend cannot be reached the action continues with
 * the device's own schema check and an honest notice.
 */
export async function checkPlansWithServer(plans: Plan[]): Promise<ServerCheckResult> {
  try {
    for (const plan of plans) {
      const result = await validatePlan(plan as ApiPlan);
      const errors = result.problems.filter((p) => p.severity === 'error');
      if (!result.valid || errors.length > 0) {
        const first = errors[0]?.message ?? 'The plan has problems that need fixing.';
        return { ok: false, error: `"${plan.event.title}" can't be used: ${first}` };
      }
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      return { ok: false, error: 'This backup has fields the server could not accept.' };
    }
    return { ok: true, notice: LIVE_CHECK_UNAVAILABLE };
  }
}
