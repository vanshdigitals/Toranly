import React from 'react';
import { X, Phone, Mail, Plus, Trash2, CheckCircle } from 'lucide-react';
import type { VendorItem, QuoteItem } from '../domain/plan';
import { formatPaise } from '../domain/money';
import { normalizeQuote } from '../domain/quotes';
import { Select } from './Select';
import './VendorDetailsDrawer.css';

export interface VendorDetailsDrawerProps {
  isOpen: boolean;
  vendor: VendorItem | null;
  categoryLabel: string;
  quotes: QuoteItem[];
  guestCount: number;
  onClose: () => void;
  onUpdateStatus: (vendorId: string, status: 'shortlisted' | 'booked' | 'dropped') => void;
  onAddQuote: (vendorId: string) => void;
  onDeleteQuote: (quoteId: string) => void;
  onDeleteVendor: (vendorId: string) => void;
}

export const VendorDetailsDrawer: React.FC<VendorDetailsDrawerProps> = ({
  isOpen,
  vendor,
  categoryLabel,
  quotes,
  guestCount,
  onClose,
  onUpdateStatus,
  onAddQuote,
  onDeleteQuote,
  onDeleteVendor,
}) => {
  if (!isOpen || !vendor) return null;

  const vendorQuotes = quotes.filter(
    (q) => q.vendorId === vendor.id || q.vendorId === vendor.name
  );

  return (
    <div
      className="vendor-drawer-scrim"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="vendor-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-vendor-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="vendor-drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-cat-eyebrow">
              {categoryLabel} Vendor
            </span>
            <h2 id="drawer-vendor-title" className="drawer-vendor-title">
              {vendor.name}
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close details drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="vendor-drawer-content">
          {/* Status & Contact Strip */}
          <div className="drawer-status-strip">
            <div className="drawer-strip-row">
              <span className="drawer-strip-label">Current workflow status</span>
              <div className="drawer-status-select-wrap">
                <Select
                  value={vendor.status}
                  onChange={(val) =>
                    onUpdateStatus(
                      vendor.id,
                      val as 'shortlisted' | 'booked' | 'dropped'
                    )
                  }
                  variant="status"
                  aria-label={`Workflow status for ${vendor.name}`}
                  options={[
                    { value: 'shortlisted', label: 'Shortlisted' },
                    { value: 'booked', label: 'Booked' },
                    { value: 'dropped', label: 'Dropped' },
                  ]}
                />
              </div>
            </div>

            <div className="drawer-strip-contacts">
              <div className="drawer-contact-col">
                <span className="drawer-contact-lbl">Primary contact</span>
                {vendor.phone ? (
                  <a
                    href={`tel:${vendor.phone}`}
                    className="drawer-contact-val tabular-nums"
                  >
                    <Phone size={13} />
                    <span>{vendor.phone}</span>
                  </a>
                ) : (
                  <span className="text-muted text-xs">Not provided</span>
                )}
              </div>
              <div className="drawer-contact-col">
                <span className="drawer-contact-lbl">Email</span>
                {vendor.email ? (
                  <a
                    href={`mailto:${vendor.email}`}
                    className="drawer-contact-val"
                  >
                    <Mail size={13} />
                    <span>{vendor.email}</span>
                  </a>
                ) : (
                  <span className="text-muted text-xs">Not provided</span>
                )}
              </div>
            </div>
          </div>

          {/* Quotes Section */}
          <div className="drawer-quotes-section">
            <div className="drawer-quotes-header">
              <h3 className="drawer-section-heading">
                Quotes ({vendorQuotes.length})
              </h3>
              <button
                type="button"
                className="drawer-add-quote-btn"
                onClick={() => onAddQuote(vendor.id)}
              >
                <Plus size={15} />
                <span>Add quote</span>
              </button>
            </div>

            {vendorQuotes.length === 0 ? (
              <div className="drawer-empty-quotes-box">
                <p>No quotes recorded for this vendor yet.</p>
                <button
                  type="button"
                  className="drawer-add-quote-btn inline-btn"
                  onClick={() => onAddQuote(vendor.id)}
                >
                  <Plus size={14} />
                  <span>Record first quote</span>
                </button>
              </div>
            ) : (
              <div className="drawer-quotes-list">
                {vendorQuotes.map((q) => {
                  const norm = normalizeQuote(q, guestCount);
                  return (
                    <div key={q.id} className="drawer-quote-card">
                      <div className="drawer-quote-top">
                        <div>
                          <span className="drawer-quote-badge">Active Quote</span>
                          <div className="drawer-quote-amount tabular-nums">
                            {formatPaise(q.amountPaise)}{' '}
                            <small className="unit-label">
                              {q.unit === 'total'
                                ? 'total'
                                : q.unit === 'per_plate'
                                ? '/ plate'
                                : '/ guest'}
                            </small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="drawer-quote-del-btn"
                          onClick={() => onDeleteQuote(q.id)}
                          title="Delete quote"
                          aria-label="Delete quote"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Per-plate math breakdown */}
                      <div className="drawer-quote-breakdown-box">
                        <div className="breakdown-row">
                          <span>Unit structure</span>
                          <strong className="text-text">
                            {q.unit === 'total'
                              ? 'Fixed total'
                              : q.unit === 'per_plate'
                              ? 'Per Plate'
                              : 'Per Guest'}
                          </strong>
                        </div>
                        <div className="breakdown-row">
                          <span>Expected guest count</span>
                          <strong className="text-text tabular-nums">
                            {guestCount} pax
                          </strong>
                        </div>
                        <div className="breakdown-row total-row">
                          <span>Calculated total</span>
                          <strong className="text-text tabular-nums">
                            {formatPaise(norm.totalPaise)}
                          </strong>
                        </div>
                      </div>

                      {q.inclusions && q.inclusions.length > 0 && (
                        <div className="drawer-quote-inclusions">
                          <span className="inclusions-heading">
                            Included in package:
                          </span>
                          <ul className="inclusions-list">
                            {q.inclusions.map((inc, i) => (
                              <li key={i}>
                                <CheckCircle size={13} className="inc-icon" />
                                <span>{inc}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vendor Notes */}
          {vendor.notes && (
            <div className="drawer-notes-section">
              <span className="drawer-section-heading">Vendor notes</span>
              <div className="drawer-notes-box">{vendor.notes}</div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="vendor-drawer-footer">
          <button
            type="button"
            className="drawer-remove-btn"
            onClick={() => {
              if (window.confirm(`Are you sure you want to remove "${vendor.name}"?`)) {
                onDeleteVendor(vendor.id);
              }
            }}
          >
            <Trash2 size={16} />
            <span>Remove vendor</span>
          </button>
          <button
            type="button"
            className="vendor-primary-pill-btn"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

