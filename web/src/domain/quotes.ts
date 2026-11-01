import type { QuoteItem } from './plan';

export interface NormalizedQuote {
  id: string;
  vendorId: string;
  rawAmountPaise: number;
  unit: 'total' | 'per_plate' | 'per_guest';
  units?: number;
  totalCalculatedPaise: number;
  perGuestPaise: number;
  inclusions: string[];
  validUntil?: string;
  isCheapest: boolean;
}

/**
 * Normalizes a quote into total paise and per-guest paise.
 */
export function normalizeQuote(
  quote: QuoteItem,
  guestCount: number,
): { totalPaise: number; perGuestPaise: number } {
  const safeGuests = Math.max(1, guestCount);
  let totalPaise = quote.amountPaise;

  if (quote.unit === 'per_plate' || quote.unit === 'per_guest') {
    const multiplier =
      typeof quote.units === 'number' && quote.units > 0 ? quote.units : safeGuests;
    totalPaise = quote.amountPaise * multiplier;
  }

  const perGuestPaise = Math.round(totalPaise / safeGuests);
  return { totalPaise, perGuestPaise };
}

/**
 * Normalizes a list of quotes and marks the cheapest one.
 */
export function normalizeAndCompareQuotes(
  quotes: QuoteItem[] = [],
  guestCount: number = 0,
): NormalizedQuote[] {
  if (!quotes || quotes.length === 0) return [];

  const normalized = quotes.map((q) => {
    const { totalPaise, perGuestPaise } = normalizeQuote(q, guestCount);
    return {
      id: q.id,
      vendorId: q.vendorId,
      rawAmountPaise: q.amountPaise,
      unit: q.unit,
      units: q.units,
      totalCalculatedPaise: totalPaise,
      perGuestPaise,
      inclusions: q.inclusions,
      validUntil: q.validUntil,
      isCheapest: false,
    };
  });

  // Find lowest total
  let lowestTotal = Infinity;
  for (const n of normalized) {
    if (n.totalCalculatedPaise < lowestTotal) {
      lowestTotal = n.totalCalculatedPaise;
    }
  }

  return normalized.map((n) => ({
    ...n,
    isCheapest: n.totalCalculatedPaise === lowestTotal && lowestTotal !== Infinity,
  }));
}
