import type { ScheduleItem } from './plan';

export interface ScheduleOverlap {
  itemA: ScheduleItem;
  itemB: ScheduleItem;
  functionId: string;
}

export interface EnrichedScheduleOverlap {
  id: string;
  itemA: ScheduleItem;
  itemB: ScheduleItem;
  functionId: string;
  overlapMinutes: number;
  overlapStartMinutes: number;
  overlapEndMinutes: number;
  overlapStartTime: string;
  overlapEndTime: string;
  suggestedShiftTime: string;
  suggestedShortenMinutes: number;
  explanation: string;
}

/**
 * Converts "HH:MM" string to minutes from midnight (0 - 1439).
 */
export function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
  return parts[0] * 60 + parts[1];
}

/**
 * Converts minutes from midnight back to 24-hour "HH:MM" format.
 */
export function minutesToTime(totalMinutes: number): string {
  const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats "HH:MM" into "10:00 AM" or "2:30 PM".
 */
export function formatClock(timeStr?: string): string {
  if (!timeStr) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(timeStr);
  if (!m) return timeStr;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Formats duration in minutes to concise readable label, e.g. "45 min" or "1 h 30 min".
 */
export function formatDuration(durationMin?: number): string {
  if (!durationMin || durationMin <= 0) return '0 min';
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  if (hours > 0 && mins > 0) return `${hours} h ${mins} min`;
  if (hours > 0) return `${hours} h`;
  return `${mins} min`;
}

/**
 * Detects overlapping schedule items within the same function.
 * Preserves exact backward-compatible signature.
 */
export function detectScheduleOverlaps(items: ScheduleItem[]): ScheduleOverlap[] {
  const byFunction = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const list = byFunction.get(item.functionId) || [];
    list.push(item);
    byFunction.set(item.functionId, list);
  }

  const overlaps: ScheduleOverlap[] = [];

  for (const [funcId, funcItems] of byFunction.entries()) {
    for (let i = 0; i < funcItems.length; i++) {
      const a = funcItems[i];
      const startA = timeToMinutes(a.startTime);
      const endA = startA + a.durationMin;

      for (let j = i + 1; j < funcItems.length; j++) {
        const b = funcItems[j];
        const startB = timeToMinutes(b.startTime);
        const endB = startB + b.durationMin;

        if (startA < endB && startB < endA) {
          overlaps.push({
            itemA: a,
            itemB: b,
            functionId: funcId,
          });
        }
      }
    }
  }

  return overlaps;
}

/**
 * Detects enriched overlapping items with detailed calculations, timing breakdown,
 * and pre-computed resolution proposals.
 */
export function detectEnrichedScheduleOverlaps(
  items: ScheduleItem[],
  ignoredIds?: Set<string>
): EnrichedScheduleOverlap[] {
  const byFunction = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const list = byFunction.get(item.functionId) || [];
    list.push(item);
    byFunction.set(item.functionId, list);
  }

  const enrichedList: EnrichedScheduleOverlap[] = [];

  for (const [funcId, funcItems] of byFunction.entries()) {
    // Sort items chronologically first
    const sorted = [...funcItems].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.position - b.position
    );

    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const startA = timeToMinutes(a.startTime);
      const endA = startA + a.durationMin;

      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const startB = timeToMinutes(b.startTime);
        const endB = startB + b.durationMin;

        if (startA < endB && startB < endA) {
          const overlapKey = `${funcId}:${a.id}:${b.id}`;
          if (ignoredIds && ignoredIds.has(overlapKey)) {
            continue;
          }

          const overlapStart = Math.max(startA, startB);
          const overlapEnd = Math.min(endA, endB);
          const overlapMinutes = Math.max(1, overlapEnd - overlapStart);

          const suggestedShiftTime = minutesToTime(endA);
          const suggestedShortenMinutes = overlapMinutes;

          const explanation = `${overlapMinutes}-minute overlap detected between "${a.title}" (${a.startTime} – ${minutesToTime(endA)}) and "${b.title}" (${b.startTime} – ${minutesToTime(endB)}).`;

          enrichedList.push({
            id: overlapKey,
            itemA: a,
            itemB: b,
            functionId: funcId,
            overlapMinutes,
            overlapStartMinutes: overlapStart,
            overlapEndMinutes: overlapEnd,
            overlapStartTime: minutesToTime(overlapStart),
            overlapEndTime: minutesToTime(overlapEnd),
            suggestedShiftTime,
            suggestedShortenMinutes,
            explanation,
          });
        }
      }
    }
  }

  return enrichedList;
}

/**
 * Resolves an overlap by shifting itemB so it starts immediately after itemA ends.
 * Also shifts downstream items within the same function to prevent domino overlaps.
 */
export function resolveByShifting(
  items: ScheduleItem[],
  overlap: ScheduleOverlap | EnrichedScheduleOverlap
): ScheduleItem[] {
  const startA = timeToMinutes(overlap.itemA.startTime);
  const endA = startA + overlap.itemA.durationMin;
  const newStartTime = minutesToTime(endA);
  const startB = timeToMinutes(overlap.itemB.startTime);
  const shiftDelta = Math.max(0, endA - startB);
  const newEndB = endA + overlap.itemB.durationMin;

  return items.map((item) => {
    if (item.id === overlap.itemB.id) {
      return {
        ...item,
        startTime: newStartTime,
      };
    }
    // Cascade shift subsequent items in the same function if they conflict with shifted item
    if (
      item.functionId === overlap.functionId &&
      item.id !== overlap.itemA.id &&
      item.id !== overlap.itemB.id
    ) {
      const itemStart = timeToMinutes(item.startTime);
      if (itemStart >= startB && itemStart < newEndB) {
        return {
          ...item,
          startTime: minutesToTime(itemStart + shiftDelta),
        };
      }
    }
    return item;
  });
}

/**
 * Resolves an overlap by shortening itemA so that it ends when itemB starts.
 */
export function resolveByShortening(
  items: ScheduleItem[],
  overlap: ScheduleOverlap | EnrichedScheduleOverlap
): ScheduleItem[] {
  const startA = timeToMinutes(overlap.itemA.startTime);
  const startB = timeToMinutes(overlap.itemB.startTime);
  const newDuration = Math.max(5, startB - startA);

  return items.map((item) => {
    if (item.id === overlap.itemA.id) {
      return {
        ...item,
        durationMin: newDuration,
      };
    }
    return item;
  });
}

export interface TimelineProgress {
  progressPercent: number; // 0 to 100
  state: 'upcoming' | 'in-progress' | 'completed';
  currentMinutes: number;
  activeItemId: string | null;
  completedItemIds: string[];
}

/**
 * Calculates progressive real-time timeline fill and item statuses
 * based strictly on the function date, time bounds, and the current clock.
 */
export function computeTimelineProgress(params: {
  functionDate: string; // "YYYY-MM-DD"
  functionStartTime?: string; // "HH:MM"
  functionEndTime?: string; // "HH:MM"
  items: ScheduleItem[];
  now: Date;
  simulatedMinutes?: number | null; // For manual time override / visual verification
}): TimelineProgress {
  const { functionDate, items, now, simulatedMinutes } = params;

  // Local date in YYYY-MM-DD
  const nowYear = now.getFullYear();
  const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
  const nowDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${nowYear}-${nowMonth}-${nowDay}`;

  const currentMinutes =
    typeof simulatedMinutes === 'number'
      ? simulatedMinutes
      : now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  // 1. If function is in the past, timeline is 100% complete
  if (functionDate < todayStr) {
    return {
      progressPercent: 100,
      state: 'completed',
      currentMinutes,
      activeItemId: null,
      completedItemIds: items.map((i) => i.id),
    };
  }

  // 2. If function is in the future on another date, timeline is unfilled (0%)
  if (functionDate > todayStr) {
    return {
      progressPercent: 0,
      state: 'upcoming',
      currentMinutes,
      activeItemId: null,
      completedItemIds: [],
    };
  }

  // 3. Function is TODAY
  // Determine overall function start and end bounds
  let startMinutes = params.functionStartTime ? timeToMinutes(params.functionStartTime) : 0;
  let endMinutes = params.functionEndTime ? timeToMinutes(params.functionEndTime) : 0;

  // If bounds not explicitly set, compute from schedule items
  if (items.length > 0) {
    const itemStartTimes = items.map((i) => timeToMinutes(i.startTime));
    const itemEndTimes = items.map((i) => timeToMinutes(i.startTime) + i.durationMin);
    const minItemStart = Math.min(...itemStartTimes);
    const maxItemEnd = Math.max(...itemEndTimes);

    if (!params.functionStartTime) startMinutes = minItemStart;
    if (!params.functionEndTime) endMinutes = maxItemEnd;
  }

  // Handle midnight wrap if endMinutes <= startMinutes
  if (endMinutes <= startMinutes && endMinutes > 0) {
    endMinutes += 24 * 60;
  }

  // Handle case where start and end are equal
  if (endMinutes <= startMinutes) {
    endMinutes = startMinutes + 60;
  }

  // Before function starts today
  if (currentMinutes < startMinutes) {
    return {
      progressPercent: 0,
      state: 'upcoming',
      currentMinutes,
      activeItemId: null,
      completedItemIds: [],
    };
  }

  // After function ends today
  if (currentMinutes >= endMinutes) {
    return {
      progressPercent: 100,
      state: 'completed',
      currentMinutes,
      activeItemId: null,
      completedItemIds: items.map((i) => i.id),
    };
  }

  // Function is actively in progress right now
  const elapsed = currentMinutes - startMinutes;
  const total = endMinutes - startMinutes;
  const progressPercent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 1000) / 10));

  // Determine active item and completed items
  let activeItemId: string | null = null;
  const completedItemIds: string[] = [];

  for (const item of items) {
    const itemStart = timeToMinutes(item.startTime);
    const itemEnd = itemStart + item.durationMin;

    if (currentMinutes >= itemEnd) {
      completedItemIds.push(item.id);
    } else if (currentMinutes >= itemStart && currentMinutes < itemEnd) {
      activeItemId = item.id;
    }
  }

  return {
    progressPercent,
    state: 'in-progress',
    currentMinutes,
    activeItemId,
    completedItemIds,
  };
}

/**
 * Intelligently drafts authentic ceremonial schedule items for a given function name.
 */
export function generateDraftScheduleForFunction(
  functionId: string,
  functionName: string,
  defaultStartTime: string = '10:00'
): ScheduleItem[] {
  const lower = functionName.toLowerCase();
  const startMin = timeToMinutes(defaultStartTime);

  const makeItem = (
    idx: number,
    offsetMin: number,
    durationMin: number,
    title: string,
    notes: string
  ): ScheduleItem => ({
    id: `sched-${functionId}-${idx}-${Date.now()}`,
    functionId,
    startTime: minutesToTime(startMin + offsetMin),
    durationMin,
    title,
    notes,
    position: idx,
  });

  if (lower.includes('wedding') || lower.includes('shaadi') || lower.includes('phera')) {
    return [
      makeItem(1, 0, 45, 'Baraat arrival', 'Procession at grand gate, dhol troupe and milni scarves ready'),
      makeItem(2, 45, 30, 'Jaimala', 'Floral stage exchange, rose petal shower coordination'),
      makeItem(3, 75, 90, 'Pheras', 'Vedic ceremony inside mandap (Pandit Ji confirmed for 11:15 sharp)'),
      makeItem(4, 150, 90, 'Lunch', 'Buffet opens while Vedic phero ceremony is still underway. Guests cannot attend both simultaneously unless planned as concurrent.'),
      makeItem(5, 240, 45, 'Vidaai', 'Farewell ritual at main porch, vintage car departure at 14:45'),
    ];
  }

  if (lower.includes('mehendi') || lower.includes('mehndi')) {
    return [
      makeItem(1, 0, 60, 'Guests arrive and welcome drinks', 'Thandai counter, fresh sugarcane juice stall, and floral gajra welcome'),
      makeItem(2, 60, 90, 'Mehendi for the bride', 'Traditional bridal henna artist application with photo moments'),
      makeItem(3, 150, 60, 'Folk dances and dholki', 'Sangeet practice, family performances and dholki songs'),
      makeItem(4, 210, 90, 'High tea and chaat street buffet', 'Live golgappa, kachori and hot jalebi stations'),
    ];
  }

  if (lower.includes('sangeet')) {
    return [
      makeItem(1, 0, 45, 'Welcome mocktails & appetizers', 'Signature cocktail bar and live acoustic singer'),
      makeItem(2, 45, 75, 'Family dance choreography', 'Bride & groom family dance sequences and awards'),
      makeItem(3, 120, 60, 'DJ and open dance floor', 'High energy celebration with Punjabi dhol & lights'),
      makeItem(4, 180, 60, 'Gala dinner feast', 'Midnight snack counter and grand buffet spread'),
    ];
  }

  if (lower.includes('reception')) {
    return [
      makeItem(1, 0, 60, 'Red carpet arrivals & photo booth', 'Welcome drinks, live string quartet and stage photos'),
      makeItem(2, 60, 45, 'Couple grand entrance & cake cutting', 'Champagne toast, speeches and ceremonial cake cutting'),
      makeItem(3, 105, 90, 'Banquet dinner & musical evening', 'Multi-course plated royal banquet and live ghazal band'),
      makeItem(4, 195, 30, 'Farewell & thank-you gifts', 'Shagun return favors and concluding family photographs'),
    ];
  }

  if (lower.includes('haldi')) {
    return [
      makeItem(1, 0, 60, 'Haldi ritual & floral holi', 'Yellow paste application with yellow marigold petals shower'),
      makeItem(2, 60, 45, 'Holy bath & change of attire', 'Mangalsnan ritual followed by family blessings'),
      makeItem(3, 105, 60, 'Traditional festive lunch', 'Authentic satvik feast on banana leaves'),
    ];
  }

  // Generic Celebration Itinerary
  return [
    makeItem(1, 0, 45, 'Welcome & guest arrival', 'Warm reception, welcome drinks, and introductory mingling'),
    makeItem(2, 45, 90, 'Ceremony & main event', 'Key rituals, speeches, and highlighted moments'),
    makeItem(3, 135, 75, 'Celebration dinner & drinks', 'Festive banquet catering and social dining'),
    makeItem(4, 210, 45, 'Photography & wrap up', 'Group photographs, favors distribution, and closing remarks'),
  ];
}
