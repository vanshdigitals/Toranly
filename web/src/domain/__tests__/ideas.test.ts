import { describe, it, expect } from 'vitest';
import { checkDietaryCoverage } from '../guests';
import { IdeaItemSchema, type IdeaItem } from '../plan';

describe('Ideas Domain & Validation', () => {
  it('validates a correct IdeaItemSchema', () => {
    const raw = {
      id: 'idea-123',
      kind: 'theme',
      title: 'Marigold Courtyard',
      body: 'Warm fairy lights and brass lamps.',
      dietTags: [],
      estimateMinPaise: 4500000,
      estimateMaxPaise: 7000000,
      source: 'ai',
      confirmed: false,
    };

    const parsed = IdeaItemSchema.parse(raw);
    expect(parsed.id).toBe('idea-123');
    expect(parsed.kind).toBe('theme');
    expect(parsed.title).toBe('Marigold Courtyard');
    expect(parsed.estimateMinPaise).toBe(4500000);
    expect(parsed.estimateMaxPaise).toBe(7000000);
    expect(parsed.confirmed).toBe(false);
  });

  it('validates personalization and notes on IdeaItemSchema', () => {
    const raw = {
      id: 'idea-456',
      kind: 'decor',
      title: 'Family photo wall',
      body: 'Old wedding photos near the entrance.',
      source: 'user',
      personalized: true,
      personalNote: 'Include gold framed photos.',
    };

    const parsed = IdeaItemSchema.parse(raw);
    expect(parsed.personalized).toBe(true);
    expect(parsed.personalNote).toBe('Include gold framed photos.');
  });

  it('accurately identifies dietary coverage and uncovered diet groups with guests', () => {
    const breakdown = {
      veg: 120,
      nonVeg: 80,
      jain: 30,
      eggetarian: 10,
      vegan: 0,
    };

    const ideas: IdeaItem[] = [
      {
        id: 'i-1',
        kind: 'menu',
        title: 'Paneer tikka',
        dietTags: ['Veg', 'Jain'],
        source: 'ai',
      },
      {
        id: 'i-2',
        kind: 'menu',
        title: 'Chicken seekh kebab',
        dietTags: ['Non-veg'],
        source: 'ai',
      },
    ];

    const coverage = checkDietaryCoverage(breakdown, ideas);
    expect(coverage.coveredDiets).toContain('veg');
    expect(coverage.coveredDiets).toContain('nonVeg');
    expect(coverage.coveredDiets).toContain('jain');
    // Eggetarian has 10 guests but no menu ideas!
    expect(coverage.uncoveredDiets).toContain('eggetarian');
    expect(coverage.isFullyCovered).toBe(false);
  });

  it('marks isFullyCovered when all non-zero dietary groups have menu ideas', () => {
    const breakdown = {
      veg: 50,
      nonVeg: 0,
      jain: 20,
      eggetarian: 0,
      vegan: 0,
    };

    const ideas: IdeaItem[] = [
      {
        id: 'i-1',
        kind: 'menu',
        title: 'Dal Baati Churma',
        dietTags: ['veg', 'jain'],
        source: 'user',
      },
    ];

    const coverage = checkDietaryCoverage(breakdown, ideas);
    expect(coverage.isFullyCovered).toBe(true);
    expect(coverage.uncoveredDiets).toHaveLength(0);
  });
});
