import React, { useState } from 'react';
import { X, CheckSquare, AlertCircle } from 'lucide-react';
import type { BudgetCategory, TaskItem } from '../domain/plan';
import { calculateDueDate, detectTaskCycle } from '../domain/timeline';
import { Button } from './Button';
import { Select } from './Select';
import './AddTaskDialog.css';

interface AddTaskDialogProps {
  isOpen: boolean;
  eventDate: string;
  categories: BudgetCategory[];
  existingTasks: TaskItem[];
  /** When set, the dialog edits this task (same id, status and position) instead of adding one. */
  initialTask?: TaskItem | null;
  onAdd: (task: TaskItem) => void;
  onCancel: () => void;
}

export const AddTaskDialog: React.FC<AddTaskDialogProps> = ({
  isOpen,
  eventDate,
  categories,
  existingTasks,
  initialTask,
  onAdd,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [categoryKey, setCategoryKey] = useState(
    initialTask?.categoryKey || categories[0]?.key || 'general',
  );
  const [dateMode, setDateMode] = useState<'relative' | 'fixed'>(
    initialTask?.dateMode ?? 'relative',
  );
  const [offsetDays, setOffsetDays] = useState(initialTask?.offsetDays ?? 30);
  const [fixedDate, setFixedDate] = useState(
    initialTask?.dueDate || eventDate || new Date().toISOString().split('T')[0],
  );
  const [isMilestone, setIsMilestone] = useState(initialTask?.isMilestone ?? false);
  const [selectedDeps, setSelectedDeps] = useState<string[]>(initialTask?.dependsOn ?? []);
  // A task cannot depend on itself; when editing, the candidate replaces the original.
  const otherTasks = initialTask
    ? existingTasks.filter((t) => t.id !== initialTask.id)
    : existingTasks;
  const [cycleError, setCycleError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleDep = (depId: string) => {
    setCycleError(null);
    const nextDeps = selectedDeps.includes(depId)
      ? selectedDeps.filter((id) => id !== depId)
      : [...selectedDeps, depId];

    // Check Kahn cycle with candidate task
    const tempTaskId = initialTask?.id ?? 'temp-task-id';
    const candidateTasks: TaskItem[] = [
      ...otherTasks,
      {
        id: tempTaskId,
        title: title || 'New Task',
        dependsOn: nextDeps,
        dateMode,
        isMilestone,
        status: 'open',
        source: 'user',
        position: existingTasks.length + 1,
      },
    ];

    const cycleCheck = detectTaskCycle(candidateTasks);
    if (cycleCheck.hasCycle) {
      setCycleError('Selecting this task creates a circular dependency.');
      return;
    }

    setSelectedDeps(nextDeps);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const computedDueDate =
      dateMode === 'relative' ? calculateDueDate(eventDate, offsetDays) : fixedDate;

    const newTask: TaskItem = {
      ...initialTask,
      id:
        initialTask?.id ??
        `task-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      categoryKey,
      offsetDays: dateMode === 'relative' ? offsetDays : undefined,
      dueDate: computedDueDate,
      dateMode,
      isMilestone,
      status: initialTask?.status ?? 'open',
      source: initialTask?.source ?? 'user',
      position: initialTask?.position ?? existingTasks.length + 1,
      dependsOn: selectedDeps,
    };

    onAdd(newTask);
  };

  return (
    <div className="task-modal-overlay" role="presentation">
      <div
        className="task-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-title"
      >
        <div className="task-modal-header">
          <div className="task-icon-badge">
            <CheckSquare size={22} className="task-modal-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="task-modal-close"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-modal-form">
          <h2 id="add-task-title" className="task-modal-title">
            {initialTask ? 'Edit task' : 'Add a task'}
          </h2>

          <div className="task-form-field">
            <label htmlFor="task-title-input" className="task-field-label">
              Task title
            </label>
            <input
              id="task-title-input"
              type="text"
              className="task-text-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Schedule venue tasting, Select invitations"
              maxLength={120}
              required
              autoFocus
            />
          </div>

          <div className="task-form-field">
            <label htmlFor="task-cat-select" className="task-field-label">
              Category
            </label>
            <Select
              id="task-cat-select"
              value={categoryKey}
              onChange={(val) => setCategoryKey(val)}
              options={categories.map((c) => ({ value: c.key, label: c.label }))}
            />
          </div>

          <div className="task-form-field">
            <span className="task-field-label">Due date type</span>
            <div className="task-mode-toggle">
              <button
                type="button"
                className={`task-mode-btn ${dateMode === 'relative' ? 'active' : ''}`}
                onClick={() => setDateMode('relative')}
              >
                Relative to event
              </button>
              <button
                type="button"
                className={`task-mode-btn ${dateMode === 'fixed' ? 'active' : ''}`}
                onClick={() => setDateMode('fixed')}
              >
                Specific date
              </button>
            </div>
          </div>

          {dateMode === 'relative' ? (
            <div className="task-form-field">
              <label htmlFor="task-offset-input" className="task-field-label">
                Days before celebration: {offsetDays} days (Due:{' '}
                {calculateDueDate(eventDate, offsetDays)})
              </label>
              <input
                id="task-offset-input"
                type="number"
                min="0"
                max="365"
                className="task-text-input"
                value={offsetDays}
                onChange={(e) => setOffsetDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </div>
          ) : (
            <div className="task-form-field">
              <label htmlFor="task-fixed-input" className="task-field-label">
                Target date
              </label>
              <input
                id="task-fixed-input"
                type="date"
                className="task-text-input"
                value={fixedDate}
                onChange={(e) => setFixedDate(e.target.value)}
              />
            </div>
          )}

          <div className="task-checkbox-field">
            <label className="task-checkbox-label">
              <input
                type="checkbox"
                checked={isMilestone}
                onChange={(e) => setIsMilestone(e.target.checked)}
              />
              <span>Mark as major milestone</span>
            </label>
          </div>

          {otherTasks.length > 0 && (
            <div className="task-form-field">
              <span className="task-field-label">Dependencies (Waiting on)</span>
              {cycleError && (
                <div className="task-cycle-alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{cycleError}</span>
                </div>
              )}
              <div className="task-deps-list">
                {otherTasks.map((t) => (
                  <label key={t.id} className="task-dep-item">
                    <input
                      type="checkbox"
                      checked={selectedDeps.includes(t.id)}
                      onChange={() => handleToggleDep(t.id)}
                    />
                    <span className="task-dep-title">{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="task-modal-actions">
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!title.trim()}>
              {initialTask ? 'Save task' : 'Add task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
