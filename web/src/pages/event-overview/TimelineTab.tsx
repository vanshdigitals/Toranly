/** The timeline tab of the event planner. */
import { Calendar, Flag, Trash2, Plus, FileSpreadsheet, Clock, Edit2, Check } from 'lucide-react';
import { isTaskOverdue, checkTaskCompletionGate } from '../../domain/timeline';
import { formatDisplayDate } from '../../lib/dateFormat';
import type { Planner } from './usePlanner';

export function TimelineTab({ planner }: { planner: Planner }) {
  const {
    plan,
    setShowTaskDialog,
    setEditingTask,
    pendingDeleteTaskId,
    setPendingDeleteTaskId,
    taskFilter,
    setTaskFilter,
    handleToggleTask,
    handleDeleteTask,
    handleDownloadTasksCsv,
    daysRemaining,
    completedTasks,
    openTasks,
  } = planner;

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
            {plan.event.eventDate ? formatDisplayDate(plan.event.eventDate) : 'celebration date'}.
            Milestones and dependency gates.
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
          <button type="button" className="tab-primary-btn" onClick={() => setShowTaskDialog(true)}>
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
            const shownDeps = isBlocked ? gate.blockingTasks.map((t) => t.title) : depTitles;
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
                    {task.source === 'ai' && <span className="ai-source-badge">AI idea</span>}
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
                  {isOver && <span className="tl-badge tl-badge--overdue">Overdue</span>}
                  <span className="tl-due">
                    {task.dueDate ? formatDisplayDate(task.dueDate) : 'No due date'}
                  </span>
                  {confirmingDelete ? (
                    <span className="tl-confirm" role="group" aria-label={`Delete ${task.title}?`}>
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
}
