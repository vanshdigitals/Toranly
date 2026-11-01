import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Users,
  Flag,
  Download,
  Trash2,
  Plus,
  FileSpreadsheet,
  Shield,
  Clock,
  Utensils,
  Building2,
  Sparkles,
  Shirt,
  Camera,
  Music,
  Mail,
  Plane,
  Flame,
  Gift,
  Folder,
  Tag,
  MoreVertical,
  Edit2,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Check,
  Receipt,
  Store,
  Scale,
  Phone,
  PiggyBank,
  Info,
} from 'lucide-react';
import { ToranlyLogomark } from '../components/ToranlyLogomark';
import { getPlan, savePlan, deletePlan, getSnapshots, restoreSnapshot } from '../storage/db';
import { exportPlanBackup, downloadBackupFile } from '../storage/backup';
import type {
  Plan,
  TaskItem,
  FunctionItem,
  ExpenseItem,
  BudgetCategory,
  PlanSnapshot,
  VendorItem,
  QuoteItem,
  QuoteUnit,
} from '../domain/plan';
import { formatPaise } from '../domain/money';
import { usePlanSummary } from '../lib/usePlanSummary';
import { LIVE_CHECK_UNAVAILABLE } from '../api/plan';
import { isTaskOverdue, checkTaskCompletionGate } from '../domain/timeline';
import { normalizeAndCompareQuotes } from '../domain/quotes';
import { checkDietaryCoverage } from '../domain/guests';
import { generateBudgetCsv, generateTasksCsv, downloadCsv } from '../domain/export';
import { calculateDaysRemaining } from '../lib/eventState';
import { InMemoryBanner } from '../components/InMemoryBanner';
import type { SaveState } from '../components/AutosaveStatus';
import { AddExpenseDialog } from '../components/AddExpenseDialog';
import { AddCategoryDialog } from '../components/AddCategoryDialog';
import { AddTaskDialog } from '../components/AddTaskDialog';
import { FunctionFormDialog } from '../components/FunctionFormDialog';
import { AddVendorDialog } from '../components/AddVendorDialog';
import { AddQuoteDialog } from '../components/AddQuoteDialog';
import { VendorDetailsDrawer } from '../components/VendorDetailsDrawer';
import { CompareQuotesModal } from '../components/CompareQuotesModal';
import { PlannerWorkspaceShell } from '../components/PlannerWorkspaceShell';
import { SettingsTab } from '../components/SettingsTab';
import { IdeasTab } from '../components/IdeasTab';
import { ScheduleTab } from '../components/ScheduleTab';
import { GuestsTab } from '../components/GuestsTab';
import { Select } from '../components/Select';
import { formatDisplayDate } from '../lib/dateFormat';
import './EventOverviewPage.css';
import './TimelineScheduleGuests.css';

// The AI plan tab loads on demand (only visitors who open it download it).
const AiPlanTab = lazy(() =>
  import('../components/AiPlanTab').then((m) => ({ default: m.AiPlanTab })),
);

const DEFAULT_VENDOR_CATEGORIES = [
  { key: 'venue', label: 'Venue & Staging' },
  { key: 'catering', label: 'Catering & Dining' },
  { key: 'photography', label: 'Photography & Film' },
  { key: 'decor', label: 'Decor & Florals' },
  { key: 'music', label: 'Music & Entertainment' },
  { key: 'attire', label: 'Attire & Jewellery' },
  { key: 'invitations', label: 'Invitations & Favours' },
  { key: 'general', label: 'Other Services' },
];

const getCategoryIcon = (key: string, label: string) => {
  const normalized = `${key} ${label}`.toLowerCase();
  if (
    normalized.includes('cater') ||
    normalized.includes('food') ||
    normalized.includes('dining') ||
    normalized.includes('meal')
  ) {
    return <Utensils size={17} className="budget-cat-icon icon-catering" />;
  }
  if (
    normalized.includes('venue') ||
    normalized.includes('hall') ||
    normalized.includes('palace') ||
    normalized.includes('hotel') ||
    normalized.includes('banquet')
  ) {
    return <Building2 size={17} className="budget-cat-icon icon-venue" />;
  }
  if (
    normalized.includes('decor') ||
    normalized.includes('flower') ||
    normalized.includes('floral') ||
    normalized.includes('stage') ||
    normalized.includes('mandap')
  ) {
    return <Sparkles size={17} className="budget-cat-icon icon-decor" />;
  }
  if (
    normalized.includes('attire') ||
    normalized.includes('jewel') ||
    normalized.includes('cloth') ||
    normalized.includes('dress') ||
    normalized.includes('makeup')
  ) {
    return <Shirt size={17} className="budget-cat-icon icon-attire" />;
  }
  if (
    normalized.includes('photo') ||
    normalized.includes('video') ||
    normalized.includes('shoot') ||
    normalized.includes('film')
  ) {
    return <Camera size={17} className="budget-cat-icon icon-photo" />;
  }
  if (
    normalized.includes('music') ||
    normalized.includes('dj') ||
    normalized.includes('sound') ||
    normalized.includes('entertain') ||
    normalized.includes('sangeet')
  ) {
    return <Music size={17} className="budget-cat-icon icon-music" />;
  }
  if (
    normalized.includes('invite') ||
    normalized.includes('card') ||
    normalized.includes('mail') ||
    normalized.includes('stationery')
  ) {
    return <Mail size={17} className="budget-cat-icon icon-invites" />;
  }
  if (
    normalized.includes('contingency') ||
    normalized.includes('buffer') ||
    normalized.includes('emergency')
  ) {
    return <Shield size={17} className="budget-cat-icon icon-contingency" />;
  }
  if (
    normalized.includes('travel') ||
    normalized.includes('stay') ||
    normalized.includes('transport') ||
    normalized.includes('flight') ||
    normalized.includes('logistics')
  ) {
    return <Plane size={17} className="budget-cat-icon icon-travel" />;
  }
  if (
    normalized.includes('ritual') ||
    normalized.includes('pooja') ||
    normalized.includes('puja') ||
    normalized.includes('pandit') ||
    normalized.includes('havan') ||
    normalized.includes('ceremony')
  ) {
    return <Flame size={17} className="budget-cat-icon icon-rituals" />;
  }
  if (
    normalized.includes('gift') ||
    normalized.includes('favour') ||
    normalized.includes('favor')
  ) {
    return <Gift size={17} className="budget-cat-icon icon-gifts" />;
  }
  return <Folder size={17} className="budget-cat-icon icon-general" />;
};

export const EventOverviewPage: React.FC = () => {
  const { eventId, tab: activeTabParam } = useParams<{ eventId: string; tab?: string }>();
  const navigate = useNavigate();

  // Active workspace tab
  const [activeTab, setActiveTab] = useState<string>(activeTabParam || 'overview');

  useEffect(() => {
    if (activeTabParam) {
      setActiveTab(activeTabParam);
    }
  }, [activeTabParam]);

  const setTab = (newTab: string) => {
    setActiveTab(newTab);
    if (newTab === 'overview') {
      navigate(`/events/${eventId}`);
    } else {
      navigate(`/events/${eventId}/${newTab}`);
    }
  };

  // Plan state
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PlanSnapshot[]>([]);

  // Dialog states
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [functionDialog, setFunctionDialog] = useState<{ open: boolean; fn: FunctionItem | null }>({
    open: false,
    fn: null,
  });
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [vendorToEdit, setVendorToEdit] = useState<VendorItem | null>(null);
  const [vendorInitialCategory, setVendorInitialCategory] = useState<string | undefined>(undefined);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [quoteInitialVendorId, setQuoteInitialVendorId] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sub-view filters & Budget interactive states
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all');
  const [budgetSubTab, setBudgetSubTab] = useState<'categories' | 'expenses'>('categories');
  const [starterPlanDismissed, setStarterPlanDismissed] = useState(false);
  const [activeCategoryMenuId, setActiveCategoryMenuId] = useState<string | null>(null);
  const [editingCategoryAllocId, setEditingCategoryAllocId] = useState<string | null>(null);
  const [editCategoryAllocValue, setEditCategoryAllocValue] = useState<string>('');
  const [editingCategoryNameId, setEditingCategoryNameId] = useState<string | null>(null);
  const [editCategoryNameValue, setEditCategoryNameValue] = useState<string>('');
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [dismissedOverrunBanner, setDismissedOverrunBanner] = useState(false);

  // Vendor category filter & modal states
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState('all');
  const [selectedVendorForDrawer, setSelectedVendorForDrawer] = useState<VendorItem | null>(null);
  const [compareQuotesCategoryKey, setCompareQuotesCategoryKey] = useState<string | null>(null);
  const [vendorActionMenuId, setVendorActionMenuId] = useState<string | null>(null);

  // Dismiss category dropdown menu on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.budget-cat-menu-wrapper')) {
        setActiveCategoryMenuId(null);
      }
      if (!target.closest('.vendor-more-menu-wrapper')) {
        setVendorActionMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveCategoryMenuId(null);
        setVendorActionMenuId(null);
        setSelectedVendorForDrawer(null);
        setCompareQuotesCategoryKey(null);
        setEditingCategoryAllocId(null);
        setEditingCategoryNameId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load plan from IndexedDB
  const loadPlanData = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    try {
      const loaded = await getPlan(eventId);
      setPlan(loaded);
      if (loaded) {
        setLastSavedAt(loaded.updatedAt);
        const snaps = await getSnapshots(eventId);
        setSnapshots(snaps);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadPlanData();
  }, [loadPlanData]);

  // Budget totals and status come from POST /plan/summary (device figures while offline).
  const { metrics: budgetMetrics, source: summarySource } = usePlanSummary(plan);
  const liveCheckNote =
    summarySource === 'device' ? (
      <p className="live-check-note" role="status">
        {LIVE_CHECK_UNAVAILABLE}
      </p>
    ) : null;

  // A notice handed over by the wizard (for example when the backend template was unavailable).
  const location = useLocation();
  const handoffNotice = (location.state as { notice?: string } | null)?.notice;
  useEffect(() => {
    if (!handoffNotice) return;
    setToastMessage(handoffNotice);
    const timer = setTimeout(() => setToastMessage(null), 5000);
    navigate(location.pathname, { replace: true, state: null });
    return () => clearTimeout(timer);
  }, [handoffNotice, location.pathname, navigate]);

  // Guard: if loading finishes and plan is missing, redirect to /events with toast
  useEffect(() => {
    if (!loading && !plan) {
      navigate('/events', { replace: true, state: { toast: "That plan isn't on this device." } });
    }
  }, [loading, plan, navigate]);

  // Save changes with autosave indicator
  const persistPlan = async (updated: Plan) => {
    setSaveStatus('saving');
    try {
      const saved = await savePlan(updated);
      setPlan(saved);
      setLastSavedAt(saved.updatedAt);
      setSaveStatus('saved');
      // Refresh snapshots
      const snaps = await getSnapshots(saved.id);
      setSnapshots(snaps);
    } catch {
      setSaveStatus('error');
    }
  };

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const handleToggleTask = (task: TaskItem) => {
    if (!plan) return;

    if (task.status === 'open') {
      // Check completion gating
      const gate = checkTaskCompletionGate(task, plan.tasks);
      if (!gate.canComplete) {
        showToast(`Waiting on: ${gate.blockingTasks.map((t) => t.title).join(', ')}`);
        return;
      }
    }

    const updatedTasks = plan.tasks.map((t) => {
      if (t.id === task.id) {
        const nextStatus = t.status === 'done' ? 'open' : 'done';
        return {
          ...t,
          status: nextStatus as 'open' | 'done',
          completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined,
        };
      }
      return t;
    });

    const updatedPlan: Plan = {
      ...plan,
      tasks: updatedTasks,
    };

    persistPlan(updatedPlan);
    showToast(task.status === 'done' ? 'Task re-opened' : 'Task marked completed');
  };

  // Adds a new task, or replaces the task with the same id when the dialog was editing it.
  const handleAddTask = (newTask: TaskItem) => {
    if (!plan) return;
    const isEdit = plan.tasks.some((t) => t.id === newTask.id);
    const updatedPlan: Plan = {
      ...plan,
      tasks: isEdit
        ? plan.tasks.map((t) => (t.id === newTask.id ? newTask : t))
        : [...plan.tasks, newTask],
    };
    persistPlan(updatedPlan);
    setShowTaskDialog(false);
    setEditingTask(null);
    showToast(isEdit ? 'Task updated' : 'Task added to checklist');
  };

  const handleDeleteTask = (taskId: string) => {
    if (!plan) return;
    // Remove the task and drop it from other tasks' dependencies so nothing waits on it.
    const updatedTasks = plan.tasks
      .filter((t) => t.id !== taskId)
      .map((t) =>
        t.dependsOn?.includes(taskId)
          ? { ...t, dependsOn: t.dependsOn.filter((id) => id !== taskId) }
          : t,
      );
    persistPlan({ ...plan, tasks: updatedTasks });
    setPendingDeleteTaskId(null);
    showToast('Task deleted');
  };

  const handleSaveFunction = (data: {
    name: string;
    date: string;
    startTime?: string;
    endTime?: string;
  }) => {
    if (!plan) return;
    const editing = functionDialog.fn;
    const updatedFunctions: FunctionItem[] = editing
      ? plan.functions.map((f) => (f.id === editing.id ? { ...f, ...data } : f))
      : [
          ...plan.functions,
          { id: `fn-${Date.now().toString(36)}`, ...data, position: plan.functions.length + 1 },
        ];
    persistPlan({ ...plan, functions: updatedFunctions });
    setFunctionDialog({ open: false, fn: null });
    showToast(editing ? 'Function updated' : 'Function added');
  };

  const handleAddExpense = (newExpense: ExpenseItem) => {
    if (!plan) return;
    const updatedPlan: Plan = {
      ...plan,
      expenses: [...plan.expenses, newExpense],
    };
    persistPlan(updatedPlan);
    setShowExpenseDialog(false);
    showToast('Expense added');
  };

  const handleDeleteExpense = (expenseId: string) => {
    if (!plan) return;
    const updatedPlan: Plan = {
      ...plan,
      expenses: plan.expenses.filter((e) => e.id !== expenseId),
    };
    persistPlan(updatedPlan);
    showToast('Expense deleted');
  };

  const handleAddCategory = (label: string, allocatedRupees: number) => {
    if (!plan) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = `cat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const allocatedPaise = Math.max(0, Math.round(allocatedRupees * 100));
    const newCategory: BudgetCategory = {
      id,
      key,
      label: trimmed,
      allocatedPaise,
      position: plan.budgetCategories.length + 1,
    };
    const updatedPlan: Plan = {
      ...plan,
      budgetCategories: [...plan.budgetCategories, newCategory],
    };
    persistPlan(updatedPlan);
    setShowAddCategoryDialog(false);
    showToast(`Added "${trimmed}" category`);
  };

  const handleStartRenameCategory = (cat: BudgetCategory) => {
    setEditingCategoryNameId(cat.id);
    setEditCategoryNameValue(cat.label);
    setActiveCategoryMenuId(null);
  };

  const handleSaveRenameCategory = (catId: string) => {
    if (!plan) return;
    const trimmed = editCategoryNameValue.trim();
    if (!trimmed) {
      setEditingCategoryNameId(null);
      return;
    }
    const updatedPlan: Plan = {
      ...plan,
      budgetCategories: plan.budgetCategories.map((c) =>
        c.id === catId ? { ...c, label: trimmed } : c,
      ),
    };
    persistPlan(updatedPlan);
    setEditingCategoryNameId(null);
    showToast(`Category renamed to "${trimmed}"`);
  };

  const handleStartEditAlloc = (cat: BudgetCategory) => {
    setEditingCategoryAllocId(cat.id);
    setEditCategoryAllocValue(String(Math.round(cat.allocatedPaise / 100)));
    setActiveCategoryMenuId(null);
  };

  const handleSaveEditAlloc = (catId: string) => {
    if (!plan) return;
    const trimmed = editCategoryAllocValue.trim();
    if (trimmed === '') {
      showToast('Please enter an allocated budget amount');
      return;
    }
    const num = Number(trimmed);
    if (isNaN(num) || !Number.isFinite(num)) {
      showToast('Please enter a valid number');
      return;
    }
    if (num < 0) {
      showToast('Allocated budget cannot be negative');
      return;
    }
    const allocatedPaise = Math.round(num * 100);
    const updatedPlan: Plan = {
      ...plan,
      budgetCategories: plan.budgetCategories.map((c) =>
        c.id === catId ? { ...c, allocatedPaise } : c,
      ),
    };
    persistPlan(updatedPlan);
    setEditingCategoryAllocId(null);
    showToast('Allocation updated');
  };

  const handleMoveCategory = (catId: string, direction: 'up' | 'down') => {
    if (!plan) return;
    const index = plan.budgetCategories.findIndex((c) => c.id === catId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === plan.budgetCategories.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newCategories = [...plan.budgetCategories];
    const [moved] = newCategories.splice(index, 1);
    newCategories.splice(targetIndex, 0, moved);

    const updatedCategories = newCategories.map((c, i) => ({
      ...c,
      position: i + 1,
    }));

    const updatedPlan: Plan = {
      ...plan,
      budgetCategories: updatedCategories,
    };
    persistPlan(updatedPlan);
    setActiveCategoryMenuId(null);
    showToast('Category reordered');
  };

  const handleDeleteCategory = (catId: string) => {
    if (!plan) return;
    const cat = plan.budgetCategories.find((c) => c.id === catId);
    if (!cat) return;

    const hasExpenses = plan.expenses.some(
      (e) => e.categoryId === cat.id || e.categoryId === cat.key,
    );
    if (hasExpenses) {
      showToast(`Cannot delete "${cat.label}": please reassign or delete its expenses first.`);
      return;
    }

    const updatedPlan: Plan = {
      ...plan,
      budgetCategories: plan.budgetCategories.filter((c) => c.id !== catId),
    };
    persistPlan(updatedPlan);
    setActiveCategoryMenuId(null);
    showToast(`Deleted category "${cat.label}"`);
  };

  const handleSaveVendor = (
    vendor: VendorItem,
    initialQuote?: { amountPaise: number; unit: QuoteUnit; inclusions?: string[] },
  ) => {
    if (!plan) return;
    const existingIndex = plan.vendors.findIndex((v) => v.id === vendor.id);
    let nextVendors: VendorItem[];
    if (existingIndex >= 0) {
      nextVendors = plan.vendors.map((v) => (v.id === vendor.id ? vendor : v));
    } else {
      nextVendors = [...plan.vendors, vendor];
    }

    let nextQuotes = plan.quotes || [];
    if (initialQuote) {
      const newQuote: QuoteItem = {
        id: `quote-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        vendorId: vendor.id,
        amountPaise: initialQuote.amountPaise,
        unit: initialQuote.unit,
        inclusions: initialQuote.inclusions || [],
      };
      nextQuotes = [...nextQuotes, newQuote];
    }

    const updatedPlan: Plan = {
      ...plan,
      vendors: nextVendors,
      quotes: nextQuotes,
      updatedAt: new Date().toISOString(),
    };
    persistPlan(updatedPlan);
    setShowVendorDialog(false);
    setVendorToEdit(null);
    showToast(
      existingIndex >= 0 ? `Updated "${vendor.name}"` : `Added "${vendor.name}" to directory`,
    );
  };

  const handleDeleteVendor = (vendorId: string) => {
    if (!plan) return;
    const v = plan.vendors.find((item) => item.id === vendorId);
    const nextVendors = plan.vendors.filter((item) => item.id !== vendorId);
    const nextQuotes = (plan.quotes || []).filter((q) => q.vendorId !== vendorId);
    const updatedPlan: Plan = {
      ...plan,
      vendors: nextVendors,
      quotes: nextQuotes,
      updatedAt: new Date().toISOString(),
    };
    persistPlan(updatedPlan);
    if (selectedVendorForDrawer && selectedVendorForDrawer.id === vendorId) {
      setSelectedVendorForDrawer(null);
    }
    showToast(`Removed "${v?.name || 'vendor'}"`);
  };

  const handleUpdateVendorStatus = (
    vendorId: string,
    status: 'shortlisted' | 'booked' | 'dropped',
  ) => {
    if (!plan) return;
    const nextVendors = plan.vendors.map((v) => (v.id === vendorId ? { ...v, status } : v));
    const updatedPlan: Plan = {
      ...plan,
      vendors: nextVendors,
      updatedAt: new Date().toISOString(),
    };
    persistPlan(updatedPlan);
    if (selectedVendorForDrawer && selectedVendorForDrawer.id === vendorId) {
      setSelectedVendorForDrawer({ ...selectedVendorForDrawer, status });
    }
    showToast(`Vendor status updated to ${status}`);
  };

  const handleSaveQuote = (quote: QuoteItem) => {
    if (!plan) return;
    const nextQuotes = [...(plan.quotes || []), quote];
    const updatedPlan: Plan = {
      ...plan,
      quotes: nextQuotes,
      updatedAt: new Date().toISOString(),
    };
    persistPlan(updatedPlan);
    setShowQuoteDialog(false);
    showToast('Quote saved and added to comparison');
  };

  const handleDeleteQuote = (quoteId: string) => {
    if (!plan) return;
    const nextQuotes = (plan.quotes || []).filter((q) => q.id !== quoteId);
    const updatedPlan: Plan = {
      ...plan,
      quotes: nextQuotes,
      updatedAt: new Date().toISOString(),
    };
    persistPlan(updatedPlan);
    showToast('Quote removed');
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!plan) return;
    const restored = await restoreSnapshot(plan.id, snapshotId);
    if (restored) {
      setPlan(restored);
      showToast('Restored previous snapshot');
    }
  };

  const handleDownloadBackup = () => {
    if (!plan) return;
    const backupJson = exportPlanBackup(plan);
    const slug = plan.event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBackupFile(backupJson, slug);
  };

  const handleDeleteCelebration = async () => {
    if (!plan) return;
    await deletePlan(plan.id);
    navigate('/events');
  };

  const handleDownloadBudgetCsv = () => {
    if (!plan) return;
    const csv = generateBudgetCsv(plan);
    downloadCsv(csv, `${plan.event.title}-budget.csv`);
  };

  const handleDownloadTasksCsv = () => {
    if (!plan) return;
    const csv = generateTasksCsv(plan);
    downloadCsv(csv, `${plan.event.title}-tasks.csv`);
  };

  if (loading || !plan) {
    return (
      <div className="overview-page">
        <div
          className="overview-loading-skeleton"
          role="status"
          aria-label="Loading celebration planner"
        >
          <ToranlyLogomark size={40} className="overview-skeleton-logo" />
          <p className="overview-skeleton-text">Loading celebration planner…</p>
        </div>
      </div>
    );
  }

  // Derived metrics
  const daysRemaining = plan.event.eventDate ? calculateDaysRemaining(plan.event.eventDate) : 0;
  const completedTasks = plan.tasks.filter((t) => t.status === 'done').length;
  const openTasks = plan.tasks.filter((t) => t.status === 'open');
  const overdueTasks = openTasks.filter((t) => isTaskOverdue(t.dueDate, t.status));

  // Dietary check
  const dietBreakdown = plan.guests
    ? {
        veg: plan.guests.veg,
        nonVeg: plan.guests.nonVeg,
        jain: plan.guests.jain,
        eggetarian: plan.guests.eggetarian,
        vegan: plan.guests.vegan,
      }
    : { veg: 0, nonVeg: 0, jain: 0, eggetarian: 0, vegan: 0 };
  const dietCoverage = checkDietaryCoverage(dietBreakdown, plan.ideas || []);

  return (
    <div className="overview-page">
      <InMemoryBanner />

      <PlannerWorkspaceShell
        plan={plan}
        activeTab={activeTab}
        onSelectTab={setTab}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        overdueTasksCount={overdueTasks.length}
        onDownloadBackup={handleDownloadBackup}
      >
        {/* TOAST MESSAGE */}
        {toastMessage && (
          <div className="overview-toast" role="status">
            <CheckCircle size={16} />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="overview-content-wrapper">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-pane-fade">
              {/* HEADER BLOCK */}
              <section className="overview-header-block">
                <div className="overview-header-info">
                  <div className="overview-badge-row">
                    <span className="overview-type-badge">{plan.event.type}</span>
                    <span className="overview-status-pill">Active celebration</span>
                  </div>
                  <h1 className="overview-title">{plan.event.title}</h1>
                  <div className="overview-meta-row">
                    <span className="overview-meta-item">
                      <MapPin size={15} />
                      <span>{plan.event.city || 'Location not set'}</span>
                    </span>
                    <span className="overview-meta-dot">·</span>
                    <span className="overview-meta-item">
                      <Calendar size={15} />
                      <span>{formatDisplayDate(plan.event.eventDate)}</span>
                    </span>
                    {plan.functions.length > 0 && (
                      <>
                        <span className="overview-meta-dot">·</span>
                        <span className="overview-meta-item">
                          <span>{plan.functions.length} functions</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="overview-countdown-box">
                  <span className="overview-countdown-number">{daysRemaining}</span>
                  <span className="overview-countdown-label">days to go</span>
                </div>
              </section>

              {/* STARTER-PLAN BANNER */}
              {!starterPlanDismissed && (
                <section className="overview-starter-banner" aria-label="Starter planning guidance">
                  <div className="overview-banner-left">
                    <div className="overview-banner-icon-box">
                      <Lightbulb size={20} />
                    </div>
                    <div className="overview-banner-text">
                      <h3 className="overview-banner-heading">Starter celebration plan ready</h3>
                      <p className="overview-banner-sub">
                        Your starter budget categories and checklist are saved in this browser. No
                        account needed. Download a backup to keep a copy.
                      </p>
                    </div>
                  </div>
                  <div className="overview-banner-actions">
                    <button
                      type="button"
                      className="overview-banner-dismiss-btn"
                      onClick={() => setStarterPlanDismissed(true)}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className="overview-banner-ai-btn"
                      onClick={handleDownloadBackup}
                    >
                      <Download size={15} />
                      <span>Download backup</span>
                    </button>
                  </div>
                </section>
              )}

              {/* BALANCED BENTO GRID */}
              <div className="overview-bento-grid">
                {/* ROW 1: BUDGET OVERVIEW (Full Width & Dominant) */}
                <section
                  className="overview-card-section bento-row-full"
                  aria-labelledby="overview-budget-heading"
                >
                  {liveCheckNote}
                  <div className="overview-card-header">
                    <div className="overview-card-title-group">
                      <h2 id="overview-budget-heading" className="overview-card-title">
                        Budget overview
                      </h2>
                      <span className="overview-card-sub">
                        Total allocated:{' '}
                        {formatPaise(budgetMetrics.totalAllocatedPaise, { includeWords: true })}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="overview-action-link"
                      onClick={() => setTab('budget')}
                    >
                      <span>View budget details</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  <div className="overview-metrics-grid">
                    <div className="overview-metric-box">
                      <span className="overview-metric-label">Total Allocated</span>
                      <span className="overview-metric-value">
                        {formatPaise(budgetMetrics.totalAllocatedPaise)}
                      </span>
                    </div>
                    <div className="overview-metric-box">
                      <span className="overview-metric-label">Committed</span>
                      <span className="overview-metric-value">
                        {formatPaise(budgetMetrics.totalCommittedPaise)}
                      </span>
                    </div>
                    <div className="overview-metric-box">
                      <span className="overview-metric-label">Remaining</span>
                      <span
                        className={`overview-metric-value ${budgetMetrics.totalRemainingPaise >= 0 ? 'overview-metric-remaining' : 'overview-metric-negative'}`}
                      >
                        {formatPaise(budgetMetrics.totalRemainingPaise)}
                      </span>
                    </div>
                  </div>

                  <div className="overview-budget-progress-container">
                    <div className="overview-progress-track">
                      <div
                        className={`overview-progress-bar-fill status-${budgetMetrics.overallStatus}`}
                        style={{
                          width: `${Math.min(100, Math.max(0, budgetMetrics.percentCommitted))}%`,
                        }}
                      />
                    </div>
                    <div className="overview-progress-meta">
                      <span className="overview-progress-pct-text">
                        {budgetMetrics.percentCommitted}% committed of allocated budget
                      </span>
                      <span
                        className={`overview-budget-status-pill status-${budgetMetrics.overallStatus}`}
                      >
                        {budgetMetrics.overallStatus === 'ok'
                          ? 'On budget'
                          : budgetMetrics.overallStatus === 'warning'
                            ? 'Near limit'
                            : 'Exceeded'}
                      </span>
                    </div>
                  </div>
                </section>

                {/* ROW 2: UPCOMING CHECKLIST (Larger Left Card) */}
                <section
                  className="overview-card-section bento-card-main"
                  aria-labelledby="overview-checklist-heading"
                >
                  <div className="overview-card-header">
                    <div className="overview-card-title-group">
                      <h2 id="overview-checklist-heading" className="overview-card-title">
                        Upcoming checklist
                      </h2>
                      <span className="overview-card-sub">
                        {completedTasks} of {plan.tasks.length} tasks completed
                      </span>
                    </div>
                    <button
                      type="button"
                      className="overview-action-link"
                      onClick={() => setTab('timeline')}
                    >
                      <span>Full timeline</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  <div className="overview-tasks-list">
                    {plan.tasks.slice(0, 5).map((task) => {
                      const isDone = task.status === 'done';
                      const isOver = isTaskOverdue(task.dueDate, task.status);
                      return (
                        <div
                          key={task.id}
                          className={`overview-task-row ${isDone ? 'overview-task-done' : ''}`}
                        >
                          <label className="overview-task-checkbox-label">
                            <input
                              type="checkbox"
                              className="overview-task-checkbox"
                              checked={isDone}
                              onChange={() => handleToggleTask(task)}
                            />
                            <div className="overview-task-info">
                              <span className="overview-task-title">{task.title}</span>
                              {task.dependsOn && task.dependsOn.length > 0 && (
                                <span className="overview-task-dep">
                                  Depends on {task.dependsOn.length} task(s)
                                </span>
                              )}
                            </div>
                          </label>

                          <div className="overview-task-badges">
                            {task.isMilestone && (
                              <span className="overview-milestone-chip">
                                <Flag size={11} />
                                <span>Milestone</span>
                              </span>
                            )}
                            {isOver && (
                              <span className="overview-overdue-chip">
                                <AlertCircle size={11} />
                                <span>Overdue</span>
                              </span>
                            )}
                            <span className="overview-task-date">{task.dueDate}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* ROW 2: GUESTS & DINING (Compact Right Card) */}
                <section
                  className="overview-card-section bento-card-side"
                  aria-labelledby="overview-guests-heading"
                >
                  <div className="overview-card-header">
                    <div className="overview-card-title-group">
                      <h2 id="overview-guests-heading" className="overview-card-title">
                        Guests &amp; Dining
                      </h2>
                      <span className="overview-card-sub">Dietary &amp; headcount summary</span>
                    </div>
                    <button
                      type="button"
                      className="overview-action-link"
                      onClick={() => setTab('guests')}
                    >
                      <span>Details</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  <div className="overview-guests-content">
                    <div className="overview-guests-hero-metric">
                      <div className="overview-guests-hero-icon-box">
                        <Users size={20} />
                      </div>
                      <div className="overview-guests-hero-text">
                        <span className="overview-guests-hero-value">
                          {plan.event.guestEstimate}
                        </span>
                        <span className="overview-guests-hero-label">expected attendees</span>
                      </div>
                    </div>

                    <div className="overview-diet-pills-row">
                      {dietBreakdown.veg > 0 && (
                        <span className="overview-diet-pill">
                          <strong>{dietBreakdown.veg}</strong> Veg
                        </span>
                      )}
                      {dietBreakdown.jain > 0 && (
                        <span className="overview-diet-pill">
                          <strong>{dietBreakdown.jain}</strong> Jain
                        </span>
                      )}
                      {dietBreakdown.nonVeg > 0 && (
                        <span className="overview-diet-pill">
                          <strong>{dietBreakdown.nonVeg}</strong> Non-Veg
                        </span>
                      )}
                      {dietBreakdown.eggetarian > 0 && (
                        <span className="overview-diet-pill">
                          <strong>{dietBreakdown.eggetarian}</strong> Egg
                        </span>
                      )}
                      {dietBreakdown.vegan > 0 && (
                        <span className="overview-diet-pill">
                          <strong>{dietBreakdown.vegan}</strong> Vegan
                        </span>
                      )}
                    </div>

                    <div
                      className={`overview-menu-hint-box ${dietCoverage.isFullyCovered ? 'covered' : 'needs-attention'}`}
                    >
                      <div className="overview-menu-hint-text">
                        {dietCoverage.isFullyCovered ? (
                          <CheckCircle size={15} className="overview-menu-check-icon" />
                        ) : (
                          <AlertTriangle size={15} className="overview-menu-warn-icon" />
                        )}
                        <span>
                          {dietCoverage.isFullyCovered
                            ? 'All dietary groups covered by menu ideas.'
                            : `${dietCoverage.uncoveredDiets.length} dietary group(s) need menu options.`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="overview-menu-ideas-link"
                        onClick={() => setTab('guests')}
                      >
                        Check dietary breakdown →
                      </button>
                    </div>
                  </div>
                </section>

                {/* ROW 3: FUNCTIONS / CEREMONY SCHEDULE & VENDOR PROGRESS */}
                {(plan.functions.length > 0 || plan.vendors.length > 0) && (
                  <>
                    {/* Functions Card */}
                    <section
                      className="overview-card-section bento-card-main"
                      aria-labelledby="overview-schedule-heading"
                    >
                      <div className="overview-card-header">
                        <div className="overview-card-title-group">
                          <h2 id="overview-schedule-heading" className="overview-card-title">
                            Ceremony schedule
                          </h2>
                          <span className="overview-card-sub">
                            {plan.functions.length} celebration event
                            {plan.functions.length === 1 ? '' : 's'} scheduled
                          </span>
                        </div>
                        <button
                          type="button"
                          className="overview-action-link"
                          onClick={() => setTab('schedule')}
                        >
                          <span>Full schedule</span>
                          <ChevronRight size={15} />
                        </button>
                      </div>

                      <div className="overview-functions-list">
                        {plan.functions.slice(0, 3).map((fn, idx) => (
                          <div key={fn.id} className="overview-function-item">
                            <div className="overview-fn-seq-badge">{idx + 1}</div>
                            <div className="overview-fn-info">
                              <span className="overview-fn-name">{fn.name}</span>
                              <div className="overview-fn-time-row">
                                <Calendar size={13} />
                                <span>{formatDisplayDate(fn.date)}</span>
                                <span className="overview-fn-dot">·</span>
                                <Clock size={13} />
                                <span>
                                  {fn.startTime || '18:00'} – {fn.endTime || '22:00'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Vendors Card */}
                    <section
                      className="overview-card-section bento-card-side"
                      aria-labelledby="overview-vendors-heading"
                    >
                      <div className="overview-card-header">
                        <div className="overview-card-title-group">
                          <h2 id="overview-vendors-heading" className="overview-card-title">
                            Vendor progress
                          </h2>
                          <span className="overview-card-sub">
                            {plan.vendors.filter((v) => v.status === 'booked').length} of{' '}
                            {plan.vendors.length} vendors booked
                          </span>
                        </div>
                        <button
                          type="button"
                          className="overview-action-link"
                          onClick={() => setTab('vendors')}
                        >
                          <span>Directory</span>
                          <ChevronRight size={15} />
                        </button>
                      </div>

                      <div className="overview-vendors-content">
                        {plan.vendors.length > 0 ? (
                          <div className="overview-vendors-list">
                            {plan.vendors.slice(0, 3).map((v) => (
                              <div key={v.id} className="overview-vendor-row">
                                <div className="overview-v-row-info">
                                  <span className="overview-v-row-name">{v.name}</span>
                                  <span className="overview-v-row-cat">{v.categoryKey}</span>
                                </div>
                                <span
                                  className={`overview-v-badge ${v.status === 'booked' ? 'overview-v-booked' : 'overview-v-shortlist'}`}
                                >
                                  {v.status === 'booked' ? 'Booked' : 'Shortlisted'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="overview-vendors-empty">
                            <p className="overview-vendors-empty-text">
                              No vendors shortlisted yet.
                            </p>
                            <button
                              type="button"
                              className="overview-vendors-empty-btn"
                              onClick={() => setTab('vendors')}
                            >
                              Explore vendor directory →
                            </button>
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB: BUDGET */}
          {activeTab === 'budget' &&
            (() => {
              const celebrationLimit =
                plan.event.budgetTotalPaise || budgetMetrics.totalAllocatedPaise;
              const isOverrun =
                plan.event.budgetTotalPaise != null &&
                plan.event.budgetTotalPaise > 0 &&
                budgetMetrics.totalAllocatedPaise > plan.event.budgetTotalPaise;
              const overrunAmountPaise = isOverrun
                ? budgetMetrics.totalAllocatedPaise - plan.event.budgetTotalPaise!
                : 0;
              const unallocatedPaise = Math.max(
                0,
                celebrationLimit - budgetMetrics.totalAllocatedPaise,
              );

              // Utilization progress calculations
              const progressBaseline = Math.max(
                celebrationLimit,
                budgetMetrics.totalAllocatedPaise,
                budgetMetrics.totalCommittedPaise,
                1,
              );
              const paidPercent = Math.min(
                100,
                Math.round((budgetMetrics.totalPaidPaise / progressBaseline) * 100),
              );
              const committedUnpaidPaise = Math.max(
                0,
                budgetMetrics.totalCommittedPaise - budgetMetrics.totalPaidPaise,
              );
              const committedUnpaidPercent = Math.min(
                100 - paidPercent,
                Math.round((committedUnpaidPaise / progressBaseline) * 100),
              );
              const remainingPercent = Math.max(0, 100 - paidPercent - committedUnpaidPercent);

              const filteredExpenses = plan.expenses.filter((e) => {
                if (expenseCategoryFilter !== 'all') {
                  const matchesCategory =
                    e.categoryId === expenseCategoryFilter ||
                    plan.budgetCategories.find((c) => c.id === expenseCategoryFilter)?.key ===
                      e.categoryId;
                  if (!matchesCategory) return false;
                }
                if (expenseSearchQuery.trim()) {
                  const q = expenseSearchQuery.toLowerCase();
                  const descMatch = e.description.toLowerCase().includes(q);
                  const noteMatch = e.note ? e.note.toLowerCase().includes(q) : false;
                  const catObj = plan.budgetCategories.find(
                    (c) => c.id === e.categoryId || c.key === e.categoryId,
                  );
                  const catMatch = catObj
                    ? catObj.label.toLowerCase().includes(q)
                    : e.categoryId.toLowerCase().includes(q);
                  if (!descMatch && !noteMatch && !catMatch) return false;
                }
                return true;
              });

              return (
                <div className="budget-page-wrapper tab-pane-fade">
                  {liveCheckNote}
                  {/* 1. Budget Page Header */}
                  <div className="budget-page-header">
                    <div className="budget-header-left">
                      <h1 className="budget-title">Budget</h1>
                      <p className="budget-description">
                        Track allocations, vendor commitments, and payments against your{' '}
                        <strong>{formatPaise(celebrationLimit)}</strong> celebration target limit.
                      </p>
                    </div>
                    <div className="budget-header-actions">
                      <button
                        type="button"
                        className="budget-action-btn budget-action-secondary"
                        onClick={handleDownloadBudgetCsv}
                        title="Export budget report as CSV file"
                      >
                        <FileSpreadsheet size={16} />
                        <span>Download CSV</span>
                      </button>
                      <button
                        type="button"
                        className="budget-action-btn budget-action-secondary"
                        onClick={() => setShowAddCategoryDialog(true)}
                      >
                        <Plus size={16} />
                        <span>Add category</span>
                      </button>
                      <button
                        type="button"
                        className="budget-action-btn budget-action-primary"
                        onClick={() => setShowExpenseDialog(true)}
                      >
                        <Plus size={16} />
                        <span>Add expense</span>
                      </button>
                    </div>
                  </div>

                  {/* Overrun Alert Banner (Stitch Design Reference) */}
                  {isOverrun && !dismissedOverrunBanner && (
                    <div className="budget-alert-banner" role="alert">
                      <div className="budget-alert-main">
                        <AlertTriangle size={18} className="budget-alert-icon" />
                        <div className="budget-alert-info">
                          <strong className="budget-alert-title">
                            Allocations exceed celebration limit by{' '}
                            {formatPaise(overrunAmountPaise)}
                          </strong>
                          <p className="budget-alert-text">
                            Total assigned {formatPaise(budgetMetrics.totalAllocatedPaise)} across{' '}
                            {plan.budgetCategories.length} categories against your planned{' '}
                            {formatPaise(plan.event.budgetTotalPaise!)} target limit. Review
                            allocations to rebalance.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="budget-alert-dismiss"
                        onClick={() => setDismissedOverrunBanner(true)}
                        title="Dismiss alert"
                        aria-label="Dismiss alert"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* 2. Hierarchical Financial Overview */}
                  <div className="budget-financial-overview">
                    <div className="budget-kpi-grid">
                      <div className="budget-kpi-tile">
                        <span className="tile-label">Total Budget</span>
                        <span className="tile-value">{formatPaise(celebrationLimit)}</span>
                        <span className="tile-sub">Celebration target</span>
                      </div>

                      <div className="budget-kpi-tile">
                        <span className="tile-label">Total Allocated</span>
                        <span className="tile-value">
                          {formatPaise(budgetMetrics.totalAllocatedPaise)}
                        </span>
                        <span className="tile-sub">
                          {celebrationLimit > 0
                            ? `${Math.round((budgetMetrics.totalAllocatedPaise / celebrationLimit) * 100)}% of celebration limit`
                            : '100% of target'}
                        </span>
                      </div>

                      <div className="budget-kpi-tile tile-remaining-hero">
                        <span className="tile-label">Remaining Balance</span>
                        <span
                          className={`tile-value ${budgetMetrics.totalRemainingPaise < 0 ? 'tile-val-negative' : 'tile-val-hero'}`}
                        >
                          {budgetMetrics.totalRemainingPaise < 0 ? '−' : ''}
                          {formatPaise(Math.abs(budgetMetrics.totalRemainingPaise))}
                        </span>
                        <span className="tile-sub">
                          {budgetMetrics.totalRemainingPaise < 0
                            ? 'Over allocated budget'
                            : 'Available uncommitted spend'}
                        </span>
                      </div>

                      <div className="budget-kpi-tile">
                        <span className="tile-label">Committed</span>
                        <span className="tile-value">
                          {formatPaise(budgetMetrics.totalCommittedPaise)}
                        </span>
                        <span className="tile-sub">
                          {budgetMetrics.percentCommitted}% contracted or planned
                        </span>
                      </div>

                      <div className="budget-kpi-tile">
                        <span className="tile-label">Paid to Date</span>
                        <span className="tile-value tile-val-paid">
                          {formatPaise(budgetMetrics.totalPaidPaise)}
                        </span>
                        <span className="tile-sub">
                          {budgetMetrics.totalCommittedPaise > 0
                            ? `${Math.round((budgetMetrics.totalPaidPaise / budgetMetrics.totalCommittedPaise) * 100)}% of committed`
                            : '0% paid'}
                        </span>
                      </div>

                      <div className="budget-kpi-tile tile-indicators">
                        <div className="tile-indicator-row">
                          <span className="indicator-label">Unallocated buffer:</span>
                          <strong className="indicator-value">
                            {formatPaise(unallocatedPaise)}
                          </strong>
                        </div>
                        <div className="tile-indicator-row">
                          <span className="indicator-label">Overall health:</span>
                          <div className="indicator-health-wrap">
                            {budgetMetrics.overallStatus === 'ok' && (
                              <span className="budget-health-pill pill-ok">
                                <CheckCircle size={13} />
                                <span>On Track</span>
                              </span>
                            )}
                            {budgetMetrics.overallStatus === 'warning' && (
                              <span className="budget-health-pill pill-warning">
                                <AlertTriangle size={13} />
                                <span>Near Limit</span>
                              </span>
                            )}
                            {budgetMetrics.overallStatus === 'over' && (
                              <span className="budget-health-pill pill-over">
                                <AlertCircle size={13} />
                                <span>Over Budget</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Utilization & Progress Visualization */}
                    <div className="budget-progress-card">
                      <div className="budget-progress-header">
                        <span className="progress-title">Budget Outflow &amp; Utilization</span>
                        <span className="progress-status-badge">
                          {budgetMetrics.percentCommitted}% committed
                        </span>
                      </div>

                      <div className="budget-progress-track">
                        <div
                          className="progress-segment segment-paid"
                          style={{ width: `${Math.min(100, paidPercent)}%` }}
                          title={`Paid to Date: ${formatPaise(budgetMetrics.totalPaidPaise)} (${paidPercent}%)`}
                        />
                        <div
                          className="progress-segment segment-committed"
                          style={{
                            width: `${Math.min(100 - paidPercent, committedUnpaidPercent)}%`,
                          }}
                          title={`Committed (Unpaid): ${formatPaise(committedUnpaidPaise)} (${committedUnpaidPercent}%)`}
                        />
                      </div>

                      <div className="budget-progress-legend">
                        <div className="legend-cell">
                          <span className="legend-dot dot-paid" />
                          <span className="legend-tag">Paid:</span>
                          <strong className="legend-val">
                            {formatPaise(budgetMetrics.totalPaidPaise)}
                          </strong>
                          <span className="legend-pct">({paidPercent}%)</span>
                        </div>
                        <div className="legend-cell">
                          <span className="legend-dot dot-committed" />
                          <span className="legend-tag">Committed (Unpaid):</span>
                          <strong className="legend-val">
                            {formatPaise(committedUnpaidPaise)}
                          </strong>
                          <span className="legend-pct">({committedUnpaidPercent}%)</span>
                        </div>
                        <div className="legend-cell">
                          <span className="legend-dot dot-remaining" />
                          <span className="legend-tag">Remaining:</span>
                          <strong className="legend-val">
                            {formatPaise(Math.max(0, budgetMetrics.totalRemainingPaise))}
                          </strong>
                          <span className="legend-pct">({remainingPercent}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Tab Navigation: Categories vs Expenses */}
                  <div className="budget-subtabs-toolbar">
                    <div className="budget-subtab-pills">
                      <button
                        type="button"
                        className={`budget-tab-btn ${budgetSubTab === 'categories' ? 'active' : ''}`}
                        onClick={() => setBudgetSubTab('categories')}
                      >
                        <Folder size={15} />
                        <span>Categories ({plan.budgetCategories.length})</span>
                      </button>
                      <button
                        type="button"
                        className={`budget-tab-btn ${budgetSubTab === 'expenses' ? 'active' : ''}`}
                        onClick={() => setBudgetSubTab('expenses')}
                      >
                        <Receipt size={15} />
                        <span>Expenses Log ({plan.expenses.length})</span>
                      </button>
                    </div>
                    <div className="budget-currency-tag">
                      <span className="currency-label">Currency:</span>
                      <span className="currency-val">INR (₹)</span>
                    </div>
                  </div>

                  {/* 5. SubTab Content: Categories Table */}
                  {budgetSubTab === 'categories' ? (
                    <div className="budget-table-card">
                      <div className="budget-table-header-bar">
                        <div className="table-bar-left">
                          <h3 className="table-bar-title">Expense Categories</h3>
                          <span className="table-bar-count">
                            {plan.budgetCategories.length} categories
                          </span>
                        </div>
                        <span className="table-bar-hint">Click allocation to edit inline</span>
                      </div>

                      <div className="budget-table-scroll budget-categories-table-view">
                        <table className="budget-data-table">
                          <thead>
                            <tr>
                              <th className="th-category" scope="col">
                                Category
                              </th>
                              <th className="th-allocated" scope="col">
                                Allocated
                              </th>
                              <th className="th-committed" scope="col">
                                Committed
                              </th>
                              <th className="th-paid" scope="col">
                                Paid
                              </th>
                              <th className="th-remaining" scope="col">
                                Remaining
                              </th>
                              <th className="th-status" scope="col">
                                Status
                              </th>
                              <th className="th-actions" scope="col">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {budgetMetrics.categories.map((c, idx) => {
                              const catObj = plan.budgetCategories.find(
                                (b) => b.id === c.categoryId,
                              );
                              const categoryExpenses = plan.expenses.filter(
                                (e) =>
                                  e.categoryId === c.categoryId ||
                                  (catObj && e.categoryId === catObj.key),
                              );
                              const hasLinkedExpenses = categoryExpenses.length > 0;
                              const isEditingAlloc = editingCategoryAllocId === c.categoryId;
                              const isEditingName = editingCategoryNameId === c.categoryId;

                              return (
                                <tr key={c.categoryId} className="budget-table-row">
                                  {/* Category column */}
                                  <td className="td-category">
                                    <div className="category-cell-content">
                                      <div className="cat-icon-container">
                                        {getCategoryIcon(c.key, c.label)}
                                      </div>
                                      {isEditingName ? (
                                        <div
                                          className="cat-name-inline-edit"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            type="text"
                                            className="cat-name-input"
                                            value={editCategoryNameValue}
                                            onChange={(e) =>
                                              setEditCategoryNameValue(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter')
                                                handleSaveRenameCategory(c.categoryId);
                                              if (e.key === 'Escape')
                                                setEditingCategoryNameId(null);
                                            }}
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            className="inline-save-btn"
                                            onClick={() => handleSaveRenameCategory(c.categoryId)}
                                            title="Save name"
                                          >
                                            <Check size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            className="inline-cancel-btn"
                                            onClick={() => setEditingCategoryNameId(null)}
                                            title="Cancel"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="category-name-wrap">
                                          <span className="category-label-text">{c.label}</span>
                                          {plan.budgetCategories.find(
                                            (cat) => cat.id === c.categoryId,
                                          )?.source === 'ai' && (
                                            <span className="ai-source-badge">AI idea</span>
                                          )}
                                          {categoryExpenses.length > 0 && (
                                            <span className="category-expense-count">
                                              {categoryExpenses.length}{' '}
                                              {categoryExpenses.length === 1 ? 'item' : 'items'}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Allocated column (Inline editable) */}
                                  <td className="td-allocated">
                                    {isEditingAlloc ? (
                                      <div
                                        className="alloc-inline-edit"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="alloc-input-wrap">
                                          <span className="alloc-currency-sym" aria-hidden="true">
                                            ₹
                                          </span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="1000"
                                            className="alloc-num-input"
                                            value={editCategoryAllocValue}
                                            onChange={(e) =>
                                              setEditCategoryAllocValue(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter')
                                                handleSaveEditAlloc(c.categoryId);
                                              if (e.key === 'Escape')
                                                setEditingCategoryAllocId(null);
                                            }}
                                            aria-label={`Allocated budget for ${c.label}`}
                                            autoFocus
                                          />
                                        </div>
                                        <div className="alloc-inline-actions">
                                          <button
                                            type="button"
                                            className="inline-save-btn"
                                            onClick={() => handleSaveEditAlloc(c.categoryId)}
                                            title="Save allocation (Enter)"
                                            aria-label="Save allocation"
                                          >
                                            <Check size={13} />
                                          </button>
                                          <button
                                            type="button"
                                            className="inline-cancel-btn"
                                            onClick={() => setEditingCategoryAllocId(null)}
                                            title="Cancel (Esc)"
                                            aria-label="Cancel editing"
                                          >
                                            <X size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        className="alloc-display-btn"
                                        onClick={() => catObj && handleStartEditAlloc(catObj)}
                                        title="Click to edit allocated budget"
                                        aria-label={`${formatPaise(c.allocatedPaise)}, edit allocated budget for ${c.label}`}
                                      >
                                        <span className="num-val">
                                          {formatPaise(c.allocatedPaise)}
                                        </span>
                                        <Edit2
                                          size={12}
                                          className="alloc-edit-hint"
                                          aria-hidden="true"
                                        />
                                      </button>
                                    )}
                                  </td>

                                  {/* Committed */}
                                  <td className="td-committed">
                                    <span className="num-val">{formatPaise(c.committedPaise)}</span>
                                  </td>

                                  {/* Paid */}
                                  <td className="td-paid">
                                    <span
                                      className={`num-val ${c.paidPaise > 0 ? 'num-paid' : 'num-muted'}`}
                                    >
                                      {formatPaise(c.paidPaise)}
                                    </span>
                                  </td>

                                  {/* Remaining */}
                                  <td className="td-remaining">
                                    <span
                                      className={`num-val ${c.remainingPaise < 0 ? 'num-negative' : 'num-positive'}`}
                                    >
                                      {c.remainingPaise < 0 ? '−' : ''}
                                      {formatPaise(Math.abs(c.remainingPaise))}
                                    </span>
                                  </td>

                                  {/* Status */}
                                  <td className="td-status">
                                    {c.status === 'ok' && (
                                      <span className="cat-status-badge badge-ok">
                                        <CheckCircle size={13} />
                                        <span>OK</span>
                                      </span>
                                    )}
                                    {c.status === 'warning' && (
                                      <span className="cat-status-badge badge-warning">
                                        <AlertTriangle size={13} />
                                        <span>Near limit ({c.percentCommitted}%)</span>
                                      </span>
                                    )}
                                    {c.status === 'over' && (
                                      <span className="cat-status-badge badge-over">
                                        <AlertCircle size={13} />
                                        <span>
                                          Over by {formatPaise(c.committedPaise - c.allocatedPaise)}
                                        </span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="td-actions">
                                    <div className="budget-cat-menu-wrapper">
                                      <button
                                        type="button"
                                        className="budget-cat-more-btn"
                                        aria-label={`Actions for ${c.label}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveCategoryMenuId(
                                            activeCategoryMenuId === c.categoryId
                                              ? null
                                              : c.categoryId,
                                          );
                                        }}
                                      >
                                        <MoreVertical size={16} />
                                      </button>

                                      {activeCategoryMenuId === c.categoryId && (
                                        <div
                                          className="budget-cat-dropdown-menu"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            className="cat-menu-item"
                                            onClick={() =>
                                              catObj && handleStartRenameCategory(catObj)
                                            }
                                          >
                                            <Edit2 size={14} />
                                            <span>Rename category</span>
                                          </button>
                                          <button
                                            type="button"
                                            className="cat-menu-item"
                                            onClick={() => catObj && handleStartEditAlloc(catObj)}
                                          >
                                            <Tag size={14} />
                                            <span>Edit allocation</span>
                                          </button>
                                          <button
                                            type="button"
                                            className="cat-menu-item"
                                            disabled={idx === 0}
                                            onClick={() => handleMoveCategory(c.categoryId, 'up')}
                                          >
                                            <ArrowUp size={14} />
                                            <span>Move up</span>
                                          </button>
                                          <button
                                            type="button"
                                            className="cat-menu-item"
                                            disabled={idx === budgetMetrics.categories.length - 1}
                                            onClick={() => handleMoveCategory(c.categoryId, 'down')}
                                          >
                                            <ArrowDown size={14} />
                                            <span>Move down</span>
                                          </button>
                                          <div className="cat-menu-divider" />
                                          {hasLinkedExpenses ? (
                                            <div
                                              className="cat-menu-disabled"
                                              title="Delete disabled while linked expenses exist"
                                            >
                                              <Trash2 size={14} />
                                              <div className="cat-menu-disabled-info">
                                                <span>Delete</span>
                                                <small>
                                                  Has {categoryExpenses.length}{' '}
                                                  {categoryExpenses.length === 1
                                                    ? 'expense'
                                                    : 'expenses'}
                                                </small>
                                              </div>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              className="cat-menu-item item-danger"
                                              onClick={() => handleDeleteCategory(c.categoryId)}
                                            >
                                              <Trash2 size={14} />
                                              <span>Delete category</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="budget-tfoot-row">
                              <td className="tfoot-category">Total Budget</td>
                              <td className="tfoot-allocated">
                                {formatPaise(budgetMetrics.totalAllocatedPaise)}
                              </td>
                              <td className="tfoot-committed">
                                {formatPaise(budgetMetrics.totalCommittedPaise)}
                              </td>
                              <td className="tfoot-paid num-paid">
                                {formatPaise(budgetMetrics.totalPaidPaise)}
                              </td>
                              <td
                                className={`tfoot-remaining ${budgetMetrics.totalRemainingPaise < 0 ? 'num-negative' : ''}`}
                              >
                                {budgetMetrics.totalRemainingPaise < 0 ? '−' : ''}
                                {formatPaise(Math.abs(budgetMetrics.totalRemainingPaise))}
                              </td>
                              <td className="tfoot-status">
                                <span
                                  className={`cat-status-badge badge-${budgetMetrics.overallStatus}`}
                                >
                                  {budgetMetrics.overallStatus === 'ok'
                                    ? 'ON TRACK'
                                    : budgetMetrics.overallStatus === 'warning'
                                      ? 'NEAR LIMIT'
                                      : 'OVER BUDGET'}
                                </span>
                              </td>
                              <td className="tfoot-actions"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Mobile Category Cards View (< 768px) */}
                      <div className="budget-categories-mobile-list">
                        {budgetMetrics.categories.map((c, idx) => {
                          const catObj = plan.budgetCategories.find((b) => b.id === c.categoryId);
                          const categoryExpenses = plan.expenses.filter(
                            (e) =>
                              e.categoryId === c.categoryId ||
                              (catObj && e.categoryId === catObj.key),
                          );
                          const hasLinkedExpenses = categoryExpenses.length > 0;
                          const isEditingAlloc = editingCategoryAllocId === c.categoryId;
                          const isEditingName = editingCategoryNameId === c.categoryId;

                          return (
                            <div key={`mob-cat-${c.categoryId}`} className="cat-mobile-card">
                              <div className="cat-mobile-header">
                                <div className="category-cell-content">
                                  <div className="cat-icon-container">
                                    {getCategoryIcon(c.key, c.label)}
                                  </div>
                                  {isEditingName ? (
                                    <div
                                      className="cat-name-inline-edit"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="text"
                                        className="cat-name-input"
                                        value={editCategoryNameValue}
                                        onChange={(e) => setEditCategoryNameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter')
                                            handleSaveRenameCategory(c.categoryId);
                                          if (e.key === 'Escape') setEditingCategoryNameId(null);
                                        }}
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        className="inline-save-btn"
                                        onClick={() => handleSaveRenameCategory(c.categoryId)}
                                        title="Save name"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-cancel-btn"
                                        onClick={() => setEditingCategoryNameId(null)}
                                        title="Cancel"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="category-name-wrap">
                                      <span className="category-label-text">{c.label}</span>
                                      {plan.budgetCategories.find((cat) => cat.id === c.categoryId)
                                        ?.source === 'ai' && (
                                        <span className="ai-source-badge">AI idea</span>
                                      )}
                                      {categoryExpenses.length > 0 && (
                                        <span className="category-expense-count">
                                          {categoryExpenses.length}{' '}
                                          {categoryExpenses.length === 1 ? 'item' : 'items'}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="budget-cat-menu-wrapper">
                                  <button
                                    type="button"
                                    className="budget-cat-more-btn"
                                    aria-label={`Actions for ${c.label}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveCategoryMenuId(
                                        activeCategoryMenuId === `mob-${c.categoryId}`
                                          ? null
                                          : `mob-${c.categoryId}`,
                                      );
                                    }}
                                  >
                                    <MoreVertical size={16} />
                                  </button>

                                  {activeCategoryMenuId === `mob-${c.categoryId}` && (
                                    <div
                                      className="budget-cat-dropdown-menu"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        className="cat-menu-item"
                                        onClick={() => catObj && handleStartRenameCategory(catObj)}
                                      >
                                        <Edit2 size={14} />
                                        <span>Rename category</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="cat-menu-item"
                                        onClick={() => catObj && handleStartEditAlloc(catObj)}
                                      >
                                        <Tag size={14} />
                                        <span>Edit allocation</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="cat-menu-item"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveCategory(c.categoryId, 'up')}
                                      >
                                        <ArrowUp size={14} />
                                        <span>Move up</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="cat-menu-item"
                                        disabled={idx === budgetMetrics.categories.length - 1}
                                        onClick={() => handleMoveCategory(c.categoryId, 'down')}
                                      >
                                        <ArrowDown size={14} />
                                        <span>Move down</span>
                                      </button>
                                      <div className="cat-menu-divider" />
                                      {hasLinkedExpenses ? (
                                        <div
                                          className="cat-menu-disabled"
                                          title="Delete disabled while linked expenses exist"
                                        >
                                          <Trash2 size={14} />
                                          <div className="cat-menu-disabled-info">
                                            <span>Delete</span>
                                            <small>
                                              Has {categoryExpenses.length}{' '}
                                              {categoryExpenses.length === 1
                                                ? 'expense'
                                                : 'expenses'}
                                            </small>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className="cat-menu-item item-danger"
                                          onClick={() => handleDeleteCategory(c.categoryId)}
                                        >
                                          <Trash2 size={14} />
                                          <span>Delete category</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="cat-mobile-metrics-grid">
                                <div className="cat-metric-box">
                                  <span className="cat-metric-label">Allocated</span>
                                  {isEditingAlloc ? (
                                    <div
                                      className="alloc-inline-edit"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="alloc-input-wrap">
                                        <span className="alloc-currency-sym" aria-hidden="true">
                                          ₹
                                        </span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="1000"
                                          className="alloc-num-input"
                                          value={editCategoryAllocValue}
                                          onChange={(e) =>
                                            setEditCategoryAllocValue(e.target.value)
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter')
                                              handleSaveEditAlloc(c.categoryId);
                                            if (e.key === 'Escape') setEditingCategoryAllocId(null);
                                          }}
                                          aria-label={`Allocated budget for ${c.label}`}
                                          autoFocus
                                        />
                                      </div>
                                      <div className="alloc-inline-actions">
                                        <button
                                          type="button"
                                          className="inline-save-btn"
                                          onClick={() => handleSaveEditAlloc(c.categoryId)}
                                          title="Save allocation (Enter)"
                                          aria-label="Save allocation"
                                        >
                                          <Check size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="inline-cancel-btn"
                                          onClick={() => setEditingCategoryAllocId(null)}
                                          title="Cancel (Esc)"
                                          aria-label="Cancel editing"
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="alloc-display-btn"
                                      onClick={() => catObj && handleStartEditAlloc(catObj)}
                                      title="Click to edit allocated budget"
                                      aria-label={`${formatPaise(c.allocatedPaise)}, edit allocated budget for ${c.label}`}
                                    >
                                      <span className="num-val">
                                        {formatPaise(c.allocatedPaise)}
                                      </span>
                                      <Edit2
                                        size={12}
                                        className="alloc-edit-hint"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  )}
                                </div>

                                <div className="cat-metric-box">
                                  <span className="cat-metric-label">Committed</span>
                                  <span className="cat-metric-val">
                                    {formatPaise(c.committedPaise)}
                                  </span>
                                </div>

                                <div className="cat-metric-box">
                                  <span className="cat-metric-label">Paid</span>
                                  <span
                                    className={`cat-metric-val ${c.paidPaise > 0 ? 'num-paid' : 'num-muted'}`}
                                  >
                                    {formatPaise(c.paidPaise)}
                                  </span>
                                </div>

                                <div className="cat-metric-box">
                                  <span className="cat-metric-label">Remaining</span>
                                  <span
                                    className={`cat-metric-val ${c.remainingPaise < 0 ? 'num-negative' : 'num-positive'}`}
                                  >
                                    {c.remainingPaise < 0 ? '−' : ''}
                                    {formatPaise(Math.abs(c.remainingPaise))}
                                  </span>
                                </div>
                              </div>

                              <div className="cat-mobile-footer">
                                <div className="cat-mobile-status">
                                  {c.status === 'ok' && (
                                    <span className="cat-status-badge badge-ok">
                                      <CheckCircle size={13} />
                                      <span>OK</span>
                                    </span>
                                  )}
                                  {c.status === 'warning' && (
                                    <span className="cat-status-badge badge-warning">
                                      <AlertTriangle size={13} />
                                      <span>Near limit ({c.percentCommitted}%)</span>
                                    </span>
                                  )}
                                  {c.status === 'over' && (
                                    <span className="cat-status-badge badge-over">
                                      <AlertCircle size={13} />
                                      <span>
                                        Over by {formatPaise(c.committedPaise - c.allocatedPaise)}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                <span className="cat-mobile-pct-text">
                                  {c.percentCommitted}% committed
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Mobile Total Summary Card */}
                        <div className="cat-mobile-summary-card">
                          <div className="cat-mobile-summary-title">Total Budget Overview</div>
                          <div className="cat-mobile-metrics-grid">
                            <div className="cat-metric-box">
                              <span className="cat-metric-label">Total Allocated</span>
                              <strong className="cat-metric-val">
                                {formatPaise(budgetMetrics.totalAllocatedPaise)}
                              </strong>
                            </div>
                            <div className="cat-metric-box">
                              <span className="cat-metric-label">Total Committed</span>
                              <strong className="cat-metric-val">
                                {formatPaise(budgetMetrics.totalCommittedPaise)}
                              </strong>
                            </div>
                            <div className="cat-metric-box">
                              <span className="cat-metric-label">Total Paid</span>
                              <strong className="cat-metric-val num-paid">
                                {formatPaise(budgetMetrics.totalPaidPaise)}
                              </strong>
                            </div>
                            <div className="cat-metric-box">
                              <span className="cat-metric-label">Remaining</span>
                              <strong
                                className={`cat-metric-val ${budgetMetrics.totalRemainingPaise < 0 ? 'num-negative' : 'num-positive'}`}
                              >
                                {budgetMetrics.totalRemainingPaise < 0 ? '−' : ''}
                                {formatPaise(Math.abs(budgetMetrics.totalRemainingPaise))}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 6. SubTab Content: Expenses Log */
                    <div className="budget-table-card">
                      {/* Expenses Toolbar */}
                      <div className="budget-expenses-toolbar">
                        <div className="expenses-toolbar-left">
                          <div className="expenses-search-box">
                            <Search size={15} className="search-icon" />
                            <input
                              type="text"
                              placeholder="Search expenses by description or note…"
                              value={expenseSearchQuery}
                              onChange={(e) => setExpenseSearchQuery(e.target.value)}
                              className="expenses-search-input"
                            />
                            {expenseSearchQuery && (
                              <button
                                type="button"
                                className="search-clear-btn"
                                onClick={() => setExpenseSearchQuery('')}
                                aria-label="Clear search"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          <div className="expenses-category-select-wrapper">
                            <Select
                              value={expenseCategoryFilter}
                              onChange={(val) => setExpenseCategoryFilter(val)}
                              aria-label="Filter expenses by category"
                              variant="subtle"
                              options={[
                                { value: 'all', label: `All categories (${plan.expenses.length})` },
                                ...plan.budgetCategories.map((cat) => {
                                  const count = plan.expenses.filter(
                                    (e) => e.categoryId === cat.id || e.categoryId === cat.key,
                                  ).length;
                                  return {
                                    value: cat.id,
                                    label: `${cat.label} (${count})`,
                                  };
                                }),
                              ]}
                            />
                          </div>
                        </div>

                        <div className="expenses-toolbar-right">
                          <span className="expenses-counter">
                            Showing {filteredExpenses.length} of {plan.expenses.length}
                          </span>
                          <button
                            type="button"
                            className="budget-action-btn budget-action-primary"
                            onClick={() => setShowExpenseDialog(true)}
                          >
                            <Plus size={16} />
                            <span>Add expense</span>
                          </button>
                        </div>
                      </div>

                      {filteredExpenses.length === 0 ? (
                        <div className="table-empty-box">
                          {plan.expenses.length === 0 ? (
                            <>
                              <div className="empty-icon-wrap">
                                <Receipt size={28} className="empty-icon" />
                              </div>
                              <h4 className="empty-title">No expenses logged yet</h4>
                              <p className="empty-desc">
                                Record planned vendor payments, official quotes, or completed
                                transactions to monitor commitments.
                              </p>
                              <button
                                type="button"
                                className="budget-action-btn budget-action-primary empty-action-btn"
                                onClick={() => setShowExpenseDialog(true)}
                              >
                                <Plus size={16} />
                                <span>Log first expense</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="empty-icon-wrap">
                                <Search size={28} className="empty-icon" />
                              </div>
                              <h4 className="empty-title">No expenses match your search</h4>
                              <p className="empty-desc">
                                Try clearing your search query or category filter to view all
                                recorded expenses.
                              </p>
                              <button
                                type="button"
                                className="budget-action-btn budget-action-secondary empty-action-btn"
                                onClick={() => {
                                  setExpenseSearchQuery('');
                                  setExpenseCategoryFilter('all');
                                }}
                              >
                                Reset filters
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="budget-table-scroll budget-expenses-table-view">
                            <table className="budget-data-table">
                              <thead>
                                <tr>
                                  <th className="th-desc" scope="col">
                                    Description
                                  </th>
                                  <th className="th-category" scope="col">
                                    Category
                                  </th>
                                  <th className="th-stage" scope="col">
                                    Stage
                                  </th>
                                  <th className="th-num" scope="col">
                                    Amount
                                  </th>
                                  <th className="th-date" scope="col">
                                    Date
                                  </th>
                                  <th className="th-actions" scope="col"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredExpenses.map((e) => {
                                  const cat = plan.budgetCategories.find(
                                    (b) => b.id === e.categoryId || b.key === e.categoryId,
                                  );
                                  return (
                                    <tr key={e.id} className="budget-table-row">
                                      <td className="td-desc">
                                        <div className="expense-title-group">
                                          <strong className="expense-description-text">
                                            {e.description}
                                          </strong>
                                          {e.note && (
                                            <span className="expense-note-text">{e.note}</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="td-category">
                                        <div className="category-cell-content">
                                          <div className="cat-icon-container">
                                            {getCategoryIcon(
                                              cat?.key || e.categoryId,
                                              cat?.label || e.categoryId,
                                            )}
                                          </div>
                                          <span className="category-label-text">
                                            {cat?.label || e.categoryId}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="td-stage">
                                        <span className={`expense-stage-tag stage-${e.kind}`}>
                                          {e.kind.toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="td-num">
                                        <strong className="num-val">
                                          {formatPaise(e.amountPaise)}
                                        </strong>
                                      </td>
                                      <td className="td-date">
                                        <span className="expense-date-text">
                                          {e.spentOn || '—'}
                                        </span>
                                      </td>
                                      <td className="td-actions">
                                        <button
                                          type="button"
                                          className="row-delete-btn"
                                          onClick={() => handleDeleteExpense(e.id)}
                                          title="Delete expense"
                                          aria-label={`Delete expense ${e.description}`}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="budget-tfoot-row">
                                  <td className="tfoot-category">
                                    Total Filtered ({filteredExpenses.length})
                                  </td>
                                  <td colSpan={2}></td>
                                  <td className="tfoot-num">
                                    {formatPaise(
                                      filteredExpenses.reduce(
                                        (sum, item) => sum + item.amountPaise,
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td colSpan={2}></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* Mobile Expenses Cards View (< 768px) */}
                          <div className="budget-expenses-mobile-list">
                            {filteredExpenses.map((e) => {
                              const cat = plan.budgetCategories.find(
                                (b) => b.id === e.categoryId || b.key === e.categoryId,
                              );
                              return (
                                <div key={`mob-exp-${e.id}`} className="expense-mobile-card">
                                  <div className="expense-mobile-top">
                                    <div className="expense-mobile-title-wrap">
                                      <strong className="expense-description-text">
                                        {e.description}
                                      </strong>
                                      {e.note && (
                                        <span className="expense-note-text">{e.note}</span>
                                      )}
                                    </div>
                                    <strong className="expense-mobile-amount">
                                      {formatPaise(e.amountPaise)}
                                    </strong>
                                  </div>

                                  <div className="expense-mobile-meta">
                                    <div className="category-cell-content">
                                      <div className="cat-icon-container">
                                        {getCategoryIcon(
                                          cat?.key || e.categoryId,
                                          cat?.label || e.categoryId,
                                        )}
                                      </div>
                                      <span className="category-label-text">
                                        {cat?.label || e.categoryId}
                                      </span>
                                    </div>
                                    <div className="expense-mobile-tags">
                                      <span className={`expense-stage-tag stage-${e.kind}`}>
                                        {e.kind.toUpperCase()}
                                      </span>
                                      <span className="expense-date-text">{e.spentOn || '—'}</span>
                                    </div>
                                  </div>

                                  <div className="expense-mobile-actions">
                                    <button
                                      type="button"
                                      className="row-delete-btn"
                                      onClick={() => handleDeleteExpense(e.id)}
                                      title="Delete expense"
                                      aria-label={`Delete expense ${e.description}`}
                                    >
                                      <Trash2 size={14} />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Mobile Filtered Expenses Summary */}
                            <div className="expense-mobile-summary-card">
                              <span className="expense-mobile-summary-label">
                                Total Filtered ({filteredExpenses.length})
                              </span>
                              <strong className="expense-mobile-summary-val">
                                {formatPaise(
                                  filteredExpenses.reduce((sum, item) => sum + item.amountPaise, 0),
                                )}
                              </strong>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* TAB: TIMELINE */}
          {activeTab === 'timeline' &&
            (() => {
              const categoryLabel = (key?: string) =>
                plan.budgetCategories.find((c) => c.key === key)?.label || key || 'General';
              const visibleTasks = plan.tasks.filter((t) =>
                taskFilter === 'all' ? true : t.status === taskFilter,
              );
              const filters = [
                { key: 'all', label: 'All', count: plan.tasks.length },
                { key: 'open', label: 'Open', count: openTasks.length },
                { key: 'done', label: 'Completed', count: completedTasks },
              ] as const;

              return (
                <div className="tab-pane-fade">
                  <div className="tab-pane-header">
                    <div>
                      <h1 className="tab-pane-title">Timeline &amp; Tasks</h1>
                      <p className="tab-pane-subtitle">
                        Counted back from{' '}
                        {plan.event.eventDate
                          ? formatDisplayDate(plan.event.eventDate)
                          : 'celebration date'}
                        . Milestones and dependency gates.
                      </p>
                    </div>
                    <div className="tab-pane-actions">
                      {plan.event.eventDate && daysRemaining >= 0 && (
                        <span className="tl-countdown">
                          <Calendar size={14} aria-hidden="true" />
                          {daysRemaining === 0
                            ? 'Today'
                            : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} to go`}
                        </span>
                      )}
                      <button
                        type="button"
                        className="tab-action-btn"
                        onClick={handleDownloadTasksCsv}
                        title="Export task checklist as CSV file"
                      >
                        <FileSpreadsheet size={15} aria-hidden="true" />
                        <span>Download CSV</span>
                      </button>
                      <button
                        type="button"
                        className="tab-primary-btn"
                        onClick={() => setShowTaskDialog(true)}
                      >
                        <Plus size={16} aria-hidden="true" />
                        <span>Add task</span>
                      </button>
                    </div>
                  </div>

                  <div className="tl-toolbar">
                    <div className="tl-segmented" role="group" aria-label="Filter tasks">
                      {filters.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          className={`tl-segment ${taskFilter === f.key ? 'is-active' : ''}`}
                          aria-pressed={taskFilter === f.key}
                          onClick={() => setTaskFilter(f.key)}
                        >
                          {f.label}
                          <span className="tl-segment-count">{f.count}</span>
                        </button>
                      ))}
                    </div>
                    {plan.tasks.length > 0 && (
                      <span className="tl-progress-text">
                        {completedTasks} of {plan.tasks.length} done
                      </span>
                    )}
                  </div>

                  {visibleTasks.length === 0 ? (
                    <div className="tl-empty">
                      {plan.tasks.length === 0
                        ? 'No tasks yet. Add your first task to start the countdown.'
                        : taskFilter === 'done'
                          ? 'No completed tasks yet.'
                          : 'Every task is done.'}
                    </div>
                  ) : (
                    <ul className="tl-task-list">
                      {visibleTasks.map((task) => {
                        const isDone = task.status === 'done';
                        const isOver = isTaskOverdue(task.dueDate, task.status);
                        const gate = checkTaskCompletionGate(task, plan.tasks);
                        const isBlocked = !isDone && !gate.canComplete;
                        const depTitles = (task.dependsOn || [])
                          .map((id) => plan.tasks.find((t) => t.id === id)?.title)
                          .filter((t): t is string => Boolean(t));
                        const shownDeps = isBlocked
                          ? gate.blockingTasks.map((t) => t.title)
                          : depTitles;
                        const confirmingDelete = pendingDeleteTaskId === task.id;

                        return (
                          <li
                            key={task.id}
                            className={`tl-task ${isDone ? 'is-done' : ''} ${isBlocked ? 'is-blocked' : ''}`}
                          >
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isDone}
                              aria-label={task.title}
                              aria-describedby={isBlocked ? `tl-dep-${task.id}` : undefined}
                              className="tl-check"
                              onClick={() => handleToggleTask(task)}
                            >
                              <Check size={13} strokeWidth={3} aria-hidden="true" />
                            </button>

                            <div className="tl-task-body">
                              <span className="tl-task-title">{task.title}</span>
                              <div className="tl-task-meta">
                                <span className="tl-tag">{categoryLabel(task.categoryKey)}</span>
                                {task.source === 'ai' && (
                                  <span className="ai-source-badge">AI idea</span>
                                )}
                                {task.isMilestone && (
                                  <span className="tl-badge tl-badge--milestone">
                                    <Flag size={11} aria-hidden="true" /> Milestone
                                  </span>
                                )}
                                {shownDeps.length > 0 && (
                                  <span
                                    id={`tl-dep-${task.id}`}
                                    className={`tl-badge tl-dep ${isBlocked ? 'tl-badge--waiting' : 'tl-badge--ready'}`}
                                    title={shownDeps.join(', ')}
                                  >
                                    {isBlocked ? (
                                      <Clock size={11} aria-hidden="true" />
                                    ) : (
                                      <Check size={11} aria-hidden="true" />
                                    )}
                                    <span className="tl-dep-text">
                                      {isBlocked ? 'Waiting on ' : 'After '}
                                      {shownDeps[0]}
                                    </span>
                                    {shownDeps.length > 1 && (
                                      <span className="tl-dep-more">+{shownDeps.length - 1}</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="tl-task-side">
                              {isOver && (
                                <span className="tl-badge tl-badge--overdue">Overdue</span>
                              )}
                              <span className="tl-due">
                                {task.dueDate ? formatDisplayDate(task.dueDate) : 'No due date'}
                              </span>
                              {confirmingDelete ? (
                                <span
                                  className="tl-confirm"
                                  role="group"
                                  aria-label={`Delete ${task.title}?`}
                                >
                                  <span className="tl-confirm-text">Delete?</span>
                                  <button
                                    type="button"
                                    className="tl-confirm-btn"
                                    onClick={() => setPendingDeleteTaskId(null)}
                                    autoFocus
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="tl-confirm-btn tl-confirm-btn--danger"
                                    onClick={() => handleDeleteTask(task.id)}
                                  >
                                    Delete
                                  </button>
                                </span>
                              ) : (
                                <span className="tl-actions">
                                  <button
                                    type="button"
                                    className="tl-icon-btn"
                                    aria-label={`Edit ${task.title}`}
                                    title="Edit task"
                                    onClick={() => setEditingTask(task)}
                                  >
                                    <Edit2 size={14} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="tl-icon-btn tl-icon-btn--danger"
                                    aria-label={`Delete ${task.title}`}
                                    title="Delete task"
                                    onClick={() => setPendingDeleteTaskId(task.id)}
                                  >
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })()}

          {/* TAB: VENDORS */}
          {activeTab === 'vendors' &&
            (() => {
              const allVendors = plan.vendors || [];
              const allQuotes = plan.quotes || [];
              const guestCount = plan.event.guestEstimate || plan.guests?.total || 0;

              const bookedCount = allVendors.filter((v) => v.status === 'booked').length;
              const shortlistedCount = allVendors.filter((v) => v.status === 'shortlisted').length;
              const droppedCount = allVendors.filter((v) => v.status === 'dropped').length;

              const hasVendors = allVendors.length > 0;
              const budgetCats = plan.budgetCategories || [];
              const allCategoryKeys = Array.from(
                new Set([...budgetCats.map((c) => c.key), ...allVendors.map((v) => v.categoryKey)]),
              );

              // Filter by active category filter if set
              const displayedCategoryKeys =
                vendorCategoryFilter === 'all'
                  ? allCategoryKeys.filter((key) => {
                      const catBudget = budgetCats.find((c) => c.key === key);
                      const catVendors = allVendors.filter((v) => v.categoryKey === key);
                      return (
                        catVendors.length > 0 ||
                        (catBudget && catBudget.allocatedPaise > 0) ||
                        ['catering', 'venue', 'photo_video', 'decor'].includes(key)
                      );
                    })
                  : [vendorCategoryFilter];

              return (
                <div className="tab-pane-fade vendors-page-wrapper">
                  {/* 1. Header Matching Stitch Reference */}
                  <div className="vendors-page-header">
                    <div className="vendors-header-title-block">
                      <h1 className="vendors-page-title">Vendors</h1>
                      <p className="vendors-page-subtitle">
                        Manage vendors, track quotes and compare catering and venue options for{' '}
                        {plan.event.title || 'your celebration'}.
                      </p>
                    </div>

                    <div className="vendors-header-actions">
                      <button
                        type="button"
                        className="vendor-secondary-pill-btn"
                        onClick={() => setTab('ai-plan')}
                        title="Explore vendor recommendations with AI Plan"
                      >
                        <Lightbulb size={16} />
                        <span>Which vendors do I need?</span>
                      </button>

                      <button
                        type="button"
                        className="vendor-primary-pill-btn"
                        onClick={() => {
                          setVendorToEdit(null);
                          setVendorInitialCategory(undefined);
                          setShowVendorDialog(true);
                        }}
                        title="Add a new vendor"
                      >
                        <Plus size={16} />
                        <span>Add vendor</span>
                      </button>
                    </div>
                  </div>

                  {!hasVendors ? (
                    /* Total Empty State */
                    <div className="vendors-total-empty-view">
                      <div className="vendors-total-empty-icon-wrap">
                        <Store size={32} />
                      </div>
                      <h2 className="vendors-total-empty-title">No vendors added yet</h2>
                      <p className="vendors-total-empty-desc">
                        Start curating caterers, venues, photographers, and decorators for{' '}
                        {plan.event.title || 'your celebration'}. Compare quotes side-by-side to
                        make confident decisions.
                      </p>
                      <div className="vendors-total-empty-actions">
                        <button
                          type="button"
                          className="vendor-primary-pill-btn"
                          onClick={() => {
                            setVendorToEdit(null);
                            setVendorInitialCategory(undefined);
                            setShowVendorDialog(true);
                          }}
                        >
                          <Plus size={16} />
                          <span>Add first vendor</span>
                        </button>
                        <button
                          type="button"
                          className="vendor-secondary-pill-btn"
                          onClick={() => setTab('ai-plan')}
                        >
                          <Lightbulb size={16} />
                          <span>Which vendors do I need?</span>
                        </button>
                      </div>

                      <div className="vendors-total-empty-quick-box">
                        <span className="vendors-quick-title">Quick start by category</span>
                        <div className="vendors-quick-chips">
                          {(budgetCats.length > 0
                            ? budgetCats.slice(0, 8)
                            : DEFAULT_VENDOR_CATEGORIES
                          ).map((cat) => (
                            <button
                              key={cat.key}
                              type="button"
                              className="vendors-quick-chip-btn"
                              onClick={() => {
                                setVendorToEdit(null);
                                setVendorInitialCategory(cat.key);
                                setShowVendorDialog(true);
                              }}
                            >
                              {getCategoryIcon(cat.key, cat.label)}
                              <span>{cat.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 2. Filter Chips Track & Status Summary Strip */}
                      <div className="vendors-filter-summary-row">
                        <div className="vendors-filter-chips-track">
                          <button
                            type="button"
                            className={`vendor-filter-chip ${vendorCategoryFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setVendorCategoryFilter('all')}
                          >
                            <span>All</span>
                            <span className="vendor-chip-badge">{allVendors.length}</span>
                          </button>
                          {allCategoryKeys.map((key) => {
                            const catBudget = budgetCats.find((c) => c.key === key);
                            const count = allVendors.filter((v) => v.categoryKey === key).length;
                            const label = catBudget?.label || key;
                            if (count === 0 && (!catBudget || catBudget.allocatedPaise === 0))
                              return null;
                            return (
                              <button
                                key={key}
                                type="button"
                                className={`vendor-filter-chip ${vendorCategoryFilter === key ? 'active' : ''}`}
                                onClick={() => setVendorCategoryFilter(key)}
                              >
                                <span>{label}</span>
                                <span className="vendor-chip-badge">{count}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="vendors-status-summary-strip">
                          <span className="vendor-status-summary-item">
                            <span className="vendor-status-dot booked" />
                            <span>{bookedCount} booked</span>
                          </span>
                          <span className="vendor-status-divider">·</span>
                          <span className="vendor-status-summary-item">
                            <span className="vendor-status-dot shortlisted" />
                            <span>{shortlistedCount} shortlisted</span>
                          </span>
                          {droppedCount > 0 && (
                            <>
                              <span className="vendor-status-divider">·</span>
                              <span className="vendor-status-summary-item">
                                <span className="vendor-status-dot dropped" />
                                <span>{droppedCount} dropped</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 3. Category Stack of Cards */}
                      <div className="vendor-categories-stack">
                        {displayedCategoryKeys.map((catKey) => {
                          const catBudget = budgetCats.find((c) => c.key === catKey);
                          const catLabel = catBudget?.label || catKey;
                          const catVendors = allVendors.filter((v) => v.categoryKey === catKey);
                          const hasBooked = catVendors.some((v) => v.status === 'booked');

                          // Quotes for this category normalized and compared
                          const rawCatQuotes = allQuotes.filter((q) =>
                            catVendors.some((v) => v.id === q.vendorId || v.name === q.vendorId),
                          );
                          const normalizedCatQuotes = normalizeAndCompareQuotes(
                            rawCatQuotes,
                            guestCount,
                          );
                          const cheapestQuote = normalizedCatQuotes.find((q) => q.isCheapest);

                          return (
                            <div key={catKey} className="vendor-category-card">
                              {/* Card Header */}
                              <div className="vendor-category-card-header">
                                <div className="vendor-category-header-info">
                                  <div className="vendor-category-icon-box">
                                    {getCategoryIcon(catKey, catLabel)}
                                  </div>
                                  <div className="vendor-category-titles">
                                    <div className="vendor-category-name-row">
                                      <h3 className="vendor-category-name">{catLabel}</h3>
                                      <span className="vendor-category-count-pill">
                                        ({catVendors.length})
                                      </span>
                                    </div>
                                    <span className="vendor-category-target-budget">
                                      Target budget:{' '}
                                      <strong>{formatPaise(catBudget?.allocatedPaise || 0)}</strong>
                                      {guestCount > 0 ? ` for ${guestCount} expected guests` : ''}
                                    </span>
                                  </div>
                                </div>

                                <div className="vendor-category-header-actions">
                                  {hasBooked ? (
                                    <span className="vendor-contract-executed-badge">
                                      <CheckCircle size={14} />
                                      <span>Contract executed</span>
                                    </span>
                                  ) : (
                                    rawCatQuotes.length >= 2 && (
                                      <button
                                        type="button"
                                        className="vendor-compare-quotes-btn"
                                        onClick={() => setCompareQuotesCategoryKey(catKey)}
                                        title="Compare quotes side-by-side"
                                      >
                                        <Scale size={14} />
                                        <span>Compare quotes</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>

                              {/* Card Body */}
                              {catVendors.length === 0 ? (
                                <div className="vendor-category-empty-row">
                                  <div className="vendor-category-empty-left">
                                    <Info size={16} />
                                    <span>
                                      No {catLabel.toLowerCase()} vendors added yet.
                                      {catBudget && catBudget.allocatedPaise > 0 && (
                                        <>
                                          {' '}
                                          You have{' '}
                                          <strong>
                                            {formatPaise(catBudget.allocatedPaise)}
                                          </strong>{' '}
                                          allocated in Budget.
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="vendor-category-empty-add-btn"
                                    onClick={() => {
                                      setVendorInitialCategory(catKey);
                                      setShowVendorDialog(true);
                                    }}
                                  >
                                    <Plus size={14} />
                                    <span>Add {catLabel.toLowerCase()} vendor</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="vendor-rows-list">
                                  {catVendors.map((vendor) => {
                                    const vendorQuotes = allQuotes.filter(
                                      (q) => q.vendorId === vendor.id || q.vendorId === vendor.name,
                                    );
                                    const normalizedVendorQuotes = normalizeAndCompareQuotes(
                                      vendorQuotes,
                                      guestCount,
                                    );
                                    const primaryQuote =
                                      normalizedVendorQuotes.find((q) => q.isCheapest) ||
                                      normalizedVendorQuotes[0];

                                    const isLowestQuote =
                                      cheapestQuote &&
                                      primaryQuote &&
                                      rawCatQuotes.length >= 2 &&
                                      (cheapestQuote.vendorId === vendor.id ||
                                        cheapestQuote.vendorId === vendor.name);

                                    const isMenuOpen = vendorActionMenuId === vendor.id;

                                    return (
                                      <div key={vendor.id} className="vendor-item-row">
                                        {/* Info Column */}
                                        <div className="vendor-item-info-col">
                                          <div className="vendor-item-title-line">
                                            <span className="vendor-item-name">{vendor.name}</span>
                                            <span className={`vendor-status-pill ${vendor.status}`}>
                                              {vendor.status}
                                            </span>
                                            {isLowestQuote && (
                                              <span className="vendor-lowest-quote-badge">
                                                <PiggyBank size={12} />
                                                <span>Lowest quote</span>
                                              </span>
                                            )}
                                          </div>

                                          {vendor.notes && (
                                            <span className="vendor-item-notes">
                                              {vendor.notes}
                                            </span>
                                          )}

                                          {(vendor.phone || vendor.email) && (
                                            <div className="vendor-item-contact-chips">
                                              {vendor.phone && (
                                                <a
                                                  href={`tel:${vendor.phone}`}
                                                  className="vendor-contact-link"
                                                  title="Call vendor"
                                                >
                                                  <Phone size={12} />
                                                  <span>{vendor.phone}</span>
                                                </a>
                                              )}
                                              {vendor.email && (
                                                <a
                                                  href={`mailto:${vendor.email}`}
                                                  className="vendor-contact-link"
                                                  title="Email vendor"
                                                >
                                                  <Mail size={12} />
                                                  <span>{vendor.email}</span>
                                                </a>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {/* Quotes & Actions Column */}
                                        <div className="vendor-item-quote-col">
                                          {primaryQuote ? (
                                            <div className="vendor-quote-details-box">
                                              <span className="vendor-quote-total-text">
                                                {formatPaise(primaryQuote.totalCalculatedPaise)}
                                              </span>
                                              <span className="vendor-quote-subtext">
                                                {primaryQuote.unit === 'per_plate' ||
                                                primaryQuote.unit === 'per_guest'
                                                  ? `${formatPaise(primaryQuote.rawAmountPaise)}/guest · ${guestCount} guests`
                                                  : 'Fixed quote total'}
                                              </span>
                                              <span className="vendor-quote-count-pill">
                                                {vendorQuotes.length} quote
                                                {vendorQuotes.length > 1 ? 's' : ''} logged
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="vendor-quote-details-box">
                                              <span className="vendor-quote-subtext">
                                                No quote added yet
                                              </span>
                                            </div>
                                          )}

                                          <div className="vendor-item-actions">
                                            <button
                                              type="button"
                                              className="vendor-view-details-btn"
                                              onClick={() => setSelectedVendorForDrawer(vendor)}
                                            >
                                              <span>View quotes &amp; details</span>
                                            </button>

                                            <button
                                              type="button"
                                              className="vendor-kebab-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setVendorActionMenuId(
                                                  isMenuOpen ? null : vendor.id,
                                                );
                                              }}
                                              aria-label="Vendor actions"
                                            >
                                              <MoreVertical size={16} />
                                            </button>

                                            {isMenuOpen && (
                                              <div
                                                className="vendor-kebab-menu"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <button
                                                  type="button"
                                                  className="vendor-kebab-menu-item"
                                                  onClick={() => {
                                                    setQuoteInitialVendorId(vendor.id);
                                                    setShowQuoteDialog(true);
                                                    setVendorActionMenuId(null);
                                                  }}
                                                >
                                                  <Plus size={14} />
                                                  <span>Add quote</span>
                                                </button>

                                                <button
                                                  type="button"
                                                  className="vendor-kebab-menu-item"
                                                  onClick={() => {
                                                    setVendorToEdit(vendor);
                                                    setShowVendorDialog(true);
                                                    setVendorActionMenuId(null);
                                                  }}
                                                >
                                                  <Edit2 size={14} />
                                                  <span>Edit vendor</span>
                                                </button>

                                                {vendor.status !== 'booked' && (
                                                  <button
                                                    type="button"
                                                    className="vendor-kebab-menu-item"
                                                    onClick={() => {
                                                      handleUpdateVendorStatus(vendor.id, 'booked');
                                                      setVendorActionMenuId(null);
                                                    }}
                                                  >
                                                    <CheckCircle size={14} />
                                                    <span>Mark as booked</span>
                                                  </button>
                                                )}

                                                {vendor.status !== 'shortlisted' && (
                                                  <button
                                                    type="button"
                                                    className="vendor-kebab-menu-item"
                                                    onClick={() => {
                                                      handleUpdateVendorStatus(
                                                        vendor.id,
                                                        'shortlisted',
                                                      );
                                                      setVendorActionMenuId(null);
                                                    }}
                                                  >
                                                    <Clock size={14} />
                                                    <span>Mark shortlisted</span>
                                                  </button>
                                                )}

                                                {vendor.status !== 'dropped' && (
                                                  <button
                                                    type="button"
                                                    className="vendor-kebab-menu-item"
                                                    onClick={() => {
                                                      handleUpdateVendorStatus(
                                                        vendor.id,
                                                        'dropped',
                                                      );
                                                      setVendorActionMenuId(null);
                                                    }}
                                                  >
                                                    <X size={14} />
                                                    <span>Mark as dropped</span>
                                                  </button>
                                                )}

                                                <button
                                                  type="button"
                                                  className="vendor-kebab-menu-item danger"
                                                  onClick={() => {
                                                    handleDeleteVendor(vendor.id);
                                                    setVendorActionMenuId(null);
                                                  }}
                                                >
                                                  <Trash2 size={14} />
                                                  <span>Delete vendor</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

          {/* TAB: GUESTS */}
          {activeTab === 'guests' && (
            <GuestsTab
              plan={plan}
              onSavePlan={persistPlan}
              onNavigateTab={(tab) => setTab(tab)}
              onShowToast={showToast}
            />
          )}

          {/* TAB: SCHEDULE */}
          {activeTab === 'schedule' && (
            <ScheduleTab
              plan={plan}
              onSavePlan={persistPlan}
              onShowToast={showToast}
              onOpenAddFunction={() => setFunctionDialog({ open: true, fn: null })}
              onOpenEditFunction={(fn) => setFunctionDialog({ open: true, fn })}
            />
          )}

          {/* TAB: IDEAS */}
          {activeTab === 'ideas' && (
            <IdeasTab
              plan={plan}
              onSavePlan={persistPlan}
              onNavigateTab={(tab) => setTab(tab)}
              onShowToast={showToast}
            />
          )}

          {/* TAB: AI PLAN */}
          {(activeTab === 'plan' || activeTab === 'ai-plan') && (
            <Suspense
              fallback={
                <div className="route-loading" role="status">
                  Loading…
                </div>
              }
            >
              <AiPlanTab plan={plan} onSavePlan={persistPlan} onShowToast={showToast} />
            </Suspense>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <SettingsTab
              plan={plan}
              snapshots={snapshots}
              onSavePlan={persistPlan}
              onRestoreSnapshot={handleRestoreSnapshot}
              onDeletePlan={handleDeleteCelebration}
              showToast={showToast}
              onRequestTabChange={setTab}
            />
          )}
        </div>
      </PlannerWorkspaceShell>

      {/* MODALS */}
      {showExpenseDialog && (
        <AddExpenseDialog
          isOpen={true}
          categories={plan.budgetCategories}
          onAdd={handleAddExpense}
          onCancel={() => setShowExpenseDialog(false)}
        />
      )}

      {showAddCategoryDialog && (
        <AddCategoryDialog
          isOpen={true}
          onAdd={handleAddCategory}
          onCancel={() => setShowAddCategoryDialog(false)}
        />
      )}

      {(showTaskDialog || editingTask) && (
        <AddTaskDialog
          key={editingTask?.id ?? 'new-task'}
          isOpen={true}
          eventDate={plan.event.eventDate || new Date().toISOString().split('T')[0]}
          categories={plan.budgetCategories}
          existingTasks={plan.tasks}
          initialTask={editingTask}
          onAdd={handleAddTask}
          onCancel={() => {
            setShowTaskDialog(false);
            setEditingTask(null);
          }}
        />
      )}

      {functionDialog.open && (
        <FunctionFormDialog
          isOpen={true}
          initialData={functionDialog.fn}
          defaultDate={plan.event.eventDate || new Date().toISOString().split('T')[0]}
          onSave={handleSaveFunction}
          onCancel={() => setFunctionDialog({ open: false, fn: null })}
        />
      )}

      {showVendorDialog && (
        <AddVendorDialog
          isOpen={true}
          categories={plan.budgetCategories}
          vendorToEdit={vendorToEdit}
          initialCategoryKey={vendorInitialCategory}
          onSave={handleSaveVendor}
          onCancel={() => {
            setShowVendorDialog(false);
            setVendorToEdit(null);
            setVendorInitialCategory(undefined);
          }}
        />
      )}

      {showQuoteDialog && (
        <AddQuoteDialog
          isOpen={true}
          vendors={plan.vendors}
          initialVendorId={quoteInitialVendorId}
          onSave={handleSaveQuote}
          onCancel={() => {
            setShowQuoteDialog(false);
            setQuoteInitialVendorId(undefined);
          }}
        />
      )}

      {selectedVendorForDrawer &&
        (() => {
          const categoryBudget = plan.budgetCategories.find(
            (c) => c.key === selectedVendorForDrawer.categoryKey,
          );
          return (
            <VendorDetailsDrawer
              isOpen={true}
              vendor={selectedVendorForDrawer}
              categoryLabel={categoryBudget?.label || selectedVendorForDrawer.categoryKey}
              quotes={plan.quotes.filter(
                (q) =>
                  q.vendorId === selectedVendorForDrawer.id ||
                  q.vendorId === selectedVendorForDrawer.name,
              )}
              guestCount={plan.event.guestEstimate || plan.guests?.total || 0}
              onClose={() => setSelectedVendorForDrawer(null)}
              onAddQuote={(vendorId) => {
                setQuoteInitialVendorId(vendorId);
                setShowQuoteDialog(true);
              }}
              onDeleteQuote={handleDeleteQuote}
              onUpdateStatus={(vendorId, status) => handleUpdateVendorStatus(vendorId, status)}
              onDeleteVendor={(vendorId) => {
                handleDeleteVendor(vendorId);
                setSelectedVendorForDrawer(null);
              }}
            />
          );
        })()}

      {compareQuotesCategoryKey &&
        (() => {
          const categoryBudget = plan.budgetCategories.find(
            (c) => c.key === compareQuotesCategoryKey,
          );
          const categoryVendors = plan.vendors.filter(
            (v) => v.categoryKey === compareQuotesCategoryKey,
          );
          const rawCategoryQuotes = plan.quotes.filter((q) =>
            categoryVendors.some((v) => v.id === q.vendorId || v.name === q.vendorId),
          );
          const normalizedCategoryQuotes = normalizeAndCompareQuotes(
            rawCategoryQuotes,
            plan.event.guestEstimate || plan.guests?.total || 0,
          );
          return (
            <CompareQuotesModal
              isOpen={true}
              categoryLabel={categoryBudget?.label || compareQuotesCategoryKey}
              guestCount={plan.event.guestEstimate || plan.guests?.total || 0}
              vendors={categoryVendors}
              quotes={normalizedCategoryQuotes}
              onClose={() => setCompareQuotesCategoryKey(null)}
              onChooseVendor={(vendorId) => {
                handleUpdateVendorStatus(vendorId, 'booked');
                setCompareQuotesCategoryKey(null);
              }}
              onAddQuote={() => {
                const firstVendor = categoryVendors[0];
                setQuoteInitialVendorId(firstVendor?.id);
                setShowQuoteDialog(true);
              }}
            />
          );
        })()}
    </div>
  );
};
