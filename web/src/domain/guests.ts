import type { IdeaItem } from './plan';

export interface DietBreakdown {
  veg: number;
  nonVeg: number;
  jain: number;
  eggetarian: number;
  vegan: number;
}

export interface DietValidationResult {
  valid: boolean;
  sum: number;
  expectedTotal: number;
  difference: number;
}

/**
 * Validates whether the dietary breakdown sums up to the total guest estimate.
 */
export function validateDietaryCounts(
  expectedTotal: number,
  breakdown: DietBreakdown,
): DietValidationResult {
  const sum =
    (breakdown.veg || 0) +
    (breakdown.nonVeg || 0) +
    (breakdown.jain || 0) +
    (breakdown.eggetarian || 0) +
    (breakdown.vegan || 0);

  const difference = sum - expectedTotal;

  return {
    valid: difference === 0,
    sum,
    expectedTotal,
    difference,
  };
}

export interface DietaryCoverageResult {
  coveredDiets: string[];
  uncoveredDiets: string[];
  isFullyCovered: boolean;
}

const DIET_KEYS: (keyof DietBreakdown)[] = ['veg', 'nonVeg', 'jain', 'eggetarian', 'vegan'];

/**
 * Checks which dietary groups with > 0 guests are covered by menu ideas.
 */
export function checkDietaryCoverage(
  breakdown: DietBreakdown,
  ideas: IdeaItem[],
): DietaryCoverageResult {
  const menuIdeas = ideas.filter((i) => i.kind === 'menu');
  const availableTags = new Set<string>();

  for (const idea of menuIdeas) {
    for (const tag of idea.dietTags || []) {
      availableTags.add(tag.toLowerCase().trim());
    }
  }

  const coveredDiets: string[] = [];
  const uncoveredDiets: string[] = [];

  for (const key of DIET_KEYS) {
    const count = breakdown[key] || 0;
    if (count > 0) {
      // Check if tag is present (e.g. 'veg', 'non-veg', 'jain', etc.)
      const normalizedKey = key.toLowerCase();
      const hasCoverage =
        availableTags.has(normalizedKey) ||
        availableTags.has(normalizedKey.replace('veg', '-veg')) ||
        (normalizedKey === 'nonveg' &&
          (availableTags.has('non-veg') ||
            availableTags.has('nonveg') ||
            availableTags.has('non_veg')));

      if (hasCoverage) {
        coveredDiets.push(key);
      } else {
        uncoveredDiets.push(key);
      }
    }
  }

  return {
    coveredDiets,
    uncoveredDiets,
    isFullyCovered: uncoveredDiets.length === 0,
  };
}
