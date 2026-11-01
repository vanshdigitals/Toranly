import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import './UnsavedChangesDialog.css';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  onKeepEditing,
  onDiscard,
}) => {
  const keepEditingBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus default: keep editing
      setTimeout(() => {
        keepEditingBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onKeepEditing();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onKeepEditing]);

  if (!isOpen) return null;

  return (
    <div className="unsaved-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="unsaved-modal-title">
      <div className="unsaved-modal-card">
        <div className="unsaved-modal-header">
          <div className="unsaved-icon-badge">
            <AlertCircle size={22} />
          </div>
          <div className="unsaved-modal-text">
            <h3 id="unsaved-modal-title" className="unsaved-modal-title">
              Discard unsaved changes?
            </h3>
            <p className="unsaved-modal-desc">
              You have unsaved changes in this form. If you leave now, your changes will be discarded.
            </p>
          </div>
        </div>

        <div className="unsaved-modal-actions">
          <button
            ref={keepEditingBtnRef}
            type="button"
            className="unsaved-btn-stay"
            onClick={onKeepEditing}
          >
            Keep editing
          </button>
          <button
            type="button"
            className="unsaved-btn-discard"
            onClick={onDiscard}
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
};

