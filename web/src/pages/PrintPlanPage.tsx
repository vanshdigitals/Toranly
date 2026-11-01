import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import type { Plan } from '../domain/plan';
import { getPlan } from '../storage/db';
import { formatPaise } from '../domain/money';
import { usePlanSummary } from '../lib/usePlanSummary';
import {
  LIVE_CHECK_UNAVAILABLE,
  validatePlan,
  type ApiPlan,
  type ValidateResponse,
} from '../api/plan';
import { ToranlyLogomark } from '../components/ToranlyLogomark';
import './PrintPlanPage.css';

export const PrintPlanPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchPlan() {
      if (!eventId) {
        setLoading(false);
        return;
      }
      const loaded = await getPlan(eventId);
      if (active) {
        setPlan(loaded);
        setLoading(false);
      }
    }
    fetchPlan();
    return () => {
      active = false;
    };
  }, [eventId]);

  // Totals from POST /plan/summary; the plan is checked with POST /plan/validate before printing.
  const { metrics: budgetMetrics, source: summarySource } = usePlanSummary(plan);
  const [problems, setProblems] = useState<ValidateResponse['problems'] | null>(null);
  const [checkUnavailable, setCheckUnavailable] = useState(false);
  useEffect(() => {
    if (!plan) return;
    const controller = new AbortController();
    validatePlan(plan as ApiPlan, controller.signal)
      .then((res) => setProblems(res.problems))
      .catch(() => {
        if (!controller.signal.aborted) setCheckUnavailable(true);
      });
    return () => controller.abort();
  }, [plan]);

  useEffect(() => {
    if (!loading && !plan) {
      navigate('/events', { replace: true, state: { toast: "That plan isn't on this device." } });
    }
  }, [loading, plan, navigate]);

  if (loading || !plan) {
    return <div className="print-loading">Loading print view…</div>;
  }

  const hasFunctions = plan.functions && plan.functions.length > 0;
  const hasExpenses = plan.expenses && plan.expenses.length > 0;
  const hasTasks = plan.tasks && plan.tasks.length > 0;
  const hasVendors = plan.vendors && plan.vendors.length > 0;
  const hasGuests = !!plan.guests;
  const hasSchedule = plan.scheduleItems && plan.scheduleItems.length > 0;
  const hasPreferences =
    plan.event.preferences &&
    (plan.event.preferences.themeWords.length > 0 ||
      plan.event.preferences.customs.length > 0 ||
      plan.event.preferences.notes.trim().length > 0);

  return (
    <div className="print-page-container">
      {/* Top Bar for Screen only */}
      <div className="print-screen-controls no-print">
        <Link to={`/events/${plan.id}`} className="print-control-btn back">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Planner</span>
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="print-control-btn print-primary"
        >
          <Printer size={16} aria-hidden="true" />
          <span>Print / Save as PDF (A4)</span>
        </button>
      </div>
      {(checkUnavailable || summarySource === 'device') && (
        <p className="print-check-note no-print" role="status">
          {LIVE_CHECK_UNAVAILABLE}
        </p>
      )}
      {problems && problems.length > 0 && (
        <div className="print-check-note no-print" role="status">
          <strong>Check before printing:</strong>
          <ul>
            {problems.map((p) => (
              <li key={`${p.code}-${p.refs.join(',')}`}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}

      <main id="main-content" className="print-document">
        {/* Document Header */}
        <header className="print-doc-header">
          <div className="print-brand">
            <ToranlyLogomark className="print-logo" />
            <span className="print-brand-name">Toranly Celebration Planner</span>
          </div>
          <span className="print-meta-date">
            Generated {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
          </span>
        </header>

        {/* 1. Event Overview & Metadata */}
        <section className="print-section">
          <h1 className="print-title">{plan.event.title}</h1>
          <div className="print-overview-grid">
            <div className="print-overview-cell">
              <span className="print-cell-label">Occasion</span>
              <span className="print-cell-val">
                {plan.event.type.charAt(0).toUpperCase() + plan.event.type.slice(1)}
              </span>
            </div>
            <div className="print-overview-cell">
              <span className="print-cell-label">Celebration Date</span>
              <span className="print-cell-val">{plan.event.eventDate || 'Date not set'}</span>
            </div>
            <div className="print-overview-cell">
              <span className="print-cell-label">Location / City</span>
              <span className="print-cell-val">{plan.event.city || 'India'}</span>
            </div>
            <div className="print-overview-cell">
              <span className="print-cell-label">Estimated Guests</span>
              <span className="print-cell-val">{plan.event.guestEstimate}</span>
            </div>
            <div className="print-overview-cell">
              <span className="print-cell-label">Total Budget</span>
              <span className="print-cell-val highlight">
                {plan.event.budgetTotalPaise
                  ? formatPaise(plan.event.budgetTotalPaise)
                  : 'Flexible'}
              </span>
            </div>
            <div className="print-overview-cell">
              <span className="print-cell-label">Committed / Remaining</span>
              <span className="print-cell-val">
                {formatPaise(budgetMetrics.totalCommittedPaise)} /{' '}
                {formatPaise(budgetMetrics.totalRemainingPaise)}
              </span>
            </div>
          </div>
        </section>

        {/* 2. Functions & Timeline */}
        {hasFunctions && (
          <section className="print-section">
            <h2 className="print-section-heading">2. Functions & Ceremonies</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Function</th>
                  <th>Date</th>
                  <th>Time Window</th>
                </tr>
              </thead>
              <tbody>
                {plan.functions.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.name}</strong>
                    </td>
                    <td>{f.date}</td>
                    <td>{f.startTime ? `${f.startTime} – ${f.endTime || ''}` : 'All Day'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 3. Budget Summary & Category Breakdown */}
        <section className="print-section">
          <h2 className="print-section-heading">3. Budget Breakdown</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Allocated</th>
                <th className="num">Committed</th>
                <th className="num">Paid</th>
                <th className="num">Remaining</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {budgetMetrics.categories.map((c) => (
                <tr key={c.categoryId}>
                  <td>
                    <strong>{c.label}</strong>
                  </td>
                  <td className="num">{formatPaise(c.allocatedPaise)}</td>
                  <td className="num">{formatPaise(c.committedPaise)}</td>
                  <td className="num">{formatPaise(c.paidPaise)}</td>
                  <td className="num">{formatPaise(c.remainingPaise)}</td>
                  <td>
                    <span className={`print-status-tag ${c.status}`}>{c.status.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
              <tr className="print-total-row">
                <td>
                  <strong>TOTAL</strong>
                </td>
                <td className="num">
                  <strong>{formatPaise(budgetMetrics.totalAllocatedPaise)}</strong>
                </td>
                <td className="num">
                  <strong>{formatPaise(budgetMetrics.totalCommittedPaise)}</strong>
                </td>
                <td className="num">
                  <strong>{formatPaise(budgetMetrics.totalPaidPaise)}</strong>
                </td>
                <td className="num">
                  <strong>{formatPaise(budgetMetrics.totalRemainingPaise)}</strong>
                </td>
                <td>
                  <strong>{budgetMetrics.overallStatus.toUpperCase()}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Expenses Log */}
        {hasExpenses && (
          <section className="print-section">
            <h2 className="print-section-heading">4. Expenses Log</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Stage</th>
                  <th>Date</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {plan.expenses.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div>
                        <strong>{e.description}</strong>
                      </div>
                      {e.note && <small className="print-subtext">{e.note}</small>}
                    </td>
                    <td>{e.kind.toUpperCase()}</td>
                    <td>{e.spentOn || '—'}</td>
                    <td className="num">{formatPaise(e.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 5. Task Checklist */}
        {hasTasks && (
          <section className="print-section">
            <h2 className="print-section-heading">5. Tasks & Milestone Checklist</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>Status</th>
                  <th>Task Title</th>
                  <th>Category</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {plan.tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className={`print-checkbox ${t.status === 'done' ? 'checked' : ''}`}>
                        {t.status === 'done' ? '✓' : '○'}
                      </span>
                    </td>
                    <td>
                      <strong>{t.title}</strong>
                      {t.isMilestone && <span className="print-milestone-tag">Milestone</span>}
                    </td>
                    <td>{t.categoryKey || 'General'}</td>
                    <td>{t.dueDate || 'Unscheduled'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 6. Vendors & Quotes */}
        {hasVendors && (
          <section className="print-section">
            <h2 className="print-section-heading">6. Vendors & Key Contacts</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {plan.vendors.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.name}</strong>
                    </td>
                    <td>{v.categoryKey}</td>
                    <td>{v.status.toUpperCase()}</td>
                    <td>{v.phone || v.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 7. Dietary & Accessibility Summary */}
        {hasGuests && plan.guests && (
          <section className="print-section">
            <h2 className="print-section-heading">7. Guests & Dietary Preferences</h2>
            <div className="print-diet-grid">
              <div className="print-diet-box">
                <span className="print-diet-count">{plan.guests.veg}</span>
                <span className="print-diet-label">Vegetarian</span>
              </div>
              <div className="print-diet-box">
                <span className="print-diet-count">{plan.guests.jain}</span>
                <span className="print-diet-label">Jain</span>
              </div>
              <div className="print-diet-box">
                <span className="print-diet-count">{plan.guests.nonVeg}</span>
                <span className="print-diet-label">Non-Vegetarian</span>
              </div>
              <div className="print-diet-box">
                <span className="print-diet-count">{plan.guests.eggetarian}</span>
                <span className="print-diet-label">Eggetarian</span>
              </div>
              <div className="print-diet-box">
                <span className="print-diet-count">{plan.guests.vegan}</span>
                <span className="print-diet-label">Vegan</span>
              </div>
            </div>
          </section>
        )}

        {/* 8. Day-of Schedule */}
        {hasSchedule && (
          <section className="print-section">
            <h2 className="print-section-heading">8. Day-of Schedule</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Duration</th>
                  <th>Item</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {plan.scheduleItems.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.startTime}</strong>
                    </td>
                    <td>{s.durationMin} mins</td>
                    <td>{s.title}</td>
                    <td>{s.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 9. Ideas & Notes */}
        {hasPreferences && (
          <section className="print-section">
            <h2 className="print-section-heading">9. Celebration Notes & Styling</h2>
            {plan.event.preferences.themeWords.length > 0 && (
              <p>
                <strong>Themes / Vibe:</strong> {plan.event.preferences.themeWords.join(', ')}
              </p>
            )}
            {plan.event.preferences.customs.length > 0 && (
              <p>
                <strong>Customs & Elements:</strong> {plan.event.preferences.customs.join(', ')}
              </p>
            )}
            {plan.event.preferences.notes && (
              <p>
                <strong>Planning Notes:</strong> {plan.event.preferences.notes}
              </p>
            )}
          </section>
        )}

        {/* Document Footer */}
        <footer className="print-doc-footer">
          <p>Toranly — Make room for the moments that matter.</p>
        </footer>
      </main>
    </div>
  );
};
