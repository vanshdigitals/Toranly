import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  ClipboardList,
  MoreVertical,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import type { Plan, FunctionItem, ScheduleItem } from '../domain/plan';
import {
  timeToMinutes,
  minutesToTime,
  formatDuration,
  detectEnrichedScheduleOverlaps,
  resolveByShifting,
  resolveByShortening,
  computeTimelineProgress,
  generateDraftScheduleForFunction,
  type EnrichedScheduleOverlap,
} from '../domain/schedule';
import { formatDisplayDate } from '../lib/dateFormat';
import './ScheduleTab.css';

interface ScheduleTabProps {
  plan: Plan;
  onSavePlan: (updatedPlan: Plan) => Promise<void>;
  onShowToast: (message: string) => void;
  onOpenAddFunction: () => void;
  onOpenEditFunction: (fn: FunctionItem) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  plan,
  onSavePlan,
  onShowToast,
  onOpenAddFunction,
  onOpenEditFunction,
}) => {
  // Sort functions chronologically
  const sortedFunctions = useMemo(() => {
    return [...plan.functions].sort(
      (a, b) =>
        (a.date || '').localeCompare(b.date || '') ||
        (a.startTime || '99:99').localeCompare(b.startTime || '99:99') ||
        a.position - b.position,
    );
  }, [plan.functions]);

  // Selected function state
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(() => {
    return sortedFunctions.length > 0 ? sortedFunctions[0].id : null;
  });

  // Ensure valid selection if functions change
  useEffect(() => {
    if (sortedFunctions.length > 0) {
      if (!selectedFunctionId || !sortedFunctions.some((f) => f.id === selectedFunctionId)) {
        setSelectedFunctionId(sortedFunctions[0].id);
      }
    } else {
      setSelectedFunctionId(null);
    }
  }, [sortedFunctions, selectedFunctionId]);

  const activeFunction = useMemo(() => {
    return sortedFunctions.find((f) => f.id === selectedFunctionId) || null;
  }, [sortedFunctions, selectedFunctionId]);

  // Active items for the selected function
  const activeItems = useMemo(() => {
    if (!activeFunction) return [];
    return plan.scheduleItems
      .filter((i) => i.functionId === activeFunction.id)
      .sort(
        (a, b) =>
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.position - b.position,
      );
  }, [plan.scheduleItems, activeFunction]);

  // Ignored / concurrent overlap keys
  const [ignoredOverlapKeys, setIgnoredOverlapKeys] = useState<Set<string>>(new Set());

  // Overlaps detection across all functions
  const allOverlaps = useMemo(() => {
    return detectEnrichedScheduleOverlaps(plan.scheduleItems, ignoredOverlapKeys);
  }, [plan.scheduleItems, ignoredOverlapKeys]);

  // Overlaps mapped by function ID
  const overlapsByFunction = useMemo(() => {
    const map = new Map<string, EnrichedScheduleOverlap[]>();
    for (const overlap of allOverlaps) {
      const list = map.get(overlap.functionId) || [];
      list.push(overlap);
      map.set(overlap.functionId, list);
    }
    return map;
  }, [allOverlaps]);

  const activeFunctionOverlaps = useMemo(() => {
    if (!activeFunction) return [];
    return overlapsByFunction.get(activeFunction.id) || [];
  }, [overlapsByFunction, activeFunction]);

  // Real-time clock update (every 10s)
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Timeline Progress calculation
  const timelineProgress = useMemo(() => {
    if (!activeFunction) {
      return {
        progressPercent: 0,
        state: 'upcoming' as const,
        currentMinutes: 0,
        activeItemId: null,
        completedItemIds: [],
      };
    }
    return computeTimelineProgress({
      functionDate: activeFunction.date,
      functionStartTime: activeFunction.startTime,
      functionEndTime: activeFunction.endTime,
      items: activeItems,
      now,
      simulatedMinutes: null,
    });
  }, [activeFunction, activeItems, now]);

  // Dialog states for Add/Edit item
  const [itemDialogOpen, setItemDialogOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Function / Item more menu states
  const [activeItemMenuId, setActiveItemMenuId] = useState<string | null>(null);
  const [functionMenuOpen, setFunctionMenuOpen] = useState<boolean>(false);

  // Close menus on outside click or escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sched-menu-anchor')) {
        setActiveItemMenuId(null);
        setFunctionMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveItemMenuId(null);
        setFunctionMenuOpen(false);
      }
    };
    window.addEventListener('click', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Form states for Item Dialog
  const [itemTitle, setItemTitle] = useState('');
  const [itemStartTime, setItemStartTime] = useState('');
  const [itemDuration, setItemDuration] = useState<number>(45);
  const [itemNotes, setItemNotes] = useState('');
  const [itemFormError, setItemFormError] = useState<string | null>(null);

  const openAddItem = () => {
    setEditingItem(null);
    setItemTitle('');
    // Default start time to last item's end time or function's start time or '10:00'
    let defaultStart = activeFunction?.startTime || '10:00';
    if (activeItems.length > 0) {
      const last = activeItems[activeItems.length - 1];
      const nextMin = timeToMinutes(last.startTime) + last.durationMin;
      defaultStart = minutesToTime(nextMin);
    }
    setItemStartTime(defaultStart);
    setItemDuration(45);
    setItemNotes('');
    setItemFormError(null);
    setItemDialogOpen(true);
  };

  const openEditItem = (item: ScheduleItem) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemStartTime(item.startTime);
    setItemDuration(item.durationMin);
    setItemNotes(item.notes || '');
    setItemFormError(null);
    setItemDialogOpen(true);
    setActiveItemMenuId(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFunction) return;
    if (!itemTitle.trim()) {
      setItemFormError('Please enter an activity title.');
      return;
    }
    if (!itemStartTime) {
      setItemFormError('Please select a start time.');
      return;
    }
    if (itemDuration < 5) {
      setItemFormError('Duration must be at least 5 minutes.');
      return;
    }

    let updatedItems: ScheduleItem[];
    if (editingItem) {
      updatedItems = plan.scheduleItems.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              title: itemTitle.trim(),
              startTime: itemStartTime,
              durationMin: itemDuration,
              notes: itemNotes.trim() || undefined,
            }
          : item,
      );
      onShowToast(`Updated "${itemTitle.trim()}"`);
    } else {
      const newItem: ScheduleItem = {
        id: `sched-${activeFunction.id}-${Date.now().toString(36)}`,
        functionId: activeFunction.id,
        startTime: itemStartTime,
        durationMin: itemDuration,
        title: itemTitle.trim(),
        notes: itemNotes.trim() || undefined,
        position: activeItems.length + 1,
      };
      updatedItems = [...plan.scheduleItems, newItem];
      onShowToast(`Added "${itemTitle.trim()}" to schedule`);
    }

    await onSavePlan({
      ...plan,
      scheduleItems: updatedItems,
    });
    setItemDialogOpen(false);
  };

  const handleDeleteItem = async (itemId: string, itemTitle: string) => {
    if (!window.confirm(`Are you sure you want to remove "${itemTitle}" from this schedule?`)) {
      return;
    }
    const updated = plan.scheduleItems.filter((i) => i.id !== itemId);
    await onSavePlan({
      ...plan,
      scheduleItems: updated,
    });
    onShowToast(`Removed "${itemTitle}"`);
    setActiveItemMenuId(null);
  };

  const handleDeleteFunction = async (fn: FunctionItem) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${fn.name}"? All schedule items for this ceremony will also be removed.`,
      )
    ) {
      return;
    }
    const updatedFunctions = plan.functions.filter((f) => f.id !== fn.id);
    const updatedItems = plan.scheduleItems.filter((i) => i.functionId !== fn.id);
    await onSavePlan({
      ...plan,
      functions: updatedFunctions,
      scheduleItems: updatedItems,
    });
    onShowToast(`Deleted "${fn.name}"`);
    setFunctionMenuOpen(false);
  };

  // Fill a function with Toranly's standard run of show (a template, not AI)
  const [isAddingStandard, setIsAddingStandard] = useState(false);
  const handleUseStandardSchedule = async (fn: FunctionItem) => {
    setIsAddingStandard(true);
    try {
      const draftItems = generateDraftScheduleForFunction(fn.id, fn.name, fn.startTime || '10:00');

      // Keep items from other functions, replace items for this function with the draft
      const otherItems = plan.scheduleItems.filter((i) => i.functionId !== fn.id);
      const updatedSchedule = [...otherItems, ...draftItems];

      await onSavePlan({
        ...plan,
        scheduleItems: updatedSchedule,
      });

      onShowToast(`Standard schedule added for ${fn.name} (${draftItems.length} items)`);
    } finally {
      setIsAddingStandard(false);
    }
  };

  // Conflict Resolution: Shift item B
  const handleResolveShift = async (overlap: EnrichedScheduleOverlap) => {
    const updated = resolveByShifting(plan.scheduleItems, overlap);
    await onSavePlan({
      ...plan,
      scheduleItems: updated,
    });
    onShowToast(`Shifted "${overlap.itemB.title}" to ${overlap.suggestedShiftTime}`);
  };

  // Conflict Resolution: Shorten item A
  const handleResolveShorten = async (overlap: EnrichedScheduleOverlap) => {
    const updated = resolveByShortening(plan.scheduleItems, overlap);
    await onSavePlan({
      ...plan,
      scheduleItems: updated,
    });
    onShowToast(`Shortened "${overlap.itemA.title}" by ${overlap.suggestedShortenMinutes} min`);
  };

  // Conflict Resolution: Ignore / Keep concurrent
  const handleResolveIgnore = (overlap: EnrichedScheduleOverlap) => {
    setIgnoredOverlapKeys((prev) => {
      const next = new Set(prev);
      next.add(overlap.id);
      return next;
    });
    onShowToast(`Marked "${overlap.itemA.title}" and "${overlap.itemB.title}" as concurrent`);
  };

  // Event Month & Year formatting
  const eventMonthYear = useMemo(() => {
    const rawDate = plan.event.eventDate || (sortedFunctions[0]?.date ?? '');
    if (!rawDate) return '';
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    } catch {
      // ignore
    }
    return '';
  }, [plan.event.eventDate, sortedFunctions]);

  // Ends timing calculation for active function
  const activeFunctionEndsText = useMemo(() => {
    if (!activeFunction) return '';
    if (activeItems.length > 0) {
      const last = activeItems[activeItems.length - 1];
      const endMin = timeToMinutes(last.startTime) + last.durationMin;
      return `ends ${minutesToTime(endMin)}`;
    }
    if (activeFunction.endTime) {
      return `ends ${activeFunction.endTime}`;
    }
    return '';
  }, [activeFunction, activeItems]);

  return (
    <div className="sched-page-container">
      {/* Page Header */}
      <header className="sched-page-header">
        <div>
          <h1 className="sched-page-title">Schedule</h1>
          <p className="sched-page-desc">
            Plan each function hour by hour. Toranly flags overlaps and items outside a function's
            time.
          </p>
        </div>
        <div className="sched-header-actions">
          {/* Add Function Primary Button (Mandatory Dark Teal with White Text & White Icon) */}
          <button type="button" className="sched-primary-btn" onClick={onOpenAddFunction}>
            <Plus size={18} />
            <span>Add function</span>
          </button>
        </div>
      </header>

      {/* Two-Column Grid Layout */}
      <div className="sched-layout-grid">
        {/* Left Column: Functions Rail */}
        <aside className="sched-sidebar-rail" aria-label="Functions navigation">
          <div className="sched-functions-card">
            <div className="sched-functions-card-header">
              <span className="sched-functions-title">Functions ({sortedFunctions.length})</span>
              {eventMonthYear && <span className="sched-functions-month">{eventMonthYear}</span>}
            </div>

            <nav className="sched-functions-list">
              {sortedFunctions.map((fn) => {
                const isActive = fn.id === selectedFunctionId;
                const fnOverlaps = overlapsByFunction.get(fn.id) || [];
                const fnItems = plan.scheduleItems.filter((i) => i.functionId === fn.id);
                const hasOverlap = fnOverlaps.length > 0;

                return (
                  <button
                    key={fn.id}
                    type="button"
                    className={`sched-function-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedFunctionId(fn.id)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="sched-function-item-header">
                      <span className="sched-function-item-name">{fn.name}</span>
                      {hasOverlap ? (
                        <span className="sched-conflict-pill">
                          <AlertTriangle size={12} />
                          <span>
                            {fnOverlaps.length} overlap ({fnOverlaps[0].overlapMinutes} min)
                          </span>
                        </span>
                      ) : (
                        <span className="sched-intact-pill">No issues</span>
                      )}
                    </div>
                    <div className="sched-function-meta">
                      <div>
                        {formatDisplayDate(fn.date)}
                        {fn.startTime && ` · ${fn.startTime}`}
                        {fn.endTime && ` to ${fn.endTime}`}
                      </div>
                      <div className="sched-function-items-count">
                        {fnItems.length} {fnItems.length === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  </button>
                );
              })}

              {sortedFunctions.length === 0 && (
                <div
                  style={{
                    padding: '16px 8px',
                    textAlign: 'center',
                    color: '#8b92a0',
                    fontSize: '13px',
                  }}
                >
                  No functions yet. Click <strong>Add function</strong> above to start.
                </div>
              )}
            </nav>
          </div>

          {/* Timeline Hygiene Information Card */}
          <div className="sched-hygiene-card">
            <div className="sched-hygiene-header">
              <Lightbulb size={16} />
              <span>Timeline Hygiene</span>
            </div>
            <p className="sched-hygiene-text">
              Toranly detects concurrent ritual &amp; catering times. Resolving overlaps ensures
              sacred rites are uninterrupted and food remains fresh.
            </p>
          </div>
        </aside>

        {/* Right Column: Function Detailed Schedule */}
        <section className="sched-main-card" aria-label="Function schedule">
          {activeFunction ? (
            <>
              {/* Function Header Row */}
              <div className="sched-card-top-header">
                <div>
                  <div className="sched-function-title-row">
                    <h2 className="sched-function-headline">{activeFunction.name}</h2>
                    {activeFunctionOverlaps.length > 0 ? (
                      <span className="sched-status-badge warning">
                        <AlertTriangle size={13} />
                        <span>Conflict detected</span>
                      </span>
                    ) : timelineProgress.state === 'in-progress' ? (
                      <span className="sched-status-badge in-progress">
                        <span
                          className="sched-timeline-dot active"
                          style={{ width: 8, height: 8 }}
                        />
                        <span>In progress</span>
                      </span>
                    ) : (
                      <span className="sched-status-badge success">
                        <CheckCircle2 size={13} />
                        <span>Schedule intact</span>
                      </span>
                    )}
                  </div>
                  <p className="sched-timing-meta">
                    {formatDisplayDate(activeFunction.date)}
                    {activeFunction.startTime && ` · ${activeFunction.startTime}`}
                    {activeFunction.endTime && ` to ${activeFunction.endTime}`}
                    {activeFunctionEndsText && (
                      <>
                        {' · '}
                        <strong>{activeFunctionEndsText}</strong>
                      </>
                    )}
                  </p>
                </div>

                {/* Right Top Actions */}
                <div className="sched-card-actions">
                  <button type="button" className="sched-secondary-btn" onClick={openAddItem}>
                    <Plus size={16} />
                    <span>Add item</span>
                  </button>

                  <button
                    type="button"
                    className="sched-secondary-btn"
                    onClick={() => handleUseStandardSchedule(activeFunction)}
                    disabled={isAddingStandard}
                  >
                    <ClipboardList size={16} aria-hidden="true" />
                    <span>{isAddingStandard ? 'Adding…' : 'Use standard schedule'}</span>
                  </button>

                  {/* Function More Menu */}
                  <div className="sched-menu-anchor" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="sched-icon-btn"
                      onClick={() => setFunctionMenuOpen(!functionMenuOpen)}
                      aria-label="Function options"
                      aria-expanded={functionMenuOpen}
                    >
                      <MoreVertical size={18} />
                    </button>

                    {functionMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: 6,
                          width: 170,
                          background: '#ffffff',
                          border: '1px solid #e3dccf',
                          borderRadius: 12,
                          boxShadow: '0 8px 24px rgba(30, 35, 48, 0.12)',
                          zIndex: 50,
                          padding: '6px 0',
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 14px',
                            border: 'none',
                            background: 'transparent',
                            fontSize: 13,
                            color: '#1e2330',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setFunctionMenuOpen(false);
                            onOpenEditFunction(activeFunction);
                          }}
                        >
                          <Edit2 size={14} />
                          <span>Edit function</span>
                        </button>
                        <button
                          type="button"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 14px',
                            border: 'none',
                            background: 'transparent',
                            fontSize: 13,
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDeleteFunction(activeFunction)}
                        >
                          <Trash2 size={14} />
                          <span>Delete function</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Indicator Status Banner when in progress */}
              {timelineProgress.state === 'in-progress' && (
                <div className="sched-progress-indicator-bar">
                  <div className="sched-progress-left">
                    <Clock size={16} />
                    <span>Ceremony is active right now ({timelineProgress.progressPercent}%)</span>
                  </div>
                  <div className="sched-progress-meter">
                    <div
                      className="sched-progress-meter-fill"
                      style={{ width: `${timelineProgress.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Continuous Vertical Timeline */}
              {activeItems.length > 0 ? (
                <div className="sched-timeline-container">
                  {/* Base neutral connecting track */}
                  <div className="sched-timeline-track" aria-hidden="true" />

                  {/* Real-time progressive fill layer */}
                  <div
                    className="sched-timeline-progress-fill"
                    style={{
                      height:
                        timelineProgress.progressPercent > 0
                          ? `calc((100% - 76px) * ${timelineProgress.progressPercent / 100})`
                          : '0px',
                    }}
                    aria-hidden="true"
                  />

                  <div className="sched-timeline-rows">
                    {activeItems.map((item) => {
                      // Check if this item is part of an overlap in this function
                      const overlap = activeFunctionOverlaps.find((o) => o.itemB.id === item.id);
                      const isItemAOverlap = activeFunctionOverlaps.some(
                        (o) => o.itemA.id === item.id,
                      );
                      const isCompleted = timelineProgress.completedItemIds.includes(item.id);
                      const isActiveItem = timelineProgress.activeItemId === item.id;

                      let dotClass = 'sched-timeline-dot';
                      if (overlap || isItemAOverlap) {
                        dotClass += ' warning';
                      } else if (isActiveItem) {
                        dotClass += ' active';
                      } else if (isCompleted) {
                        dotClass += ' completed';
                      }

                      return (
                        <div key={item.id} className="sched-timeline-row">
                          {/* Time Column */}
                          <div className="sched-time-col">
                            <span className={`sched-time-label ${overlap ? 'has-warning' : ''}`}>
                              {item.startTime}
                            </span>
                            <span className="sched-duration-label">
                              {formatDuration(item.durationMin)}
                            </span>
                          </div>

                          {/* Center Marker Column */}
                          <div className="sched-marker-col">
                            <span className={dotClass} />
                          </div>

                          {/* Content Card Column */}
                          {overlap ? (
                            /* Conflict Resolution Card (Row 4 in Stitch) */
                            <div className="sched-conflict-card">
                              <div className="sched-conflict-card-header">
                                <div className="sched-conflict-title-row">
                                  <h3 className="sched-item-title">{item.title}</h3>
                                  <span className="sched-conflict-chip">
                                    <AlertTriangle size={12} />
                                    <span>
                                      {overlap.overlapMinutes}-minute overlap detected with{' '}
                                      {overlap.itemA.title} ({overlap.itemA.startTime} –{' '}
                                      {minutesToTime(
                                        timeToMinutes(overlap.itemA.startTime) +
                                          overlap.itemA.durationMin,
                                      )}
                                      )
                                    </span>
                                  </span>
                                </div>
                                <div className="sched-menu-anchor" style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    className="sched-item-menu-btn"
                                    onClick={() =>
                                      setActiveItemMenuId(
                                        activeItemMenuId === item.id ? null : item.id,
                                      )
                                    }
                                    aria-label="Item actions"
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  {activeItemMenuId === item.id && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '100%',
                                        width: 140,
                                        background: '#ffffff',
                                        border: '1px solid #e3dccf',
                                        borderRadius: 10,
                                        boxShadow: '0 6px 20px rgba(30, 35, 48, 0.1)',
                                        zIndex: 50,
                                        padding: '4px 0',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        style={{
                                          width: '100%',
                                          textAlign: 'left',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: 'transparent',
                                          fontSize: 12.5,
                                          color: '#1e2330',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => openEditItem(item)}
                                      >
                                        <Edit2 size={13} />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        style={{
                                          width: '100%',
                                          textAlign: 'left',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: 'transparent',
                                          fontSize: 12.5,
                                          color: '#dc2626',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => handleDeleteItem(item.id, item.title)}
                                      >
                                        <Trash2 size={13} />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <p className="sched-conflict-desc">
                                {item.notes ||
                                  `Buffet opens while Vedic phero ceremony is still underway. Guests cannot attend both simultaneously unless planned as concurrent.`}
                              </p>

                              {/* Proposed Resolution Actions */}
                              <div className="sched-conflict-actions">
                                {/* Primary resolution button: Dark teal with white text & white icon */}
                                <button
                                  type="button"
                                  className="sched-conflict-fix-btn"
                                  onClick={() => handleResolveShift(overlap)}
                                >
                                  <Clock size={15} />
                                  <span>
                                    Shift {item.title} to {overlap.suggestedShiftTime} (Ends{' '}
                                    {minutesToTime(
                                      timeToMinutes(overlap.suggestedShiftTime) + item.durationMin,
                                    )}
                                    )
                                  </span>
                                </button>

                                {/* Secondary resolution button */}
                                <button
                                  type="button"
                                  className="sched-conflict-sub-btn"
                                  onClick={() => handleResolveShorten(overlap)}
                                >
                                  <Clock size={15} />
                                  <span>
                                    Shorten {overlap.itemA.title} by{' '}
                                    {overlap.suggestedShortenMinutes} min
                                  </span>
                                </button>

                                {/* Ghost ignore / concurrent option */}
                                <button
                                  type="button"
                                  className="sched-conflict-ghost-btn"
                                  onClick={() => handleResolveIgnore(overlap)}
                                >
                                  Keep concurrent buffet (Ignore)
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Standard Schedule Item Card */
                            <div className="sched-item-card">
                              <div className="sched-item-main">
                                <h3 className="sched-item-title">{item.title}</h3>
                                {item.notes && <p className="sched-item-desc">{item.notes}</p>}
                              </div>
                              <div className="sched-menu-anchor" style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  className="sched-item-menu-btn"
                                  onClick={() =>
                                    setActiveItemMenuId(
                                      activeItemMenuId === item.id ? null : item.id,
                                    )
                                  }
                                  aria-label="Item actions"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {activeItemMenuId === item.id && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      right: 0,
                                      top: '100%',
                                      width: 140,
                                      background: '#ffffff',
                                      border: '1px solid #e3dccf',
                                      borderRadius: 10,
                                      boxShadow: '0 6px 20px rgba(30, 35, 48, 0.1)',
                                      zIndex: 50,
                                      padding: '4px 0',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: 12.5,
                                        color: '#1e2330',
                                        cursor: 'pointer',
                                      }}
                                      onClick={() => openEditItem(item)}
                                    >
                                      <Edit2 size={13} />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: 12.5,
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                      }}
                                      onClick={() => handleDeleteItem(item.id, item.title)}
                                    >
                                      <Trash2 size={13} />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Empty state when function has no items */
                <div className="sched-empty-container">
                  <div className="sched-empty-icon">
                    <Calendar size={28} />
                  </div>
                  <h3 className="sched-empty-title">Add a function to start your schedule</h3>
                  <p className="sched-empty-desc">
                    Plan this ceremony hour by hour. Add timeline items or let Toranly draft an
                    authentic run-of-show with AI.
                  </p>
                  <div className="sched-empty-actions">
                    <button type="button" className="sched-primary-btn" onClick={openAddItem}>
                      <Plus size={16} />
                      <span>Add item</span>
                    </button>
                    <button
                      type="button"
                      className="sched-secondary-btn"
                      onClick={() => handleUseStandardSchedule(activeFunction)}
                      disabled={isAddingStandard}
                    >
                      <ClipboardList size={16} aria-hidden="true" />
                      <span>{isAddingStandard ? 'Adding…' : 'Use standard schedule'}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* No functions in celebration */
            <div className="sched-empty-container">
              <div className="sched-empty-icon">
                <Calendar size={28} />
              </div>
              <h3 className="sched-empty-title">Add a function to start your schedule</h3>
              <p className="sched-empty-desc">
                Organize your celebration day-of schedule across Mehendi, Sangeet, Wedding, and
                Reception ceremonies.
              </p>
              <button type="button" className="sched-primary-btn" onClick={onOpenAddFunction}>
                <Plus size={18} />
                <span>Add function</span>
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Add / Edit Schedule Item Dialog */}
      {itemDialogOpen && (
        <div className="sched-modal-overlay" role="dialog" aria-modal="true">
          <div className="sched-modal-card">
            <div className="sched-modal-header">
              <h3 className="sched-modal-title">
                {editingItem ? 'Edit schedule item' : 'Add schedule item'}
              </h3>
              <button
                type="button"
                className="sched-modal-close-btn"
                onClick={() => setItemDialogOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem}>
              {itemFormError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {itemFormError}
                </div>
              )}

              <div className="sched-form-group">
                <label className="sched-form-label">
                  Activity Title <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="sched-input"
                  placeholder="e.g. Baraat arrival, Jaimala, Lunch buffet"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="sched-form-group">
                  <label className="sched-form-label">
                    Start Time <span className="req">*</span>
                  </label>
                  <input
                    type="time"
                    className="sched-input"
                    value={itemStartTime}
                    onChange={(e) => setItemStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="sched-form-group">
                  <label className="sched-form-label">
                    Duration (min) <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    className="sched-input"
                    value={itemDuration}
                    onChange={(e) => setItemDuration(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Quick duration presets */}
              <div className="sched-form-group" style={{ marginTop: -8 }}>
                <div className="sched-time-presets">
                  {[15, 30, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`sched-preset-chip ${itemDuration === mins ? 'active' : ''}`}
                      onClick={() => setItemDuration(mins)}
                    >
                      {formatDuration(mins)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sched-form-group">
                <label className="sched-form-label">Description / Notes (Optional)</label>
                <textarea
                  className="sched-textarea"
                  rows={3}
                  placeholder="e.g. Procession at grand gate, dhol troupe and milni scarves ready"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                />
              </div>

              <div className="sched-modal-footer">
                <button
                  type="button"
                  className="sched-cancel-btn"
                  onClick={() => setItemDialogOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sched-primary-btn">
                  <span>{editingItem ? 'Save changes' : 'Add to schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
