import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Check,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  UtensilsCrossed,
  Info,
  X,
  Sparkles,
  ArrowRight,
  History,
} from 'lucide-react';
import type { Plan } from '../domain/plan';
import { validateDietaryCounts, checkDietaryCoverage, type DietBreakdown } from '../domain/guests';
import { generateDietaryCsv, downloadCsv } from '../domain/export';
import './GuestsTab.css';

interface GuestsTabProps {
  plan: Plan;
  onSavePlan: (updatedPlan: Plan) => Promise<void>;
  onNavigateTab: (tab: string) => void;
  onShowToast: (message: string) => void;
}

const ACCESSIBILITY_OPTIONS = [
  {
    id: 'ramps',
    title: 'Step-free access & ramps',
    description: 'Mandap entrance, dining courtyard, and restroom corridors',
    fullWidth: false,
  },
  {
    id: 'seating',
    title: 'Seating support & front-row low chairs',
    description: 'Cushioned armchairs reserved for grandparents near havan kund',
    fullWidth: false,
  },
  {
    id: 'hearing',
    title: 'Hearing loop / amplified audio near mandap',
    description: 'Clear speaker feed of Sanskrit mantras and ceremonial vows',
    fullWidth: false,
  },
  {
    id: 'visual',
    title: 'Visual assistance & high-contrast signage',
    description: 'Legible dietary markers at live counters for low-vision guests',
    fullWidth: false,
  },
  {
    id: 'transit',
    title: 'Elderly mobility transit golf carts',
    description: 'Dedicated shuttle between parking gate and reception lawn',
    fullWidth: true,
  },
];

const DIETARY_CATEGORIES: {
  key: keyof DietBreakdown;
  label: string;
  subtitle: string;
  dotColor: string;
}[] = [
  {
    key: 'veg',
    label: 'Pure Veg',
    subtitle: 'Standard Indian vegetarian',
    dotColor: '#1E7A46',
  },
  {
    key: 'nonVeg',
    label: 'Non-Veg',
    subtitle: 'Halal / separate grill',
    dotColor: '#743C1D',
  },
  {
    key: 'jain',
    label: 'Jain',
    subtitle: 'No onion, garlic, roots',
    dotColor: '#F2A93B',
  },
  {
    key: 'eggetarian',
    label: 'Eggetarian',
    subtitle: 'Bakery & breakfast',
    dotColor: '#D97706',
  },
  {
    key: 'vegan',
    label: 'Vegan',
    subtitle: 'No dairy / zero ghee',
    dotColor: '#6E7979',
  },
];

export const GuestsTab: React.FC<GuestsTabProps> = ({
  plan,
  onSavePlan,
  onNavigateTab,
  onShowToast,
}) => {
  // Baseline initial total guests
  const initialTotal = plan.event.guestEstimate || plan.guests?.total || 250;

  // Local state for interactive editing
  const [totalGuests, setTotalGuests] = useState<number>(initialTotal);
  const [veg, setVeg] = useState<number>(plan.guests?.veg ?? 150);
  const [nonVeg, setNonVeg] = useState<number>(plan.guests?.nonVeg ?? 70);
  const [jain, setJain] = useState<number>(plan.guests?.jain ?? 20);
  const [eggetarian, setEggetarian] = useState<number>(plan.guests?.eggetarian ?? 10);
  const [vegan, setVegan] = useState<number>(plan.guests?.vegan ?? 0);

  const [allergyTags, setAllergyTags] = useState<string[]>(() => {
    if (plan.guests?.allergyTags && plan.guests.allergyTags.length > 0) {
      return [...plan.guests.allergyTags];
    }
    return ['Peanut', 'Lactose intolerant', 'Shellfish & seafood'];
  });

  const [accessibilityNeeds, setAccessibilityNeeds] = useState<string[]>(() => {
    if (plan.guests?.accessibilityNeeds && plan.guests.accessibilityNeeds.length > 0) {
      return [...plan.guests.accessibilityNeeds];
    }
    return ['ramps'];
  });

  const [allergyInput, setAllergyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if plan changes externally
  useEffect(() => {
    const est = plan.event.guestEstimate || plan.guests?.total || 250;
    setTotalGuests(est);
    setVeg(plan.guests?.veg ?? 150);
    setNonVeg(plan.guests?.nonVeg ?? 70);
    setJain(plan.guests?.jain ?? 20);
    setEggetarian(plan.guests?.eggetarian ?? 10);
    setVegan(plan.guests?.vegan ?? 0);
    if (plan.guests?.allergyTags && plan.guests.allergyTags.length > 0) {
      setAllergyTags([...plan.guests.allergyTags]);
    }
    if (plan.guests?.accessibilityNeeds && plan.guests.accessibilityNeeds.length > 0) {
      setAccessibilityNeeds([...plan.guests.accessibilityNeeds]);
    }
  }, [plan]);

  // Diet breakdown state object
  const breakdown: DietBreakdown = useMemo(
    () => ({
      veg,
      nonVeg,
      jain,
      eggetarian,
      vegan,
    }),
    [veg, nonVeg, jain, eggetarian, vegan],
  );

  // Validation
  const dietValidation = useMemo(
    () => validateDietaryCounts(totalGuests, breakdown),
    [totalGuests, breakdown],
  );

  // Dietary coverage check against saved menu ideas
  const coverageResult = useMemo(
    () => checkDietaryCoverage(breakdown, plan.ideas || []),
    [breakdown, plan.ideas],
  );

  // Shortlisted caterer rate details
  const catererInfo = useMemo(() => {
    // Look for catering vendor or per_plate quote
    const cateringQuote = plan.quotes.find((q) => q.unit === 'per_plate' || q.unit === 'per_guest');
    if (cateringQuote) {
      const vendor = plan.vendors.find((v) => v.id === cateringQuote.vendorId);
      const rate = Math.round(cateringQuote.amountPaise / 100);
      return {
        name: vendor ? `${vendor.name} shortlisted quote` : 'Shortlisted caterer quote',
        ratePerPlate: rate > 0 ? rate : 1900,
      };
    }

    const cateringVendor = plan.vendors.find(
      (v) =>
        v.categoryKey?.toLowerCase().includes('cater') || v.name?.toLowerCase().includes('cater'),
    );
    if (cateringVendor) {
      return {
        name: `${cateringVendor.name} shortlisted quote`,
        ratePerPlate: 1900,
      };
    }

    return {
      name: 'Saffron Table Caterers shortlisted quote',
      ratePerPlate: 1900,
    };
  }, [plan.quotes, plan.vendors]);

  // Check dirty state
  const isDirty = useMemo(() => {
    const origTotal = plan.event.guestEstimate || plan.guests?.total || 250;
    if (totalGuests !== origTotal) return true;
    if (veg !== (plan.guests?.veg ?? 150)) return true;
    if (nonVeg !== (plan.guests?.nonVeg ?? 70)) return true;
    if (jain !== (plan.guests?.jain ?? 20)) return true;
    if (eggetarian !== (plan.guests?.eggetarian ?? 10)) return true;
    if (vegan !== (plan.guests?.vegan ?? 0)) return true;

    const origAllergies = plan.guests?.allergyTags || [
      'Peanut',
      'Lactose intolerant',
      'Shellfish & seafood',
    ];
    if (allergyTags.length !== origAllergies.length) return true;
    if (allergyTags.some((tag, idx) => tag !== origAllergies[idx])) return true;

    const origAccess = plan.guests?.accessibilityNeeds || ['ramps'];
    if (accessibilityNeeds.length !== origAccess.length) return true;
    if (accessibilityNeeds.some((acc, idx) => acc !== origAccess[idx])) return true;

    return false;
  }, [totalGuests, veg, nonVeg, jain, eggetarian, vegan, allergyTags, accessibilityNeeds, plan]);

  // Stepper handlers
  const handleDietChange = (key: keyof DietBreakdown, delta: number) => {
    switch (key) {
      case 'veg':
        setVeg((prev) => Math.max(0, prev + delta));
        break;
      case 'nonVeg':
        setNonVeg((prev) => Math.max(0, prev + delta));
        break;
      case 'jain':
        setJain((prev) => Math.max(0, prev + delta));
        break;
      case 'eggetarian':
        setEggetarian((prev) => Math.max(0, prev + delta));
        break;
      case 'vegan':
        setVegan((prev) => Math.max(0, prev + delta));
        break;
    }
  };

  const handleTotalGuestsChange = (val: number) => {
    setTotalGuests(Math.max(0, val));
  };

  // Allergy handlers
  const handleAddAllergy = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = allergyInput.trim();
    if (!trimmed) return;
    if (allergyTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      onShowToast(`Allergy "${trimmed}" is already tagged.`);
      setAllergyInput('');
      return;
    }
    setAllergyTags((prev) => [...prev, trimmed]);
    setAllergyInput('');
  };

  const handleRemoveAllergy = (tagToRemove: string) => {
    setAllergyTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Accessibility toggle
  const handleToggleAccessibility = (id: string) => {
    setAccessibilityNeeds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedPlan: Plan = {
        ...plan,
        event: {
          ...plan.event,
          guestEstimate: totalGuests,
        },
        guests: {
          total: totalGuests,
          veg,
          nonVeg,
          jain,
          eggetarian,
          vegan,
          allergyTags,
          accessibilityNeeds,
        },
      };

      await onSavePlan(updatedPlan);
      onShowToast('Saved guest headcount and dietary details');
    } catch {
      onShowToast('Failed to save guest details. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    const est = plan.event.guestEstimate || plan.guests?.total || 250;
    setTotalGuests(est);
    setVeg(plan.guests?.veg ?? 150);
    setNonVeg(plan.guests?.nonVeg ?? 70);
    setJain(plan.guests?.jain ?? 20);
    setEggetarian(plan.guests?.eggetarian ?? 10);
    setVegan(plan.guests?.vegan ?? 0);
    setAllergyTags(
      plan.guests?.allergyTags?.length
        ? [...plan.guests.allergyTags]
        : ['Peanut', 'Lactose intolerant', 'Shellfish & seafood'],
    );
    setAccessibilityNeeds(
      plan.guests?.accessibilityNeeds?.length ? [...plan.guests.accessibilityNeeds] : ['ramps'],
    );
    onShowToast('Discarded unsaved guest changes');
  };

  // Export CSV
  const handleExportCsv = () => {
    // Generate brief with current view state
    const currentPlanView: Plan = {
      ...plan,
      event: {
        ...plan.event,
        guestEstimate: totalGuests,
      },
      guests: {
        total: totalGuests,
        veg,
        nonVeg,
        jain,
        eggetarian,
        vegan,
        allergyTags,
        accessibilityNeeds,
      },
    };

    const csvData = generateDietaryCsv(currentPlanView);
    const safeTitle = (plan.event.title || 'Toranly').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    downloadCsv(csvData, `${safeTitle}_Dietary_Requirements.csv`);
    onShowToast('Exported dietary breakdown CSV');
  };

  // AI Menu prompt action
  const handleAiSuggestIdeas = () => {
    onShowToast('Opening Ideas workspace with menu filters...');
    onNavigateTab('ideas');
  };

  // Menu coverage textual summary
  const coveredDescription = useMemo(() => {
    const menuIdeas = (plan.ideas || []).filter((i) => i.kind === 'menu');
    if (menuIdeas.length === 0) {
      return 'None yet (No menu ideas saved).';
    }
    return (
      menuIdeas
        .map((i) => i.title)
        .slice(0, 4)
        .join(', ') + (menuIdeas.length > 4 ? ` (+${menuIdeas.length - 4} more)` : '')
    );
  }, [plan.ideas]);

  const uncoveredSummary = useMemo(() => {
    const labels: string[] = [];
    if (coverageResult.uncoveredDiets.includes('jain') && jain > 0) {
      labels.push(`Jain (${jain} pax)`);
    }
    if (coverageResult.uncoveredDiets.includes('eggetarian') && eggetarian > 0) {
      labels.push(`Eggetarian (${eggetarian} pax)`);
    }
    if (coverageResult.uncoveredDiets.includes('vegan') && vegan > 0) {
      labels.push(`Vegan (${vegan} pax)`);
    }
    if (coverageResult.uncoveredDiets.includes('nonVeg') && nonVeg > 0) {
      labels.push(`Non-Veg (${nonVeg} pax)`);
    }
    if (coverageResult.uncoveredDiets.includes('veg') && veg > 0) {
      labels.push(`Pure Veg (${veg} pax)`);
    }
    return labels.join(' or ');
  }, [coverageResult, jain, eggetarian, vegan, nonVeg, veg]);

  const uncoveredSummaryShort = useMemo(() => {
    const names = coverageResult.uncoveredDiets
      .map((k) => {
        const found = DIETARY_CATEGORIES.find((c) => c.key === k);
        return found ? found.label : k;
      })
      .slice(0, 2);
    return names.join(' & ');
  }, [coverageResult]);

  return (
    <div className="guests-tab-container">
      {/* 1. Page Header */}
      <header className="guests-header">
        <div>
          <h1 className="guests-title">Guests and food</h1>
          <p className="guests-desc">
            Manage guest headcount, dietary preferences, catering quantities, and accessibility
            requirements for your event.
          </p>
        </div>
        <div className="guests-header-actions">
          <button
            type="button"
            className="guests-secondary-btn"
            onClick={handleExportCsv}
            aria-label="Export dietary breakdown CSV"
          >
            <Download size={18} />
            <span>Export dietary breakdown</span>
          </button>
          <button
            type="button"
            className="guests-primary-btn"
            onClick={handleSave}
            disabled={isSaving}
            aria-label="Save guest details"
          >
            <Check size={18} />
            <span>{isSaving ? 'Saving...' : 'Save guest details'}</span>
          </button>
        </div>
      </header>

      {/* Main Stack of Cards */}
      <div className="guests-card-stack">
        {/* 2. Headcount Baseline */}
        <section className="guests-card" aria-labelledby="headcount-heading">
          <div className="guests-card-header">
            <div>
              <h2 id="headcount-heading" className="guests-card-title">
                Headcount baseline
              </h2>
              <p className="guests-card-subtitle">
                Master attendance baseline synced across venue layout and banquet packages.
              </p>
            </div>
            {/* Live Progress Check Pill */}
            <div
              className={`guests-pill ${
                dietValidation.valid
                  ? 'guests-pill--valid'
                  : dietValidation.difference > 0
                    ? 'guests-pill--error'
                    : 'guests-pill--warning'
              }`}
            >
              {dietValidation.valid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>
                {dietValidation.sum} of {totalGuests} guests assigned
              </span>
            </div>
          </div>

          <div className="guests-headcount-body">
            <div className="guests-headcount-field">
              <label htmlFor="total-guests-input" className="guests-field-label">
                Total expected guests
              </label>
              <div className="guests-headcount-input-wrap">
                <button
                  type="button"
                  className="guests-stepper-btn"
                  onClick={() => handleTotalGuestsChange(totalGuests - 10)}
                  disabled={totalGuests <= 0}
                  aria-label="Decrease total expected guests by 10"
                >
                  <Minus size={16} />
                </button>
                <div className="guests-input-with-pax">
                  <input
                    id="total-guests-input"
                    type="number"
                    min={0}
                    value={totalGuests}
                    onChange={(e) => handleTotalGuestsChange(parseInt(e.target.value, 10) || 0)}
                    className="guests-number-input"
                  />
                  <span className="guests-input-suffix">pax</span>
                </div>
                <button
                  type="button"
                  className="guests-stepper-btn"
                  onClick={() => handleTotalGuestsChange(totalGuests + 10)}
                  aria-label="Increase total expected guests by 10"
                >
                  <Plus size={16} />
                </button>
              </div>
              <p className="guests-field-hint">
                Baseline count used for caterer quote comparison &amp; venue seating capacity.
              </p>
            </div>

            {/* Caterer Linked Estimate Notice */}
            <div className="guests-caterer-card">
              <div className="guests-caterer-left">
                <div className="guests-caterer-icon-wrap">
                  <UtensilsCrossed size={20} />
                </div>
                <div className="guests-caterer-info">
                  <span className="guests-caterer-title">{catererInfo.name}</span>
                  <span className="guests-caterer-calc">
                    ₹{catererInfo.ratePerPlate.toLocaleString('en-IN')} / plate × {totalGuests} pax
                    ={' '}
                    <strong>
                      ₹{(catererInfo.ratePerPlate * totalGuests).toLocaleString('en-IN')}
                    </strong>
                  </span>
                </div>
              </div>
              <span className="guests-verified-badge">
                <Info size={14} />
                <span>Verified rate</span>
              </span>
            </div>
          </div>
        </section>

        {/* 3. Dietary Breakdown Steppers */}
        <section className="diet-section" aria-labelledby="dietary-heading">
          <div className="guests-card-header-clean">
            <h2 id="dietary-heading" className="guests-card-title">
              Dietary breakdown
            </h2>
            <p className="guests-card-subtitle">
              Catering contracts require precise counts for live counters, halwai stalls, and
              separate preparation kitchens.
            </p>
          </div>

          {/* 5 Cards */}
          <div className="diet-grid">
            {DIETARY_CATEGORIES.map((cat) => {
              const count = breakdown[cat.key];
              const pct = totalGuests > 0 ? Math.round((count / totalGuests) * 100) : 0;

              return (
                <article key={cat.key} className="diet-card">
                  <div className="diet-card-top">
                    <div className="diet-card-title-row">
                      <span className="diet-card-name">{cat.label}</span>
                      <span
                        className="diet-card-dot"
                        style={{ backgroundColor: cat.dotColor }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="diet-card-sub">{cat.subtitle}</span>
                  </div>
                  <div className="diet-card-bottom">
                    <div className="diet-stepper-box">
                      <button
                        type="button"
                        className="diet-step-btn"
                        onClick={() => handleDietChange(cat.key, -5)}
                        disabled={count <= 0}
                        aria-label={`Decrease ${cat.label} count`}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="diet-step-val">{count}</span>
                      <button
                        type="button"
                        className="diet-step-btn"
                        onClick={() => handleDietChange(cat.key, 5)}
                        aria-label={`Increase ${cat.label} count`}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <span className="diet-pct-label">{pct}% of total</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Dynamic Status Check Strip Banner */}
          <div
            className={`diet-status-strip ${
              dietValidation.valid
                ? 'diet-status-strip--valid'
                : dietValidation.difference > 0
                  ? 'diet-status-strip--error'
                  : 'diet-status-strip--warning'
            }`}
          >
            <div className="diet-status-strip-left">
              {dietValidation.valid ? (
                <CheckCircle2 size={20} className="shrink-0" />
              ) : dietValidation.difference > 0 ? (
                <AlertCircle size={20} className="shrink-0" />
              ) : (
                <AlertTriangle size={20} className="shrink-0" />
              )}
              <p className="diet-status-strip-text">
                {dietValidation.valid ? (
                  <>
                    Diet counts match:{' '}
                    <strong>
                      {dietValidation.sum} of {totalGuests}
                    </strong>{' '}
                    guests accounted for across all catering categories.
                  </>
                ) : dietValidation.difference > 0 ? (
                  <>
                    Over-allocated: <strong>{dietValidation.sum} guests assigned</strong> for{' '}
                    {totalGuests} expected guests (+{dietValidation.difference} extra).
                  </>
                ) : (
                  <>
                    Under-allocated:{' '}
                    <strong>
                      {dietValidation.sum} of {totalGuests}
                    </strong>{' '}
                    guests assigned ({Math.abs(dietValidation.difference)} unassigned).
                  </>
                )}
              </p>
            </div>
            <span className="diet-status-strip-badge">
              {dietValidation.valid
                ? 'Balanced'
                : dietValidation.difference > 0
                  ? `Over by +${dietValidation.difference}`
                  : `Mismatch (${dietValidation.difference})`}
            </span>
          </div>
        </section>

        {/* 4. Allergies & Food Sensitivities */}
        <section className="guests-card" aria-labelledby="allergies-heading">
          <div className="guests-card-header-clean">
            <h2 id="allergies-heading" className="guests-card-title">
              Allergies &amp; food sensitivities
            </h2>
            <p className="guests-card-subtitle">
              Tag specific allergies to include on head chef briefing sheets and live counter
              allergen cards.
            </p>
          </div>

          <div className="allergies-container">
            {allergyTags.length > 0 ? (
              <div className="allergy-chips-list" role="list" aria-label="Allergy tags">
                {allergyTags.map((tag) => (
                  <span key={tag} className="allergy-chip" role="listitem">
                    <span>{tag}</span>
                    <button
                      type="button"
                      className="allergy-remove-btn"
                      onClick={() => handleRemoveAllergy(tag)}
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="allergy-empty-hint">
                No allergy tags added yet. Add common allergies below.
              </p>
            )}

            <form onSubmit={handleAddAllergy} className="allergy-add-form">
              <input
                type="text"
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAllergy();
                  }
                }}
                placeholder="Add allergy tag (e.g., Gluten-free, Sesame)..."
                className="allergy-text-input"
                aria-label="New allergy tag"
              />
              <button
                type="button"
                onClick={() => handleAddAllergy()}
                className="allergy-add-btn"
                disabled={!allergyInput.trim()}
              >
                <Plus size={16} />
                <span>Add tag</span>
              </button>
            </form>
          </div>
        </section>

        {/* 5. Accessibility Needs */}
        <section className="guests-card" aria-labelledby="accessibility-heading">
          <div className="guests-card-header-clean">
            <h2 id="accessibility-heading" className="guests-card-title">
              Accessibility &amp; physical support needs
            </h2>
            <p className="guests-card-subtitle">
              Ensures venue ramps, mandap seating, and elderly transit golf carts are arranged in
              coordination with hospitality staff.
            </p>
          </div>

          <div className="accessibility-grid">
            {ACCESSIBILITY_OPTIONS.map((opt) => {
              const isChecked = accessibilityNeeds.includes(opt.id);

              return (
                <label
                  key={opt.id}
                  className={`accessibility-option-card ${
                    opt.fullWidth ? 'accessibility-card--full' : ''
                  } ${isChecked ? 'accessibility-card--checked' : ''}`}
                >
                  <div className="custom-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleAccessibility(opt.id)}
                      className="toranly-custom-checkbox-input"
                      aria-label={opt.title}
                    />
                    <div
                      className={`toranly-custom-checkbox-box ${isChecked ? 'checked' : ''}`}
                      aria-hidden="true"
                    >
                      {isChecked && (
                        <Check size={12} strokeWidth={3} className="toranly-checkbox-check" />
                      )}
                    </div>
                  </div>
                  <div className="accessibility-text-col">
                    <span className="accessibility-title">{opt.title}</span>
                    <span className="accessibility-desc">{opt.description}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* 6. Menu Coverage Check */}
        <section className="guests-coverage-panel" aria-labelledby="ai-coverage-heading">
          <div className="guests-coverage-header">
            <div className="guests-coverage-title-row">
              <Sparkles size={20} className="guests-coverage-icon" />
              <h3 id="ai-coverage-heading" className="guests-coverage-title">
                Menu coverage check against saved Ideas
              </h3>
            </div>
            <span className="guests-coverage-sync-badge">Ideas Workspace Sync</span>
          </div>

          <div className="guests-coverage-body">
            <p className="guests-coverage-covered">
              <strong>Menu ideas currently cover:</strong> {coveredDescription}
            </p>

            {uncoveredSummary ? (
              <div className="guests-coverage-warning">
                <AlertTriangle size={18} className="shrink-0" />
                <span>
                  <strong>Missing coverage:</strong> No dedicated {uncoveredSummary} main dish ideas
                  saved in your Ideas workspace.
                </span>
              </div>
            ) : (
              <div className="guests-coverage-complete">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>
                  <strong>Complete coverage:</strong> All dietary categories in your guest list have
                  corresponding ideas saved.
                </span>
              </div>
            )}
          </div>

          <div className="guests-coverage-actions">
            <button type="button" className="guests-secondary-btn" onClick={handleAiSuggestIdeas}>
              <Sparkles size={16} />
              <span>
                Get menu ideas with AI {uncoveredSummaryShort ? `(${uncoveredSummaryShort})` : ''}
              </span>
            </button>
            <button
              type="button"
              className="guests-text-link-btn"
              onClick={() => onNavigateTab('ideas')}
            >
              <span>View saved ideas in Ideas workspace</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </section>

        {/* 7. Bottom Save Bar */}
        <footer className="guests-save-bar" aria-label="Save changes bar">
          <div className="guests-save-status">
            <History size={16} />
            <span>
              {isDirty
                ? 'Unsaved changes pending: Headcount or dietary preferences modified'
                : 'All changes saved (synced with event plan)'}
            </span>
          </div>
          <div className="guests-save-actions">
            <button
              type="button"
              className="guests-discard-btn"
              onClick={handleDiscard}
              disabled={!isDirty}
            >
              Discard
            </button>
            <button
              type="button"
              className="guests-primary-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Check size={18} />
              <span>{isSaving ? 'Saving...' : 'Save guest details'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
