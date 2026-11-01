import React, { useState, useEffect } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { Button } from './Button';
import './AddCategoryDialog.css';

interface AddCategoryDialogProps {
  isOpen: boolean;
  onAdd: (label: string, allocatedRupees: number) => void;
  onCancel: () => void;
}

export const AddCategoryDialog: React.FC<AddCategoryDialogProps> = ({
  isOpen,
  onAdd,
  onCancel,
}) => {
  const [label, setLabel] = useState('');
  const [allocatedRupees, setAllocatedRupees] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLabel('');
      setAllocatedRupees('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Please enter a category name');
      return;
    }
    const amount = allocatedRupees === '' ? 0 : Number(allocatedRupees);
    if (isNaN(amount) || amount < 0) {
      setError('Please enter a valid allocation amount');
      return;
    }

    onAdd(trimmed, amount);
  };

  return (
    <div className="cat-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="cat-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-category-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cat-modal-header">
          <div className="cat-icon-badge">
            <FolderPlus size={22} className="cat-modal-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="cat-modal-close"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <h2 id="add-category-title" className="cat-modal-title">
          Add Budget Category
        </h2>

        <form onSubmit={handleSubmit}>
          {error && <div className="cat-form-error">{error}</div>}

          <div className="cat-form-field">
            <label htmlFor="cat-name-input" className="cat-field-label">
              Category Name *
            </label>
            <input
              id="cat-name-input"
              type="text"
              className="cat-input"
              placeholder="e.g., Bridal Jewellery, Sound & Lighting"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              maxLength={60}
              required
            />
          </div>

          <div className="cat-form-field">
            <label htmlFor="cat-allocated-input" className="cat-field-label">
              Allocated Budget (₹)
            </label>
            <div className="cat-currency-input-wrap">
              <span className="cat-currency-symbol">₹</span>
              <input
                id="cat-allocated-input"
                type="number"
                min="0"
                step="1000"
                className="cat-input cat-input-currency"
                placeholder="0"
                value={allocatedRupees}
                onChange={(e) => {
                  const val = e.target.value;
                  setAllocatedRupees(val === '' ? '' : Math.max(0, Number(val)));
                }}
              />
            </div>
            <span className="cat-field-hint">
              Target spending allocated for this celebration expense area.
            </span>
          </div>

          <div className="cat-modal-actions">
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!label.trim()}>
              Add Category
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
