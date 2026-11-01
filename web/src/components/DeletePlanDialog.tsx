import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from './Button';
import './DeletePlanDialog.css';

interface DeletePlanDialogProps {
  isOpen: boolean;
  planTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeletePlanDialog: React.FC<DeletePlanDialogProps> = ({
  isOpen,
  planTitle,
  onConfirm,
  onCancel,
}) => {
  const [typedTitle, setTypedTitle] = useState('');

  if (!isOpen) return null;

  const isMatch = typedTitle.trim() === planTitle.trim();

  const handleConfirm = () => {
    if (isMatch) {
      onConfirm();
    }
  };

  return (
    <div className="delete-overlay" role="presentation">
      <div
        className="delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className="delete-header">
          <div className="delete-icon-badge">
            <AlertTriangle size={22} className="delete-warning-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="delete-close-btn"
            onClick={onCancel}
            aria-label="Cancel deletion"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="delete-content">
          <h2 id="delete-dialog-title" className="delete-title">
            Delete celebration plan?
          </h2>
          <p className="delete-warning-text">
            This action cannot be undone. All budget categories, expenses, tasks, and vendor records for <strong>{planTitle}</strong> will be permanently removed from this device.
          </p>

          <div className="delete-input-group">
            <label htmlFor="delete-confirm-input" className="delete-input-label">
              Please type <span className="delete-required-text">"{planTitle}"</span> to confirm:
            </label>
            <input
              id="delete-confirm-input"
              type="text"
              className="delete-text-input"
              value={typedTitle}
              onChange={(e) => setTypedTitle(e.target.value)}
              placeholder={planTitle}
              autoFocus
            />
          </div>
        </div>

        <div className="delete-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <button
            type="button"
            className="delete-danger-btn"
            disabled={!isMatch}
            onClick={handleConfirm}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete this plan
          </button>
        </div>
      </div>
    </div>
  );
};
