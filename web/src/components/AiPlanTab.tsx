/**
 * AI plan tab (UX_FLOWS.md S-10). Real suggestions only, through GET /api/v1/ai/status and
 * POST /api/v1/ai/suggest; the provider key stays on the backend. Nothing is added to the plan
 * until the visitor accepts items and confirms "Apply selected".
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Info, Lightbulb, Loader2, RotateCcw, TriangleAlert, X } from 'lucide-react';
import {
  getAiStatus,
  requestAiSuggestions,
  type AiContract,
  type AiItem,
  type AiStatus,
} from '../api/ai';
import { ApiError } from '../api/client';
import type { Plan } from '../domain/plan';
import { applyAiItems, describeAiItem, previewAiChanges, targetLabel } from '../domain/aiApply';
import { buildPlanContext } from '../lib/aiContext';
import {
  AI_CONSENT_TEXT,
  getAiConsent,
  loadAiRuns,
  runFromResult,
  saveAiRuns,
  setAiConsent,
  type AiItemState,
  type AiRun,
} from '../lib/aiSession';
import './AiPlanTab.css';

interface AiPlanTabProps {
  plan: Plan;
  onSavePlan: (plan: Plan) => Promise<void>;
  onShowToast?: (msg: string) => void;
}

const CONTRACTS: { value: AiContract; label: string }[] = [
  { value: 'plan.generate', label: 'Full plan' },
  { value: 'budget.suggest', label: 'Budget split' },
  { value: 'timeline.suggest', label: 'Tasks' },
  { value: 'theme.suggest', label: 'Theme and decor' },
  { value: 'menu.suggest', label: 'Menu' },
  { value: 'vendors.categories', label: 'Vendor types' },
  { value: 'budget.savings', label: 'Saving ideas' },
  { value: 'schedule.draft', label: 'Day-of schedule' },
];

const CONTRACT_LABEL: Record<string, string> = {
  ...Object.fromEntries(CONTRACTS.map((c) => [c.value, c.label])),
  'plan.revise': 'Revised plan',
};

const STAGES = [
  'Reading your plan details…',
  'Asking the AI for ideas…',
  'Checking every suggestion…',
];

const LIMIT_REASONS = new Set(['device_day', 'ip_day', 'global_day']);
const STATUS_REFRESH_MS = 60_000;
const UNDO_MS = 10_000;
const FEEDBACK_MAX = 500;

const MSG_UNAVAILABLE =
  "AI suggestions aren't available right now. Everything else works as usual.";
const MSG_OFFLINE = "You're offline. AI suggestions need a connection.";

function formatResetTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

type Availability =
  | { kind: 'loading' }
  | { kind: 'available' }
  | { kind: 'limit' }
  | { kind: 'busy'; seconds: number }
  | { kind: 'unavailable' }
  | { kind: 'offline' };

export const AiPlanTab: React.FC<AiPlanTabProps> = ({ plan, onSavePlan, onShowToast }) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [limitHit, setLimitHit] = useState(false);
  const [busyUntil, setBusyUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [contract, setContract] = useState<AiContract>('plan.generate');
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const [runs, setRuns] = useState<AiRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ runId: string; index: number; until: number } | null>(null);

  const [consentOpen, setConsentOpen] = useState(false);
  const pendingRequest = useRef<{ contract: AiContract; feedback?: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  // --- Status: on open, every 60 s while the tab is open, and after each generation ---
  const refreshStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await getAiStatus(signal);
      setStatus(next);
      setStatusFailed(false);
      setLimitHit(next.reason ? LIMIT_REASONS.has(next.reason) : next.remainingToday <= 0);
      if (next.reason === 'device_minute') setBusyUntil(Date.now() + 60_000);
    } catch (err) {
      if (!signal?.aborted && !(err instanceof DOMException)) setStatusFailed(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refreshStatus(controller.signal);
    const timer = setInterval(() => refreshStatus(), STATUS_REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refreshStatus]);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      refreshStatus();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, [refreshStatus]);

  // One clock for the busy countdown and the Undo window.
  const ticking = busyUntil > now || (undo !== null && undo.until > now);
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  // --- Saved results (last five per plan) ---
  useEffect(() => {
    let active = true;
    loadAiRuns(plan.id).then((saved) => {
      if (!active) return;
      setRuns(saved);
      setActiveRunId(saved[0]?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [plan.id]);

  const persistRuns = useCallback(
    async (next: AiRun[]) => {
      setRuns(next);
      await saveAiRuns(plan.id, next);
    },
    [plan.id],
  );

  const activeRun = runs.find((r) => r.id === activeRunId) ?? null;

  // --- Availability ---
  const availability: Availability = useMemo(() => {
    if (!online) return { kind: 'offline' };
    if (busyUntil > now) return { kind: 'busy', seconds: Math.ceil((busyUntil - now) / 1000) };
    if (limitHit) return { kind: 'limit' };
    if (statusFailed) return { kind: 'unavailable' };
    if (!status) return { kind: 'loading' };
    if (!status.available) return { kind: 'unavailable' };
    return { kind: 'available' };
  }, [online, busyUntil, now, limitHit, statusFailed, status]);

  const resetTime = formatResetTime(status?.resetsAt);
  const canGenerate = availability.kind === 'available' && !generating;

  // --- Generation ---
  const runRequest = async (req: { contract: AiContract; feedback?: string }) => {
    if (inFlight.current) return; // one request at a time per tab
    inFlight.current = true;
    setGenerating(true);
    setStage(0);
    setRequestError(null);
    const stageTimer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3000);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const context = buildPlanContext(plan, today);
      const result = await requestAiSuggestions(req.contract, context, req.feedback);
      const run = runFromResult(req.contract, result);
      await persistRuns([run, ...runs]);
      setActiveRunId(run.id);
      if (result.status === 'failed') setRequestError(result.message ?? MSG_UNAVAILABLE);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const layer = err.problem.layer;
        if (layer === 'device_minute' && err.retryAfter) {
          setBusyUntil(Date.now() + err.retryAfter * 1000);
        } else {
          setLimitHit(true);
        }
      } else if (err instanceof ApiError && err.code === 'ai_busy') {
        setBusyUntil(Date.now() + (err.retryAfter ?? 20) * 1000);
        setNow(Date.now());
      } else if (err instanceof ApiError && err.isUnreachable) {
        setRequestError(navigator.onLine ? MSG_UNAVAILABLE : MSG_OFFLINE);
      } else {
        setRequestError(err instanceof ApiError ? err.detail : MSG_UNAVAILABLE);
      }
    } finally {
      clearInterval(stageTimer);
      inFlight.current = false;
      setGenerating(false);
      refreshStatus();
    }
  };

  const startRequest = async (req: { contract: AiContract; feedback?: string }) => {
    if (await getAiConsent()) {
      await runRequest(req);
    } else {
      pendingRequest.current = req;
      setConsentOpen(true);
    }
  };

  const handleConsent = async (given: boolean) => {
    setConsentOpen(false);
    await setAiConsent(given);
    const req = pendingRequest.current;
    pendingRequest.current = null;
    if (given && req) await runRequest(req);
  };

  // --- Review ---
  const setItemState = (runId: string, index: number, state: AiItemState) =>
    persistRuns(
      runs.map((r) =>
        r.id === runId
          ? { ...r, items: r.items.map((it, i) => (i === index ? { ...it, state } : it)) }
          : r,
      ),
    );

  const handleReject = (index: number) => {
    if (!activeRun) return;
    setItemState(activeRun.id, index, 'rejected');
    setUndo({ runId: activeRun.id, index, until: Date.now() + UNDO_MS });
    setNow(Date.now());
  };

  const handleUndo = () => {
    if (!undo) return;
    setItemState(undo.runId, undo.index, 'suggested');
    setUndo(null);
  };

  const accepted = useMemo(
    () =>
      activeRun ? activeRun.items.filter((it) => it.state === 'accepted').map((it) => it.item) : [],
    [activeRun],
  );
  const changes = useMemo(() => previewAiChanges(plan, accepted), [plan, accepted]);

  const handleApply = async () => {
    if (!activeRun || accepted.length === 0) return;
    setApplying(true);
    try {
      await onSavePlan(applyAiItems(plan, accepted));
      await persistRuns(
        runs.map((r) =>
          r.id === activeRun.id
            ? {
                ...r,
                items: r.items.map((it) =>
                  it.state === 'accepted' ? { ...it, state: 'applied' as const } : it,
                ),
              }
            : r,
        ),
      );
      setConfirmOpen(false);
      onShowToast?.(
        `${accepted.length} suggestion${accepted.length === 1 ? '' : 's'} added to your plan.`,
      );
    } finally {
      setApplying(false);
    }
  };

  const handleRevise = async () => {
    const text = feedback.trim();
    if (!text) return;
    setReviseOpen(false);
    setFeedback('');
    await startRequest({ contract: 'plan.revise', feedback: text });
  };

  // --- Render ---
  const remaining = status?.remainingToday ?? 0;
  const limit = status?.limitToday ?? 0;
  const meterTone = remaining === 0 ? 'error' : remaining <= 2 ? 'warning' : 'primary';
  const undoSeconds = undo && undo.until > now ? Math.ceil((undo.until - now) / 1000) : 0;

  return (
    <div className="ai-tab tab-pane-fade">
      <div className="tab-pane-header ai-tab-header">
        <div>
          <h1 className="tab-pane-title">AI plan</h1>
          <p className="tab-pane-subtitle">
            Ask for ideas, review each one, and add only what you accept.
          </p>
        </div>
        {status && (
          <div className="ai-meter" aria-label="AI usage today">
            <div className="ai-meter-row">
              <span className="ai-meter-text">
                AI suggestions left today: {remaining} of {limit}
              </span>
              <span className="ai-tip">
                <button type="button" className="ai-tip-btn" aria-describedby="ai-tip-text">
                  <Info size={14} aria-hidden="true" />
                  <span>How limits work</span>
                </button>
                <span role="tooltip" id="ai-tip-text" className="ai-tip-text">
                  To keep Toranly free and fair, each device gets a limited number of AI suggestions
                  per day.
                </span>
              </span>
            </div>
            <div
              className="ai-meter-bar"
              role="progressbar"
              aria-label="AI suggestions left today"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={remaining}
            >
              <span
                className={`ai-meter-fill tone-${meterTone}`}
                style={{ width: `${limit ? (remaining / limit) * 100 : 0}%` }}
              />
            </div>
            {resetTime && <span className="ai-meter-reset">Resets at {resetTime}</span>}
          </div>
        )}
      </div>

      <div className="ai-warning" role="note">
        <TriangleAlert size={18} aria-hidden="true" className="ai-warning-icon" />
        <p>
          AI suggestions can be wrong or incomplete. Check prices, dates and vendor details yourself
          before you rely on them. Nothing is added to your plan until you accept it.
        </p>
      </div>

      <section className="ai-panel" aria-labelledby="ai-generate-heading">
        <h2 id="ai-generate-heading" className="ai-panel-title">
          What should the AI suggest?
        </h2>
        <div className="ai-contracts" role="radiogroup" aria-label="Suggestion type">
          {CONTRACTS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={contract === c.value}
              className={`ai-contract ${contract === c.value ? 'is-active' : ''}`}
              onClick={() => setContract(c.value)}
              disabled={generating}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="ai-actions">
          <button
            type="button"
            className="tab-primary-btn"
            onClick={() => startRequest({ contract })}
            disabled={!canGenerate}
            aria-busy={generating}
          >
            {generating ? (
              <Loader2 size={16} className="ai-spin" aria-hidden="true" />
            ) : (
              <Lightbulb size={16} aria-hidden="true" />
            )}
            <span>{generating ? 'Generating…' : 'Generate suggestions'}</span>
          </button>
          {runs.length > 0 && (
            <button
              type="button"
              className="tab-action-btn"
              onClick={() => setReviseOpen(true)}
              disabled={!canGenerate}
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span>Revise with feedback</span>
            </button>
          )}
        </div>

        <div aria-live="polite">
          {generating && (
            <p className="ai-progress">
              <Loader2 size={14} className="ai-spin" aria-hidden="true" />
              {STAGES[stage]}
            </p>
          )}
          {!generating && availability.kind === 'limit' && (
            <p className="ai-state ai-state--warning">
              You've used today's AI suggestions.
              {resetTime ? ` They reset at ${resetTime}.` : ''} Everything else works as usual.
            </p>
          )}
          {!generating && availability.kind === 'busy' && (
            <p className="ai-state ai-state--warning">
              AI is busy right now. Try again in {availability.seconds} seconds.
            </p>
          )}
          {!generating && availability.kind === 'unavailable' && (
            <p className="ai-state">{MSG_UNAVAILABLE}</p>
          )}
          {!generating && availability.kind === 'offline' && (
            <p className="ai-state">{MSG_OFFLINE}</p>
          )}
          {!generating && requestError && availability.kind === 'available' && (
            <p className="ai-state">{requestError}</p>
          )}
        </div>
      </section>

      {runs.length > 1 && (
        <div className="ai-history">
          <label htmlFor="ai-history-select">Earlier results</label>
          <select
            id="ai-history-select"
            value={activeRunId ?? ''}
            onChange={(e) => setActiveRunId(e.target.value)}
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {CONTRACT_LABEL[r.contract] ?? r.contract} ·{' '}
                {new Date(r.createdAt).toLocaleString([], {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeRun && (
        <section className="ai-results" aria-labelledby="ai-results-heading">
          <div className="ai-results-head">
            <h2 id="ai-results-heading" className="ai-panel-title">
              {CONTRACT_LABEL[activeRun.contract] ?? 'Suggestions'}
            </h2>
            {accepted.length > 0 && (
              <button
                type="button"
                className="tab-primary-btn"
                onClick={() => setConfirmOpen(true)}
              >
                <Check size={16} aria-hidden="true" />
                <span>Apply selected ({accepted.length})</span>
              </button>
            )}
          </div>

          {activeRun.status === 'fallback' && activeRun.message && (
            <p className="ai-state">{activeRun.message}</p>
          )}
          {activeRun.status === 'failed' && (
            <p className="ai-state">{activeRun.message ?? MSG_UNAVAILABLE}</p>
          )}

          {(activeRun.assumptions.length > 0 || activeRun.warnings.length > 0) && (
            <div className="ai-notes">
              {activeRun.assumptions.length > 0 && (
                <div>
                  <h3>Assumptions</h3>
                  <ul>
                    {activeRun.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {activeRun.warnings.length > 0 && (
                <div className="ai-notes-warnings">
                  <h3>Warnings</h3>
                  <ul>
                    {activeRun.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {undoSeconds > 0 && undo?.runId === activeRun.id && (
            <div className="ai-undo" role="status">
              <span>Suggestion rejected.</span>
              <button type="button" className="ai-link-btn" onClick={handleUndo}>
                Undo ({undoSeconds}s)
              </button>
            </div>
          )}

          <ul className="ai-items">
            {activeRun.items.map(({ item, state }, index) => (
              <AiItemCard
                key={`${activeRun.id}-${index}`}
                item={item}
                plan={plan}
                state={state}
                fallback={activeRun.status === 'fallback'}
                onAccept={() =>
                  setItemState(activeRun.id, index, state === 'accepted' ? 'suggested' : 'accepted')
                }
                onReject={() => handleReject(index)}
              />
            ))}
          </ul>
        </section>
      )}

      {consentOpen && (
        <div className="ai-overlay" role="presentation">
          <div
            className="ai-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-consent-title"
          >
            <h2 id="ai-consent-title">Before you use AI suggestions</h2>
            <p>{AI_CONSENT_TEXT}</p>
            <div className="ai-dialog-actions">
              <button type="button" className="tab-action-btn" onClick={() => handleConsent(false)}>
                Not now
              </button>
              <button
                type="button"
                className="tab-primary-btn"
                onClick={() => handleConsent(true)}
                autoFocus
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="ai-overlay" role="presentation">
          <div
            className="ai-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-apply-title"
          >
            <h2 id="ai-apply-title">Add these to your plan?</h2>
            <ul className="ai-change-list">
              {changes.map((c, i) => (
                <li key={i}>
                  <span className="ai-chip">{targetLabel(c.target)}</span>
                  <span>
                    {c.text}
                    {c.to && (
                      <>
                        {': '}
                        {c.from && <s>{c.from}</s>} {c.to}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="ai-dialog-actions">
              <button
                type="button"
                className="tab-action-btn"
                onClick={() => setConfirmOpen(false)}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className="tab-primary-btn"
                onClick={handleApply}
                disabled={applying}
              >
                {applying ? 'Applying…' : 'Apply to plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviseOpen && (
        <div className="ai-overlay" role="presentation">
          <div
            className="ai-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-revise-title"
          >
            <h2 id="ai-revise-title">Revise with feedback</h2>
            <label htmlFor="ai-feedback" className="ai-feedback-label">
              What should change?
            </label>
            <textarea
              id="ai-feedback"
              className="ai-feedback"
              rows={4}
              maxLength={FEEDBACK_MAX}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              autoFocus
            />
            <span className="ai-feedback-count">
              {feedback.length}/{FEEDBACK_MAX} characters
            </span>
            <div className="ai-dialog-actions">
              <button type="button" className="tab-action-btn" onClick={() => setReviseOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="tab-primary-btn"
                onClick={handleRevise}
                disabled={!feedback.trim()}
              >
                Revise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const STATE_CHIP: Record<AiItemState, string> = {
  suggested: 'Suggested',
  accepted: 'Accepted',
  rejected: 'Rejected',
  applied: 'Added to plan',
};

const AiItemCard: React.FC<{
  item: AiItem;
  plan: Plan;
  state: AiItemState;
  fallback: boolean;
  onAccept: () => void;
  onReject: () => void;
}> = ({ item, plan, state, fallback, onAccept, onReject }) => {
  const view = describeAiItem(item, plan);
  const chip = state === 'suggested' && fallback ? 'Standard template' : STATE_CHIP[state];
  const locked = state === 'applied';
  return (
    <li className={`ai-item is-${state}`}>
      <div className="ai-item-main">
        <div className="ai-item-chips">
          <span className={`ai-chip ai-chip--${state}`}>{chip}</span>
          <span className="ai-chip ai-chip--target">→ {targetLabel(view.target)}</span>
        </div>
        <h3 className="ai-item-title">{view.title}</h3>
        {view.detail && <p className="ai-item-detail">{view.detail}</p>}
        {view.estimate && (
          <p className="ai-item-estimate">
            <span className="ai-chip ai-chip--estimate">Estimate</span> {view.estimate}
          </p>
        )}
      </div>
      {!locked && state !== 'rejected' && (
        <div className="ai-item-actions">
          <button
            type="button"
            className={`ai-icon-btn ${state === 'accepted' ? 'is-on' : ''}`}
            aria-pressed={state === 'accepted'}
            aria-label={`Accept ${view.title}`}
            onClick={onAccept}
          >
            <Check size={16} aria-hidden="true" />
            <span>Accept</span>
          </button>
          <button
            type="button"
            className="ai-icon-btn"
            aria-label={`Reject ${view.title}`}
            onClick={onReject}
          >
            <X size={16} aria-hidden="true" />
            <span>Reject</span>
          </button>
        </div>
      )}
    </li>
  );
};
