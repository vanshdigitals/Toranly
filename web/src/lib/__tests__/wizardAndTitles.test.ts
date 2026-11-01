import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateDaysRemaining,
  createInitialWizardData,
  formatINR,
  getWizardDraft,
  saveWizardDraft,
} from '../eventState';
import { titleForPath } from '../routeTitle';

// Vitest runs in Node: a minimal in-memory localStorage for the draft functions.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

beforeEach(() => store.clear());

describe('wizard draft', () => {
  it('starts empty: no example names, cities, budgets or guest counts', () => {
    const draft = createInitialWizardData('wedding');
    expect(draft).toMatchObject({
      eventName: '',
      eventDate: '',
      city: '',
      budgetTotal: 0,
      guestEstimate: 0,
      functions: [],
    });
    expect(draft.preferences.themeWords).toEqual([]);
    expect(draft.preferences.notes).toBe('');
  });

  it('saves on this device and reads back the same values', () => {
    getWizardDraft('birthday');
    saveWizardDraft({ eventName: 'Aarav turns 7', city: 'Indore', guestEstimate: 40 });
    expect(getWizardDraft()).toMatchObject({
      eventName: 'Aarav turns 7',
      city: 'Indore',
      guestEstimate: 40,
    });
  });

  it('survives a corrupted stored draft by starting fresh', () => {
    localStorage.setItem('toranly_wizard_draft', '{not json');
    expect(getWizardDraft('wedding').eventName).toBe('');
  });
});

describe('formatting', () => {
  it('formats rupees with Indian grouping', () => {
    expect(formatINR(1250000, false)).toBe('₹12,50,000');
  });

  it('counts days to the event and never goes below zero', () => {
    const inTen = new Date();
    inTen.setDate(inTen.getDate() + 10);
    expect(calculateDaysRemaining(inTen.toISOString().slice(0, 10))).toBeGreaterThanOrEqual(9);
    expect(calculateDaysRemaining('2000-01-01')).toBe(0);
  });
});

describe('page titles', () => {
  it.each([
    ['/', 'Toranly — Celebration & Event Planner'],
    ['/events', 'My plans · Toranly'],
    ['/events/new', 'Plan a celebration · Toranly'],
    ['/events/evt-1', 'Overview · Toranly'],
    ['/events/evt-1/budget', 'Budget · Toranly'],
    ['/events/evt-1/ai-plan', 'AI plan · Toranly'],
    ['/nope', 'Page not found · Toranly'],
  ])('%s → %s', (path, title) => {
    expect(titleForPath(path)).toBe(title);
  });
});
