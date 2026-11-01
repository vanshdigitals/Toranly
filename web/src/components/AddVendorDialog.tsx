import React, { useState, useEffect } from 'react';
import { X, Store } from 'lucide-react';
import type { BudgetCategory, VendorItem, QuoteUnit } from '../domain/plan';
import { rupeesToPaise } from '../domain/money';
import { Button } from './Button';
import { Select } from './Select';
import './AddVendorDialog.css';

export interface AddVendorDialogProps {
  isOpen: boolean;
  categories: BudgetCategory[];
  vendorToEdit?: VendorItem | null;
  initialCategoryKey?: string;
  onSave: (
    vendor: VendorItem,
    initialQuote?: { amountPaise: number; unit: QuoteUnit; inclusions?: string[] },
  ) => void;
  onCancel: () => void;
}

const DEFAULT_CATEGORIES = [
  { key: 'venue', label: 'Venue & Staging' },
  { key: 'catering', label: 'Catering & Dining' },
  { key: 'photography', label: 'Photography & Film' },
  { key: 'decor', label: 'Decor & Florals' },
  { key: 'music', label: 'Music & Entertainment' },
  { key: 'attire', label: 'Attire & Jewellery' },
  { key: 'invitations', label: 'Invitations & Favours' },
  { key: 'general', label: 'Other Services' },
];

export const AddVendorDialog: React.FC<AddVendorDialogProps> = ({
  isOpen,
  categories,
  vendorToEdit,
  initialCategoryKey,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [status, setStatus] = useState<'shortlisted' | 'booked' | 'dropped'>('shortlisted');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Optional Quote state
  const [includeQuote, setIncludeQuote] = useState(false);
  const [quoteRupees, setQuoteRupees] = useState<number | ''>('');
  const [quoteUnit, setQuoteUnit] = useState<QuoteUnit>('total');
  const [inclusions, setInclusions] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Available categories merged
  const availableCategories = React.useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.map((c) => ({ key: c.key || c.id, label: c.label }));
    }
    return DEFAULT_CATEGORIES;
  }, [categories]);

  useEffect(() => {
    if (vendorToEdit) {
      setName(vendorToEdit.name);
      setCategoryKey(vendorToEdit.categoryKey);
      setStatus(vendorToEdit.status);
      setPhone(vendorToEdit.phone || '');
      setEmail(vendorToEdit.email || '');
      setNotes(vendorToEdit.notes || '');
      setIncludeQuote(false);
    } else {
      setName('');
      setCategoryKey(initialCategoryKey || availableCategories[0]?.key || 'venue');
      setStatus('shortlisted');
      setPhone('');
      setEmail('');
      setNotes('');
      setIncludeQuote(false);
      setQuoteRupees('');
      setQuoteUnit('total');
      setInclusions('');
    }
    setError(null);
  }, [vendorToEdit, initialCategoryKey, availableCategories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Vendor name is required.');
      return;
    }

    if (includeQuote && (!quoteRupees || Number(quoteRupees) <= 0)) {
      setError('Please specify a valid quote amount or uncheck the initial quote option.');
      return;
    }

    const vendorId = vendorToEdit
      ? vendorToEdit.id
      : `vend-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const vendor: VendorItem = {
      id: vendorId,
      name: trimmedName,
      categoryKey: categoryKey || availableCategories[0]?.key || 'venue',
      status,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    let initialQuote: { amountPaise: number; unit: QuoteUnit; inclusions?: string[] } | undefined;
    if (includeQuote && quoteRupees && Number(quoteRupees) > 0) {
      initialQuote = {
        amountPaise: rupeesToPaise(Number(quoteRupees)),
        unit: quoteUnit,
        inclusions: inclusions
          ? inclusions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      };
    }

    onSave(vendor, initialQuote);
  };

  return (
    <div className="vendor-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="vendor-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vendor-modal-header">
          <div className="vendor-icon-badge">
            <Store size={22} className="vendor-modal-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="vendor-modal-close-btn"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="vendor-modal-title-group">
          <h2 id="vendor-dialog-title" className="vendor-modal-title">
            {vendorToEdit ? 'Edit vendor details' : 'Add new vendor'}
          </h2>
          <p className="vendor-modal-desc">
            {vendorToEdit
              ? 'Update contact details, booking status, and notes for this vendor.'
              : 'Add venues, caterers, photographers, decorators, and other vendors to organize quotes.'}
          </p>
        </div>

        {error && <div className="vendor-modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="vendor-modal-form">
          {/* Vendor Name */}
          <div className="vendor-form-group">
            <label htmlFor="vendor-name-input" className="vendor-form-label">
              Vendor or business name <span className="label-required">*</span>
            </label>
            <input
              id="vendor-name-input"
              type="text"
              required
              autoFocus
              className="vendor-form-input"
              placeholder="e.g. Royal Palace Banquets or Candid Moments Studio"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          {/* Category & Status */}
          <div className="vendor-form-row">
            <div className="vendor-form-group">
              <label htmlFor="vendor-cat-select" className="vendor-form-label">
                Category
              </label>
              <Select
                id="vendor-cat-select"
                value={categoryKey}
                onChange={(val) => setCategoryKey(val)}
                options={availableCategories.map((c) => ({ value: c.key, label: c.label }))}
              />
            </div>

            <div className="vendor-form-group">
              <label htmlFor="vendor-status-select" className="vendor-form-label">
                Booking status
              </label>
              <Select
                id="vendor-status-select"
                value={status}
                onChange={(val) => setStatus(val as 'shortlisted' | 'booked' | 'dropped')}
                options={[
                  { value: 'shortlisted', label: 'Shortlisted' },
                  { value: 'booked', label: 'Booked & Confirmed' },
                  { value: 'dropped', label: 'Dropped / Inactive' },
                ]}
              />
            </div>
          </div>

          {/* Contact: Phone & Email */}
          <div className="vendor-form-row">
            <div className="vendor-form-group">
              <label htmlFor="vendor-phone-input" className="vendor-form-label">
                Phone number <span className="label-optional">(optional)</span>
              </label>
              <input
                id="vendor-phone-input"
                type="tel"
                className="vendor-form-input"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="vendor-form-group">
              <label htmlFor="vendor-email-input" className="vendor-form-label">
                Email address <span className="label-optional">(optional)</span>
              </label>
              <input
                id="vendor-email-input"
                type="email"
                className="vendor-form-input"
                placeholder="contact@vendor.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="vendor-form-group">
            <label htmlFor="vendor-notes-input" className="vendor-form-label">
              Notes or proposal terms <span className="label-optional">(optional)</span>
            </label>
            <textarea
              id="vendor-notes-input"
              rows={2}
              className="vendor-form-textarea"
              placeholder="e.g. Quoted for 350 guests; includes sound system and 2 green rooms."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Optional Initial Quote (Only for new vendors) */}
          {!vendorToEdit && (
            <div className="vendor-quote-toggle-section">
              <label className="vendor-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeQuote}
                  onChange={(e) => setIncludeQuote(e.target.checked)}
                />
                <span>Include initial quote for comparison</span>
              </label>

              {includeQuote && (
                <div className="vendor-quote-fields">
                  <div className="vendor-form-row">
                    <div className="vendor-form-group">
                      <label htmlFor="quote-amount-input" className="vendor-form-label">
                        Quoted amount (₹) <span className="label-required">*</span>
                      </label>
                      <div className="vendor-currency-input-wrap">
                        <span className="vendor-currency-prefix">₹</span>
                        <input
                          id="quote-amount-input"
                          type="number"
                          min="0"
                          step="500"
                          required={includeQuote}
                          className="vendor-form-input has-prefix"
                          placeholder="e.g. 150000"
                          value={quoteRupees}
                          onChange={(e) =>
                            setQuoteRupees(e.target.value ? Number(e.target.value) : '')
                          }
                        />
                      </div>
                    </div>

                    <div className="vendor-form-group">
                      <label htmlFor="quote-unit-select" className="vendor-form-label">
                        Rate structure
                      </label>
                      <Select
                        id="quote-unit-select"
                        value={quoteUnit}
                        onChange={(val) => setQuoteUnit(val as QuoteUnit)}
                        options={[
                          { value: 'total', label: 'Fixed Total (₹ Total)' },
                          { value: 'per_plate', label: 'Per Plate (₹ / Plate)' },
                          { value: 'per_guest', label: 'Per Guest (₹ / Guest)' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="vendor-form-group">
                    <label htmlFor="quote-inclusions-input" className="vendor-form-label">
                      Inclusions <span className="label-optional">(comma-separated)</span>
                    </label>
                    <input
                      id="quote-inclusions-input"
                      type="text"
                      className="vendor-form-input"
                      placeholder="e.g. Welcome drinks, Stage lighting, Basic decor"
                      value={inclusions}
                      onChange={(e) => setInclusions(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="vendor-modal-actions">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {vendorToEdit ? 'Save changes' : 'Add vendor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
