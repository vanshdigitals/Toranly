import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { deletePlan, listPlans, savePlan } from '../../storage/db';
import { generatePlanFromTemplate } from '../../domain/templates';
import { checkSavedPlans, getStartPlanningAction } from '../navigation';

const store = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const plan = (id: string) =>
  generatePlanFromTemplate({
    id,
    type: 'birthday',
    title: `Plan ${id}`,
    eventDate: '2026-12-20',
    guestEstimate: 40,
    budgetTotalPaise: 5000000,
  });

async function clearPlans() {
  for (const p of await listPlans()) await deletePlan(p.id);
}

describe('Start planning: saved-plan check', () => {
  beforeEach(async () => {
    vi.stubGlobal('localStorage', localStorageShim);
    // db.ts needs window.indexedDB, otherwise it stays in memory mode ("unavailable").
    vi.stubGlobal('window', { indexedDB: globalThis.indexedDB });
    store.clear();
    await clearPlans();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a new browser goes straight to the wizard', async () => {
    expect(await checkSavedPlans()).toBe('none');
    expect(await getStartPlanningAction()).toBe('wizard');
  });

  it('one saved plan shows the welcome-back dialog', async () => {
    await savePlan(plan('p1'));
    expect(await getStartPlanningAction()).toBe('welcome-back');
  });

  it('several saved plans show the same dialog', async () => {
    await savePlan(plan('p1'));
    await savePlan(plan('p2'));
    await savePlan(plan('p3'));
    expect(await getStartPlanningAction()).toBe('welcome-back');
  });

  it('a legacy localStorage event (migrated by My Plans) counts as a saved plan', async () => {
    store.set('toranly_events', JSON.stringify([{ id: 'evt-legacy' }]));
    expect(await checkSavedPlans()).toBe('some');
  });

  it('deleting every plan returns to the new-user flow, legacy copies included', async () => {
    await savePlan(plan('p1'));
    store.set('toranly_events', JSON.stringify([{ id: 'p1' }]));
    expect(await checkSavedPlans()).toBe('some');
    await deletePlan('p1');
    expect(await checkSavedPlans()).toBe('none');
    expect(await getStartPlanningAction()).toBe('wizard');
  });

  it('checking (repeatedly) never creates or changes plans', async () => {
    await savePlan(plan('p1'));
    const before = await listPlans();
    await Promise.all([getStartPlanningAction(), getStartPlanningAction(), checkSavedPlans()]);
    expect(await listPlans()).toEqual(before);
  });

  it('corrupted legacy data is ignored instead of crashing', async () => {
    store.set('toranly_events', '{not json');
    expect(await checkSavedPlans()).toBe('none');
  });
});

describe('Start planning: storage failure', () => {
  it('unreadable storage is reported as unavailable and falls back to the wizard', async () => {
    vi.resetModules();
    vi.doMock('../../storage/db', () => ({
      listPlans: () => Promise.reject(new Error('IndexedDB blocked')),
      isInMemoryStorage: () => true,
    }));
    const nav = await import('../navigation');
    expect(await nav.checkSavedPlans()).toBe('unavailable');
    expect(await nav.getStartPlanningAction()).toBe('wizard');
    vi.doUnmock('../../storage/db');
    vi.resetModules();
  });
});
