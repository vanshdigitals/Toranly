import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  savePlan,
  getPlan,
  listPlans,
  deletePlan,
  getSnapshots,
  restoreSnapshot,
  hasAnyPlans,
} from '../db';
import {
  exportPlanBackup,
  parseBackupFile,
  detectPlanConflicts,
} from '../backup';
import { generatePlanFromTemplate } from '../../domain/templates';

describe('Storage Layer & IndexedDB', () => {
  const samplePlan = generatePlanFromTemplate({
    id: 'test-plan-1',
    type: 'wedding',
    title: 'Pooja & Rohan Wedding',
    eventDate: '2026-11-25',
    guestEstimate: 180,
    budgetTotalPaise: 150000000,
  });

  beforeEach(async () => {
    // Clean up
    await deletePlan(samplePlan.id);
  });

  it('saves and retrieves a plan successfully', async () => {
    await savePlan(samplePlan);
    const retrieved = await getPlan(samplePlan.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(samplePlan.id);
    expect(retrieved?.event.title).toBe('Pooja & Rohan Wedding');
  });

  it('lists saved plans and checks hasAnyPlans', async () => {
    await savePlan(samplePlan);
    const hasPlans = await hasAnyPlans();
    expect(hasPlans).toBe(true);

    const plans = await listPlans();
    expect(plans.some((p) => p.id === samplePlan.id)).toBe(true);
  });

  it('deletes a plan', async () => {
    await savePlan(samplePlan);
    await deletePlan(samplePlan.id);
    const retrieved = await getPlan(samplePlan.id);
    expect(retrieved).toBeNull();
  });

  it('manages snapshots and restores from a snapshot', async () => {
    await savePlan(samplePlan);
    const initialSnaps = await getSnapshots(samplePlan.id);
    expect(initialSnaps.length).toBeLessThanOrEqual(3);

    if (initialSnaps.length > 0) {
      const restored = await restoreSnapshot(samplePlan.id, initialSnaps[0].id);
      expect(restored).not.toBeNull();
      expect(restored?.id).toBe(samplePlan.id);
    }
  });
});

describe('Backup Export & Safe Import', () => {
  const planA = generatePlanFromTemplate({
    id: 'plan-backup-a',
    type: 'engagement',
    title: 'Engagement Gala',
    eventDate: '2026-10-15',
    guestEstimate: 80,
    budgetTotalPaise: 60000000,
  });

  it('exports a valid .toranly.json backup string', () => {
    const backupJson = exportPlanBackup(planA);
    const parsed = JSON.parse(backupJson);

    expect(parsed.format).toBe('toranly-backup');
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.plans).toHaveLength(1);
    expect(parsed.plans[0].id).toBe('plan-backup-a');
  });

  it('safely validates and imports backup JSON', () => {
    const backupJson = exportPlanBackup(planA);
    const result = parseBackupFile(backupJson);

    expect(result.success).toBe(true);
    expect(result.plans).toBeDefined();
    expect(result.plans![0].id).toBe('plan-backup-a');
  });

  it('rejects invalid JSON or files without toranly-backup format', () => {
    expect(parseBackupFile('{ not-valid-json').success).toBe(false);
    expect(parseBackupFile('{"format": "other", "schemaVersion": 1, "plans": []}').success).toBe(false);
  });

  it('detects existing ID conflicts before importing', async () => {
    await savePlan(planA);
    const check = await detectPlanConflicts([planA]);

    expect(check.conflicts).toHaveLength(1);
    expect(check.conflicts[0].incoming.id).toBe(planA.id);

    const planB = generatePlanFromTemplate({
      id: 'plan-backup-unique',
      type: 'birthday',
      title: 'Birthday Bash',
      eventDate: '2026-09-10',
    });

    const checkUnique = await detectPlanConflicts([planB]);
    expect(checkUnique.conflicts).toHaveLength(0);
    expect(checkUnique.nonConflicts).toHaveLength(1);
  });
});
