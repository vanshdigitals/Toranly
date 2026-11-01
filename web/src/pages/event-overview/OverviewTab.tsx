/** The overview tab of the event planner. */
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
  Clock,
} from 'lucide-react';
import { formatPaise } from '../../domain/money';
import { isTaskOverdue } from '../../domain/timeline';
import { formatDisplayDate } from '../../lib/dateFormat';
import type { Planner } from './usePlanner';
import { NextActionsPanel } from './NextActionsPanel';

export function OverviewTab({ planner }: { planner: Planner }) {
  const {
    plan,
    starterPlanDismissed,
    setStarterPlanDismissed,
    budgetMetrics,
    setTab,
    nextActions,
    summarySource,
    liveCheckNote,
    handleToggleTask,
    handleDownloadBackup,
    daysRemaining,
    completedTasks,
    dietBreakdown,
    dietCoverage,
  } = planner;

  return (
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

      <NextActionsPanel actions={nextActions} source={summarySource} onOpenTab={setTab} />

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
                Your starter budget categories and checklist are saved in this browser. No account
                needed. Download a backup to keep a copy.
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
            <button type="button" className="overview-banner-ai-btn" onClick={handleDownloadBackup}>
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
            <button type="button" className="overview-action-link" onClick={() => setTab('budget')}>
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
              <span className={`overview-budget-status-pill status-${budgetMetrics.overallStatus}`}>
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
            <button type="button" className="overview-action-link" onClick={() => setTab('guests')}>
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
                <span className="overview-guests-hero-value">{plan.event.guestEstimate}</span>
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
                    <p className="overview-vendors-empty-text">No vendors shortlisted yet.</p>
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
  );
}
