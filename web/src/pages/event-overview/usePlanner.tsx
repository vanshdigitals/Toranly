/**
 * State, autosave and every edit handler of the event planner page, kept out of the
 * tab components so each tab only renders.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getPlan, savePlan, deletePlan, getSnapshots, restoreSnapshot } from '../../storage/db';
import { exportPlanBackup, downloadBackupFile } from '../../storage/backup';
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
} from '../../domain/plan';
import { usePlanSummary } from '../../lib/usePlanSummary';
import { LIVE_CHECK_UNAVAILABLE } from '../../api/plan';
import { isTaskOverdue, checkTaskCompletionGate } from '../../domain/timeline';
import { checkDietaryCoverage } from '../../domain/guests';
import { generateBudgetCsv, generateTasksCsv, downloadCsv } from '../../domain/export';
import { calculateDaysRemaining } from '../../lib/eventState';
import type { SaveState } from '../../lib/saveState';

export function usePlanner() {
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
  const {
    metrics: budgetMetrics,
    source: summarySource,
    summary: serverSummary,
  } = usePlanSummary(plan);
  // Decisions made by the backend from the whole plan (POST /plan/summary).
  const nextActions = serverSummary?.nextActions ?? [];
  const urgencyByTask = new Map((serverSummary?.taskUrgency ?? []).map((u) => [u.taskId, u]));
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

  return {
    activeTab,
    setActiveTab,
    plan,
    setPlan,
    loading,
    setLoading,
    saveStatus,
    setSaveStatus,
    lastSavedAt,
    setLastSavedAt,
    snapshots,
    setSnapshots,
    showExpenseDialog,
    setShowExpenseDialog,
    showAddCategoryDialog,
    setShowAddCategoryDialog,
    showTaskDialog,
    setShowTaskDialog,
    editingTask,
    setEditingTask,
    pendingDeleteTaskId,
    setPendingDeleteTaskId,
    functionDialog,
    setFunctionDialog,
    showVendorDialog,
    setShowVendorDialog,
    vendorToEdit,
    setVendorToEdit,
    vendorInitialCategory,
    setVendorInitialCategory,
    showQuoteDialog,
    setShowQuoteDialog,
    quoteInitialVendorId,
    setQuoteInitialVendorId,
    toastMessage,
    setToastMessage,
    taskFilter,
    setTaskFilter,
    budgetSubTab,
    setBudgetSubTab,
    starterPlanDismissed,
    setStarterPlanDismissed,
    activeCategoryMenuId,
    setActiveCategoryMenuId,
    editingCategoryAllocId,
    setEditingCategoryAllocId,
    editCategoryAllocValue,
    setEditCategoryAllocValue,
    editingCategoryNameId,
    setEditingCategoryNameId,
    editCategoryNameValue,
    setEditCategoryNameValue,
    expenseSearchQuery,
    setExpenseSearchQuery,
    expenseCategoryFilter,
    setExpenseCategoryFilter,
    dismissedOverrunBanner,
    setDismissedOverrunBanner,
    vendorCategoryFilter,
    setVendorCategoryFilter,
    selectedVendorForDrawer,
    setSelectedVendorForDrawer,
    compareQuotesCategoryKey,
    setCompareQuotesCategoryKey,
    vendorActionMenuId,
    setVendorActionMenuId,
    eventId,
    activeTabParam,
    budgetMetrics,
    summarySource,
    nextActions,
    urgencyByTask,
    navigate,
    setTab,
    showToast,
    loadPlanData,
    liveCheckNote,
    location,
    handoffNotice,
    persistPlan,
    handleToggleTask,
    handleAddTask,
    handleDeleteTask,
    handleSaveFunction,
    handleAddExpense,
    handleDeleteExpense,
    handleAddCategory,
    handleStartRenameCategory,
    handleSaveRenameCategory,
    handleStartEditAlloc,
    handleSaveEditAlloc,
    handleMoveCategory,
    handleDeleteCategory,
    handleSaveVendor,
    handleDeleteVendor,
    handleUpdateVendorStatus,
    handleSaveQuote,
    handleDeleteQuote,
    handleRestoreSnapshot,
    handleDownloadBackup,
    handleDeleteCelebration,
    handleDownloadBudgetCsv,
    handleDownloadTasksCsv,
  };
}

/** Derived figures for a loaded plan (computed once per render of the page). */
export function derivePlanView(plan: Plan) {
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

  return { daysRemaining, completedTasks, openTasks, overdueTasks, dietBreakdown, dietCoverage };
}

export type Planner = Omit<ReturnType<typeof usePlanner>, 'plan'> &
  ReturnType<typeof derivePlanView> & { plan: Plan };
