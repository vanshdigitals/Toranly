/**
 * "Next best actions" on the Overview: up to five suggestions the backend worked out from the
 * whole plan (dates, budget, guests, schedule), each with a one-line reason. Deterministic,
 * not AI; nothing changes until the visitor acts.
 */
import { AlertTriangle, CalendarClock, Clock, Link2, Utensils, Wallet } from 'lucide-react';
import type { components } from '../../api/schema';
import { LIVE_CHECK_UNAVAILABLE } from '../../api/plan';
import type { SummarySource } from '../../lib/usePlanSummary';

type NextAction = components['schemas']['NextActionOut'];

const KIND: Record<NextAction['kind'], { label: string; Icon: typeof Clock }> = {
  task: { label: 'Task', Icon: Clock },
  blocked_task: { label: 'Do first', Icon: Link2 },
  budget_over: { label: 'Over budget', Icon: Wallet },
  budget_warning: { label: 'Budget', Icon: AlertTriangle },
  menu: { label: 'Menu', Icon: Utensils },
  schedule: { label: 'Schedule', Icon: CalendarClock },
};

const TAB_LABEL: Record<NextAction['tab'], string> = {
  timeline: 'Open Timeline',
  budget: 'Open Budget',
  ideas: 'Open Ideas',
  schedule: 'Open Schedule',
};

interface NextActionsPanelProps {
  actions: NextAction[];
  source: SummarySource;
  onOpenTab: (tab: string) => void;
}

export function NextActionsPanel({ actions, source, onOpenTab }: NextActionsPanelProps) {
  return (
    <section className="next-actions" aria-labelledby="next-actions-heading">
      <div className="next-actions-head">
        <h2 id="next-actions-heading" className="next-actions-title">
          Next best actions
        </h2>
        <p className="next-actions-sub">Worked out from your dates, budget, guests and schedule.</p>
      </div>

      {actions.length === 0 ? (
        <p className="next-actions-state" role="status">
          {source === 'device'
            ? LIVE_CHECK_UNAVAILABLE
            : source === 'pending'
              ? 'Checking your plan…'
              : "Nothing urgent right now. You're on track."}
        </p>
      ) : (
        <ol className="next-actions-list">
          {actions.map((action) => {
            const { label, Icon } = KIND[action.kind];
            return (
              <li
                key={`${action.kind}-${action.refs.join('-')}-${action.title}`}
                className="next-action"
              >
                <span className={`next-action-kind kind-${action.kind}`}>
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </span>
                <div className="next-action-body">
                  <p className="next-action-title">{action.title}</p>
                  <p className="next-action-reason">{action.reason}</p>
                </div>
                <button
                  type="button"
                  className="next-action-open"
                  onClick={() => onOpenTab(action.tab)}
                  aria-label={`${TAB_LABEL[action.tab]} for: ${action.title}`}
                >
                  {TAB_LABEL[action.tab]}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
