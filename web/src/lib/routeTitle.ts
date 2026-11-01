/** Page titles per route (announced by screen readers on navigation). */

const SITE = 'Toranly';

const TAB_TITLES: Record<string, string> = {
  overview: 'Overview',
  budget: 'Budget',
  timeline: 'Timeline',
  vendors: 'Vendors',
  guests: 'Guests',
  schedule: 'Schedule',
  ideas: 'Ideas',
  plan: 'AI plan',
  'ai-plan': 'AI plan',
  settings: 'Settings',
  setup: 'Edit setup',
  print: 'Print',
};

export function titleForPath(pathname: string): string {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts.length === 0) return `${SITE} — Celebration & Event Planner`;
  if (parts[0] === 'wizard' || (parts[0] === 'events' && parts[1] === 'new')) {
    return `Plan a celebration · ${SITE}`;
  }
  if (parts[0] === 'events' && parts.length === 1) return `My plans · ${SITE}`;
  if (parts[0] === 'events') {
    const tab = TAB_TITLES[parts[2] ?? 'overview'];
    if (tab) return `${tab} · ${SITE}`;
  }
  return `Page not found · ${SITE}`;
}
