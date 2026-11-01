import React, { useState, useEffect } from 'react';
import { X, Scale } from 'lucide-react';
import type { VendorItem, QuoteItem, QuoteUnit } from '../domain/plan';
import { rupeesToPaise } from '../domain/money';
import { Button } from './Button';
import { Select } from './Select';
import './AddQuoteDialog.css';

export interface AddQuoteDialogProps {
  isOpen: boolean;
  vendors: VendorItem[];
  initialVendorId?: string;
  onSave: (quote: QuoteItem) => void;
  onCancel: () => void;
}

export const AddQuoteDialog: React.FC<AddQuoteDialogProps> = ({
  isOpen,
  vendors,
  initialVendorId,
  onSave,
  onCancel,
}) => {
  const [vendorId, setVendorId] = useState(initialVendorId || vendors[0]?.id || '');
  const [amountRupees, setAmountRupees] = useState<number | ''>('');
  const [unit, setUnit] = useState<QuoteUnit>('total');
  const [inclusions, setInclusions] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVendorId(initialVendorId || vendors[0]?.id || '');
    setAmountRupees('');
    setUnit('total');
    setInclusions('');
    setValidUntil('');
    setError(null);
  }, [initialVendorId, vendors, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      setError('Please select a vendor.');
      return;
    }
    if (!amountRupees || Number(amountRupees) <= 0) {
      setError('Please enter a valid quoted amount in Rupees.');
      return;
    }

    const newQuote: QuoteItem = {
      id: `quote-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      vendorId,
      amountPaise: rupeesToPaise(Number(amountRupees)),
      unit,
      inclusions: inclusions
        ? inclusions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      validUntil: validUntil || undefined,
    };

    onSave(newQuote);
  };

  return (
    <div className="quote-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="quote-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quote-modal-header">
          <div className="quote-icon-badge">
            <Scale size={22} className="quote-modal-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="quote-modal-close-btn"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="quote-modal-title-group">
          <h2 id="quote-dialog-title" className="quote-modal-title">
            Add vendor quote
          </h2>
          <p className="quote-modal-desc">
            Record a vendor rate structure to compare normalized costs per guest and total commitment.
          </p>
        </div>

        {error && <div className="quote-modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="quote-modal-form">
          <div className="quote-form-group">
            <label htmlFor="quote-vendor-select" className="quote-form-label">
              Vendor <span className="label-required">*</span>
            </label>
            <Select
              id="quote-vendor-select"
              required
              value={vendorId}
              onChange={(val) => setVendorId(val)}
              options={vendors.map((v) => ({
                value: v.id,
                label: `${v.name} (${v.categoryKey})`,
              }))}
            />
          </div>

          <div className="quote-form-row">
            <div className="quote-form-group">
              <label htmlFor="quote-amount-num" className="quote-form-label">
                Quoted rate (₹) <span className="label-required">*</span>
              </label>
              <div className="quote-currency-input-wrap">
                <span className="quote-currency-prefix">₹</span>
                <input
                  id="quote-amount-num"
                  type="number"
                  min="0"
                  step="500"
                  required
                  autoFocus
                  className="quote-form-input has-prefix"
                  placeholder="e.g. 85000"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
            </div>

            <div className="quote-form-group">
              <label htmlFor="quote-unit-select-field" className="quote-form-label">
                Rate structure
              </label>
              <Select
                id="quote-unit-select-field"
                value={unit}
                onChange={(val) => setUnit(val as QuoteUnit)}
                options={[
                  { value: 'total', label: 'Fixed Total (₹ Total)' },
                  { value: 'per_plate', label: 'Per Plate (₹ / Plate)' },
                  { value: 'per_guest', label: 'Per Guest (₹ / Guest)' },
                ]}
              />
            </div>
          </div>

          <div className="quote-form-group">
            <label htmlFor="quote-inc-input" className="quote-form-label">
              Inclusions <span className="label-optional">(comma-separated)</span>
            </label>
            <input
              id="quote-inc-input"
              type="text"
              className="quote-form-input"
              placeholder="e.g. Staff of 12, Table linens, Cutlery, Live tandoor"
              value={inclusions}
              onChange={(e) => setInclusions(e.target.value)}
            />
          </div>

          <div className="quote-form-group">
            <label htmlFor="quote-validity-date" className="quote-form-label">
              Quote valid until <span className="label-optional">(optional)</span>
            </label>
            <input
              id="quote-validity-date"
              type="date"
              className="quote-form-input"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          <div className="quote-modal-actions">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save quote
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
