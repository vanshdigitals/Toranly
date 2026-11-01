/** The budget tab of the event planner. */
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Plus,
  FileSpreadsheet,
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
} from 'lucide-react';
import { formatPaise } from '../../domain/money';
import { Select } from '../../components/Select';
import { getCategoryIcon } from './helpers';
import type { Planner } from './usePlanner';

export function BudgetTab({ planner }: { planner: Planner }) {
  const {
    plan,
    setShowExpenseDialog,
    setShowAddCategoryDialog,
    budgetSubTab,
    setBudgetSubTab,
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
    budgetMetrics,
    liveCheckNote,
    handleDeleteExpense,
    handleStartRenameCategory,
    handleSaveRenameCategory,
    handleStartEditAlloc,
    handleSaveEditAlloc,
    handleMoveCategory,
    handleDeleteCategory,
    handleDownloadBudgetCsv,
  } = planner;

  const celebrationLimit = plan.event.budgetTotalPaise || budgetMetrics.totalAllocatedPaise;
  const isOverrun =
    plan.event.budgetTotalPaise != null &&
    plan.event.budgetTotalPaise > 0 &&
    budgetMetrics.totalAllocatedPaise > plan.event.budgetTotalPaise;
  const overrunAmountPaise = isOverrun
    ? budgetMetrics.totalAllocatedPaise - plan.event.budgetTotalPaise!
    : 0;
  const unallocatedPaise = Math.max(0, celebrationLimit - budgetMetrics.totalAllocatedPaise);

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
        plan.budgetCategories.find((c) => c.id === expenseCategoryFilter)?.key === e.categoryId;
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
                Allocations exceed celebration limit by {formatPaise(overrunAmountPaise)}
              </strong>
              <p className="budget-alert-text">
                Total assigned {formatPaise(budgetMetrics.totalAllocatedPaise)} across{' '}
                {plan.budgetCategories.length} categories against your planned{' '}
                {formatPaise(plan.event.budgetTotalPaise!)} target limit. Review allocations to
                rebalance.
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
            <span className="tile-value">{formatPaise(budgetMetrics.totalAllocatedPaise)}</span>
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
            <span className="tile-value">{formatPaise(budgetMetrics.totalCommittedPaise)}</span>
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
              <strong className="indicator-value">{formatPaise(unallocatedPaise)}</strong>
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
              <strong className="legend-val">{formatPaise(budgetMetrics.totalPaidPaise)}</strong>
              <span className="legend-pct">({paidPercent}%)</span>
            </div>
            <div className="legend-cell">
              <span className="legend-dot dot-committed" />
              <span className="legend-tag">Committed (Unpaid):</span>
              <strong className="legend-val">{formatPaise(committedUnpaidPaise)}</strong>
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
              <span className="table-bar-count">{plan.budgetCategories.length} categories</span>
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
                  const catObj = plan.budgetCategories.find((b) => b.id === c.categoryId);
                  const categoryExpenses = plan.expenses.filter(
                    (e) => e.categoryId === c.categoryId || (catObj && e.categoryId === catObj.key),
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
                                onChange={(e) => setEditCategoryNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRenameCategory(c.categoryId);
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
                      </td>

                      {/* Allocated column (Inline editable) */}
                      <td className="td-allocated">
                        {isEditingAlloc ? (
                          <div className="alloc-inline-edit" onClick={(e) => e.stopPropagation()}>
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
                                onChange={(e) => setEditCategoryAllocValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditAlloc(c.categoryId);
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
                            <span className="num-val">{formatPaise(c.allocatedPaise)}</span>
                            <Edit2 size={12} className="alloc-edit-hint" aria-hidden="true" />
                          </button>
                        )}
                      </td>

                      {/* Committed */}
                      <td className="td-committed">
                        <span className="num-val">{formatPaise(c.committedPaise)}</span>
                      </td>

                      {/* Paid */}
                      <td className="td-paid">
                        <span className={`num-val ${c.paidPaise > 0 ? 'num-paid' : 'num-muted'}`}>
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
                            <span>Over by {formatPaise(c.committedPaise - c.allocatedPaise)}</span>
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
                                activeCategoryMenuId === c.categoryId ? null : c.categoryId,
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
                                      {categoryExpenses.length === 1 ? 'expense' : 'expenses'}
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
                    <span className={`cat-status-badge badge-${budgetMetrics.overallStatus}`}>
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
                (e) => e.categoryId === c.categoryId || (catObj && e.categoryId === catObj.key),
              );
              const hasLinkedExpenses = categoryExpenses.length > 0;
              const isEditingAlloc = editingCategoryAllocId === c.categoryId;
              const isEditingName = editingCategoryNameId === c.categoryId;

              return (
                <div key={`mob-cat-${c.categoryId}`} className="cat-mobile-card">
                  <div className="cat-mobile-header">
                    <div className="category-cell-content">
                      <div className="cat-icon-container">{getCategoryIcon(c.key, c.label)}</div>
                      {isEditingName ? (
                        <div className="cat-name-inline-edit" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            className="cat-name-input"
                            value={editCategoryNameValue}
                            onChange={(e) => setEditCategoryNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRenameCategory(c.categoryId);
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
                          {plan.budgetCategories.find((cat) => cat.id === c.categoryId)?.source ===
                            'ai' && <span className="ai-source-badge">AI idea</span>}
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
                                  {categoryExpenses.length === 1 ? 'expense' : 'expenses'}
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
                        <div className="alloc-inline-edit" onClick={(e) => e.stopPropagation()}>
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
                              onChange={(e) => setEditCategoryAllocValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditAlloc(c.categoryId);
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
                          <span className="num-val">{formatPaise(c.allocatedPaise)}</span>
                          <Edit2 size={12} className="alloc-edit-hint" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div className="cat-metric-box">
                      <span className="cat-metric-label">Committed</span>
                      <span className="cat-metric-val">{formatPaise(c.committedPaise)}</span>
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
                          <span>Over by {formatPaise(c.committedPaise - c.allocatedPaise)}</span>
                        </span>
                      )}
                    </div>
                    <span className="cat-mobile-pct-text">{c.percentCommitted}% committed</span>
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
                    Record planned vendor payments, official quotes, or completed transactions to
                    monitor commitments.
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
                    Try clearing your search query or category filter to view all recorded expenses.
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
                              <strong className="expense-description-text">{e.description}</strong>
                              {e.note && <span className="expense-note-text">{e.note}</span>}
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
                            <strong className="num-val">{formatPaise(e.amountPaise)}</strong>
                          </td>
                          <td className="td-date">
                            <span className="expense-date-text">{e.spentOn || '—'}</span>
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
                      <td className="tfoot-category">Total Filtered ({filteredExpenses.length})</td>
                      <td colSpan={2}></td>
                      <td className="tfoot-num">
                        {formatPaise(
                          filteredExpenses.reduce((sum, item) => sum + item.amountPaise, 0),
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
                          <strong className="expense-description-text">{e.description}</strong>
                          {e.note && <span className="expense-note-text">{e.note}</span>}
                        </div>
                        <strong className="expense-mobile-amount">
                          {formatPaise(e.amountPaise)}
                        </strong>
                      </div>

                      <div className="expense-mobile-meta">
                        <div className="category-cell-content">
                          <div className="cat-icon-container">
                            {getCategoryIcon(cat?.key || e.categoryId, cat?.label || e.categoryId)}
                          </div>
                          <span className="category-label-text">{cat?.label || e.categoryId}</span>
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
                    {formatPaise(filteredExpenses.reduce((sum, item) => sum + item.amountPaise, 0))}
                  </strong>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
