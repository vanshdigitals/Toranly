import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Sparkles,
  MoreHorizontal,
  Pencil,
  CheckCircle,
  Edit3,
  Trash2,
  Clock,
  AlertTriangle,
  Check,
  ArrowRight,
  X,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import type { Plan, IdeaItem, IdeaKind } from '../domain/plan';
import { formatPaise } from '../domain/money';
import { checkDietaryCoverage, type DietBreakdown } from '../domain/guests';
import { Select } from './Select';
import {
  getAiStatus,
  requestAiSuggestions,
  AI_UNAVAILABLE_MESSAGE,
  type AiContract,
  type AiStatus,
  type AiItem,
} from '../api/ai';
import { ApiError } from '../api/client';
import { aiItemToIdea } from '../domain/aiApply';
import { AI_CONSENT_KEY, AI_CONSENT_TEXT } from '../lib/aiSession';
import { buildPlanContext } from '../lib/aiContext';
import { getMeta, setMeta } from '../storage/db';
import './IdeasTab.css';

interface IdeasTabProps {
  plan: Plan;
  onSavePlan: (updatedPlan: Plan) => Promise<void>;
  onNavigateTab?: (tab: string) => void;
  onShowToast?: (message: string) => void;
}

type FilterCategory = 'all' | 'theme' | 'decor' | 'menu' | 'saving' | 'other';

const KIND_OPTIONS: { value: IdeaKind; label: string }[] = [
  { value: 'theme', label: 'Theme' },
  { value: 'decor', label: 'Decor' },
  { value: 'menu', label: 'Menu' },
  { value: 'saving', label: 'Saving' },
  { value: 'other', label: 'Other' },
];

const DIET_LABELS: Record<string, string> = {
  veg: 'Veg',
  nonVeg: 'Non-veg',
  jain: 'Jain',
  eggetarian: 'Eggetarian',
  vegan: 'Vegan',
};

const STANDARD_DIET_TAGS = ['Veg', 'Non-veg', 'Jain', 'Eggetarian', 'Vegan'];

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatEstimateRange(
  minPaise?: number,
  maxPaise?: number,
  isSaving = false,
): string | null {
  if (minPaise == null && maxPaise == null) return null;
  const prefix = isSaving ? 'Estimate saving ' : 'Estimate ';

  if (minPaise != null && maxPaise != null) {
    if (minPaise === maxPaise) {
      return `${prefix}${formatPaise(minPaise)}`;
    }
    return `${prefix}${formatPaise(minPaise)} to ${formatPaise(maxPaise)}`;
  }
  if (minPaise != null) {
    return `${prefix}from ${formatPaise(minPaise)}`;
  }
  if (maxPaise != null) {
    return `${prefix}up to ${formatPaise(maxPaise)}`;
  }
  return null;
}

export const IdeasTab: React.FC<IdeasTabProps> = ({
  plan,
  onSavePlan,
  onNavigateTab,
  onShowToast,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [actionMenuIdeaId, setActionMenuIdeaId] = useState<string | null>(null);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalIdea, setEditModalIdea] = useState<IdeaItem | null>(null);
  const [deleteModalIdea, setDeleteModalIdea] = useState<IdeaItem | null>(null);
  const [personalizeModalIdea, setPersonalizeModalIdea] = useState<IdeaItem | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // Add/Edit Form State
  const [formKind, setFormKind] = useState<IdeaKind>('theme');
  const [formTitle, setFormTitle] = useState('');
  const [formTitleError, setFormTitleError] = useState(false);
  const [formDetails, setFormDetails] = useState('');
  const [formDietTags, setFormDietTags] = useState<string[]>([]);
  const [formMinRupees, setFormMinRupees] = useState<string>('');
  const [formMaxRupees, setFormMaxRupees] = useState<string>('');

  // Personalize Form State
  const [personalNoteText, setPersonalNoteText] = useState('');

  // AI Modal State
  const [aiContract, setAiContract] = useState<AiContract>('theme.suggest');
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiStatusError, setAiStatusError] = useState(false);
  const [aiConsent, setAiConsent] = useState<boolean | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<AiItem[]>([]);
  const [addedAiItemIndices, setAddedAiItemIndices] = useState<Set<number>>(new Set());

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close kebab menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionMenuIdeaId(null);
      }
    }
    if (actionMenuIdeaId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [actionMenuIdeaId]);

  // Load AI status & consent when AI modal opens
  useEffect(() => {
    if (aiModalOpen) {
      const controller = new AbortController();
      getAiStatus(controller.signal)
        .then(setAiStatus)
        .catch((err: unknown) => {
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            setAiStatusError(true);
          }
        });
      getMeta<boolean>(AI_CONSENT_KEY).then((v) => setAiConsent(v === true));
      return () => controller.abort();
    }
  }, [aiModalOpen]);

  const ideas = useMemo(() => plan.ideas || [], [plan.ideas]);

  // Ideas count by category
  const themeIdeas = useMemo(() => ideas.filter((i) => i.kind === 'theme'), [ideas]);
  const decorIdeas = useMemo(() => ideas.filter((i) => i.kind === 'decor'), [ideas]);
  const menuIdeas = useMemo(() => ideas.filter((i) => i.kind === 'menu'), [ideas]);
  const savingIdeas = useMemo(() => ideas.filter((i) => i.kind === 'saving'), [ideas]);
  const otherIdeas = useMemo(() => ideas.filter((i) => i.kind === 'other'), [ideas]);

  const filteredIdeas = useMemo(() => {
    if (activeFilter === 'all') return ideas;
    return ideas.filter((i) => i.kind === activeFilter);
  }, [ideas, activeFilter]);

  // Dietary Coverage Check
  const dietBreakdown: DietBreakdown = useMemo(() => {
    if (plan.guests && !Array.isArray(plan.guests)) {
      return {
        veg: plan.guests.veg ?? 0,
        nonVeg: plan.guests.nonVeg ?? 0,
        jain: plan.guests.jain ?? 0,
        eggetarian: plan.guests.eggetarian ?? 0,
        vegan: plan.guests.vegan ?? 0,
      };
    }
    return { veg: 0, nonVeg: 0, jain: 0, eggetarian: 0, vegan: 0 };
  }, [plan.guests]);

  const dietCoverage = useMemo(
    () => checkDietaryCoverage(dietBreakdown, ideas),
    [dietBreakdown, ideas],
  );

  const coveredDietTags = useMemo(() => {
    const tags = new Set<string>();
    menuIdeas.forEach((item) => {
      (item.dietTags || []).forEach((t) => tags.add(capitalize(t)));
    });
    return Array.from(tags);
  }, [menuIdeas]);

  const uncoveredWithGuests = useMemo(() => {
    return dietCoverage.uncoveredDiets.filter((key) => {
      const count = dietBreakdown[key as keyof DietBreakdown] || 0;
      return count > 0;
    });
  }, [dietCoverage.uncoveredDiets, dietBreakdown]);

  const totalGuestsWithDiets = useMemo(() => {
    return (
      dietBreakdown.veg +
      dietBreakdown.nonVeg +
      dietBreakdown.jain +
      dietBreakdown.eggetarian +
      dietBreakdown.vegan
    );
  }, [dietBreakdown]);

  // -------------------------------------------------------------
  // DIALOG OPEN / CLOSE HANDLERS
  // -------------------------------------------------------------
  const openAddModal = (defaultKind?: IdeaKind) => {
    setFormKind(defaultKind || (activeFilter !== 'all' ? (activeFilter as IdeaKind) : 'theme'));
    setFormTitle('');
    setFormTitleError(false);
    setFormDetails('');
    setFormDietTags(defaultKind === 'menu' || activeFilter === 'menu' ? ['Veg'] : []);
    setFormMinRupees('');
    setFormMaxRupees('');
    setAddModalOpen(true);
  };

  const openEditModal = (idea: IdeaItem) => {
    setEditModalIdea(idea);
    setFormKind(idea.kind);
    setFormTitle(idea.title);
    setFormTitleError(false);
    setFormDetails(idea.body || '');
    setFormDietTags(idea.dietTags || []);
    setFormMinRupees(
      idea.estimateMinPaise != null ? String(Math.round(idea.estimateMinPaise / 100)) : '',
    );
    setFormMaxRupees(
      idea.estimateMaxPaise != null ? String(Math.round(idea.estimateMaxPaise / 100)) : '',
    );
    setActionMenuIdeaId(null);
  };

  const openPersonalizeModal = (idea: IdeaItem) => {
    setPersonalizeModalIdea(idea);
    setPersonalNoteText(idea.personalNote || idea.body || '');
    setActionMenuIdeaId(null);
  };

  const openDeleteModal = (idea: IdeaItem) => {
    setDeleteModalIdea(idea);
    setActionMenuIdeaId(null);
  };

  // -------------------------------------------------------------
  // SAVE / DELETE / CONFIRM HANDLERS
  // -------------------------------------------------------------
  const handleSaveIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormTitleError(true);
      return;
    }

    const minPaise = formMinRupees.trim() ? Math.round(Number(formMinRupees) * 100) : undefined;
    const maxPaise = formMaxRupees.trim() ? Math.round(Number(formMaxRupees) * 100) : undefined;

    let updatedIdeas: IdeaItem[];

    if (editModalIdea) {
      updatedIdeas = ideas.map((item) => {
        if (item.id === editModalIdea.id) {
          return {
            ...item,
            kind: formKind,
            title: formTitle.trim(),
            body: formDetails.trim() || undefined,
            dietTags: formKind === 'menu' ? formDietTags : [],
            estimateMinPaise: minPaise,
            estimateMaxPaise: maxPaise,
          };
        }
        return item;
      });
    } else {
      const newIdea: IdeaItem = {
        id: `idea-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        kind: formKind,
        title: formTitle.trim(),
        body: formDetails.trim() || undefined,
        dietTags: formKind === 'menu' ? formDietTags : [],
        estimateMinPaise: minPaise,
        estimateMaxPaise: maxPaise,
        source: 'user',
        confirmed: false,
      };
      updatedIdeas = [...ideas, newIdea];
    }

    await onSavePlan({ ...plan, ideas: updatedIdeas });
    setAddModalOpen(false);
    setEditModalIdea(null);
    onShowToast?.(editModalIdea ? 'Idea updated' : 'Idea saved');
  };

  const handleSavePersonalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalizeModalIdea) return;

    const updatedIdeas = ideas.map((item) => {
      if (item.id === personalizeModalIdea.id) {
        return {
          ...item,
          personalized: true,
          personalNote: personalNoteText.trim() || undefined,
        };
      }
      return item;
    });

    await onSavePlan({ ...plan, ideas: updatedIdeas });
    setPersonalizeModalIdea(null);
    onShowToast?.('Personal note saved');
  };

  const handleToggleConfirm = async (idea: IdeaItem) => {
    const nextConfirmed = !idea.confirmed;
    const updatedIdeas = ideas.map((item) => {
      if (item.id === idea.id) {
        return { ...item, confirmed: nextConfirmed };
      }
      return item;
    });

    await onSavePlan({ ...plan, ideas: updatedIdeas });
    setActionMenuIdeaId(null);
    onShowToast?.(nextConfirmed ? 'Idea confirmed' : 'Idea marked unconfirmed');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalIdea) return;
    const updatedIdeas = ideas.filter((item) => item.id !== deleteModalIdea.id);
    await onSavePlan({ ...plan, ideas: updatedIdeas });
    setDeleteModalIdea(null);
    onShowToast?.('Idea deleted');
  };

  // -------------------------------------------------------------
  // AI SUGGESTIONS HANDLER
  // -------------------------------------------------------------
  const giveAiConsent = async () => {
    await setMeta(AI_CONSENT_KEY, true);
    setAiConsent(true);
  };

  const handleRequestAi = async () => {
    setAiBusy(true);
    setAiError(null);
    setAiResults([]);
    setAddedAiItemIndices(new Set());

    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await requestAiSuggestions(aiContract, buildPlanContext(plan, today));
      setAiResults((res.items || []) as AiItem[]);
      getAiStatus()
        .then(setAiStatus)
        .catch(() => undefined);
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : AI_UNAVAILABLE_MESSAGE);
    } finally {
      setAiBusy(false);
    }
  };

  const handleAddAiItemToIdeas = async (item: AiItem, index: number) => {
    const newIdea = aiItemToIdea(
      item,
      `idea-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    );

    const updatedIdeas = [...ideas, newIdea];
    await onSavePlan({ ...plan, ideas: updatedIdeas });

    setAddedAiItemIndices((prev) => new Set(prev).add(index));
    onShowToast?.('Idea added to celebration plan');
  };

  // -------------------------------------------------------------
  // RENDER IDEA CARD
  // -------------------------------------------------------------
  const renderCard = (idea: IdeaItem) => {
    const isMenuOpen = actionMenuIdeaId === idea.id;
    const estimateText = formatEstimateRange(
      idea.estimateMinPaise,
      idea.estimateMaxPaise,
      idea.kind === 'saving',
    );

    return (
      <article key={idea.id} className="idea-card-item">
        <div className="idea-card-top">
          <div className="idea-card-header-row">
            <span className="idea-card-category-tag">{idea.kind}</span>
            <div className="idea-kebab-container" ref={isMenuOpen ? menuRef : undefined}>
              <button
                type="button"
                className="idea-kebab-btn"
                aria-label={`Actions for ${idea.title}`}
                aria-expanded={isMenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setActionMenuIdeaId(isMenuOpen ? null : idea.id);
                }}
              >
                <MoreHorizontal size={16} />
              </button>

              {isMenuOpen && (
                <div className="idea-context-menu" role="menu">
                  <button
                    type="button"
                    className="idea-menu-item"
                    role="menuitem"
                    onClick={() => openEditModal(idea)}
                  >
                    <Pencil size={14} />
                    <span>Edit idea</span>
                  </button>

                  <button
                    type="button"
                    className="idea-menu-item"
                    role="menuitem"
                    onClick={() => handleToggleConfirm(idea)}
                  >
                    <CheckCircle size={14} />
                    <span>{idea.confirmed ? 'Mark unconfirmed' : 'Confirm idea'}</span>
                  </button>

                  <button
                    type="button"
                    className="idea-menu-item"
                    role="menuitem"
                    onClick={() => openPersonalizeModal(idea)}
                  >
                    <Edit3 size={14} />
                    <span>Personalize note</span>
                  </button>

                  <button
                    type="button"
                    className="idea-menu-item is-danger"
                    role="menuitem"
                    onClick={() => openDeleteModal(idea)}
                  >
                    <Trash2 size={14} />
                    <span>Delete idea</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <h4 className="idea-card-title">{idea.title}</h4>
          {idea.body && <p className="idea-card-body">{idea.body}</p>}

          {(estimateText || (idea.dietTags && idea.dietTags.length > 0)) && (
            <div className="idea-card-badges">
              {estimateText && (
                <span className="idea-estimate-chip">
                  <Clock size={13} aria-hidden="true" />
                  <span>{estimateText}</span>
                </span>
              )}

              {idea.dietTags?.map((tag) => {
                const norm = tag.toLowerCase().replace('-', '');
                let tagClass = 'idea-diet-tag';
                if (norm === 'veg') tagClass += ' idea-diet-veg';
                else if (norm === 'nonveg') tagClass += ' idea-diet-nonveg';
                else if (norm === 'jain') tagClass += ' idea-diet-jain';
                else if (norm === 'eggetarian') tagClass += ' idea-diet-eggetarian';
                else if (norm === 'vegan') tagClass += ' idea-diet-vegan';

                return (
                  <span key={tag} className={tagClass}>
                    {capitalize(tag)}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="idea-card-footer">
          <span className="idea-source-tag">
            {idea.source === 'ai' ? (
              <>
                <Sparkles size={13} className="idea-source-icon" aria-hidden="true" />
                <span>AI idea</span>
              </>
            ) : (
              <>
                <Edit3 size={13} className="idea-source-icon" aria-hidden="true" />
                <span>Your idea</span>
              </>
            )}
          </span>

          {idea.personalized || idea.personalNote ? (
            <span
              className="idea-status-tag idea-status-personalized"
              title={idea.personalNote || 'Personal note'}
            >
              Personal note
            </span>
          ) : idea.confirmed ? (
            <span className="idea-status-tag idea-status-confirmed">Confirmed</span>
          ) : (
            <span className="idea-status-tag idea-status-unconfirmed">Unconfirmed</span>
          )}
        </div>
      </article>
    );
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div className="ideas-workspace tab-pane-fade">
      {/* 1. COMPACT PAGE HEADER */}
      <header className="ideas-page-header">
        <div className="ideas-header-text">
          <h1 className="ideas-page-title">Ideas</h1>
          <p className="ideas-page-desc">
            Themes, decor, menu and saving ideas for your celebration. Suggestions you accept and
            ideas you add yourself appear here.
          </p>
        </div>

        <div className="ideas-header-actions">
          <button type="button" className="ideas-btn-primary" onClick={() => openAddModal()}>
            <Plus size={16} aria-hidden="true" />
            <span>Add idea</span>
          </button>

          <button
            type="button"
            className="ideas-btn-secondary"
            onClick={() => setAiModalOpen(true)}
          >
            <Lightbulb size={16} aria-hidden="true" />
            <span>Get more ideas</span>
          </button>
        </div>
      </header>

      {/* 2. CATEGORY FILTER NAVIGATION */}
      <div className="ideas-filter-bar">
        <div className="ideas-filter-chips" role="tablist" aria-label="Filter ideas by category">
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'all'}
            className={`ideas-filter-pill ${activeFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({ideas.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'theme'}
            className={`ideas-filter-pill ${activeFilter === 'theme' ? 'is-active' : ''}`}
            onClick={() => setActiveFilter('theme')}
          >
            Theme ({themeIdeas.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'decor'}
            className={`ideas-filter-pill ${activeFilter === 'decor' ? 'is-active' : ''}`}
            onClick={() => setActiveFilter('decor')}
          >
            Decor ({decorIdeas.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'menu'}
            className={`ideas-filter-pill ${activeFilter === 'menu' ? 'is-active' : ''}`}
            onClick={() => setActiveFilter('menu')}
          >
            Menu ({menuIdeas.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'saving'}
            className={`ideas-filter-pill ${activeFilter === 'saving' ? 'is-active' : ''}`}
            onClick={() => setActiveFilter('saving')}
          >
            Saving ({savingIdeas.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'other'}
            className={`ideas-filter-pill ${activeFilter === 'other' ? 'is-active' : ''}`}
            onClick={() => setActiveFilter('other')}
          >
            Other ({otherIdeas.length})
          </button>
        </div>

        <span className="ideas-count-display">
          {filteredIdeas.length} {filteredIdeas.length === 1 ? 'idea' : 'ideas'}
        </span>
      </div>

      {/* 3. GUEST PREFERENCE NOTICE */}
      <div className="ideas-diet-notice">
        <div className="ideas-diet-notice-left">
          <span className="ideas-diet-notice-text">
            {coveredDietTags.length > 0
              ? `Menu ideas cover ${coveredDietTags.join(', ')}.`
              : totalGuestsWithDiets > 0
                ? 'No dietary tags specified on menu items yet.'
                : 'No guest dietary requirements recorded yet.'}
          </span>

          {uncoveredWithGuests.length > 0 && (
            <span className="ideas-diet-warning-badge">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>
                Missing:{' '}
                {uncoveredWithGuests
                  .map(
                    (k) =>
                      `${DIET_LABELS[k] || k} (${dietBreakdown[k as keyof DietBreakdown]} guests)`,
                  )
                  .join(', ')}
              </span>
            </span>
          )}

          {uncoveredWithGuests.length === 0 && totalGuestsWithDiets > 0 && (
            <span className="ideas-diet-success-badge">
              <Check size={14} aria-hidden="true" />
              <span>All guest diets covered</span>
            </span>
          )}
        </div>

        <button
          type="button"
          className="ideas-diet-view-btn"
          onClick={() => onNavigateTab?.('guests')}
        >
          <span>View guests</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      {/* 4. CATEGORY SECTIONS & CARD GRID */}
      {ideas.length === 0 ? (
        <div className="ideas-empty-state-card">
          <h2 className="ideas-empty-title">No ideas saved yet</h2>
          <p className="ideas-empty-desc">
            Save your own ideas or ask for theme, decor, menu and saving ideas for your celebration.
          </p>
          <div className="ideas-empty-actions">
            <button type="button" className="ideas-btn-primary" onClick={() => openAddModal()}>
              <Plus size={16} aria-hidden="true" />
              <span>Add idea</span>
            </button>
            <button
              type="button"
              className="ideas-btn-secondary"
              onClick={() => {
                setAiContract('theme.suggest');
                setAiModalOpen(true);
              }}
            >
              <Lightbulb size={16} aria-hidden="true" />
              <span>Get theme ideas</span>
            </button>
          </div>
        </div>
      ) : filteredIdeas.length === 0 ? (
        <div className="ideas-empty-state-card">
          <h2 className="ideas-empty-title">No {activeFilter} ideas saved</h2>
          <p className="ideas-empty-desc">
            You haven&apos;t saved any ideas in this category yet. Add your own or browse other
            categories.
          </p>
          <div className="ideas-empty-actions">
            <button
              type="button"
              className="ideas-btn-primary"
              onClick={() => openAddModal(activeFilter as IdeaKind)}
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add {activeFilter} idea</span>
            </button>
            <button
              type="button"
              className="ideas-btn-secondary"
              onClick={() => setActiveFilter('all')}
            >
              <span>Show all ideas</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="ideas-board">
          {/* THEME SECTION */}
          {(activeFilter === 'all' || activeFilter === 'theme') && themeIdeas.length > 0 && (
            <section className="idea-group" aria-labelledby="heading-group-theme">
              <div className="idea-group-header">
                <h3 id="heading-group-theme" className="idea-group-title">
                  Theme
                </h3>
                <span className="idea-group-count">({themeIdeas.length})</span>
              </div>
              <div className="idea-cards-grid">{themeIdeas.map(renderCard)}</div>
            </section>
          )}

          {/* DECOR SECTION */}
          {(activeFilter === 'all' || activeFilter === 'decor') && decorIdeas.length > 0 && (
            <section className="idea-group" aria-labelledby="heading-group-decor">
              <div className="idea-group-header">
                <h3 id="heading-group-decor" className="idea-group-title">
                  Decor
                </h3>
                <span className="idea-group-count">({decorIdeas.length})</span>
              </div>
              <div className="idea-cards-grid">{decorIdeas.map(renderCard)}</div>
            </section>
          )}

          {/* MENU SECTION */}
          {(activeFilter === 'all' || activeFilter === 'menu') && menuIdeas.length > 0 && (
            <section className="idea-group" aria-labelledby="heading-group-menu">
              <div className="idea-group-header">
                <h3 id="heading-group-menu" className="idea-group-title">
                  Menu
                </h3>
                <span className="idea-group-count">({menuIdeas.length})</span>
              </div>
              <div className="idea-cards-grid">{menuIdeas.map(renderCard)}</div>
            </section>
          )}

          {/* SAVING SECTION */}
          {(activeFilter === 'all' || activeFilter === 'saving') && savingIdeas.length > 0 && (
            <section className="idea-group" aria-labelledby="heading-group-saving">
              <div className="idea-group-header">
                <h3 id="heading-group-saving" className="idea-group-title">
                  Saving
                </h3>
                <span className="idea-group-count">({savingIdeas.length})</span>
              </div>
              <div className="idea-cards-grid">{savingIdeas.map(renderCard)}</div>
            </section>
          )}

          {/* OTHER SECTION */}
          {(activeFilter === 'all' || activeFilter === 'other') && otherIdeas.length > 0 && (
            <section className="idea-group" aria-labelledby="heading-group-other">
              <div className="idea-group-header">
                <h3 id="heading-group-other" className="idea-group-title">
                  Other
                </h3>
                <span className="idea-group-count">({otherIdeas.length})</span>
              </div>
              <div className="idea-cards-grid">{otherIdeas.map(renderCard)}</div>
            </section>
          )}
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT IDEA ================= */}
      {(addModalOpen || editModalIdea) && (
        <div
          className="ideas-modal-overlay"
          onClick={() => {
            setAddModalOpen(false);
            setEditModalIdea(null);
          }}
        >
          <div
            className="ideas-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-idea-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ideas-modal-header">
              <h2 id="add-idea-modal-title" className="ideas-modal-title">
                {editModalIdea ? 'Edit idea' : 'Add idea'}
              </h2>
              <button
                type="button"
                className="ideas-modal-close-btn"
                aria-label="Close dialog"
                onClick={() => {
                  setAddModalOpen(false);
                  setEditModalIdea(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveIdea} className="ideas-form-body">
              {/* Kind Dropdown */}
              <div className="ideas-form-field">
                <label className="ideas-form-label" htmlFor="idea-kind-select">
                  Kind
                </label>
                <Select
                  id="idea-kind-select"
                  value={formKind}
                  onChange={(val) => setFormKind(val as IdeaKind)}
                  options={KIND_OPTIONS}
                />
              </div>

              {/* Title Field */}
              <div className="ideas-form-field">
                <div className="ideas-form-label-row">
                  <label className="ideas-form-label" htmlFor="idea-title-input">
                    Title <span className="ideas-label-optional">(required)</span>
                  </label>
                  {formTitleError && (
                    <span className="ideas-form-error-msg" role="alert">
                      Give your idea a title.
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  id="idea-title-input"
                  maxLength={120}
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    if (e.target.value.trim()) setFormTitleError(false);
                  }}
                  placeholder="e.g. Masala chai stall or Marigold arch"
                  className={`ideas-form-input ${formTitleError ? 'has-error' : ''}`}
                  autoFocus
                />
                <p className="ideas-form-help">Brief headline describing this celebration idea.</p>
              </div>

              {/* Dietary Checkboxes (Only for Menu) */}
              {formKind === 'menu' && (
                <div className="ideas-diet-checkboxes-box">
                  <span className="ideas-diet-checkboxes-title">Diet tags (for Menu items)</span>
                  <div className="ideas-diet-checkbox-group">
                    {STANDARD_DIET_TAGS.map((tag) => {
                      const isChecked = formDietTags.some(
                        (t) => t.toLowerCase() === tag.toLowerCase(),
                      );
                      return (
                        <label key={tag} className="ideas-checkbox-label">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormDietTags([...formDietTags, tag]);
                              } else {
                                setFormDietTags(
                                  formDietTags.filter((t) => t.toLowerCase() !== tag.toLowerCase()),
                                );
                              }
                            }}
                          />
                          <span>{tag}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Estimated Budget / Savings */}
              <div className="ideas-form-field">
                <label className="ideas-form-label">
                  {formKind === 'saving'
                    ? 'Estimated savings range (₹)'
                    : 'Estimated cost range (₹)'}
                  <span className="ideas-label-optional"> (optional)</span>
                </label>
                <div className="ideas-form-estimates-row">
                  <div className="ideas-input-currency-wrapper">
                    <span className="ideas-currency-prefix">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      placeholder="Min (e.g. 20000)"
                      value={formMinRupees}
                      onChange={(e) => setFormMinRupees(e.target.value)}
                      className="ideas-form-input"
                    />
                  </div>
                  <div className="ideas-input-currency-wrapper">
                    <span className="ideas-currency-prefix">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      placeholder="Max (e.g. 35000)"
                      value={formMaxRupees}
                      onChange={(e) => setFormMaxRupees(e.target.value)}
                      className="ideas-form-input"
                    />
                  </div>
                </div>
              </div>

              {/* Details Textarea with Character Counter */}
              <div className="ideas-form-field">
                <div className="ideas-form-label-row">
                  <label className="ideas-form-label" htmlFor="idea-details-textarea">
                    Details
                  </label>
                  <span className="ideas-char-counter">{formDetails.length}/500</span>
                </div>
                <textarea
                  id="idea-details-textarea"
                  rows={3}
                  maxLength={500}
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                  placeholder="Notes on vendor sourcing, estimated cost range or specific preferences..."
                  className="ideas-form-textarea"
                />
              </div>

              {/* Footer Buttons */}
              <div className="ideas-modal-footer">
                <button
                  type="button"
                  className="ideas-modal-btn-cancel"
                  onClick={() => {
                    setAddModalOpen(false);
                    setEditModalIdea(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="ideas-modal-btn-submit">
                  Save idea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PERSONALIZE IDEA ================= */}
      {personalizeModalIdea && (
        <div className="ideas-modal-overlay" onClick={() => setPersonalizeModalIdea(null)}>
          <div
            className="ideas-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="personalize-idea-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ideas-modal-header">
              <h2 id="personalize-idea-modal-title" className="ideas-modal-title">
                Personalize idea
              </h2>
              <button
                type="button"
                className="ideas-modal-close-btn"
                aria-label="Close dialog"
                onClick={() => setPersonalizeModalIdea(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePersonalNote} className="ideas-form-body">
              <p className="ideas-page-desc" style={{ marginTop: 0 }}>
                Add your personal preferences, custom touches, or specific instructions for{' '}
                <strong>&ldquo;{personalizeModalIdea.title}&rdquo;</strong>.
              </p>

              <div className="ideas-form-field">
                <div className="ideas-form-label-row">
                  <label className="ideas-form-label" htmlFor="personal-note-textarea">
                    Personal note &amp; customization
                  </label>
                  <span className="ideas-char-counter">{personalNoteText.length}/500</span>
                </div>
                <textarea
                  id="personal-note-textarea"
                  rows={4}
                  maxLength={500}
                  value={personalNoteText}
                  onChange={(e) => setPersonalNoteText(e.target.value)}
                  placeholder="e.g. Include grandma's favorite brass bowls, use warm yellow marigolds instead of orange..."
                  className="ideas-form-textarea"
                  autoFocus
                />
              </div>

              <div className="ideas-modal-footer">
                <button
                  type="button"
                  className="ideas-modal-btn-cancel"
                  onClick={() => setPersonalizeModalIdea(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="ideas-modal-btn-submit">
                  Save note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {deleteModalIdea && (
        <div className="ideas-modal-overlay" onClick={() => setDeleteModalIdea(null)}>
          <div
            className="ideas-modal-card is-delete"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-idea-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ideas-delete-header">
              <div className="ideas-delete-icon-wrapper">
                <Trash2 size={20} />
              </div>
              <h3 id="delete-idea-title" className="ideas-modal-title">
                Delete this idea?
              </h3>
            </div>

            <p className="ideas-delete-text">
              Are you sure you want to remove{' '}
              <span className="ideas-delete-target-title">
                &ldquo;{deleteModalIdea.title}&rdquo;
              </span>
              ? This cannot be undone.
            </p>

            <div className="ideas-modal-footer">
              <button
                type="button"
                className="ideas-modal-btn-cancel"
                onClick={() => setDeleteModalIdea(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ideas-modal-btn-danger"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: GET MORE IDEAS (AI SUGGESTIONS) ================= */}
      {aiModalOpen && (
        <div className="ideas-modal-overlay" onClick={() => setAiModalOpen(false)}>
          <div
            className="ideas-modal-card is-ai"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-ideas-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ideas-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={20} color="var(--color-primary, #0f6e6e)" />
                <h2 id="ai-ideas-modal-title" className="ideas-modal-title">
                  Get more ideas
                </h2>
              </div>
              <button
                type="button"
                className="ideas-modal-close-btn"
                aria-label="Close dialog"
                onClick={() => setAiModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* AI Privacy & Consent Check */}
            {aiStatusError || (aiStatus && !aiStatus.available) ? (
              <div className="ideas-ai-notice-box" role="status">
                <p className="ideas-ai-notice-title">AI suggestions unavailable</p>
                <p>
                  {aiStatus?.message && aiStatus.reason !== 'no_key'
                    ? aiStatus.message
                    : AI_UNAVAILABLE_MESSAGE}
                </p>
                <p style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Everything else in Toranly keeps working without AI.
                </p>
              </div>
            ) : aiConsent === false ? (
              <div className="ideas-ai-notice-box">
                <p className="ideas-ai-notice-title">Before you use AI suggestions</p>
                <p>{AI_CONSENT_TEXT}</p>
                <div style={{ marginTop: 14 }}>
                  <button type="button" className="ideas-btn-primary" onClick={giveAiConsent}>
                    I understand, continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="ideas-form-body">
                <div className="ideas-form-field">
                  <label className="ideas-form-label" htmlFor="ai-contract-select">
                    What would you like ideas for?
                  </label>
                  <Select
                    id="ai-contract-select"
                    value={aiContract}
                    onChange={(val) => setAiContract(val as AiContract)}
                    options={[
                      { value: 'theme.suggest', label: 'Theme and decor concepts' },
                      { value: 'menu.suggest', label: 'Menu and dish ideas' },
                      { value: 'budget.savings', label: 'Ways to save money' },
                    ]}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    className="ideas-btn-primary"
                    disabled={aiBusy}
                    onClick={handleRequestAi}
                  >
                    {aiBusy ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Thinking…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>Generate ideas</span>
                      </>
                    )}
                  </button>

                  {aiStatus && (
                    <span className="ideas-ai-quota-text">
                      {aiStatus.remainingToday} requests left today
                    </span>
                  )}
                </div>

                {aiError && (
                  <p className="ideas-form-error-msg" role="alert">
                    {aiError}
                  </p>
                )}

                {/* AI Results */}
                {aiResults.length > 0 && (
                  <div>
                    <h4
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--color-text-secondary)',
                        margin: '16px 0 8px 0',
                      }}
                    >
                      Suggested Ideas ({aiResults.length})
                    </h4>

                    <div className="ideas-ai-results-list">
                      {aiResults.map((item, idx) => {
                        const isAdded = addedAiItemIndices.has(idx);
                        const title = String(
                          item.title || item.dish_name || item.idea || item.kind || 'Idea',
                        );
                        const desc = String(
                          item.description || item.detail || item.trade_off || item.course || '',
                        );
                        const estMin = item.estimate_inr_min ?? item.estimate_saving_inr_min;
                        const estMax = item.estimate_inr_max ?? item.estimate_saving_inr_max;
                        const estStr =
                          typeof estMin === 'number' || typeof estMax === 'number'
                            ? formatEstimateRange(
                                typeof estMin === 'number' ? estMin * 100 : undefined,
                                typeof estMax === 'number' ? estMax * 100 : undefined,
                                item.kind === 'saving_idea',
                              )
                            : null;

                        return (
                          <div key={idx} className="ideas-ai-result-item">
                            <div className="ideas-ai-result-content">
                              <h5 className="ideas-ai-result-title">{title}</h5>
                              {desc && <p className="ideas-ai-result-desc">{desc}</p>}
                              <div className="ideas-ai-result-chips">
                                {estStr && (
                                  <span
                                    className="idea-estimate-chip"
                                    style={{ fontSize: '0.6875rem' }}
                                  >
                                    <Clock size={11} />
                                    <span>{estStr}</span>
                                  </span>
                                )}
                                {Array.isArray(item.diet_tags) &&
                                  item.diet_tags.map((t) => (
                                    <span
                                      key={String(t)}
                                      className="idea-diet-tag idea-diet-veg"
                                      style={{ fontSize: '0.6562rem' }}
                                    >
                                      {String(t)}
                                    </span>
                                  ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`ideas-ai-add-btn ${isAdded ? 'is-added' : ''}`}
                              disabled={isAdded}
                              onClick={() => handleAddAiItemToIdeas(item, idx)}
                            >
                              {isAdded ? (
                                <>
                                  <Check size={14} />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={14} />
                                  <span>Add to ideas</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="ideas-modal-footer">
              <button
                type="button"
                className="ideas-modal-btn-cancel"
                onClick={() => setAiModalOpen(false)}
              >
                Close
              </button>
              {onNavigateTab && (
                <button
                  type="button"
                  className="ideas-diet-view-btn"
                  onClick={() => {
                    setAiModalOpen(false);
                    onNavigateTab('plan');
                  }}
                >
                  <span>Open full AI assistant</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
