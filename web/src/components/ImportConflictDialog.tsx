import React from 'react';
import { AlertCircle, Copy, Replace, X } from 'lucide-react';
import type { Plan } from '../domain/plan';
import { Button } from './Button';
import './ImportConflictDialog.css';

interface ImportConflictDialogProps {
  isOpen: boolean;
  incomingPlan: Plan;
  existingPlan: Plan;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export const ImportConflictDialog: React.FC<ImportConflictDialogProps> = ({
  isOpen,
  incomingPlan,
  existingPlan,
  onReplace,
  onKeepBoth,
  onCancel,
}) => {
  if (!isOpen) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Unknown';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="conflict-overlay" role="presentation">
      <div
        className="conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
      >
        <div className="conflict-header">
          <div className="conflict-badge">
            <AlertCircle size={22} className="conflict-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="conflict-close-btn"
            onClick={onCancel}
            aria-label="Cancel import"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="conflict-content">
          <h2 id="conflict-dialog-title" className="conflict-title">
            Plan already exists
          </h2>
          <p className="conflict-intro">
            A celebration with the same plan ID was found in this browser. How would you like to handle this file?
          </p>

          <div className="conflict-comparison">
            <div className="conflict-card existing">
              <span className="conflict-card-tag">Already on this device</span>
              <h3 className="conflict-card-title">{existingPlan.event.title}</h3>
              <p className="conflict-card-meta">
                Last modified: {formatDate(existingPlan.updatedAt)}
              </p>
            </div>

            <div className="conflict-card incoming">
              <span className="conflict-card-tag">From backup file</span>
              <h3 className="conflict-card-title">{incomingPlan.event.title}</h3>
              <p className="conflict-card-meta">
                Exported / modified: {formatDate(incomingPlan.updatedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="conflict-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onKeepBoth} className="conflict-keep-btn">
            <Copy size={16} aria-hidden="true" />
            Keep both (copy)
          </Button>
          <Button variant="primary" onClick={onReplace} className="conflict-replace-btn">
            <Replace size={16} aria-hidden="true" />
            Replace existing
          </Button>
        </div>
      </div>
    </div>
  );
};
