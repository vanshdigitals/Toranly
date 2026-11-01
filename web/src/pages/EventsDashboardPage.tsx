import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  Calendar,
  MapPin,
  ArrowRight,
  HeartHandshake,
  Cake,
  Users,
  Sparkles,
  Download,
  Trash2,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { ToranlyLogomark } from '../components/ToranlyLogomark';
import { listPlans, savePlan, deletePlan } from '../storage/db';
import {
  exportPlanBackup,
  parseBackupFile,
  detectPlanConflicts,
  downloadBackupFile,
  checkPlansWithServer,
} from '../storage/backup';
import { getAllEvents } from '../lib/eventState';
import { migrate } from '../domain/plan';
import type { Plan } from '../domain/plan';
import { formatPaise } from '../domain/money';
import { calculateBudgetMetrics } from '../domain/budget';
import { calculateDaysRemaining } from '../lib/eventState';
import { getCategoryById } from '../types/wizard';
import { InMemoryBanner } from '../components/InMemoryBanner';
import { StorageNoticeDialog } from '../components/StorageNoticeDialog';
import { DeletePlanDialog } from '../components/DeletePlanDialog';
import { ImportConflictDialog } from '../components/ImportConflictDialog';
import './EventsDashboardPage.css';

export const EventsDashboardPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const [conflictData, setConflictData] = useState<{ incoming: Plan; existing: Plan } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Read incoming toast message from router navigation state (e.g. "That plan isn't on this device.")
  useEffect(() => {
    const state = location.state as { toast?: string } | null;
    if (state?.toast) {
      setToastMessage(state.toast);
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  // Load plans from IndexedDB, migrating localStorage legacy events if needed
  const loadAllPlans = async () => {
    try {
      let dbPlans = await listPlans();
      if (dbPlans.length === 0) {
        // Check localStorage events to migrate
        const localEvents = getAllEvents();
        if (localEvents.length > 0) {
          for (const evt of localEvents) {
            try {
              const migrated = migrate(evt);
              await savePlan(migrated);
            } catch {
              // ignore invalid legacy items
            }
          }
          dbPlans = await listPlans();
        }
      }
      setPlans(dbPlans);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllPlans();
  }, []);

  // Handle Export Backup
  const handleExport = (e: React.MouseEvent, plan: Plan) => {
    e.preventDefault();
    e.stopPropagation();
    const backupJson = exportPlanBackup(plan);
    const slug = plan.event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBackupFile(backupJson, slug);
  };

  // Handle Delete Confirmation (D-01)
  const handleDeleteClick = (e: React.MouseEvent, plan: Plan) => {
    e.preventDefault();
    e.stopPropagation();
    setPlanToDelete(plan);
  };

  const handleConfirmDelete = async () => {
    if (!planToDelete) return;
    await deletePlan(planToDelete.id);
    setPlanToDelete(null);
    await loadAllPlans();
  };

  // Handle Import Backup
  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    if (file.size > 2 * 1024 * 1024) {
      setImportError('Backup file exceeds the 2MB size limit.');
      return;
    }

    try {
      const text = await file.text();
      const parseResult = parseBackupFile(text);

      if (!parseResult.success || !parseResult.plans || parseResult.plans.length === 0) {
        setImportError(parseResult.error || 'Failed to read backup file.');
        return;
      }

      const importedPlans = parseResult.plans;
      const serverCheck = await checkPlansWithServer(importedPlans);
      if (!serverCheck.ok) {
        setImportError(serverCheck.error);
        return;
      }
      if (serverCheck.notice) setToastMessage(serverCheck.notice);
      const conflictCheck = await detectPlanConflicts(importedPlans);

      if (conflictCheck.conflicts.length > 0) {
        // Handle first conflict via dialog (D-16)
        setConflictData(conflictCheck.conflicts[0]);
      } else {
        // Save non-conflicting plans directly
        for (const p of importedPlans) {
          await savePlan(p);
        }
        await loadAllPlans();
        if (importedPlans[0]) {
          navigate(`/events/${importedPlans[0].id}`);
        }
      }
    } catch {
      setImportError('Failed to read or parse the backup file.');
    }
  };

  const handleResolveConflictReplace = async () => {
    if (!conflictData) return;
    await savePlan(conflictData.incoming);
    const planId = conflictData.incoming.id;
    setConflictData(null);
    await loadAllPlans();
    navigate(`/events/${planId}`);
  };

  const handleResolveConflictKeepBoth = async () => {
    if (!conflictData) return;
    const newId = `plan-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const clonedPlan: Plan = {
      ...conflictData.incoming,
      id: newId,
      event: {
        ...conflictData.incoming.event,
        title: `${conflictData.incoming.event.title} (Imported)`,
      },
    };
    await savePlan(clonedPlan);
    setConflictData(null);
    await loadAllPlans();
    navigate(`/events/${clonedPlan.id}`);
  };

  return (
    <div className="dashboard-page">
      <InMemoryBanner />
      <StorageNoticeDialog />

      {/* Hidden File Input for .toranly.json Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.toranly.json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* 1. TOP NAVBAR */}
      <header className="dashboard-navbar">
        <div className="dashboard-nav-container">
          <Link to="/" className="dashboard-logo-link" aria-label="Toranly Home">
            <ToranlyLogomark size={32} />
            <span className="dashboard-brand-title">Toranly</span>
          </Link>

          <div className="dashboard-nav-actions">
            <button
              type="button"
              className="dashboard-nav-import-btn"
              onClick={handleImportClick}
              title="Import a saved celebration backup"
            >
              <Upload size={16} aria-hidden="true" />
              <span>Import plan</span>
            </button>
            <Link to="/events/new" className="dashboard-nav-create-btn">
              <Plus size={16} aria-hidden="true" />
              <span>Plan a celebration</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main id="main-content" className="dashboard-main">
        <div className="dashboard-container">
          {toastMessage && (
            <div className="dashboard-toast" role="status" aria-live="polite">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{toastMessage}</span>
            </div>
          )}

          <div className="dashboard-header-row">
            <div>
              <h1 className="dashboard-title">Your celebrations</h1>
              <p className="dashboard-subtitle">
                Saved in this browser on this device. Download a backup anytime to keep a copy.
              </p>
            </div>
            <div className="dashboard-header-cta-group">
              <button
                type="button"
                className="dashboard-import-btn"
                onClick={handleImportClick}
              >
                <Upload size={16} aria-hidden="true" />
                <span>Import plan</span>
              </button>
              <Link to="/events/new" className="dashboard-cta-btn">
                <Plus size={18} aria-hidden="true" />
                <span>Plan a celebration</span>
              </Link>
            </div>
          </div>

          {importError && (
            <div className="dashboard-import-error" role="alert">
              <span>{importError}</span>
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="error-dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {loading ? (
            <div className="dashboard-loading">Loading saved celebrations…</div>
          ) : plans.length === 0 ? (
            /* EMPTY STATE (ST-04) */
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-icon-box">
                <Sparkles size={28} />
              </div>
              <h2 className="dashboard-empty-title">No celebrations yet</h2>
              <p className="dashboard-empty-desc">
                From intimate family birthdays to three-day weddings, create your first celebration
                to get a personalized checklist and budget breakdown saved right in this browser.
              </p>
              <div className="dashboard-empty-actions">
                <Link to="/events/new" className="dashboard-cta-btn">
                  <Plus size={18} />
                  <span>Plan a celebration</span>
                </Link>
                <button
                  type="button"
                  className="dashboard-import-btn"
                  onClick={handleImportClick}
                >
                  <Upload size={16} />
                  <span>Import backup (.toranly.json)</span>
                </button>
              </div>

              <div className="dashboard-shortcuts-section">
                <span className="dashboard-shortcuts-label">Or start with a ready template:</span>
                <div className="dashboard-shortcuts-grid">
                  <Link
                    to="/events/new?type=wedding"
                    className="dashboard-shortcut-card"
                  >
                    <div className="dashboard-shortcut-icon">
                      <HeartHandshake size={20} />
                    </div>
                    <div>
                      <strong>Wedding Planner</strong>
                      <span>Mehendi, sangeet, reception &amp; budget</span>
                    </div>
                  </Link>
                  <Link
                    to="/events/new?type=birthday"
                    className="dashboard-shortcut-card"
                  >
                    <div className="dashboard-shortcut-icon">
                      <Cake size={20} />
                    </div>
                    <div>
                      <strong>Birthday Celebration</strong>
                      <span>Theme, cake, games &amp; return gifts</span>
                    </div>
                  </Link>
                  <Link
                    to="/events/new?type=community"
                    className="dashboard-shortcut-card"
                  >
                    <div className="dashboard-shortcut-icon">
                      <Users size={20} />
                    </div>
                    <div>
                      <strong>Community Mela / Pooja</strong>
                      <span>Sound, safety, catering &amp; volunteers</span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* EVENTS GRID */
            <div className="dashboard-events-grid">
              {plans.map((p) => {
                const cat = getCategoryById(p.event.type);
                const Icon = cat.icon;
                const daysRemaining = p.event.eventDate ? calculateDaysRemaining(p.event.eventDate) : null;
                const metrics = calculateBudgetMetrics(p.budgetCategories, p.expenses);
                const openTasksCount = p.tasks.filter((t) => t.status === 'open').length;

                return (
                  <div key={p.id} className="dashboard-event-card">
                    <div className="dashboard-card-top">
                      <div className="dashboard-card-cat-badge">
                        <Icon size={16} />
                        <span>{cat.name}</span>
                      </div>
                      <div className="dashboard-card-top-actions">
                        {daysRemaining !== null && (
                          <span className="dashboard-days-pill">
                            {daysRemaining} days to go
                          </span>
                        )}
                        <button
                          type="button"
                          className="dashboard-card-icon-btn"
                          title="Download .toranly.json backup"
                          onClick={(e) => handleExport(e, p)}
                          aria-label={`Download backup for ${p.event.title}`}
                        >
                          <Download size={15} />
                        </button>
                        <button
                          type="button"
                          className="dashboard-card-icon-btn danger"
                          title="Delete plan"
                          onClick={(e) => handleDeleteClick(e, p)}
                          aria-label={`Delete ${p.event.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <Link to={`/events/${p.id}`} className="dashboard-card-main-link">
                      <h2 className="dashboard-card-title">{p.event.title}</h2>

                      <div className="dashboard-card-meta">
                        <span className="dashboard-card-meta-item">
                          <MapPin size={14} />
                          <span>{p.event.city || 'India'}</span>
                        </span>
                        <span>·</span>
                        <span className="dashboard-card-meta-item">
                          <Calendar size={14} />
                          <span>{p.event.eventDate || 'Date unset'}</span>
                        </span>
                      </div>

                      <div className="dashboard-card-stats-box">
                        <div className="dashboard-card-stat">
                          <span className="dashboard-stat-label">Budget committed</span>
                          <span className="dashboard-stat-value">
                            {formatPaise(metrics.totalCommittedPaise, { compact: true })} of{' '}
                            {p.event.budgetTotalPaise ? formatPaise(p.event.budgetTotalPaise, { compact: true }) : 'Flexible'}
                          </span>
                        </div>
                        <div className="dashboard-card-stat">
                          <span className="dashboard-stat-label">Open checklist</span>
                          <span className="dashboard-stat-value">
                            {openTasksCount} tasks remaining
                          </span>
                        </div>
                      </div>

                      <div className="dashboard-card-footer">
                        <span className="dashboard-card-action">Open planner</span>
                        <ArrowRight size={16} className="dashboard-arrow-icon" />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Delete Plan Confirmation Dialog (D-01) */}
      {planToDelete && (
        <DeletePlanDialog
          isOpen={true}
          planTitle={planToDelete.event.title}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPlanToDelete(null)}
        />
      )}

      {/* Import Conflict Resolution Dialog (D-16) */}
      {conflictData && (
        <ImportConflictDialog
          isOpen={true}
          incomingPlan={conflictData.incoming}
          existingPlan={conflictData.existing}
          onReplace={handleResolveConflictReplace}
          onKeepBoth={handleResolveConflictKeepBoth}
          onCancel={() => setConflictData(null)}
        />
      )}
    </div>
  );
};
