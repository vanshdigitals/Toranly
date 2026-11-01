import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, AlertCircle, ArrowRight, X } from 'lucide-react';
import type { Plan, TaskItem } from '../domain/plan';
import { previewDateChange, type DateChangePreviewResult } from '../domain/timeline';
import {
  fetchDatePreview,
  LIVE_CHECK_UNAVAILABLE,
  type ApiPlan,
  type DatePreviewResponse,
} from '../api/plan';
import { Button } from './Button';
import './DateChangeDialog.css';

interface DateChangeDialogProps {
  isOpen: boolean;
  currentDate: string;
  plan: Plan;
  onConfirm: (newDate: string, updatedTasks: TaskItem[]) => void;
  onCancel: () => void;
}

export const DateChangeDialog: React.FC<DateChangeDialogProps> = ({
  isOpen,
  currentDate,
  plan,
  onConfirm,
  onCancel,
}) => {
  const [selectedDate, setSelectedDate] = useState(currentDate);

  const tasks = plan.tasks;
  // Instant preview from the device while the backend (the source of truth) answers.
  const localPreview = useMemo(() => {
    if (!selectedDate || selectedDate === currentDate) return null;
    return previewDateChange(tasks, currentDate, selectedDate);
  }, [tasks, currentDate, selectedDate]);

  const [server, setServer] = useState<{
    date: string;
    preview: DateChangePreviewResult | null;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !selectedDate || selectedDate === currentDate) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchDatePreview(
        { plan: plan as ApiPlan, newDate: selectedDate, shiftFixedTasks: false },
        controller.signal,
      )
        .then((res) => setServer({ date: selectedDate, preview: fromServer(res) }))
        .catch(() => {
          if (!controller.signal.aborted) setServer({ date: selectedDate, preview: null });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, plan, currentDate, selectedDate]);

  const serverAnswered = server?.date === selectedDate;
  const preview = serverAnswered && server.preview ? server.preview : localPreview;
  const liveCheckFailed = Boolean(localPreview) && serverAnswered && !server.preview;

  if (!isOpen) return null;

  const handleApply = () => {
    if (!preview || !selectedDate) return;

    // Apply new due dates to tasks
    const shiftedMap = new Map(preview.relativeTasksShifted.map((t) => [t.id, t.newDueDate]));
    const updatedTasks: TaskItem[] = tasks.map((t) => {
      if (shiftedMap.has(t.id)) {
        return {
          ...t,
          dueDate: shiftedMap.get(t.id)!,
        };
      }
      return t;
    });

    onConfirm(selectedDate, updatedTasks);
  };

  return (
    <div className="date-change-overlay" role="presentation">
      <div
        className="date-change-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="date-change-title"
      >
        <div className="date-change-header">
          <div className="date-change-icon-badge">
            <Calendar size={22} className="date-change-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="date-change-close"
            onClick={onCancel}
            aria-label="Cancel date change"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="date-change-content">
          <h2 id="date-change-title" className="date-change-title">
            Change celebration date
          </h2>
          <p className="date-change-intro">
            Moving your event date updates all timeline tasks that are scheduled relative to your
            event.
          </p>

          <div className="date-change-picker-row">
            <label htmlFor="new-event-date-input" className="date-picker-label">
              New celebration date:
            </label>
            <input
              id="new-event-date-input"
              type="date"
              className="date-picker-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {liveCheckFailed && (
            <p className="date-change-live-note" role="status">
              {LIVE_CHECK_UNAVAILABLE}
            </p>
          )}

          {preview && (
            <div className="date-preview-summary">
              <div className="preview-stat-card">
                <span className="preview-stat-value">
                  {preview.deltaDays > 0 ? `+${preview.deltaDays}` : preview.deltaDays} days
                </span>
                <span className="preview-stat-label">Date Shift</span>
              </div>
              <div className="preview-stat-card">
                <span className="preview-stat-value">{preview.relativeTasksShifted.length}</span>
                <span className="preview-stat-label">Tasks Shifted</span>
              </div>
              {preview.overdueCount > 0 && (
                <div className="preview-stat-card warning">
                  <span className="preview-stat-value warning">{preview.overdueCount}</span>
                  <span className="preview-stat-label">Become Overdue</span>
                </div>
              )}
            </div>
          )}

          {preview && preview.overdueCount > 0 && (
            <div className="date-change-warning-box">
              <AlertCircle size={16} className="warning-box-icon" aria-hidden="true" />
              <p className="warning-box-text">
                Moving to this earlier date will make {preview.overdueCount} task(s) overdue today.
              </p>
            </div>
          )}

          {preview && preview.relativeTasksShifted.length > 0 && (
            <div className="date-preview-list-wrapper">
              <h4 className="preview-list-heading">Task schedule preview</h4>
              <ul className="date-preview-list">
                {preview.relativeTasksShifted.slice(0, 6).map((t) => (
                  <li
                    key={t.id}
                    className={`date-preview-item ${t.becomesOverdue ? 'overdue' : ''}`}
                  >
                    <span className="preview-task-title">{t.title}</span>
                    <span className="preview-task-shift">
                      <span className="old-date">{t.oldDueDate}</span>
                      <ArrowRight size={13} aria-hidden="true" />
                      <span className="new-date">{t.newDueDate}</span>
                    </span>
                  </li>
                ))}
                {preview.relativeTasksShifted.length > 6 && (
                  <li className="preview-more-item">
                    + {preview.relativeTasksShifted.length - 6} more tasks will be updated
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="date-change-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={
              !preview || selectedDate === currentDate || (!serverAnswered && !!localPreview)
            }
          >
            Confirm date change
          </Button>
        </div>
      </div>
    </div>
  );
};

function fromServer(res: DatePreviewResponse): DateChangePreviewResult {
  return {
    oldEventDate: res.oldDate,
    newEventDate: res.newDate,
    deltaDays: res.deltaDays,
    relativeTasksShifted: res.shifted.map((t) => ({
      id: t.id,
      title: t.title,
      oldDueDate: t.oldDue,
      newDueDate: t.newDue,
      offsetDays: t.offsetDays ?? undefined,
      becomesOverdue: t.becomesOverdue,
    })),
    fixedTasksUnchanged: res.unchanged.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate ?? undefined,
    })),
    overdueCount: res.nowOverdue.length,
  };
}
