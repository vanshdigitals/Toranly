import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  formatClock,
  formatDuration,
  detectScheduleOverlaps,
  detectEnrichedScheduleOverlaps,
  resolveByShifting,
  resolveByShortening,
  computeTimelineProgress,
  generateDraftScheduleForFunction,
} from '../schedule';
import type { ScheduleItem } from '../plan';

describe('Domain: Schedule & Real-Time Timeline', () => {
  it('converts time to minutes and back to time accurately', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('10:00')).toBe(600);
    expect(timeToMinutes('14:45')).toBe(885);
    expect(timeToMinutes('23:59')).toBe(1439);

    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(600)).toBe('10:00');
    expect(minutesToTime(885)).toBe('14:45');
    expect(minutesToTime(1439)).toBe('23:59');
  });

  it('formats clock and duration cleanly', () => {
    expect(formatClock('10:00')).toBe('10:00 AM');
    expect(formatClock('12:30')).toBe('12:30 PM');
    expect(formatClock('15:00')).toBe('3:00 PM');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(120)).toBe('2 h');
  });

  it('detects enriched overlaps with precise duration and proposals', () => {
    const items: ScheduleItem[] = [
      {
        id: 'item-1',
        functionId: 'fn-wedding',
        startTime: '11:15',
        durationMin: 90,
        title: 'Pheras',
        position: 1,
      },
      {
        id: 'item-2',
        functionId: 'fn-wedding',
        startTime: '12:30',
        durationMin: 90,
        title: 'Lunch',
        position: 2,
      },
    ];

    const overlaps = detectEnrichedScheduleOverlaps(items);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].overlapMinutes).toBe(15);
    expect(overlaps[0].overlapStartTime).toBe('12:30');
    expect(overlaps[0].overlapEndTime).toBe('12:45');
    expect(overlaps[0].suggestedShiftTime).toBe('12:45');
    expect(overlaps[0].suggestedShortenMinutes).toBe(15);

    // Verify resolveByShifting shifts itemB
    const shifted = resolveByShifting(items, overlaps[0]);
    const shiftedLunch = shifted.find((i) => i.id === 'item-2');
    expect(shiftedLunch?.startTime).toBe('12:45');

    // After shifting, there are no overlaps
    expect(detectScheduleOverlaps(shifted)).toHaveLength(0);

    // Verify resolveByShortening shortens itemA
    const shortened = resolveByShortening(items, overlaps[0]);
    const shortenedPheras = shortened.find((i) => i.id === 'item-1');
    expect(shortenedPheras?.durationMin).toBe(75);

    // After shortening, there are no overlaps
    expect(detectScheduleOverlaps(shortened)).toHaveLength(0);
  });

  it('calculates real-time timeline progress for past, future, and today events', () => {
    const items: ScheduleItem[] = [
      {
        id: '1',
        functionId: 'fn-1',
        startTime: '10:00',
        durationMin: 60,
        title: 'Arrival',
        position: 1,
      },
      {
        id: '2',
        functionId: 'fn-1',
        startTime: '11:00',
        durationMin: 60,
        title: 'Ceremony',
        position: 2,
      },
      {
        id: '3',
        functionId: 'fn-1',
        startTime: '12:00',
        durationMin: 60,
        title: 'Feast',
        position: 3,
      },
    ];

    // 1. Past function on another date: 100% complete
    const pastRes = computeTimelineProgress({
      functionDate: '2020-01-01',
      functionStartTime: '10:00',
      functionEndTime: '13:00',
      items,
      now: new Date('2026-10-31T12:00:00'),
    });
    expect(pastRes.state).toBe('completed');
    expect(pastRes.progressPercent).toBe(100);
    expect(pastRes.completedItemIds).toHaveLength(3);

    // 2. Future function on another date: 0% complete, no fake elapsed progress
    const futureRes = computeTimelineProgress({
      functionDate: '2030-01-01',
      functionStartTime: '10:00',
      functionEndTime: '13:00',
      items,
      now: new Date('2026-10-31T12:00:00'),
    });
    expect(futureRes.state).toBe('upcoming');
    expect(futureRes.progressPercent).toBe(0);
    expect(futureRes.completedItemIds).toHaveLength(0);

    // 3. Today, before function start: 0%
    const todayStr = '2026-10-31';
    const beforeStartRes = computeTimelineProgress({
      functionDate: todayStr,
      functionStartTime: '10:00',
      functionEndTime: '13:00',
      items,
      now: new Date('2026-10-31T08:30:00'),
      simulatedMinutes: 8 * 60 + 30, // 08:30
    });
    expect(beforeStartRes.state).toBe('upcoming');
    expect(beforeStartRes.progressPercent).toBe(0);

    // 4. Today, during function: 50% through at 11:30 (start 10:00, end 13:00 is 180 min total; 90 min elapsed = 50%)
    const midRes = computeTimelineProgress({
      functionDate: todayStr,
      functionStartTime: '10:00',
      functionEndTime: '13:00',
      items,
      now: new Date('2026-10-31T11:30:00'),
      simulatedMinutes: 11 * 60 + 30, // 11:30
    });
    expect(midRes.state).toBe('in-progress');
    expect(midRes.progressPercent).toBe(50);
    expect(midRes.activeItemId).toBe('2'); // Ceremony is active between 11:00 and 12:00
    expect(midRes.completedItemIds).toEqual(['1']); // Arrival is completed

    // 5. Today, after function end: 100%
    const afterRes = computeTimelineProgress({
      functionDate: todayStr,
      functionStartTime: '10:00',
      functionEndTime: '13:00',
      items,
      now: new Date('2026-10-31T14:00:00'),
      simulatedMinutes: 14 * 60, // 14:00
    });
    expect(afterRes.state).toBe('completed');
    expect(afterRes.progressPercent).toBe(100);
    expect(afterRes.completedItemIds).toHaveLength(3);
  });

  it('generates rich draft schedule for common celebrations', () => {
    const weddingDraft = generateDraftScheduleForFunction('fn-w', 'Wedding Ceremony', '10:00');
    expect(weddingDraft.length).toBeGreaterThanOrEqual(4);
    expect(weddingDraft[0].title).toBe('Baraat arrival');

    const mehendiDraft = generateDraftScheduleForFunction('fn-m', 'Mehendi & Sangeet', '16:00');
    expect(mehendiDraft.length).toBeGreaterThanOrEqual(4);
    expect(mehendiDraft[0].startTime).toBe('16:00');
  });
});
