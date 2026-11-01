import React from 'react';
import { X, PiggyBank, Check, Plus } from 'lucide-react';
import type { VendorItem } from '../domain/plan';
import type { NormalizedQuote } from '../domain/quotes';
import { formatPaise, paiseToRupees } from '../domain/money';
import './CompareQuotesModal.css';

export interface CompareQuotesModalProps {
  isOpen: boolean;
  categoryLabel: string;
  quotes: NormalizedQuote[];
  vendors: VendorItem[];
  guestCount: number;
  onClose: () => void;
  onChooseVendor: (vendorId: string) => void;
  onAddQuote: () => void;
}

export const CompareQuotesModal: React.FC<CompareQuotesModalProps> = ({
  isOpen,
  categoryLabel,
  quotes,
  vendors,
  guestCount,
  onClose,
  onChooseVendor,
  onAddQuote,
}) => {
  if (!isOpen) return null;

  // Calculate price variance if 2 or more quotes exist
  let varianceText: string | null = null;
  if (quotes.length >= 2) {
    const sorted = [...quotes].sort((a, b) => a.totalCalculatedPaise - b.totalCalculatedPaise);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const diffPaise = highest.totalCalculatedPaise - lowest.totalCalculatedPaise;
    if (diffPaise > 0 && lowest.totalCalculatedPaise > 0) {
      const pct = Math.round((diffPaise / lowest.totalCalculatedPaise) * 100);
      const highVendor = vendors.find(
        (v) => v.id === highest.vendorId || v.name === highest.vendorId,
      );
      varianceText = `Variance: ${highVendor?.name || 'Higher quote'} is ${formatPaise(diffPaise)} more (+${pct}%)`;
    }
  }

  return (
    <div className="vendor-compare-scrim" role="presentation" onClick={onClose}>
      <div
        className="vendor-compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="compare-dialog-header">
          <div className="compare-dialog-eyebrow-group">
            <span className="compare-dialog-eyebrow">{categoryLabel} Category</span>
            <h2 id="compare-dialog-title" className="compare-dialog-title">
              Compare {categoryLabel.toLowerCase()} quotes
            </h2>
          </div>
          <button
            type="button"
            className="compare-dialog-close-btn"
            onClick={onClose}
            aria-label="Close quote comparison dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="compare-dialog-content">
          {quotes.length === 0 ? (
            <div className="compare-empty-box">
              <p>No quotes recorded for vendors in this category yet.</p>
              <button type="button" className="vendor-primary-pill-btn" onClick={onAddQuote}>
                <Plus size={16} />
                <span>Add first quote</span>
              </button>
            </div>
          ) : (
            <div className={`compare-cards-grid ${quotes.length === 1 ? 'single-col' : ''}`}>
              {quotes.map((q) => {
                const vendor = vendors.find((v) => v.id === q.vendorId || v.name === q.vendorId);
                const vendorName = vendor ? vendor.name : q.vendorId;

                return (
                  <div
                    key={q.id}
                    className={`compare-quote-card ${q.isCheapest ? 'is-cheapest' : ''}`}
                  >
                    <div className="compare-card-top">
                      {q.isCheapest && (
                        <span className="compare-cheapest-pill">
                          <PiggyBank size={14} />
                          <span>Lowest Quote</span>
                        </span>
                      )}
                      <h3 className="compare-vendor-name">{vendorName}</h3>
                      <p className="compare-vendor-desc">
                        {vendor?.notes ? vendor.notes : `${categoryLabel} proposal`}
                      </p>
                    </div>

                    <div className="compare-pricing-box">
                      <div className="pricing-row-total">
                        <span className="pricing-lbl">Total calculated</span>
                        <strong className="pricing-val tabular-nums">
                          {formatPaise(q.totalCalculatedPaise)}
                        </strong>
                      </div>
                      <div className="pricing-row-rate">
                        <span className="rate-lbl">Rate structure</span>
                        <span className="rate-val tabular-nums">
                          {formatPaise(q.rawAmountPaise)}{' '}
                          {q.unit === 'total'
                            ? 'total'
                            : q.unit === 'per_plate'
                              ? `(₹${paiseToRupees(q.rawAmountPaise)} / plate × ${guestCount} pax)`
                              : `(₹${paiseToRupees(q.rawAmountPaise)} / guest × ${guestCount} pax)`}
                        </span>
                      </div>
                    </div>

                    <div className="compare-inclusions-box">
                      <span className="inclusions-label">Key Features &amp; Differences:</span>
                      {q.inclusions && q.inclusions.length > 0 ? (
                        <ul className="inclusions-check-list">
                          {q.inclusions.map((inc, i) => (
                            <li key={i}>
                              <Check size={14} className="check-icon" />
                              <span>{inc}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted text-xs">Standard service package</span>
                      )}
                    </div>

                    <div className="compare-card-bottom">
                      <button
                        type="button"
                        className={`compare-choose-btn ${
                          vendor?.status === 'booked'
                            ? 'is-booked'
                            : q.isCheapest
                              ? 'is-primary'
                              : 'is-secondary'
                        }`}
                        onClick={() => {
                          if (vendor) {
                            onChooseVendor(vendor.id);
                            onClose();
                          }
                        }}
                      >
                        {vendor?.status === 'booked' ? '✓ Currently Booked' : 'Choose this vendor'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="compare-dialog-footer">
          <span className="compare-variance-note">
            {varianceText || `Normalized rates calculated for ${guestCount} expected guests.`}
          </span>
          <button type="button" className="compare-close-action" onClick={onClose}>
            Close comparison
          </button>
        </div>
      </div>
    </div>
  );
};
