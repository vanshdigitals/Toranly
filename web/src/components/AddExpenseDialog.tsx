import React, { useState } from 'react';
import { X, Receipt } from 'lucide-react';
import type { BudgetCategory, ExpenseItem, ExpenseKind } from '../domain/plan';
import { rupeesToPaise } from '../domain/money';
import { Button } from './Button';
import { Select } from './Select';
import './AddExpenseDialog.css';

interface AddExpenseDialogProps {
  isOpen: boolean;
  categories: BudgetCategory[];
  onAdd: (expense: ExpenseItem) => void;
  onCancel: () => void;
}

export const AddExpenseDialog: React.FC<AddExpenseDialogProps> = ({
  isOpen,
  categories,
  onAdd,
  onCancel,
}) => {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState<number | ''>('');
  const [kind, setKind] = useState<ExpenseKind>('planned');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amountRupees || Number(amountRupees) <= 0) return;

    const newExpense: ExpenseItem = {
      id: `exp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      categoryId: categoryId || categories[0]?.id || 'general',
      description: description.trim(),
      amountPaise: rupeesToPaise(Number(amountRupees)),
      kind,
      spentOn: kind === 'paid' ? spentOn : undefined,
      note: note.trim() || undefined,
    };

    onAdd(newExpense);
  };

  return (
    <div className="expense-modal-overlay" role="presentation">
      <div
        className="expense-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-expense-title"
      >
        <div className="expense-modal-header">
          <div className="expense-icon-badge">
            <Receipt size={22} className="expense-modal-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="expense-modal-close"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="expense-modal-form">
          <h2 id="add-expense-title" className="expense-modal-title">
            Add an expense
          </h2>

          <div className="expense-form-field">
            <label htmlFor="expense-category-select" className="expense-field-label">
              Category
            </label>
            <Select
              id="expense-category-select"
              value={categoryId}
              onChange={(val) => setCategoryId(val)}
              options={categories.map((c) => ({ value: c.id, label: c.label }))}
            />
          </div>

          <div className="expense-form-field">
            <label htmlFor="expense-desc-input" className="expense-field-label">
              Description
            </label>
            <input
              id="expense-desc-input"
              type="text"
              className="expense-text-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Venue booking deposit, Florist advance"
              maxLength={120}
              required
            />
          </div>

          <div className="expense-form-row">
            <div className="expense-form-field">
              <label htmlFor="expense-amount-input" className="expense-field-label">
                Amount (₹ INR)
              </label>
              <input
                id="expense-amount-input"
                type="number"
                min="1"
                step="1"
                className="expense-text-input"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="₹ Amount in rupees"
                required
              />
            </div>

            <div className="expense-form-field">
              <label htmlFor="expense-kind-select" className="expense-field-label">
                Stage
              </label>
              <Select
                id="expense-kind-select"
                value={kind}
                onChange={(val) => setKind(val as ExpenseKind)}
                options={[
                  { value: 'planned', label: 'Planned (Estimate)' },
                  { value: 'quoted', label: 'Quoted (Vendor offer)' },
                  { value: 'paid', label: 'Paid (Actual spent)' },
                ]}
              />
            </div>
          </div>

          {kind === 'paid' && (
            <div className="expense-form-field">
              <label htmlFor="expense-date-input" className="expense-field-label">
                Date paid
              </label>
              <input
                id="expense-date-input"
                type="date"
                className="expense-text-input"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
              />
            </div>
          )}

          <div className="expense-form-field">
            <label htmlFor="expense-notes-input" className="expense-field-label">
              Notes (optional)
            </label>
            <textarea
              id="expense-notes-input"
              className="expense-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Payment terms, invoice details, etc."
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="expense-modal-actions">
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!description.trim() || !amountRupees || Number(amountRupees) <= 0}
            >
              Add expense
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
