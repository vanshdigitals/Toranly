import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Calendar,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
} from 'lucide-react';
import { ToranlyLogomark } from '../components/ToranlyLogomark';
import { EVENT_CATEGORIES, resolveCategoryId, getCategoryById } from '../types/wizard';
import type { EventCategory, EventFunction, WizardData } from '../types/wizard';
import {
  getWizardDraft,
  saveWizardDraft,
  formatINR,
  createInitialWizardData,
} from '../lib/eventState';
import { savePlan, listPlans } from '../storage/db';
import { applyServerTemplate, generatePlanFromTemplate } from '../domain/templates';
import { fetchPlanTemplate, LIVE_CHECK_UNAVAILABLE } from '../api/plan';
import { InMemoryBanner } from '../components/InMemoryBanner';
import './EventWizardPage.css';

interface EventWizardPageProps {
  initialStep?: number;
}

const DRAFT_SAVE_DELAY_MS = 500;

export const EventWizardPage: React.FC<EventWizardPageProps> = ({ initialStep }) => {
  const navigate = useNavigate();
  const { eventId: urlEventId } = useParams<{ eventId?: string }>();
  const [searchParams] = useSearchParams();

  // Determine current step (1 to 4)
  const stepParam = searchParams.get('step');
  const typeParam = searchParams.get('type');

  const currentStep = useMemo(() => {
    if (initialStep) return initialStep;
    if (stepParam) {
      const parsed = parseInt(stepParam, 10);
      if (parsed >= 1 && parsed <= 4) return parsed;
    }
    return 1;
  }, [initialStep, stepParam]);

  // Load wizard data: visiting /events/new at step 1 starts fresh
  const [wizardData, setWizardData] = useState<WizardData>(() => {
    if (!urlEventId && (!stepParam || stepParam === '1')) {
      return createInitialWizardData(typeParam);
    }
    return getWizardDraft(typeParam);
  });

  // Track live saved plans count on this device for the quiet hint
  const [savedPlansCount, setSavedPlansCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    async function loadSavedPlansCount() {
      try {
        const plans = await listPlans();
        if (active) {
          setSavedPlansCount(plans.length);
        }
      } catch (err) {
        console.warn('Error fetching saved plans count:', err);
      }
    }
    loadSavedPlansCount();
    return () => {
      active = false;
    };
  }, []);

  // Sync draft if URL type parameter changes on step 1
  useEffect(() => {
    if (typeParam && currentStep === 1) {
      const resolved = resolveCategoryId(typeParam);
      if (wizardData.categoryId !== resolved) {
        const cat = getCategoryById(resolved);
        const updated = saveWizardDraft({
          categoryId: cat.id,
          categoryName: cat.name,
          canonicalType: cat.canonicalType,
        });
        setWizardData(updated);
      }
    }
  }, [typeParam, currentStep, wizardData.categoryId]);

  // Form field error states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Modal states
  const [showExitModal, setShowExitModal] = useState(false);
  const [showFunctionModal, setShowFunctionModal] = useState(false);
  const [editingFunction, setEditingFunction] = useState<EventFunction | null>(null);
  const [functionFormData, setFunctionFormData] = useState<{
    name: string;
    date: string;
    startTime: string;
    endTime: string;
  }>({
    name: '',
    date: '',
    startTime: '',
    endTime: '',
  });

  // Step 3 dietary collapsible state
  const [isDietaryExpanded, setIsDietaryExpanded] = useState(false);

  // Step 4 custom chip inputs
  const [customThemeInput, setCustomThemeInput] = useState('');
  const [customAvoidColorInput, setCustomAvoidColorInput] = useState('');
  const [customCustomsInput, setCustomCustomsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unique IDs for accessibility
  const eventNameInputId = useId();
  const eventDateInputId = useId();
  const cityInputId = useId();
  const budgetInputId = useId();
  const guestsInputId = useId();
  const notesInputId = useId();

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFieldErrors({});
  }, [currentStep]);

  // Save changes helper
  // The screen updates on every keystroke; the draft is written to this device at most
  // every DRAFT_SAVE_DELAY_MS and flushed when the wizard closes or the page is left.
  const latestDraft = useRef(wizardData);
  const pendingSave = useRef<number | null>(null);
  useEffect(() => {
    latestDraft.current = wizardData;
  }, [wizardData]);
  const flushDraft = () => {
    if (pendingSave.current === null) return;
    window.clearTimeout(pendingSave.current);
    pendingSave.current = null;
    saveWizardDraft(latestDraft.current);
  };
  useEffect(() => {
    window.addEventListener('pagehide', flushDraft);
    return () => {
      window.removeEventListener('pagehide', flushDraft);
      flushDraft();
    };
  }, []);

  const updateData = (updates: Partial<WizardData>) => {
    const next: WizardData = {
      ...latestDraft.current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    latestDraft.current = next;
    setWizardData(next);
    if (pendingSave.current !== null) window.clearTimeout(pendingSave.current);
    pendingSave.current = window.setTimeout(() => {
      pendingSave.current = null;
      saveWizardDraft(next);
    }, DRAFT_SAVE_DELAY_MS);
    return next;
  };

  // Step navigation helper
  const goToStep = (stepNumber: number) => {
    const id = urlEventId || wizardData.eventId;
    updateData({ step: stepNumber });
    if (stepNumber === 1) {
      navigate(`/events/new`);
    } else {
      navigate(`/events/${id}/setup?step=${stepNumber}`);
    }
  };

  // -------------------------------------------------------------
  // STEP 1 HANDLERS (Celebration Type & Name)
  // -------------------------------------------------------------
  const handleSelectCategory = (cat: EventCategory) => {
    setFieldErrors((prev) => ({ ...prev, category: '' }));

    const isCurrentNameDefault = EVENT_CATEGORIES.some(
      (c) => c.defaultPlaceholder === wizardData.eventName,
    );

    // Never put example text into the visitor's own plan; drafts saved by older versions may
    // still hold a category's example name, which is cleared here.
    const nextName = isCurrentNameDefault ? '' : wizardData.eventName;

    updateData({
      categoryId: cat.id,
      categoryName: cat.name,
      canonicalType: cat.canonicalType,
      eventName: nextName,
    });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 50);
    setFieldErrors((prev) => ({ ...prev, eventName: '' }));
    updateData({ eventName: val });
  };

  // -------------------------------------------------------------
  // STEP 2 HANDLERS (Event Details & Functions)
  // -------------------------------------------------------------
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFieldErrors((prev) => ({ ...prev, eventDate: '' }));
    updateData({ eventDate: val });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 80);
    updateData({ city: val });
  };

  const openAddFunctionModal = () => {
    setEditingFunction(null);
    setFunctionFormData({
      name: '',
      date: wizardData.eventDate || new Date().toISOString().split('T')[0],
      startTime: '18:00',
      endTime: '22:00',
    });
    setShowFunctionModal(true);
  };

  const openEditFunctionModal = (fn: EventFunction) => {
    setEditingFunction(fn);
    setFunctionFormData({
      name: fn.name,
      date: fn.date,
      startTime: fn.startTime || '',
      endTime: fn.endTime || '',
    });
    setShowFunctionModal(true);
  };

  const handleDeleteFunction = (fnId: string) => {
    const updated = wizardData.functions.filter((f) => f.id !== fnId);
    updateData({ functions: updated });
  };

  const handleSaveFunction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!functionFormData.name.trim()) return;

    if (
      functionFormData.startTime &&
      functionFormData.endTime &&
      functionFormData.endTime <= functionFormData.startTime
    ) {
      alert('End time must be later than start time.');
      return;
    }

    let updatedFunctions: EventFunction[];
    if (editingFunction) {
      updatedFunctions = wizardData.functions.map((f) =>
        f.id === editingFunction.id
          ? {
              ...f,
              name: functionFormData.name.trim(),
              date: functionFormData.date,
              startTime: functionFormData.startTime || undefined,
              endTime: functionFormData.endTime || undefined,
            }
          : f,
      );
    } else {
      const newFn: EventFunction = {
        id: `fn-${Date.now().toString(36)}`,
        name: functionFormData.name.trim(),
        date: functionFormData.date,
        startTime: functionFormData.startTime || undefined,
        endTime: functionFormData.endTime || undefined,
        position: wizardData.functions.length + 1,
      };
      updatedFunctions = [...wizardData.functions, newFn];
    }

    updateData({ functions: updatedFunctions });
    setShowFunctionModal(false);
  };

  // -------------------------------------------------------------
  // STEP 3 HANDLERS (Budget & Guests)
  // -------------------------------------------------------------
  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const budgetVal = isNaN(val) ? 0 : Math.max(0, Math.min(999999999, val));
    setFieldErrors((prev) => ({ ...prev, budget: '' }));
    updateData({ budgetTotal: budgetVal });
  };

  const handleGuestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const guestsVal = isNaN(val) ? 1 : Math.max(1, Math.min(10000, val));
    setFieldErrors((prev) => ({ ...prev, guests: '', diet: '' }));
    updateData({ guestEstimate: guestsVal });
  };

  const handleDietAdjust = (field: keyof typeof wizardData.dietBreakdown, delta: number) => {
    const currentVal = wizardData.dietBreakdown[field] || 0;
    const nextVal = Math.max(0, currentVal + delta);
    const updated = {
      ...wizardData.dietBreakdown,
      [field]: nextVal,
    };
    setFieldErrors((prev) => ({ ...prev, diet: '' }));
    updateData({ dietBreakdown: updated });
  };

  const handleDietDirectInput = (field: keyof typeof wizardData.dietBreakdown, valStr: string) => {
    const val = parseInt(valStr, 10);
    const nextVal = isNaN(val) ? 0 : Math.max(0, val);
    const updated = {
      ...wizardData.dietBreakdown,
      [field]: nextVal,
    };
    setFieldErrors((prev) => ({ ...prev, diet: '' }));
    updateData({ dietBreakdown: updated });
  };

  // Diet total count
  const dietSum = useMemo(() => {
    const { veg, jain, nonVeg, eggetarian, vegan } = wizardData.dietBreakdown;
    return (veg || 0) + (jain || 0) + (nonVeg || 0) + (eggetarian || 0) + (vegan || 0);
  }, [wizardData.dietBreakdown]);

  // -------------------------------------------------------------
  // STEP 4 HANDLERS (Preferences & Finalize)
  // -------------------------------------------------------------
  const handleAddThemeWord = (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    if (wizardData.preferences.themeWords.length >= 5) {
      alert('You can select up to 5 theme words.');
      return;
    }
    if (!wizardData.preferences.themeWords.includes(trimmed)) {
      updateData({
        preferences: {
          ...wizardData.preferences,
          themeWords: [...wizardData.preferences.themeWords, trimmed],
        },
      });
    }
    setCustomThemeInput('');
  };

  const handleRemoveThemeWord = (word: string) => {
    updateData({
      preferences: {
        ...wizardData.preferences,
        themeWords: wizardData.preferences.themeWords.filter((w) => w !== word),
      },
    });
  };

  const handleAddAvoidColor = (color: string) => {
    const trimmed = color.trim().toLowerCase();
    if (!trimmed) return;
    if (!wizardData.preferences.avoidColours.includes(trimmed)) {
      updateData({
        preferences: {
          ...wizardData.preferences,
          avoidColours: [...wizardData.preferences.avoidColours, trimmed],
        },
      });
    }
    setCustomAvoidColorInput('');
  };

  const handleRemoveAvoidColor = (color: string) => {
    updateData({
      preferences: {
        ...wizardData.preferences,
        avoidColours: wizardData.preferences.avoidColours.filter((c) => c !== color),
      },
    });
  };

  const handleAddCustom = (custom: string) => {
    const trimmed = custom.trim().toLowerCase();
    if (!trimmed) return;
    if (!wizardData.preferences.customs.includes(trimmed)) {
      updateData({
        preferences: {
          ...wizardData.preferences,
          customs: [...wizardData.preferences.customs, trimmed],
        },
      });
    }
    setCustomCustomsInput('');
  };

  const handleRemoveCustom = (custom: string) => {
    updateData({
      preferences: {
        ...wizardData.preferences,
        customs: wizardData.preferences.customs.filter((c) => c !== custom),
      },
    });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, 500);
    updateData({
      preferences: {
        ...wizardData.preferences,
        notes: val,
      },
    });
  };

  // -------------------------------------------------------------
  // VALIDATION & NEXT STEP
  // -------------------------------------------------------------
  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!wizardData.categoryId) {
        errors.category = 'Please choose a celebration type to continue.';
      }
      if (!wizardData.eventName || wizardData.eventName.trim().length === 0) {
        errors.eventName = 'Please give your celebration a name.';
      }
    } else if (currentStep === 2) {
      if (!wizardData.eventDate) {
        errors.eventDate = 'Please specify the celebration date.';
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const chosen = new Date(wizardData.eventDate);
        chosen.setHours(0, 0, 0, 0);
        if (chosen < today) {
          errors.eventDate = "Dates before today aren't allowed.";
        }
      }
    } else if (currentStep === 3) {
      if (!wizardData.budgetTotal || wizardData.budgetTotal <= 0) {
        errors.budget = 'Please enter an estimated budget above ₹0.';
      }
      if (!wizardData.guestEstimate || wizardData.guestEstimate < 1) {
        errors.guests = 'Please enter an expected guest count of at least 1.';
      }
      if (dietSum > wizardData.guestEstimate) {
        errors.diet = `Dietary count (${dietSum}) cannot exceed total guests (${wizardData.guestEstimate}).`;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCurrentStep()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentStep === 1) {
      // Completed step 1: create the plan in IndexedDB
      try {
        const initialPlan = generatePlanFromTemplate({
          id: wizardData.eventId,
          type: wizardData.canonicalType,
          title: wizardData.eventName,
          eventDate: wizardData.eventDate,
          city: wizardData.city,
          guestEstimate: wizardData.guestEstimate,
          budgetTotalPaise:
            wizardData.budgetTotal > 0 ? Math.round(wizardData.budgetTotal * 100) : undefined,
          preferences: wizardData.preferences,
          dietBreakdown: wizardData.dietBreakdown,
        });
        await savePlan(initialPlan);
      } catch (err) {
        console.warn('Error saving plan upon completing step 1:', err);
      }
    }

    if (currentStep < 4) {
      goToStep(currentStep + 1);
    } else {
      // Finalize setup
      handleFinishSetup();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    } else {
      navigate('/');
    }
  };

  const handleFinishSetup = async () => {
    setIsSubmitting(true);
    try {
      let planDoc = generatePlanFromTemplate({
        id: wizardData.eventId,
        type: wizardData.canonicalType,
        title: wizardData.eventName,
        eventDate: wizardData.eventDate,
        city: wizardData.city,
        guestEstimate: wizardData.guestEstimate,
        budgetTotalPaise:
          wizardData.budgetTotal > 0 ? Math.round(wizardData.budgetTotal * 100) : undefined,
        preferences: wizardData.preferences,
        dietBreakdown: wizardData.dietBreakdown,
      });

      if (wizardData.functions && wizardData.functions.length > 0) {
        planDoc.functions = wizardData.functions.map((f, i) => ({
          id: f.id,
          name: f.name,
          date: f.date,
          startTime: f.startTime,
          endTime: f.endTime,
          position: i + 1,
        }));
      }

      // The budget split and starter tasks come from the backend; the browser template above
      // is the offline fallback.
      let notice: string | undefined;
      try {
        const tpl = await fetchPlanTemplate({
          type: planDoc.event.type,
          budgetTotalPaise: planDoc.event.budgetTotalPaise,
          eventDate: planDoc.event.eventDate,
        });
        planDoc = applyServerTemplate(planDoc, tpl);
      } catch {
        notice = LIVE_CHECK_UNAVAILABLE;
      }

      await savePlan(planDoc);
      setIsSubmitting(false);
      navigate(`/events/${planDoc.id}`, notice ? { state: { notice } } : undefined);
    } catch (err) {
      console.warn('Error saving plan to storage', err);
      setIsSubmitting(false);
      navigate(`/events/${wizardData.eventId}`);
    }
  };

  const handleSaveAndExit = async () => {
    saveWizardDraft(wizardData);
    if (wizardData.categoryId && wizardData.eventName) {
      try {
        const planDoc = generatePlanFromTemplate({
          id: wizardData.eventId,
          type: wizardData.canonicalType,
          title: wizardData.eventName,
          eventDate: wizardData.eventDate,
          city: wizardData.city,
          guestEstimate: wizardData.guestEstimate,
          budgetTotalPaise:
            wizardData.budgetTotal > 0 ? Math.round(wizardData.budgetTotal * 100) : undefined,
          preferences: wizardData.preferences,
          dietBreakdown: wizardData.dietBreakdown,
        });
        await savePlan(planDoc);
      } catch (err) {
        console.warn('Error saving plan to storage on exit:', err);
      }
    }
    setShowExitModal(false);
    navigate('/events');
  };

  // Today min date string for HTML date input
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Suggested preset tags for Step 4
  const PRESET_THEMES = [
    'Marigold',
    'Royal Heritage',
    'Garden Floral',
    'Minimalist',
    'Pastel-free',
    'Boho Chic',
  ];
  const PRESET_AVOID = ['Black', 'Neon', 'Bright Red', 'White'];
  const PRESET_CUSTOMS = [
    'Sangeet',
    'Phoolon ki Chaadar',
    'Kanyadaan',
    'Haldi Shower',
    'Milni Ceremony',
  ];

  return (
    <div className="wizard-page">
      <InMemoryBanner />
      {/* 1. WIZARD HEADER */}
      <header className="wizard-header" role="banner">
        <div className="wizard-header-container">
          <div className="wizard-header-left">
            <Link to="/" className="wizard-logo-link" aria-label="Toranly Home">
              <ToranlyLogomark size={32} />
              <span className="wizard-brand-text">Toranly</span>
            </Link>
          </div>

          <div className="wizard-header-right">
            <button
              type="button"
              className="wizard-save-exit-btn"
              onClick={() => setShowExitModal(true)}
            >
              Save &amp; exit
            </button>
          </div>
        </div>
      </header>

      {/* 2. PROGRESS STEPPER */}
      <nav aria-label="Wizard progress" className="wizard-stepper-wrapper">
        <div className="wizard-stepper-container">
          <div className="wizard-stepper-header">
            <span className="wizard-stepper-count">Step {currentStep} of 4</span>
            <span className="wizard-stepper-percent">{currentStep * 25}% completed</span>
          </div>

          <div
            className="wizard-progress-bar"
            role="progressbar"
            aria-valuenow={currentStep * 25}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Wizard progress: ${currentStep * 25}%`}
          >
            <div className="wizard-progress-fill" style={{ width: `${currentStep * 25}%` }} />
          </div>

          {/* Stepper items */}
          <div className="wizard-steps-nav">
            {[
              { num: 1, label: 'Celebration' },
              { num: 2, label: 'Details' },
              { num: 3, label: 'Budget & guests' },
              { num: 4, label: 'Preferences' },
            ].map((step) => {
              const isCompleted = step.num < currentStep;
              const isActive = step.num === currentStep;

              if (isCompleted) {
                return (
                  <button
                    key={step.num}
                    type="button"
                    className="wizard-step-tab wizard-step-tab-completed"
                    onClick={() => goToStep(step.num)}
                    aria-label={`Jump back to step ${step.num}: ${step.label}`}
                  >
                    <span className="wizard-step-tab-icon">
                      <CheckCircle size={15} />
                    </span>
                    <span className="wizard-step-tab-label">{step.label}</span>
                  </button>
                );
              }

              return (
                <div
                  key={step.num}
                  className={`wizard-step-tab ${isActive ? 'wizard-step-tab-active' : 'wizard-step-tab-upcoming'}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="wizard-step-tab-number">{step.num}</span>
                  <span className="wizard-step-tab-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 3. MAIN WIZARD CONTENT */}
      <main id="main-content" className="wizard-main">
        <div className="wizard-form-container">
          {/* STEP 1: Celebration Type & Name */}
          {currentStep === 1 && (
            <div className="wizard-step-view">
              {savedPlansCount > 0 && (
                <div className="wizard-saved-plans-hint" role="status">
                  <span>
                    You have {savedPlansCount} saved {savedPlansCount === 1 ? 'plan' : 'plans'} on
                    this device.{' '}
                    <Link to="/events" className="wizard-saved-plans-link">
                      Open My plans
                    </Link>
                  </span>
                </div>
              )}

              <div className="wizard-intro-block">
                <span className="wizard-eyebrow">STEP 1 · CELEBRATION</span>
                <h1 className="wizard-title">What are you celebrating?</h1>
                <p className="wizard-subtitle">
                  Choose your celebration type to help us tailor your planning experience.
                </p>
              </div>

              {fieldErrors.category && (
                <div className="wizard-inline-error" role="alert">
                  <AlertCircle size={18} />
                  <span>{fieldErrors.category}</span>
                </div>
              )}

              {/* 9 Practical Categories Grid */}
              <div
                className="wizard-category-grid"
                role="radiogroup"
                aria-label="Celebration Categories"
              >
                {EVENT_CATEGORIES.map((cat) => {
                  const isSelected = wizardData.categoryId === cat.id;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`wizard-category-card ${isSelected ? 'wizard-category-card-selected' : ''}`}
                      onClick={() => handleSelectCategory(cat)}
                    >
                      <div className="wizard-card-icon-wrapper">
                        <Icon size={24} className="wizard-card-icon" />
                      </div>
                      <div className="wizard-card-info">
                        <span className="wizard-card-name">{cat.name}</span>
                        {cat.description && (
                          <span className="wizard-card-desc">{cat.description}</span>
                        )}
                      </div>
                      <div className="wizard-card-check" aria-hidden="true">
                        {isSelected && <Check size={16} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Event Name Input */}
              <div className="wizard-field-group">
                <div className="wizard-label-row">
                  <label htmlFor={eventNameInputId} className="wizard-input-label">
                    Celebration name <span className="wizard-required-star">*</span>
                  </label>
                  <span className="wizard-char-counter">{wizardData.eventName.length}/50</span>
                </div>
                <input
                  id={eventNameInputId}
                  type="text"
                  className={`wizard-text-input ${fieldErrors.eventName ? 'wizard-input-error' : ''}`}
                  value={wizardData.eventName}
                  onChange={handleNameChange}
                  maxLength={50}
                  placeholder="e.g. Ananya & Rohan's Wedding"
                  aria-describedby="event-name-helper"
                />
                <p id="event-name-helper" className="wizard-field-helper">
                  You can change this anytime later.
                </p>
                {fieldErrors.eventName && (
                  <p className="wizard-field-error-text">{fieldErrors.eventName}</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Event Details & Sub-Functions */}
          {currentStep === 2 && (
            <div className="wizard-step-view">
              <div className="wizard-intro-block">
                <span className="wizard-eyebrow">STEP 2 · DETAILS</span>
                <h1 className="wizard-title">When and where?</h1>
                <p className="wizard-subtitle">
                  Set the primary date and location for your celebration.
                </p>
              </div>

              {/* Event Date & Location Fields */}
              <div className="wizard-card-panel">
                <div className="wizard-field-group">
                  <label htmlFor={eventDateInputId} className="wizard-input-label">
                    Event date <span className="wizard-required-star">*</span>
                  </label>
                  <div className="wizard-input-with-icon">
                    <Calendar size={18} className="wizard-leading-icon" />
                    <input
                      id={eventDateInputId}
                      type="date"
                      min={todayStr}
                      className={`wizard-text-input wizard-input-pl ${fieldErrors.eventDate ? 'wizard-input-error' : ''}`}
                      value={wizardData.eventDate}
                      onChange={handleDateChange}
                      required
                    />
                  </div>
                  <p className="wizard-field-helper">Dates before today aren&apos;t allowed.</p>
                  {fieldErrors.eventDate && (
                    <p className="wizard-field-error-text">{fieldErrors.eventDate}</p>
                  )}
                </div>

                <div className="wizard-field-group">
                  <div className="wizard-label-row">
                    <label htmlFor={cityInputId} className="wizard-input-label">
                      City
                    </label>
                    <span className="wizard-optional-badge">Optional</span>
                  </div>
                  <div className="wizard-input-with-icon">
                    <MapPin size={18} className="wizard-leading-icon" />
                    <input
                      id={cityInputId}
                      type="text"
                      className="wizard-text-input wizard-input-pl"
                      value={wizardData.city}
                      onChange={handleCityChange}
                      placeholder="e.g. Jaipur, Udaipur, Delhi, Mumbai"
                      maxLength={80}
                    />
                  </div>
                  <p className="wizard-field-helper">
                    Used for local vendor estimates and regional weather context.
                  </p>
                </div>
              </div>

              {/* Sub-functions section */}
              <div className="wizard-card-panel">
                <div className="wizard-panel-header">
                  <div>
                    <div className="wizard-panel-title-row">
                      <h2 className="wizard-panel-title">Celebration functions</h2>
                      <span className="wizard-category-pill">{wizardData.categoryName}</span>
                    </div>
                    <p className="wizard-panel-desc">
                      Add separate functions like mehendi, sangeet, or reception.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="wizard-secondary-btn"
                    onClick={openAddFunctionModal}
                  >
                    <Plus size={16} />
                    <span>Add function</span>
                  </button>
                </div>

                {wizardData.functions.length === 0 ? (
                  <div className="wizard-empty-box">
                    <p>No separate functions added yet.</p>
                    <button
                      type="button"
                      className="wizard-link-btn"
                      onClick={openAddFunctionModal}
                    >
                      + Add your first function
                    </button>
                  </div>
                ) : (
                  <div className="wizard-function-list">
                    {wizardData.functions.map((fn) => (
                      <div key={fn.id} className="wizard-function-item">
                        <div className="wizard-fn-main">
                          <span className="wizard-fn-name">{fn.name}</span>
                          <div className="wizard-fn-meta">
                            <span>{fn.date}</span>
                            {fn.startTime && fn.endTime && (
                              <>
                                <span className="wizard-fn-dot">·</span>
                                <span>
                                  {fn.startTime} to {fn.endTime}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="wizard-fn-actions">
                          <button
                            type="button"
                            className="wizard-icon-action-btn"
                            onClick={() => openEditFunctionModal(fn)}
                            aria-label={`Edit ${fn.name}`}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="wizard-icon-action-btn wizard-icon-action-danger"
                            onClick={() => handleDeleteFunction(fn.id)}
                            aria-label={`Delete ${fn.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Budget & Guests */}
          {currentStep === 3 && (
            <div className="wizard-step-view">
              <div className="wizard-intro-block">
                <span className="wizard-eyebrow">STEP 3 · BUDGET &amp; GUESTS</span>
                <h1 className="wizard-title">Budget and guests</h1>
                <p className="wizard-subtitle">
                  Set your overall celebration budget and headcount to calibrate automatic category
                  allocation and catering projections.
                </p>
              </div>

              {/* Total Budget */}
              <div className="wizard-card-panel">
                <label htmlFor={budgetInputId} className="wizard-input-label">
                  Total budget <span className="wizard-required-star">*</span>
                </label>
                <div className="wizard-currency-input-wrapper">
                  <span className="wizard-currency-prefix">₹</span>
                  <input
                    id={budgetInputId}
                    type="number"
                    min={0}
                    max={999999999}
                    step={5000}
                    className={`wizard-currency-input ${fieldErrors.budget ? 'wizard-input-error' : ''}`}
                    value={wizardData.budgetTotal || ''}
                    onChange={handleBudgetChange}
                    placeholder="1800000"
                    required
                  />
                </div>
                <div className="wizard-budget-preview-row">
                  <span className="wizard-preview-label">Live Indian Grouping:</span>
                  <span className="wizard-preview-value">{formatINR(wizardData.budgetTotal)}</span>
                </div>
                <p className="wizard-field-helper">
                  Allowed range: ₹0 to ₹99,99,99,999. Toranly splits this deterministically across
                  venue, catering, decor, and photography upon setup completion.
                </p>
                {fieldErrors.budget && (
                  <p className="wizard-field-error-text">{fieldErrors.budget}</p>
                )}
              </div>

              {/* Expected Guests */}
              <div className="wizard-card-panel">
                <div className="wizard-label-row">
                  <label htmlFor={guestsInputId} className="wizard-input-label">
                    Expected guests <span className="wizard-required-star">*</span>
                  </label>
                  <span className="wizard-input-range-hint">1 – 10,000 attendees</span>
                </div>
                <input
                  id={guestsInputId}
                  type="number"
                  min={1}
                  max={10000}
                  className={`wizard-text-input ${fieldErrors.guests ? 'wizard-input-error' : ''}`}
                  value={wizardData.guestEstimate || ''}
                  onChange={handleGuestsChange}
                  placeholder="250"
                  required
                />
                <p className="wizard-field-helper">
                  Used to compute per-plate catering quotes and venue capacity recommendations.
                </p>
                {fieldErrors.guests && (
                  <p className="wizard-field-error-text">{fieldErrors.guests}</p>
                )}
              </div>

              {/* Collapsible Food Preferences & Dietary */}
              <div className="wizard-card-panel wizard-diet-panel">
                <button
                  type="button"
                  className="wizard-accordion-trigger"
                  onClick={() => setIsDietaryExpanded(!isDietaryExpanded)}
                  aria-expanded={isDietaryExpanded}
                >
                  <div className="wizard-accordion-title-block">
                    <div className="wizard-accordion-title-row">
                      <UtensilsCrossed size={18} className="wizard-accent-icon" />
                      <span className="wizard-accordion-title">
                        Add food preferences <span className="wizard-optional-badge">Optional</span>
                      </span>
                    </div>
                    <span className="wizard-accordion-subtitle">
                      Indian festive dietary distribution for menu planning and live counter split
                    </span>
                  </div>
                  {isDietaryExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {isDietaryExpanded && (
                  <div className="wizard-accordion-content">
                    <div className="wizard-diet-grid">
                      {/* Veg */}
                      <div className="wizard-diet-item">
                        <div className="wizard-diet-label-row">
                          <span className="wizard-veg-dot" aria-hidden="true">
                            ●
                          </span>
                          <span className="wizard-diet-label">Vegetarian</span>
                        </div>
                        <div className="wizard-stepper-control">
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('veg', -5)}
                            aria-label="Decrease vegetarian count"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="wizard-diet-number-input"
                            value={wizardData.dietBreakdown.veg}
                            onChange={(e) => handleDietDirectInput('veg', e.target.value)}
                          />
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('veg', 5)}
                            aria-label="Increase vegetarian count"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Jain */}
                      <div className="wizard-diet-item">
                        <div className="wizard-diet-label-row">
                          <span className="wizard-jain-dot" aria-hidden="true">
                            ●
                          </span>
                          <span className="wizard-diet-label">Jain (No Root Veg)</span>
                        </div>
                        <div className="wizard-stepper-control">
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('jain', -5)}
                            aria-label="Decrease Jain count"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="wizard-diet-number-input"
                            value={wizardData.dietBreakdown.jain}
                            onChange={(e) => handleDietDirectInput('jain', e.target.value)}
                          />
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('jain', 5)}
                            aria-label="Increase Jain count"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Non-veg */}
                      <div className="wizard-diet-item">
                        <div className="wizard-diet-label-row">
                          <span className="wizard-nonveg-dot" aria-hidden="true">
                            ●
                          </span>
                          <span className="wizard-diet-label">Non-vegetarian</span>
                        </div>
                        <div className="wizard-stepper-control">
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('nonVeg', -5)}
                            aria-label="Decrease non-vegetarian count"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="wizard-diet-number-input"
                            value={wizardData.dietBreakdown.nonVeg}
                            onChange={(e) => handleDietDirectInput('nonVeg', e.target.value)}
                          />
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('nonVeg', 5)}
                            aria-label="Increase non-vegetarian count"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Eggetarian */}
                      <div className="wizard-diet-item">
                        <div className="wizard-diet-label-row">
                          <span className="wizard-egg-dot" aria-hidden="true">
                            ●
                          </span>
                          <span className="wizard-diet-label">Eggetarian</span>
                        </div>
                        <div className="wizard-stepper-control">
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('eggetarian', -5)}
                            aria-label="Decrease eggetarian count"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="wizard-diet-number-input"
                            value={wizardData.dietBreakdown.eggetarian}
                            onChange={(e) => handleDietDirectInput('eggetarian', e.target.value)}
                          />
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('eggetarian', 5)}
                            aria-label="Increase eggetarian count"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Vegan */}
                      <div className="wizard-diet-item">
                        <div className="wizard-diet-label-row">
                          <span className="wizard-vegan-dot" aria-hidden="true">
                            ●
                          </span>
                          <span className="wizard-diet-label">Vegan</span>
                        </div>
                        <div className="wizard-stepper-control">
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('vegan', -5)}
                            aria-label="Decrease vegan count"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="wizard-diet-number-input"
                            value={wizardData.dietBreakdown.vegan}
                            onChange={(e) => handleDietDirectInput('vegan', e.target.value)}
                          />
                          <button
                            type="button"
                            className="wizard-step-btn"
                            onClick={() => handleDietAdjust('vegan', 5)}
                            aria-label="Increase vegan count"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="wizard-diet-summary-bar">
                      <span className="wizard-diet-sum-text">
                        Total dietary split: <strong>{dietSum}</strong> of{' '}
                        <strong>{wizardData.guestEstimate}</strong> guests
                      </span>
                      {dietSum > wizardData.guestEstimate && (
                        <span className="wizard-diet-error-pill">
                          Exceeds guest estimate by {dietSum - wizardData.guestEstimate}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {fieldErrors.diet && (
                  <p className="wizard-field-error-text wizard-p-space">{fieldErrors.diet}</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Preferences & Review / Finalize */}
          {currentStep === 4 && (
            <div className="wizard-step-view">
              <div className="wizard-intro-block">
                <span className="wizard-eyebrow">STEP 4 · PREFERENCES</span>
                <h1 className="wizard-title">Make it yours</h1>
                <p className="wizard-subtitle">
                  Fine-tune your celebration style and traditions. Only what you choose is used.
                </p>
              </div>

              {/* Theme Words */}
              <div className="wizard-card-panel">
                <div className="wizard-label-row">
                  <label className="wizard-input-label">Theme words</label>
                  <span className="wizard-char-counter">
                    {wizardData.preferences.themeWords.length} / 5 added
                  </span>
                </div>
                <p className="wizard-field-helper">
                  Up to 5 tags to guide decor, floral palettes, and visual tone.
                </p>

                <div className="wizard-chips-box">
                  {wizardData.preferences.themeWords.map((word) => (
                    <span key={word} className="wizard-tag-chip">
                      <span>{word}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveThemeWord(word)}
                        aria-label={`Remove theme word ${word}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>

                {wizardData.preferences.themeWords.length < 5 && (
                  <div className="wizard-add-tag-row">
                    <input
                      type="text"
                      className="wizard-tag-input"
                      placeholder="Type custom theme and press Add"
                      aria-label="Add a theme word"
                      value={customThemeInput}
                      onChange={(e) => setCustomThemeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddThemeWord(customThemeInput);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="wizard-secondary-btn wizard-tag-add-btn"
                      onClick={() => handleAddThemeWord(customThemeInput)}
                    >
                      Add
                    </button>
                  </div>
                )}

                <div className="wizard-presets-row">
                  <span className="wizard-presets-title">Suggestions:</span>
                  {PRESET_THEMES.filter(
                    (p) => !wizardData.preferences.themeWords.includes(p.toLowerCase()),
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="wizard-preset-pill"
                      onClick={() => handleAddThemeWord(preset)}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colours to Avoid */}
              <div className="wizard-card-panel">
                <div className="wizard-label-row">
                  <label className="wizard-input-label">Colours to avoid</label>
                  <span className="wizard-optional-badge">Optional</span>
                </div>
                <p className="wizard-field-helper">
                  Palettes or shades you want excluded from floral, decor, or attire ideas.
                </p>

                <div className="wizard-chips-box">
                  {wizardData.preferences.avoidColours.map((color) => (
                    <span key={color} className="wizard-tag-chip wizard-tag-chip-avoid">
                      <span>{color}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAvoidColor(color)}
                        aria-label={`Remove avoid colour ${color}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="wizard-add-tag-row">
                  <input
                    type="text"
                    className="wizard-tag-input"
                    placeholder="Type colour to avoid..."
                    aria-label="Add a colour to avoid"
                    value={customAvoidColorInput}
                    onChange={(e) => setCustomAvoidColorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAvoidColor(customAvoidColorInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="wizard-secondary-btn wizard-tag-add-btn"
                    onClick={() => handleAddAvoidColor(customAvoidColorInput)}
                  >
                    Add
                  </button>
                </div>

                <div className="wizard-presets-row">
                  <span className="wizard-presets-title">Common choices:</span>
                  {PRESET_AVOID.filter(
                    (p) => !wizardData.preferences.avoidColours.includes(p.toLowerCase()),
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="wizard-preset-pill"
                      onClick={() => handleAddAvoidColor(preset)}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customs to Include */}
              <div className="wizard-card-panel">
                <div className="wizard-label-row">
                  <label className="wizard-input-label">Customs &amp; traditions</label>
                  <span className="wizard-optional-badge">Optional</span>
                </div>
                <p className="wizard-field-helper">
                  Only what you choose is used. Toranly never assumes traditions based on names.
                </p>

                <div className="wizard-chips-box">
                  {wizardData.preferences.customs.map((custom) => (
                    <span key={custom} className="wizard-tag-chip wizard-tag-chip-custom">
                      <span>{custom}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustom(custom)}
                        aria-label={`Remove custom ${custom}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="wizard-add-tag-row">
                  <input
                    type="text"
                    className="wizard-tag-input"
                    placeholder="Type custom or ceremony name..."
                    aria-label="Add a custom or ceremony"
                    value={customCustomsInput}
                    onChange={(e) => setCustomCustomsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustom(customCustomsInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="wizard-secondary-btn wizard-tag-add-btn"
                    onClick={() => handleAddCustom(customCustomsInput)}
                  >
                    Add
                  </button>
                </div>

                <div className="wizard-presets-row">
                  <span className="wizard-presets-title">Popular:</span>
                  {PRESET_CUSTOMS.filter(
                    (p) => !wizardData.preferences.customs.includes(p.toLowerCase()),
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="wizard-preset-pill"
                      onClick={() => handleAddCustom(preset)}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Planning Notes */}
              <div className="wizard-card-panel">
                <div className="wizard-label-row">
                  <label htmlFor={notesInputId} className="wizard-input-label">
                    Planning notes
                  </label>
                  <span className="wizard-char-counter">
                    {wizardData.preferences.notes.length} / 500
                  </span>
                </div>
                <textarea
                  id={notesInputId}
                  className="wizard-textarea"
                  rows={3}
                  maxLength={500}
                  value={wizardData.preferences.notes}
                  onChange={handleNotesChange}
                  placeholder="Special requests, family traditions, or accessibility requirements for your guests..."
                />
              </div>

              {/* 4. DOCUMENTED REVIEW & EDIT SUMMARY MODULE */}
              <div className="wizard-review-module" aria-label="Review celebration details">
                <div className="wizard-review-header">
                  <h2 className="wizard-review-title">Celebration review</h2>
                  <span className="wizard-review-subtitle">
                    Verify entered details before launching your planning workspace.
                  </span>
                </div>

                <div className="wizard-review-cards-list">
                  {/* Step 1 Review */}
                  <div className="wizard-review-item">
                    <div className="wizard-review-item-content">
                      <span className="wizard-review-tag">1. Celebration</span>
                      <h3 className="wizard-review-item-title">{wizardData.eventName}</h3>
                      <p className="wizard-review-item-meta">{wizardData.categoryName}</p>
                    </div>
                    <button
                      type="button"
                      className="wizard-review-edit-btn"
                      onClick={() => goToStep(1)}
                      aria-label="Edit celebration type and name"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Step 2 Review */}
                  <div className="wizard-review-item">
                    <div className="wizard-review-item-content">
                      <span className="wizard-review-tag">2. Details</span>
                      <h3 className="wizard-review-item-title">{wizardData.eventDate}</h3>
                      <p className="wizard-review-item-meta">
                        {wizardData.city || 'Location not specified'} ·{' '}
                        {wizardData.functions.length} functions planned
                      </p>
                    </div>
                    <button
                      type="button"
                      className="wizard-review-edit-btn"
                      onClick={() => goToStep(2)}
                      aria-label="Edit date, city and functions"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Step 3 Review */}
                  <div className="wizard-review-item">
                    <div className="wizard-review-item-content">
                      <span className="wizard-review-tag">3. Budget &amp; guests</span>
                      <h3 className="wizard-review-item-title">
                        {formatINR(wizardData.budgetTotal)}
                      </h3>
                      <p className="wizard-review-item-meta">
                        {wizardData.guestEstimate} expected guests · Diet breakdown:{' '}
                        {dietSum > 0 ? `${dietSum} specified` : 'Standard'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="wizard-review-edit-btn"
                      onClick={() => goToStep(3)}
                      aria-label="Edit budget and guest details"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 4. FIXED BOTTOM NAVIGATION BAR */}
      <footer className="wizard-bottom-bar" role="region" aria-label="Wizard actions">
        <div className="wizard-bottom-container">
          <button
            type="button"
            className="wizard-back-btn"
            onClick={handleBack}
            aria-label={
              currentStep === 1 ? 'Cancel and go to landing page' : 'Go back to previous step'
            }
          >
            <ArrowLeft size={18} />
            <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
          </button>

          <button
            type="button"
            className="wizard-continue-btn"
            onClick={handleNext}
            disabled={isSubmitting}
            aria-label={
              currentStep === 4 ? 'Finish celebration setup' : 'Continue to next wizard step'
            }
          >
            <span>
              {currentStep === 4
                ? isSubmitting
                  ? 'Creating celebration...'
                  : 'Finish setup'
                : 'Continue'}
            </span>
            <ArrowRight size={18} />
          </button>
        </div>
      </footer>

      {/* D-11 FUNCTION MODAL */}
      {showFunctionModal && (
        <div
          className="wizard-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fn-modal-title"
        >
          <div className="wizard-modal-card">
            <div className="wizard-modal-header">
              <h3 id="fn-modal-title" className="wizard-modal-title">
                {editingFunction ? 'Edit function' : 'Add function'}
              </h3>
              <button
                type="button"
                className="wizard-modal-close-btn"
                onClick={() => setShowFunctionModal(false)}
                aria-label="Close function dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFunction} className="wizard-modal-body">
              <div className="wizard-field-group">
                <label className="wizard-input-label">Function name *</label>
                <input
                  type="text"
                  className="wizard-text-input"
                  required
                  maxLength={60}
                  placeholder="e.g. Mehendi, Sangeet, Cocktail, Pheras"
                  value={functionFormData.name}
                  onChange={(e) =>
                    setFunctionFormData({ ...functionFormData, name: e.target.value })
                  }
                  autoFocus
                />
              </div>

              <div className="wizard-field-group">
                <label className="wizard-input-label">Date *</label>
                <input
                  type="date"
                  className="wizard-text-input"
                  required
                  value={functionFormData.date}
                  onChange={(e) =>
                    setFunctionFormData({ ...functionFormData, date: e.target.value })
                  }
                />
              </div>

              <div className="wizard-time-row">
                <div className="wizard-field-group">
                  <label className="wizard-input-label">Start time</label>
                  <input
                    type="time"
                    className="wizard-text-input"
                    value={functionFormData.startTime}
                    onChange={(e) =>
                      setFunctionFormData({ ...functionFormData, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="wizard-field-group">
                  <label className="wizard-input-label">End time</label>
                  <input
                    type="time"
                    className="wizard-text-input"
                    value={functionFormData.endTime}
                    onChange={(e) =>
                      setFunctionFormData({ ...functionFormData, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="wizard-modal-footer">
                <button
                  type="button"
                  className="wizard-secondary-btn"
                  onClick={() => setShowFunctionModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="wizard-primary-btn">
                  Save function
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAVE & EXIT MODAL */}
      {showExitModal && (
        <div
          className="wizard-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-modal-title"
        >
          <div className="wizard-modal-card">
            <div className="wizard-modal-header">
              <h3 id="exit-modal-title" className="wizard-modal-title">
                Save celebration draft?
              </h3>
              <button
                type="button"
                className="wizard-modal-close-btn"
                onClick={() => setShowExitModal(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>
            <div className="wizard-modal-body">
              <p className="wizard-modal-text">
                Your celebration setup progress is automatically saved in your browser. You can
                return to continue setting up your celebration whenever you are ready.
              </p>
            </div>
            <div className="wizard-modal-footer">
              <button
                type="button"
                className="wizard-secondary-btn"
                onClick={() => setShowExitModal(false)}
              >
                Keep planning
              </button>
              <button type="button" className="wizard-primary-btn" onClick={handleSaveAndExit}>
                Save &amp; exit to dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
