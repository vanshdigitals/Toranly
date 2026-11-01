import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Plan, PlanSnapshot } from '../domain/plan';
import { PlanSchema, PlanSnapshotSchema, migrate } from '../domain/plan';
import { removeEvent } from '../lib/eventState';

const DB_NAME = 'toranly';
const DB_VERSION = 1;
const SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between automatic snapshots
const MAX_SNAPSHOTS_PER_PLAN = 3;

interface ToranlyDBSchema {
  plans: {
    key: string;
    value: Plan;
  };
  snapshots: {
    key: string;
    value: PlanSnapshot;
    indexes: { planId: string };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

// In-memory fallback structures
let isMemoryMode = false;
const inMemoryPlans = new Map<string, Plan>();
const inMemorySnapshots = new Map<string, PlanSnapshot[]>();
const inMemoryMeta = new Map<string, unknown>();

// Listeners for in-memory mode change
const memoryModeListeners = new Set<(inMemory: boolean) => void>();

export function isInMemoryStorage(): boolean {
  return isMemoryMode;
}

export function subscribeMemoryMode(listener: (inMemory: boolean) => void): () => void {
  memoryModeListeners.add(listener);
  return () => memoryModeListeners.delete(listener);
}

function notifyMemoryMode(val: boolean) {
  isMemoryMode = val;
  for (const listener of memoryModeListeners) {
    listener(val);
  }
}

let dbPromise: Promise<IDBPDatabase<ToranlyDBSchema> | null> | null = null;

async function getDB(): Promise<IDBPDatabase<ToranlyDBSchema> | null> {
  if (isMemoryMode) return null;
  if (typeof window === 'undefined' || !window.indexedDB) {
    notifyMemoryMode(true);
    return null;
  }

  if (!dbPromise) {
    try {
      dbPromise = openDB<ToranlyDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('plans')) {
            db.createObjectStore('plans', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('snapshots')) {
            const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' });
            snapshotStore.createIndex('planId', 'planId');
          }
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'key' });
          }
        },
      }).catch((err) => {
        console.warn('Failed to open IndexedDB, falling back to in-memory mode:', err);
        notifyMemoryMode(true);
        return null;
      });
    } catch (err) {
      console.warn('Synchronous failure during openDB, falling back to in-memory mode:', err);
      notifyMemoryMode(true);
      dbPromise = Promise.resolve(null);
      return null;
    }
  }

  try {
    const db = await dbPromise;
    if (!db) {
      notifyMemoryMode(true);
      return null;
    }
    return db;
  } catch (err) {
    console.warn('Promise rejection reading db, falling back to in-memory mode:', err);
    notifyMemoryMode(true);
    return null;
  }
}

/**
 * List all saved plans, sorted by updatedAt descending.
 */
export async function listPlans(): Promise<Plan[]> {
  try {
    const db = await getDB();
    if (!db || isMemoryMode) {
      const plans = Array.from(inMemoryPlans.values());
      return plans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    const plans = await db.getAll('plans');
    return plans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err) {
    console.warn('Error listing plans from IndexedDB, falling back to in-memory mode:', err);
    notifyMemoryMode(true);
    const plans = Array.from(inMemoryPlans.values());
    return plans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

/**
 * Check if at least one plan exists in the browser.
 */
export async function hasAnyPlans(): Promise<boolean> {
  try {
    const plans = await listPlans();
    return plans.length > 0;
  } catch (err) {
    console.warn('Error checking plans:', err);
    return false;
  }
}

/**
 * Get a single plan by ID.
 */
export async function getPlan(id: string): Promise<Plan | null> {
  const db = await getDB();
  if (!db || isMemoryMode) {
    const raw = inMemoryPlans.get(id);
    if (!raw) return null;
    try {
      return migrate(raw);
    } catch {
      return raw as Plan;
    }
  }

  try {
    const plan = await db.get('plans', id);
    if (!plan) return null;
    try {
      return migrate(plan);
    } catch {
      return plan as Plan;
    }
  } catch (err) {
    console.warn(`Error getting plan ${id} from IndexedDB:`, err);
    return null;
  }
}

/**
 * Save a plan. Validates schema, updates updatedAt, creates snapshots when eligible,
 * and handles persistent storage requests.
 */
export async function savePlan(plan: Plan): Promise<Plan> {
  let validated: Plan;
  try {
    const migrated = migrate(plan);
    validated = PlanSchema.parse({
      ...migrated,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    validated = {
      ...plan,
      updatedAt: new Date().toISOString(),
    };
  }

  const db = await getDB();
  if (!db || isMemoryMode) {
    inMemoryPlans.set(validated.id, validated);
    manageSnapshotInMemory(validated);
    return validated;
  }

  try {
    await db.put('plans', validated);
    await manageSnapshotIndexedDB(db, validated);
    await requestStoragePersistenceOnce(db);
    return validated;
  } catch (err) {
    console.warn(`Failed to save plan to IndexedDB, saving to in-memory:`, err);
    notifyMemoryMode(true);
    inMemoryPlans.set(validated.id, validated);
    return validated;
  }
}

/**
 * Delete a plan and its snapshots.
 */
export async function deletePlan(id: string): Promise<void> {
  // The wizard also writes a legacy localStorage copy; My Plans migrates those back when
  // IndexedDB is empty, so remove it too or the deleted plan reappears.
  removeEvent(id);
  const db = await getDB();
  if (!db || isMemoryMode) {
    inMemoryPlans.delete(id);
    inMemorySnapshots.delete(id);
    return;
  }

  try {
    const tx = db.transaction(['plans', 'snapshots'], 'readwrite');
    await tx.objectStore('plans').delete(id);

    // Delete associated snapshots
    const snapshotStore = tx.objectStore('snapshots');
    const index = snapshotStore.index('planId');
    let cursor = await index.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    console.warn(`Error deleting plan ${id} from IndexedDB:`, err);
  }
}

/**
 * Get snapshots for a plan, sorted newest first.
 */
export async function getSnapshots(planId: string): Promise<PlanSnapshot[]> {
  const db = await getDB();
  if (!db || isMemoryMode) {
    const snaps = inMemorySnapshots.get(planId) || [];
    return [...snaps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  try {
    const index = db.transaction('snapshots').store.index('planId');
    const snaps = await index.getAll(planId);
    return snaps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn(`Error fetching snapshots for plan ${planId}:`, err);
    return [];
  }
}

/**
 * Restore a plan from a snapshot.
 */
export async function restoreSnapshot(planId: string, snapshotId: string): Promise<Plan | null> {
  const snapshots = await getSnapshots(planId);
  const target = snapshots.find((s) => s.id === snapshotId);
  if (!target) return null;

  // Restore the plan with updated timestamp
  const restoredPlan: Plan = {
    ...target.plan,
    updatedAt: new Date().toISOString(),
  };

  return await savePlan(restoredPlan);
}

/**
 * Get meta key value.
 */
export async function getMeta<T = unknown>(key: string): Promise<T | null> {
  const db = await getDB();
  if (!db || isMemoryMode) {
    return (inMemoryMeta.get(key) as T) ?? null;
  }

  try {
    const entry = await db.get('meta', key);
    return entry ? (entry.value as T) : null;
  } catch {
    return null;
  }
}

/**
 * Set meta key value.
 */
export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  if (!db || isMemoryMode) {
    inMemoryMeta.set(key, value);
    return;
  }

  try {
    await db.put('meta', { key, value });
  } catch (err) {
    console.warn(`Error writing meta key ${key}:`, err);
  }
}

// ----------------------------------------------------------------------
// Internal Snapshot and Persistence Helpers
// ----------------------------------------------------------------------

async function manageSnapshotIndexedDB(db: IDBPDatabase<ToranlyDBSchema>, plan: Plan): Promise<void> {
  try {
    const snaps = await getSnapshots(plan.id);
    const now = Date.now();

    // Check last snapshot time
    if (snaps.length > 0) {
      const lastSnapTime = new Date(snaps[0].createdAt).getTime();
      if (now - lastSnapTime < SNAPSHOT_INTERVAL_MS) {
        return; // Too soon for a new snapshot
      }
    }

    const newSnapshot: PlanSnapshot = PlanSnapshotSchema.parse({
      id: `snap-${plan.id}-${now}`,
      planId: plan.id,
      createdAt: new Date().toISOString(),
      plan,
    });

    await db.put('snapshots', newSnapshot);

    // Prune oldest snapshots beyond MAX_SNAPSHOTS_PER_PLAN (3)
    const updatedSnaps = await getSnapshots(plan.id);
    if (updatedSnaps.length > MAX_SNAPSHOTS_PER_PLAN) {
      const toDelete = updatedSnaps.slice(MAX_SNAPSHOTS_PER_PLAN);
      const tx = db.transaction('snapshots', 'readwrite');
      for (const snap of toDelete) {
        await tx.store.delete(snap.id);
      }
      await tx.done;
    }
  } catch (err) {
    console.warn('Failed to manage snapshot in IndexedDB:', err);
  }
}

function manageSnapshotInMemory(plan: Plan): void {
  const snaps = inMemorySnapshots.get(plan.id) || [];
  const now = Date.now();

  if (snaps.length > 0) {
    const lastSnapTime = new Date(snaps[0].createdAt).getTime();
    if (now - lastSnapTime < SNAPSHOT_INTERVAL_MS) {
      return;
    }
  }

  const newSnapshot: PlanSnapshot = {
    id: `snap-${plan.id}-${now}`,
    planId: plan.id,
    createdAt: new Date().toISOString(),
    plan,
  };

  const nextSnaps = [newSnapshot, ...snaps].slice(0, MAX_SNAPSHOTS_PER_PLAN);
  inMemorySnapshots.set(plan.id, nextSnaps);
}

let persistenceRequested = false;

async function requestStoragePersistenceOnce(db: IDBPDatabase<ToranlyDBSchema>): Promise<void> {
  if (persistenceRequested) return;
  persistenceRequested = true;

  try {
    const existing = await db.get('meta', 'persistRequested');
    if (existing) return;

    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      await db.put('meta', { key: 'persistRequested', value: true });
      await db.put('meta', { key: 'persistGranted', value: granted });
    }
  } catch {
    // Ignore errors for storage persistence
  }
}
