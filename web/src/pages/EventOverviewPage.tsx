import { lazy, Suspense } from 'react';
import { CheckCircle } from 'lucide-react';
import { ToranlyLogomark } from '../components/ToranlyLogomark';
import { normalizeAndCompareQuotes } from '../domain/quotes';
import { InMemoryBanner } from '../components/InMemoryBanner';
import { AddExpenseDialog } from '../components/AddExpenseDialog';
import { AddCategoryDialog } from '../components/AddCategoryDialog';
import { AddTaskDialog } from '../components/AddTaskDialog';
import { FunctionFormDialog } from '../components/FunctionFormDialog';
import { AddVendorDialog } from '../components/AddVendorDialog';
import { AddQuoteDialog } from '../components/AddQuoteDialog';
import { VendorDetailsDrawer } from '../components/VendorDetailsDrawer';
import { CompareQuotesModal } from '../components/CompareQuotesModal';
import { PlannerWorkspaceShell } from '../components/PlannerWorkspaceShell';
import './EventOverviewPage.css';
import './TimelineScheduleGuests.css';
import { derivePlanView, usePlanner } from './event-overview/usePlanner';
import { OverviewTab } from './event-overview/OverviewTab';
import { BudgetTab } from './event-overview/BudgetTab';
import { TimelineTab } from './event-overview/TimelineTab';
import { VendorsTab } from './event-overview/VendorsTab';

// Tabs outside the core four load on demand (only visitors who open them download them).
const SettingsTab = lazy(() =>
  import('../components/SettingsTab').then((m) => ({ default: m.SettingsTab })),
);
const IdeasTab = lazy(() =>
  import('../components/IdeasTab').then((m) => ({ default: m.IdeasTab })),
);
const ScheduleTab = lazy(() =>
  import('../components/ScheduleTab').then((m) => ({ default: m.ScheduleTab })),
);
const GuestsTab = lazy(() =>
  import('../components/GuestsTab').then((m) => ({ default: m.GuestsTab })),
);
const AiPlanTab = lazy(() =>
  import('../components/AiPlanTab').then((m) => ({ default: m.AiPlanTab })),
);

export const EventOverviewPage: React.FC = () => {
  const state = usePlanner();
  const {
    activeTab,
    loading,
    saveStatus,
    lastSavedAt,
    snapshots,
    showExpenseDialog,
    setShowExpenseDialog,
    showAddCategoryDialog,
    setShowAddCategoryDialog,
    showTaskDialog,
    setShowTaskDialog,
    editingTask,
    setEditingTask,
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
    selectedVendorForDrawer,
    setSelectedVendorForDrawer,
    compareQuotesCategoryKey,
    setCompareQuotesCategoryKey,
    setTab,
    showToast,
    persistPlan,
    handleAddTask,
    handleSaveFunction,
    handleAddExpense,
    handleAddCategory,
    handleSaveVendor,
    handleDeleteVendor,
    handleUpdateVendorStatus,
    handleSaveQuote,
    handleDeleteQuote,
    handleRestoreSnapshot,
    handleDownloadBackup,
    handleDeleteCelebration,
    plan,
  } = state;

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
  const view = derivePlanView(plan);
  const planner = { ...state, ...view, plan };
  const { overdueTasks } = view;

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
          <Suspense
            fallback={
              <div className="route-loading" role="status">
                Loading…
              </div>
            }
          >
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && <OverviewTab planner={planner} />}

            {/* TAB: BUDGET */}
            {activeTab === 'budget' && <BudgetTab planner={planner} />}

            {/* TAB: TIMELINE */}
            {activeTab === 'timeline' && <TimelineTab planner={planner} />}

            {/* TAB: VENDORS */}
            {activeTab === 'vendors' && <VendorsTab planner={planner} />}

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
              <AiPlanTab plan={plan} onSavePlan={persistPlan} onShowToast={showToast} />
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
          </Suspense>
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
