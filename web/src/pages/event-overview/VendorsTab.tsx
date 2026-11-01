/** The vendors tab of the event planner. */
import {
  Lightbulb,
  CheckCircle,
  Trash2,
  Plus,
  Clock,
  Mail,
  MoreVertical,
  Edit2,
  X,
  Store,
  Scale,
  Phone,
  PiggyBank,
  Info,
} from 'lucide-react';
import { formatPaise } from '../../domain/money';
import { normalizeAndCompareQuotes } from '../../domain/quotes';
import { DEFAULT_VENDOR_CATEGORIES, getCategoryIcon } from './helpers';
import type { Planner } from './usePlanner';

export function VendorsTab({ planner }: { planner: Planner }) {
  const {
    plan,
    setShowVendorDialog,
    setVendorToEdit,
    setVendorInitialCategory,
    setShowQuoteDialog,
    setQuoteInitialVendorId,
    vendorCategoryFilter,
    setVendorCategoryFilter,
    setSelectedVendorForDrawer,
    setCompareQuotesCategoryKey,
    vendorActionMenuId,
    setVendorActionMenuId,
    setTab,
    handleDeleteVendor,
    handleUpdateVendorStatus,
  } = planner;

  const allVendors = plan.vendors || [];
  const allQuotes = plan.quotes || [];
  const guestCount = plan.event.guestEstimate || plan.guests?.total || 0;

  const bookedCount = allVendors.filter((v) => v.status === 'booked').length;
  const shortlistedCount = allVendors.filter((v) => v.status === 'shortlisted').length;
  const droppedCount = allVendors.filter((v) => v.status === 'dropped').length;

  const hasVendors = allVendors.length > 0;
  const budgetCats = plan.budgetCategories || [];
  const allCategoryKeys = Array.from(
    new Set([...budgetCats.map((c) => c.key), ...allVendors.map((v) => v.categoryKey)]),
  );

  // Filter by active category filter if set
  const displayedCategoryKeys =
    vendorCategoryFilter === 'all'
      ? allCategoryKeys.filter((key) => {
          const catBudget = budgetCats.find((c) => c.key === key);
          const catVendors = allVendors.filter((v) => v.categoryKey === key);
          return (
            catVendors.length > 0 ||
            (catBudget && catBudget.allocatedPaise > 0) ||
            ['catering', 'venue', 'photo_video', 'decor'].includes(key)
          );
        })
      : [vendorCategoryFilter];

  return (
    <div className="tab-pane-fade vendors-page-wrapper">
      {/* 1. Header Matching Stitch Reference */}
      <div className="vendors-page-header">
        <div className="vendors-header-title-block">
          <h1 className="vendors-page-title">Vendors</h1>
          <p className="vendors-page-subtitle">
            Manage vendors, track quotes and compare catering and venue options for{' '}
            {plan.event.title || 'your celebration'}.
          </p>
        </div>

        <div className="vendors-header-actions">
          <button
            type="button"
            className="vendor-secondary-pill-btn"
            onClick={() => setTab('ai-plan')}
            title="Explore vendor recommendations with AI Plan"
          >
            <Lightbulb size={16} />
            <span>Which vendors do I need?</span>
          </button>

          <button
            type="button"
            className="vendor-primary-pill-btn"
            onClick={() => {
              setVendorToEdit(null);
              setVendorInitialCategory(undefined);
              setShowVendorDialog(true);
            }}
            title="Add a new vendor"
          >
            <Plus size={16} />
            <span>Add vendor</span>
          </button>
        </div>
      </div>

      {!hasVendors ? (
        /* Total Empty State */
        <div className="vendors-total-empty-view">
          <div className="vendors-total-empty-icon-wrap">
            <Store size={32} />
          </div>
          <h2 className="vendors-total-empty-title">No vendors added yet</h2>
          <p className="vendors-total-empty-desc">
            Start curating caterers, venues, photographers, and decorators for{' '}
            {plan.event.title || 'your celebration'}. Compare quotes side-by-side to make confident
            decisions.
          </p>
          <div className="vendors-total-empty-actions">
            <button
              type="button"
              className="vendor-primary-pill-btn"
              onClick={() => {
                setVendorToEdit(null);
                setVendorInitialCategory(undefined);
                setShowVendorDialog(true);
              }}
            >
              <Plus size={16} />
              <span>Add first vendor</span>
            </button>
            <button
              type="button"
              className="vendor-secondary-pill-btn"
              onClick={() => setTab('ai-plan')}
            >
              <Lightbulb size={16} />
              <span>Which vendors do I need?</span>
            </button>
          </div>

          <div className="vendors-total-empty-quick-box">
            <span className="vendors-quick-title">Quick start by category</span>
            <div className="vendors-quick-chips">
              {(budgetCats.length > 0 ? budgetCats.slice(0, 8) : DEFAULT_VENDOR_CATEGORIES).map(
                (cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className="vendors-quick-chip-btn"
                    onClick={() => {
                      setVendorToEdit(null);
                      setVendorInitialCategory(cat.key);
                      setShowVendorDialog(true);
                    }}
                  >
                    {getCategoryIcon(cat.key, cat.label)}
                    <span>{cat.label}</span>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 2. Filter Chips Track & Status Summary Strip */}
          <div className="vendors-filter-summary-row">
            <div className="vendors-filter-chips-track">
              <button
                type="button"
                className={`vendor-filter-chip ${vendorCategoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setVendorCategoryFilter('all')}
              >
                <span>All</span>
                <span className="vendor-chip-badge">{allVendors.length}</span>
              </button>
              {allCategoryKeys.map((key) => {
                const catBudget = budgetCats.find((c) => c.key === key);
                const count = allVendors.filter((v) => v.categoryKey === key).length;
                const label = catBudget?.label || key;
                if (count === 0 && (!catBudget || catBudget.allocatedPaise === 0)) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`vendor-filter-chip ${vendorCategoryFilter === key ? 'active' : ''}`}
                    onClick={() => setVendorCategoryFilter(key)}
                  >
                    <span>{label}</span>
                    <span className="vendor-chip-badge">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="vendors-status-summary-strip">
              <span className="vendor-status-summary-item">
                <span className="vendor-status-dot booked" />
                <span>{bookedCount} booked</span>
              </span>
              <span className="vendor-status-divider">·</span>
              <span className="vendor-status-summary-item">
                <span className="vendor-status-dot shortlisted" />
                <span>{shortlistedCount} shortlisted</span>
              </span>
              {droppedCount > 0 && (
                <>
                  <span className="vendor-status-divider">·</span>
                  <span className="vendor-status-summary-item">
                    <span className="vendor-status-dot dropped" />
                    <span>{droppedCount} dropped</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 3. Category Stack of Cards */}
          <div className="vendor-categories-stack">
            {displayedCategoryKeys.map((catKey) => {
              const catBudget = budgetCats.find((c) => c.key === catKey);
              const catLabel = catBudget?.label || catKey;
              const catVendors = allVendors.filter((v) => v.categoryKey === catKey);
              const hasBooked = catVendors.some((v) => v.status === 'booked');

              // Quotes for this category normalized and compared
              const rawCatQuotes = allQuotes.filter((q) =>
                catVendors.some((v) => v.id === q.vendorId || v.name === q.vendorId),
              );
              const normalizedCatQuotes = normalizeAndCompareQuotes(rawCatQuotes, guestCount);
              const cheapestQuote = normalizedCatQuotes.find((q) => q.isCheapest);

              return (
                <div key={catKey} className="vendor-category-card">
                  {/* Card Header */}
                  <div className="vendor-category-card-header">
                    <div className="vendor-category-header-info">
                      <div className="vendor-category-icon-box">
                        {getCategoryIcon(catKey, catLabel)}
                      </div>
                      <div className="vendor-category-titles">
                        <div className="vendor-category-name-row">
                          <h3 className="vendor-category-name">{catLabel}</h3>
                          <span className="vendor-category-count-pill">({catVendors.length})</span>
                        </div>
                        <span className="vendor-category-target-budget">
                          Target budget:{' '}
                          <strong>{formatPaise(catBudget?.allocatedPaise || 0)}</strong>
                          {guestCount > 0 ? ` for ${guestCount} expected guests` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="vendor-category-header-actions">
                      {hasBooked ? (
                        <span className="vendor-contract-executed-badge">
                          <CheckCircle size={14} />
                          <span>Contract executed</span>
                        </span>
                      ) : (
                        rawCatQuotes.length >= 2 && (
                          <button
                            type="button"
                            className="vendor-compare-quotes-btn"
                            onClick={() => setCompareQuotesCategoryKey(catKey)}
                            title="Compare quotes side-by-side"
                          >
                            <Scale size={14} />
                            <span>Compare quotes</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  {catVendors.length === 0 ? (
                    <div className="vendor-category-empty-row">
                      <div className="vendor-category-empty-left">
                        <Info size={16} />
                        <span>
                          No {catLabel.toLowerCase()} vendors added yet.
                          {catBudget && catBudget.allocatedPaise > 0 && (
                            <>
                              {' '}
                              You have <strong>{formatPaise(catBudget.allocatedPaise)}</strong>{' '}
                              allocated in Budget.
                            </>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="vendor-category-empty-add-btn"
                        onClick={() => {
                          setVendorInitialCategory(catKey);
                          setShowVendorDialog(true);
                        }}
                      >
                        <Plus size={14} />
                        <span>Add {catLabel.toLowerCase()} vendor</span>
                      </button>
                    </div>
                  ) : (
                    <div className="vendor-rows-list">
                      {catVendors.map((vendor) => {
                        const vendorQuotes = allQuotes.filter(
                          (q) => q.vendorId === vendor.id || q.vendorId === vendor.name,
                        );
                        const normalizedVendorQuotes = normalizeAndCompareQuotes(
                          vendorQuotes,
                          guestCount,
                        );
                        const primaryQuote =
                          normalizedVendorQuotes.find((q) => q.isCheapest) ||
                          normalizedVendorQuotes[0];

                        const isLowestQuote =
                          cheapestQuote &&
                          primaryQuote &&
                          rawCatQuotes.length >= 2 &&
                          (cheapestQuote.vendorId === vendor.id ||
                            cheapestQuote.vendorId === vendor.name);

                        const isMenuOpen = vendorActionMenuId === vendor.id;

                        return (
                          <div key={vendor.id} className="vendor-item-row">
                            {/* Info Column */}
                            <div className="vendor-item-info-col">
                              <div className="vendor-item-title-line">
                                <span className="vendor-item-name">{vendor.name}</span>
                                <span className={`vendor-status-pill ${vendor.status}`}>
                                  {vendor.status}
                                </span>
                                {isLowestQuote && (
                                  <span className="vendor-lowest-quote-badge">
                                    <PiggyBank size={12} />
                                    <span>Lowest quote</span>
                                  </span>
                                )}
                              </div>

                              {vendor.notes && (
                                <span className="vendor-item-notes">{vendor.notes}</span>
                              )}

                              {(vendor.phone || vendor.email) && (
                                <div className="vendor-item-contact-chips">
                                  {vendor.phone && (
                                    <a
                                      href={`tel:${vendor.phone}`}
                                      className="vendor-contact-link"
                                      title="Call vendor"
                                    >
                                      <Phone size={12} />
                                      <span>{vendor.phone}</span>
                                    </a>
                                  )}
                                  {vendor.email && (
                                    <a
                                      href={`mailto:${vendor.email}`}
                                      className="vendor-contact-link"
                                      title="Email vendor"
                                    >
                                      <Mail size={12} />
                                      <span>{vendor.email}</span>
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Quotes & Actions Column */}
                            <div className="vendor-item-quote-col">
                              {primaryQuote ? (
                                <div className="vendor-quote-details-box">
                                  <span className="vendor-quote-total-text">
                                    {formatPaise(primaryQuote.totalCalculatedPaise)}
                                  </span>
                                  <span className="vendor-quote-subtext">
                                    {primaryQuote.unit === 'per_plate' ||
                                    primaryQuote.unit === 'per_guest'
                                      ? `${formatPaise(primaryQuote.rawAmountPaise)}/guest · ${guestCount} guests`
                                      : 'Fixed quote total'}
                                  </span>
                                  <span className="vendor-quote-count-pill">
                                    {vendorQuotes.length} quote
                                    {vendorQuotes.length > 1 ? 's' : ''} logged
                                  </span>
                                </div>
                              ) : (
                                <div className="vendor-quote-details-box">
                                  <span className="vendor-quote-subtext">No quote added yet</span>
                                </div>
                              )}

                              <div className="vendor-item-actions">
                                <button
                                  type="button"
                                  className="vendor-view-details-btn"
                                  onClick={() => setSelectedVendorForDrawer(vendor)}
                                >
                                  <span>View quotes &amp; details</span>
                                </button>

                                <button
                                  type="button"
                                  className="vendor-kebab-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVendorActionMenuId(isMenuOpen ? null : vendor.id);
                                  }}
                                  aria-label="Vendor actions"
                                >
                                  <MoreVertical size={16} />
                                </button>

                                {isMenuOpen && (
                                  <div
                                    className="vendor-kebab-menu"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="vendor-kebab-menu-item"
                                      onClick={() => {
                                        setQuoteInitialVendorId(vendor.id);
                                        setShowQuoteDialog(true);
                                        setVendorActionMenuId(null);
                                      }}
                                    >
                                      <Plus size={14} />
                                      <span>Add quote</span>
                                    </button>

                                    <button
                                      type="button"
                                      className="vendor-kebab-menu-item"
                                      onClick={() => {
                                        setVendorToEdit(vendor);
                                        setShowVendorDialog(true);
                                        setVendorActionMenuId(null);
                                      }}
                                    >
                                      <Edit2 size={14} />
                                      <span>Edit vendor</span>
                                    </button>

                                    {vendor.status !== 'booked' && (
                                      <button
                                        type="button"
                                        className="vendor-kebab-menu-item"
                                        onClick={() => {
                                          handleUpdateVendorStatus(vendor.id, 'booked');
                                          setVendorActionMenuId(null);
                                        }}
                                      >
                                        <CheckCircle size={14} />
                                        <span>Mark as booked</span>
                                      </button>
                                    )}

                                    {vendor.status !== 'shortlisted' && (
                                      <button
                                        type="button"
                                        className="vendor-kebab-menu-item"
                                        onClick={() => {
                                          handleUpdateVendorStatus(vendor.id, 'shortlisted');
                                          setVendorActionMenuId(null);
                                        }}
                                      >
                                        <Clock size={14} />
                                        <span>Mark shortlisted</span>
                                      </button>
                                    )}

                                    {vendor.status !== 'dropped' && (
                                      <button
                                        type="button"
                                        className="vendor-kebab-menu-item"
                                        onClick={() => {
                                          handleUpdateVendorStatus(vendor.id, 'dropped');
                                          setVendorActionMenuId(null);
                                        }}
                                      >
                                        <X size={14} />
                                        <span>Mark as dropped</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="vendor-kebab-menu-item danger"
                                      onClick={() => {
                                        handleDeleteVendor(vendor.id);
                                        setVendorActionMenuId(null);
                                      }}
                                    >
                                      <Trash2 size={14} />
                                      <span>Delete vendor</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
