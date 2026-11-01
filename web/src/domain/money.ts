/**
 * Money and currency domain logic
 * Works strictly in integer paise for precision.
 */

export interface ShareInput {
  key: string;
  sharePercent: number;
  position?: number;
}

export interface SplitResult {
  key: string;
  sharePercent: number;
  allocatedPaise: number;
}

/**
 * Largest-Remainder Method (Hamilton-Hare)
 * Guarantees that the sum of allocated paise across shares strictly equals totalPaise,
 * distributing fractional remainders in order of largest decimal component.
 */
export function splitMoneyLargestRemainder(
  totalPaise: number,
  shares: ShareInput[],
): SplitResult[] {
  if (shares.length === 0) return [];
  if (totalPaise <= 0) {
    return shares.map((s) => ({
      key: s.key,
      sharePercent: s.sharePercent,
      allocatedPaise: 0,
    }));
  }

  // 1. Calculate floor and remainder for each share
  const items = shares.map((s, index) => {
    const exact = (totalPaise * s.sharePercent) / 100;
    const floored = Math.floor(exact);
    const remainder = exact - floored;
    return {
      key: s.key,
      sharePercent: s.sharePercent,
      floored,
      remainder,
      index,
    };
  });

  const sumFloored = items.reduce((acc, item) => acc + item.floored, 0);
  const leftover = totalPaise - sumFloored;

  // 2. Sort by remainder descending, tie-breaking by original position index
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 0.0000001) {
      return b.remainder - a.remainder;
    }
    return a.index - b.index;
  });

  const bonusKeys = new Set<string>();
  for (let i = 0; i < leftover && i < sorted.length; i++) {
    bonusKeys.add(sorted[i].key);
  }

  return items.map((item) => ({
    key: item.key,
    sharePercent: item.sharePercent,
    allocatedPaise: item.floored + (bonusKeys.has(item.key) ? 1 : 0),
  }));
}

/**
 * Convert Rupees to integer Paise.
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert integer Paise to Rupees.
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export interface FormatOptions {
  compact?: boolean;
  includeSymbol?: boolean;
  includeWords?: boolean;
}

/**
 * Formats paise into Indian Rupee formatting (e.g. ₹18,00,000 or ₹18 Lakh)
 */
export function formatPaise(paise: number, options: FormatOptions = {}): string {
  const { compact = false, includeSymbol = true, includeWords = false } = options;
  const rupees = Math.round(paise / 100);
  const abs = Math.abs(rupees);
  const prefix = (rupees < 0 ? '-' : '') + (includeSymbol ? '₹' : '');

  if (compact) {
    if (abs >= 10000000) {
      const cr = (abs / 10000000)
        .toFixed(2)
        .replace(/\.00$/, '')
        .replace(/(\.[1-9])0$/, '$1');
      return `${prefix}${cr} Cr`;
    }
    if (abs >= 100000) {
      const lakh = (abs / 100000)
        .toFixed(2)
        .replace(/\.00$/, '')
        .replace(/(\.[1-9])0$/, '$1');
      return `${prefix}${lakh} L`;
    }
    if (abs >= 1000) {
      const k = (abs / 1000).toFixed(1).replace(/\.0$/, '');
      return `${prefix}${k}k`;
    }
  }

  const formattedNumber = abs.toLocaleString('en-IN');
  const baseStr = `${prefix}${formattedNumber}`;

  if (includeWords && abs >= 100000) {
    if (abs >= 10000000) {
      const cr = (abs / 10000000).toFixed(2).replace(/\.00$/, '');
      return `${baseStr} (${cr} Crore)`;
    }
    const lakh = (abs / 100000).toFixed(2).replace(/\.00$/, '');
    return `${baseStr} (${lakh} Lakh)`;
  }

  return baseStr;
}
