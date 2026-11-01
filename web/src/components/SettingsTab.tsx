import React, { useState, useEffect, useRef, useId } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  Check,
  MapPin,
  Users,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import type { Plan, PlanSnapshot, FunctionItem, TaskItem } from '../domain/plan';
import { rupeesToPaise, paiseToRupees } from '../domain/money';
import { generateBudgetCsv, generateTasksCsv, downloadCsv } from '../domain/export';
import {
  exportPlanBackup,
  downloadBackupFile,
  parseBackupFile,
  checkPlansWithServer,
} from '../storage/backup';
import { formatDisplayDate } from '../lib/dateFormat';
import { FunctionFormDialog } from './FunctionFormDialog';
import { DateChangeDialog } from './DateChangeDialog';
import { DeletePlanDialog } from './DeletePlanDialog';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { TextSizeControl } from './TextSizeControl';
import './SettingsTab.css';

interface SettingsTabProps {
  plan: Plan;
  snapshots: PlanSnapshot[];
  onSavePlan: (updatedPlan: Plan) => Promise<void>;
  onRestoreSnapshot: (snapshotId: string) => Promise<void>;
  onDeletePlan: () => Promise<void>;
  showToast: (msg: string) => void;
  onRequestTabChange?: (tabId: string) => void;
}

const FUNCTION_DOT_COLORS = [
  '#f2a93b', // celebration gold
  '#4a58a7', // purple / indigo
  '#b83a6b', // accent rani / pink
  '#0f6e6e', // primary teal
  '#1e7a46', // emerald
  '#d97706', // amber
];

function formatIndianLakhShorthand(rupees: number): string {
  if (!rupees || rupees <= 0) return '₹0';
  if (rupees >= 10000000) {
    const cr = (rupees / 10000000)
      .toFixed(2)
      .replace(/\.00$/, '')
      .replace(/(\.[1-9])0$/, '$1');
    return `${cr} crore`;
  }
  if (rupees >= 100000) {
    const lakh = (rupees / 100000)
      .toFixed(2)
      .replace(/\.00$/, '')
      .replace(/(\.[1-9])0$/, '$1');
    return `${lakh} lakh`;
  }
  if (rupees >= 1000) {
    const k = (rupees / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}k`;
  }
  return `₹${rupees.toLocaleString('en-IN')}`;
}

function getDaysUntil(dateStr?: string | null): { text: string; isPast: boolean } | null {
  if (!dateStr) return null;
  const datePart = dateStr.split('T')[0].trim();
  const parts = datePart.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { text: 'Today', isPast: false };
  if (diffDays > 0) return { text: `${diffDays} days to go`, isPast: false };
  return { text: `${Math.abs(diffDays)} days ago`, isPast: true };
}

function isMainFunction(
  fn: FunctionItem,
  allFunctions: FunctionItem[],
  eventDate: string | null,
): boolean {
  if (/wedding|pheras|varmala|marriage/i.test(fn.name)) return true;
  if (eventDate && fn.date === eventDate) {
    const firstOnDate = allFunctions.find((f) => f.date === eventDate);
    if (firstOnDate && firstOnDate.id === fn.id) return true;
  }
  return false;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  plan,
  snapshots,
  onSavePlan,
  onRestoreSnapshot,
  onDeletePlan,
  showToast,
}) => {
  // --- FORM STATE ---
  const [title, setTitle] = useState(plan.event.title);
  const [city, setCity] = useState(plan.event.city || '');
  const [guestEstimate, setGuestEstimate] = useState<number>(plan.event.guestEstimate || 0);
  const [budgetRupees, setBudgetRupees] = useState<number>(
    plan.event.budgetTotalPaise ? paiseToRupees(plan.event.budgetTotalPaise) : 0,
  );
  const [notes, setNotes] = useState(plan.event.preferences?.notes || '');
  const [themeWords, setThemeWords] = useState<string[]>(plan.event.preferences?.themeWords || []);
  const [newThemeWord, setNewThemeWord] = useState('');
  const [avoidColours, setAvoidColours] = useState<string[]>(
    plan.event.preferences?.avoidColours || [],
  );
  const [newAvoidColour, setNewAvoidColour] = useState('');
  const [customs, setCustoms] = useState<string[]>(plan.event.preferences?.customs || []);
  const [newCustom, setNewCustom] = useState('');

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvancedData, setShowAdvancedData] = useState(false);

  // --- DIALOG STATES ---
  const [showFunctionDialog, setShowFunctionDialog] = useState(false);
  const [editingFunction, setEditingFunction] = useState<FunctionItem | null>(null);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const themeInputId = useId();
  const avoidInputId = useId();
  const customInputId = useId();

  // Reset initial values when plan changes
  useEffect(() => {
    setTitle(plan.event.title);
    setCity(plan.event.city || '');
    setGuestEstimate(plan.event.guestEstimate || 0);
    setBudgetRupees(plan.event.budgetTotalPaise ? paiseToRupees(plan.event.budgetTotalPaise) : 0);
    setNotes(plan.event.preferences?.notes || '');
    setThemeWords(plan.event.preferences?.themeWords || []);
    setAvoidColours(plan.event.preferences?.avoidColours || []);
    setCustoms(plan.event.preferences?.customs || []);
    setIsDirty(false);
  }, [plan]);

  // Window beforeunload guard for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Form field change tracking
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Event title is required.');
      return;
    }

    setIsSaving(true);
    try {
      const budgetPaise = budgetRupees > 0 ? rupeesToPaise(budgetRupees) : null;
      const updatedPlan: Plan = {
        ...plan,
        event: {
          ...plan.event,
          title: title.trim(),
          city: city.trim() || null,
          guestEstimate: Math.max(0, guestEstimate),
          budgetTotalPaise: budgetPaise,
          preferences: {
            ...plan.event.preferences,
            themeWords,
            avoidColours,
            customs,
            notes: notes.slice(0, 500),
          },
        },
      };

      await onSavePlan(updatedPlan);
      setIsDirty(false);
      showToast('Changes saved successfully');
    } catch {
      showToast('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- PREFERENCES CHIPS ---
  const handleAddThemeWord = () => {
    const trimmed = newThemeWord.trim();
    if (trimmed && !themeWords.includes(trimmed) && themeWords.length < 8) {
      setThemeWords([...themeWords, trimmed]);
      setNewThemeWord('');
      markDirty();
    }
  };

  const handleRemoveThemeWord = (word: string) => {
    setThemeWords(themeWords.filter((w) => w !== word));
    markDirty();
  };

  const handleAddAvoidColour = () => {
    const trimmed = newAvoidColour.trim();
    if (trimmed && !avoidColours.includes(trimmed) && avoidColours.length < 8) {
      setAvoidColours([...avoidColours, trimmed]);
      setNewAvoidColour('');
      markDirty();
    }
  };

  const handleRemoveAvoidColour = (colour: string) => {
    setAvoidColours(avoidColours.filter((c) => c !== colour));
    markDirty();
  };

  const handleAddCustom = () => {
    const trimmed = newCustom.trim();
    if (trimmed && !customs.includes(trimmed) && customs.length < 8) {
      setCustoms([...customs, trimmed]);
      setNewCustom('');
      markDirty();
    }
  };

  const handleRemoveCustom = (custom: string) => {
    setCustoms(customs.filter((c) => c !== custom));
    markDirty();
  };

  // --- FUNCTIONS (D-11) ---
  const handleOpenAddFunction = () => {
    setEditingFunction(null);
    setShowFunctionDialog(true);
  };

  const handleOpenEditFunction = (fn: FunctionItem) => {
    setEditingFunction(fn);
    setShowFunctionDialog(true);
  };

  const handleDeleteFunction = async (fnId: string) => {
    const updatedFunctions = plan.functions.filter((f) => f.id !== fnId);
    await onSavePlan({
      ...plan,
      functions: updatedFunctions,
    });
    showToast('Function deleted.');
  };

  const handleSaveFunction = async (data: {
    name: string;
    date: string;
    startTime?: string;
    endTime?: string;
  }) => {
    let updatedFunctions: FunctionItem[];
    if (editingFunction) {
      updatedFunctions = plan.functions.map((f) =>
        f.id === editingFunction.id ? { ...f, ...data } : f,
      );
    } else {
      const newFn: FunctionItem = {
        id: `fn-${Date.now().toString(36)}`,
        name: data.name,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        position: plan.functions.length + 1,
      };
      updatedFunctions = [...plan.functions, newFn];
    }

    await onSavePlan({
      ...plan,
      functions: updatedFunctions,
    });
    setShowFunctionDialog(false);
    setEditingFunction(null);
    showToast(editingFunction ? 'Function updated.' : 'Function added.');
  };

  // --- DATE CHANGE (D-03) ---
  const handleDateChangeConfirm = async (newDate: string, updatedTasks?: TaskItem[]) => {
    await onSavePlan({
      ...plan,
      event: {
        ...plan.event,
        eventDate: newDate,
      },
      tasks: updatedTasks || plan.tasks,
    });
    setShowDateDialog(false);
    showToast(`Celebration date moved to ${formatDisplayDate(newDate)}.`);
  };

  // --- BACKUP & EXPORT ---
  const handleDownloadBudgetCsv = () => {
    const csv = generateBudgetCsv(plan);
    const slug = (plan.event.title || 'budget').toLowerCase().replace(/\s+/g, '-');
    downloadCsv(csv, `${slug}-budget.csv`);
    showToast('Budget CSV downloaded.');
  };

  const handleDownloadTasksCsv = () => {
    const csv = generateTasksCsv(plan);
    const slug = (plan.event.title || 'tasks').toLowerCase().replace(/\s+/g, '-');
    downloadCsv(csv, `${slug}-tasks.csv`);
    showToast('Tasks CSV downloaded.');
  };

  const handleDownloadBackup = () => {
    const backupJson = exportPlanBackup(plan);
    downloadBackupFile(backupJson, plan.event.title || 'celebration-plan');
    showToast('Backup downloaded (.toranly.json)');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const result = parseBackupFile(content);
      if (!result.success || !result.plans || result.plans.length === 0) {
        showToast(result.error || 'Failed to parse backup file.');
        return;
      }

      const matching = result.plans.find((p) => p.id === plan.id) || result.plans[0];
      const serverCheck = await checkPlansWithServer([matching]);
      if (!serverCheck.ok) {
        showToast(serverCheck.error);
        return;
      }
      await onSavePlan(matching);
      showToast(
        serverCheck.notice
          ? `Plan restored. ${serverCheck.notice}`
          : 'Plan imported and restored successfully.',
      );
    } catch {
      showToast('Invalid backup file. Please upload a valid .toranly.json.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRestoreWithGuard = (snapshotId: string) => {
    if (isDirty) {
      setPendingNavigationAction(() => () => onRestoreSnapshot(snapshotId));
      setShowUnsavedDialog(true);
    } else {
      onRestoreSnapshot(snapshotId);
    }
  };

  const countdown = getDaysUntil(plan.event.eventDate);

  return (
    <div className="settings-page">
      <div className="settings-container">
        {/* PAGE HEADER */}
        <header className="settings-page-header">
          <h1 className="settings-page-title">Event settings</h1>
          <p className="settings-page-desc">
            Manage your celebration details, functions schedule, data exports, or change your event
            date.
          </p>
        </header>

        {/* MAIN STACK OF CARDS */}
        <div className="settings-cards-stack">
          {/* ========================================================= */}
          {/* 3. EVENT DETAILS CARD                                    */}
          {/* ========================================================= */}
          <section className="settings-card" aria-labelledby="card-event-details">
            <div className="settings-card-header">
              <div>
                <h2 id="card-event-details" className="settings-card-title">
                  Event Details
                </h2>
                <p className="settings-card-subtitle">
                  Key parameters shaping your budget calculations, print outputs, and guest
                  allocations.
                </p>
              </div>
              <span className="settings-active-plan-badge">Active Plan</span>
            </div>

            <form onSubmit={handleSaveDetails} className="settings-form-layout">
              <div className="settings-fields-grid">
                {/* Event Name */}
                <div className="settings-field col-span-full">
                  <label htmlFor="settings-name-input" className="settings-label">
                    Event name
                  </label>
                  <input
                    id="settings-name-input"
                    type="text"
                    className="settings-input"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      markDirty();
                    }}
                    maxLength={120}
                    placeholder="e.g. Ananya & Rohan's Wedding"
                    required
                  />
                  <span className="settings-helper-text">
                    Used on headers, exports, and printable vendor run-sheets.
                  </span>
                </div>

                {/* Host City */}
                <div className="settings-field">
                  <label htmlFor="settings-city-input" className="settings-label">
                    Host City
                  </label>
                  <div className="settings-input-with-icon">
                    <input
                      id="settings-city-input"
                      type="text"
                      className="settings-input"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        markDirty();
                      }}
                      maxLength={80}
                      placeholder="e.g. Jaipur"
                    />
                    <MapPin size={18} className="settings-field-icon" aria-hidden="true" />
                  </div>
                  <span className="settings-helper-text">Primary vendor sourcing region.</span>
                </div>

                {/* Expected Guests */}
                <div className="settings-field">
                  <label htmlFor="settings-guests-input" className="settings-label">
                    Expected guests
                  </label>
                  <div className="settings-input-with-icon">
                    <input
                      id="settings-guests-input"
                      type="number"
                      min="0"
                      max="10000"
                      className="settings-input"
                      value={guestEstimate || ''}
                      onChange={(e) => {
                        setGuestEstimate(parseInt(e.target.value, 10) || 0);
                        markDirty();
                      }}
                      placeholder="e.g. 250"
                    />
                    <Users size={18} className="settings-field-icon" aria-hidden="true" />
                  </div>
                  <span className="settings-helper-text">
                    Baseline head count for caterers and room blocks.
                  </span>
                </div>

                {/* Total Budget */}
                <div className="settings-field col-span-full">
                  <div className="settings-label-row">
                    <label htmlFor="settings-budget-input" className="settings-label">
                      Total budget
                    </label>
                    <span className="settings-budget-preview-pill">
                      {formatIndianLakhShorthand(budgetRupees)}
                    </span>
                  </div>
                  <div className="settings-currency-wrapper">
                    <span className="settings-currency-prefix">₹</span>
                    <input
                      id="settings-budget-input"
                      type="number"
                      min="0"
                      step="1000"
                      className="settings-input has-currency"
                      value={budgetRupees || ''}
                      onChange={(e) => {
                        setBudgetRupees(Math.max(0, parseInt(e.target.value, 10) || 0));
                        markDirty();
                      }}
                      placeholder="18,00,000"
                    />
                  </div>
                  <span className="settings-helper-text">
                    Indian Rupees standard formatting (INR).
                  </span>
                </div>

                {/* Theme Words Chips */}
                <div className="settings-field">
                  <label htmlFor={themeInputId} className="settings-label">
                    Theme words
                  </label>
                  <div className="settings-chips-box">
                    {themeWords.map((word) => (
                      <span key={word} className="settings-chip theme-chip">
                        <span>{word}</span>
                        <button
                          type="button"
                          className="settings-chip-remove"
                          onClick={() => handleRemoveThemeWord(word)}
                          aria-label={`Remove theme word ${word}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {themeWords.length < 8 && (
                      <input
                        id={themeInputId}
                        type="text"
                        placeholder="Add tag..."
                        className="settings-chip-inline-input"
                        value={newThemeWord}
                        onChange={(e) => setNewThemeWord(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddThemeWord();
                          }
                        }}
                      />
                    )}
                  </div>
                  <span className="settings-helper-text">
                    Style prompts fed to decorator proposals and moodboards.
                  </span>
                </div>

                {/* Colours to Avoid Chips */}
                <div className="settings-field">
                  <label htmlFor={avoidInputId} className="settings-label">
                    Colours to avoid
                  </label>
                  <div className="settings-chips-box">
                    {avoidColours.map((colour) => (
                      <span key={colour} className="settings-chip avoid-chip">
                        <span>{colour}</span>
                        <button
                          type="button"
                          className="settings-chip-remove avoid"
                          onClick={() => handleRemoveAvoidColour(colour)}
                          aria-label={`Remove color ${colour}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {avoidColours.length < 8 && (
                      <input
                        id={avoidInputId}
                        type="text"
                        placeholder="Add avoided colour..."
                        className="settings-chip-inline-input"
                        value={newAvoidColour}
                        onChange={(e) => setNewAvoidColour(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAvoidColour();
                          }
                        }}
                      />
                    )}
                  </div>
                  <span className="settings-helper-text">
                    Flagged in styling and floral checklists.
                  </span>
                </div>

                {/* Customs to Include Chips */}
                <div className="settings-field col-span-full">
                  <label htmlFor={customInputId} className="settings-label">
                    Customs to include
                  </label>
                  <div className="settings-chips-box">
                    {customs.map((custom) => (
                      <span key={custom} className="settings-chip custom-chip">
                        <Sparkles size={13} className="settings-custom-icon" aria-hidden="true" />
                        <span>{custom}</span>
                        <button
                          type="button"
                          className="settings-chip-remove custom"
                          onClick={() => handleRemoveCustom(custom)}
                          aria-label={`Remove custom ${custom}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {customs.length < 8 && (
                      <input
                        id={customInputId}
                        type="text"
                        placeholder="Add custom or tradition..."
                        className="settings-chip-inline-input"
                        value={newCustom}
                        onChange={(e) => setNewCustom(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustom();
                          }
                        }}
                      />
                    )}
                  </div>
                  <span className="settings-helper-text">
                    Only what you choose is used. We never assume customs.
                  </span>
                </div>

                {/* Planner Notes */}
                <div className="settings-field col-span-full">
                  <div className="settings-label-row">
                    <label htmlFor="settings-notes-input" className="settings-label">
                      Planner Notes
                    </label>
                    <span className="settings-char-counter">{notes.length}/500</span>
                  </div>
                  <textarea
                    id="settings-notes-input"
                    className="settings-textarea"
                    rows={3}
                    maxLength={500}
                    placeholder="Immediate family arrives Jaipur by noon... Shared context for your co-planners and coordinator export summaries."
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      markDirty();
                    }}
                  />
                  <span className="settings-helper-text">
                    Shared context for your co-planners and coordinator export summaries.
                  </span>
                </div>
              </div>

              {/* Form Action Row */}
              <div className="settings-card-actions">
                {isDirty && <span className="settings-unsaved-badge">Unsaved changes</span>}
                <button
                  type="submit"
                  className="settings-primary-btn"
                  disabled={isSaving || !isDirty}
                >
                  <Check size={18} aria-hidden="true" />
                  <span>{isSaving ? 'Saving...' : 'Save changes'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* ========================================================= */}
          {/* 4. EVENT DATE & TIMING CARD                              */}
          {/* ========================================================= */}
          <section className="settings-card" aria-labelledby="card-date-timing">
            <div className="settings-date-row">
              <div className="settings-date-info">
                <h2 id="card-date-timing" className="settings-card-title">
                  Event Date &amp; Timing
                </h2>
                <div className="settings-date-display-line">
                  <span className="settings-date-main">
                    {formatDisplayDate(plan.event.eventDate)}
                  </span>
                  {countdown && (
                    <span className={`settings-countdown-pill ${countdown.isPast ? 'past' : ''}`}>
                      <Clock size={15} aria-hidden="true" />
                      <span>{countdown.text}</span>
                    </span>
                  )}
                </div>
                <p className="settings-card-desc-compact">
                  Changing the date recalculates relative timeline tasks and checks function
                  schedules across all connected vendors.
                </p>
              </div>

              <button
                type="button"
                className="settings-secondary-btn"
                onClick={() => setShowDateDialog(true)}
              >
                <Calendar size={18} aria-hidden="true" />
                <span>Change date</span>
              </button>
            </div>
          </section>

          {/* ========================================================= */}
          {/* 5. FUNCTIONS & SUB-EVENTS CARD                           */}
          {/* ========================================================= */}
          <section className="settings-card" aria-labelledby="card-functions">
            <div className="settings-card-header">
              <div>
                <h2 id="card-functions" className="settings-card-title">
                  Functions &amp; Sub-events
                </h2>
                <p className="settings-card-subtitle">
                  Order of ritual gatherings and logistical time windows.
                </p>
              </div>
              <button
                type="button"
                className="settings-secondary-btn"
                onClick={handleOpenAddFunction}
              >
                <Plus size={18} aria-hidden="true" />
                <span>Add function</span>
              </button>
            </div>

            {plan.functions.length === 0 ? (
              <div className="settings-empty-state">
                <p className="settings-empty-title">No functions added yet</p>
                <p className="settings-empty-desc">
                  Add ceremonies and gatherings (such as Mehendi, Sangeet, or Pheras) to structure
                  your celebration timeline.
                </p>
                <button
                  type="button"
                  className="settings-secondary-btn"
                  onClick={handleOpenAddFunction}
                >
                  <Plus size={16} aria-hidden="true" />
                  <span>Add your first function</span>
                </button>
              </div>
            ) : (
              <div className="settings-table-wrapper">
                <table className="settings-functions-table">
                  <thead>
                    <tr>
                      <th className="col-fn">Function</th>
                      <th className="col-date">Date</th>
                      <th className="col-time">Timing</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.functions.map((fn, idx) => {
                      const dotColor = FUNCTION_DOT_COLORS[idx % FUNCTION_DOT_COLORS.length];
                      const isMain = isMainFunction(fn, plan.functions, plan.event.eventDate);

                      return (
                        <tr key={fn.id} className={idx % 2 === 1 ? 'row-alt' : ''}>
                          <td className="col-fn">
                            <div className="settings-fn-cell">
                              <span
                                className="settings-fn-dot"
                                style={{ backgroundColor: dotColor }}
                                aria-hidden="true"
                              />
                              <span className="settings-fn-name">{fn.name}</span>
                              {isMain && <span className="settings-main-badge">Main</span>}
                            </div>
                          </td>
                          <td className="col-date">{formatDisplayDate(fn.date)}</td>
                          <td className="col-time">
                            {fn.startTime || fn.endTime ? (
                              <span className="settings-timing-text">
                                {fn.startTime || ''}
                                {fn.endTime ? ` – ${fn.endTime}` : ''}
                              </span>
                            ) : (
                              <span className="settings-timing-unset">—</span>
                            )}
                          </td>
                          <td className="col-actions">
                            <div className="settings-actions-group">
                              <button
                                type="button"
                                className="settings-icon-action-btn"
                                onClick={() => handleOpenEditFunction(fn)}
                                title={`Edit ${fn.name}`}
                                aria-label={`Edit ${fn.name}`}
                              >
                                <Pencil size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="settings-icon-action-btn danger"
                                onClick={() => handleDeleteFunction(fn.id)}
                                title={`Delete ${fn.name}`}
                                aria-label={`Delete ${fn.name}`}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ========================================================= */}
          {/* 6. DATA & EXPORT CARD                                    */}
          {/* ========================================================= */}
          <section className="settings-card" aria-label="Text size">
            <TextSizeControl />
          </section>

          <section className="settings-card" aria-labelledby="card-data-export">
            <h2 id="card-data-export" className="settings-card-title">
              Data &amp; Export
            </h2>
            <p className="settings-card-subtitle max-w-2xl">
              Download spreadsheet-compatible CSV files of your current budget allocations, expenses
              log, and task checklist.
            </p>

            <div className="settings-export-actions">
              <button
                type="button"
                className="settings-secondary-btn"
                onClick={handleDownloadBudgetCsv}
              >
                <Download size={18} aria-hidden="true" />
                <span>Download budget CSV</span>
              </button>
              <button
                type="button"
                className="settings-secondary-btn"
                onClick={handleDownloadTasksCsv}
              >
                <Download size={18} aria-hidden="true" />
                <span>Download tasks CSV</span>
              </button>
            </div>

            {/* Preserved Backup & Restore / Snapshot controls in clean expandable drawer */}
            <div className="settings-backup-collapsible">
              <button
                type="button"
                className="settings-backup-toggle-btn"
                onClick={() => setShowAdvancedData((prev) => !prev)}
                aria-expanded={showAdvancedData}
              >
                <span>
                  {showAdvancedData
                    ? 'Hide backup & restore options'
                    : 'Backup & snapshot restore options'}
                </span>
              </button>

              {showAdvancedData && (
                <div className="settings-backup-panel">
                  <div className="settings-backup-btns-row">
                    <button
                      type="button"
                      className="settings-secondary-btn compact"
                      onClick={handleDownloadBackup}
                    >
                      <Download size={16} aria-hidden="true" />
                      <span>Download .toranly.json backup</span>
                    </button>
                    <button
                      type="button"
                      className="settings-secondary-btn compact"
                      onClick={handleImportClick}
                    >
                      <Upload size={16} aria-hidden="true" />
                      <span>Import plan (.toranly.json)</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.toranly.json"
                      onChange={handleFileSelected}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {snapshots.length > 0 && (
                    <div className="settings-snapshots-subpanel">
                      <span className="settings-snapshots-heading">Local snapshots</span>
                      <div className="settings-snapshots-items">
                        {snapshots.map((snap, idx) => (
                          <div key={snap.id} className="settings-snapshot-chip">
                            <span>
                              Snapshot {idx + 1} ·{' '}
                              {new Date(snap.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <button
                              type="button"
                              className="settings-snapshot-btn"
                              onClick={() => handleRestoreWithGuard(snap.id)}
                            >
                              <RotateCcw size={13} aria-hidden="true" />
                              <span>Restore</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ========================================================= */}
          {/* 7. DANGER ZONE CARD                                      */}
          {/* ========================================================= */}
          <section
            className="settings-card settings-danger-card"
            aria-labelledby="card-danger-zone"
          >
            <div className="settings-danger-row">
              <div className="settings-danger-info">
                <div className="settings-danger-title-row">
                  <AlertTriangle size={20} className="settings-danger-icon" aria-hidden="true" />
                  <h2 id="card-danger-zone" className="settings-danger-title">
                    Danger Zone
                  </h2>
                </div>
                <p className="settings-danger-desc">
                  Deleting removes{' '}
                  <strong className="settings-danger-strong">{plan.event.title}</strong> and all
                  associated budget items, tasks, vendor quotes, and guest dietary records
                  permanently. This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                className="settings-danger-btn"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 size={18} aria-hidden="true" />
                <span>Delete event</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* DIALOGS */}
      {showFunctionDialog && (
        <FunctionFormDialog
          isOpen={true}
          initialData={editingFunction}
          defaultDate={plan.event.eventDate || new Date().toISOString().split('T')[0]}
          onSave={handleSaveFunction}
          onCancel={() => {
            setShowFunctionDialog(false);
            setEditingFunction(null);
          }}
        />
      )}

      {showDateDialog && (
        <DateChangeDialog
          isOpen={true}
          currentDate={plan.event.eventDate || new Date().toISOString().split('T')[0]}
          plan={plan}
          onConfirm={handleDateChangeConfirm}
          onCancel={() => setShowDateDialog(false)}
        />
      )}

      {showDeleteDialog && (
        <DeletePlanDialog
          isOpen={true}
          planTitle={plan.event.title}
          onConfirm={onDeletePlan}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}

      {showUnsavedDialog && (
        <UnsavedChangesDialog
          isOpen={true}
          onKeepEditing={() => {
            setShowUnsavedDialog(false);
            setPendingNavigationAction(null);
          }}
          onDiscard={() => {
            setShowUnsavedDialog(false);
            setIsDirty(false);
            if (pendingNavigationAction) {
              pendingNavigationAction();
              setPendingNavigationAction(null);
            }
          }}
        />
      )}
    </div>
  );
};
