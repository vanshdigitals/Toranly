import { describe, it, expect } from 'vitest';
import { formatDisplayDate } from '../../lib/dateFormat';
import { generatePlanFromTemplate } from '../templates';
import { generateBudgetCsv, generateTasksCsv } from '../export';
import { exportPlanBackup, parseBackupFile } from '../../storage/backup';

describe('Date Formatting Specification', () => {
  it('formats dates strictly as "15 Feb 2027" (Intl en-GB day/month/year)', () => {
    expect(formatDisplayDate('2027-02-15')).toBe('15 Feb 2027');
    expect(formatDisplayDate('2026-12-25')).toBe('25 Dec 2026');
    expect(formatDisplayDate('2028-01-01')).toBe('1 Jan 2028');
  });

  it('handles ISO timestamps with time components without timezone drift', () => {
    expect(formatDisplayDate('2027-02-15T18:30:00.000Z')).toBe('15 Feb 2027');
  });

  it('handles missing or empty dates gracefully', () => {
    expect(formatDisplayDate(null)).toBe('Date unset');
    expect(formatDisplayDate(undefined)).toBe('Date unset');
    expect(formatDisplayDate('')).toBe('Date unset');
  });

  it('handles invalid date strings by returning the raw string fallback', () => {
    expect(formatDisplayDate('invalid-date')).toBe('invalid-date');
  });
});

describe('Settings Export & Backup Integration', () => {
  const plan = generatePlanFromTemplate({
    title: 'Ananya & Rohan Wedding',
    type: 'wedding',
    eventDate: '2027-02-15',
    city: 'Udaipur',
    guestEstimate: 250,
    budgetTotalPaise: 250000000, // ₹25,00,000
  });

  it('generates valid budget CSV with correct headers', () => {
    const csv = generateBudgetCsv(plan);
    expect(csv).toContain('Category,Allocated (INR),Committed (INR),Paid (INR),Remaining (INR),Status');
    expect(csv).toContain('Venue & Stays,700000.00');
    expect(csv).toContain('TOTAL,2500000.00');
  });

  it('generates valid tasks CSV with correct headers', () => {
    const csv = generateTasksCsv(plan);
    expect(csv).toContain('Task Title,Category,Due Date,Status,Milestone,Dependencies');
    expect(csv).toContain('Lock in main venue & dates,venue');
  });

  it('exports and safely parses plan backups via .toranly.json format', () => {
    const backupJson = exportPlanBackup(plan);
    const parsed = parseBackupFile(backupJson);
    expect(parsed.success).toBe(true);
    expect(parsed.plans).toHaveLength(1);
    expect(parsed.plans![0].event.title).toBe('Ananya & Rohan Wedding');
    expect(parsed.plans![0].event.eventDate).toBe('2027-02-15');
  });
});
