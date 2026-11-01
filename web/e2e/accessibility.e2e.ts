/**
 * axe-core on every screen of the real app (production build, real backend): no serious or
 * critical WCAG issues. Uses the axe-core package directly, injected into each page.
 */
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import { createPlan, dismissStorageNotice } from './helpers';

// The production CSP (correctly) blocks injected scripts; allow axe for this test only.
test.use({ bypassCSP: true });

const AXE_PATH = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

interface AxeViolation {
  id: string;
  impact: string | null;
  nodes: { target: string[] }[];
}

async function seriousViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (ctx: Document) => Promise<{ violations: AxeViolation[] }> };
      }
    ).axe;
    return (await axe.run(document)).violations;
  });
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('E2E-9 axe: no serious or critical issues on any screen', async ({ page }) => {
  const id = await createPlan(page, {
    name: 'Accessibility check',
    date: '2027-03-14',
    city: 'Pune',
    budgetRupees: 1250000,
    guests: 180,
  });
  const routes = [
    '/',
    '/events',
    '/events/new',
    `/events/${id}`,
    `/events/${id}/budget`,
    `/events/${id}/timeline`,
    `/events/${id}/vendors`,
    `/events/${id}/guests`,
    `/events/${id}/schedule`,
    `/events/${id}/ideas`,
    `/events/${id}/ai-plan`,
    `/events/${id}/settings`,
    `/events/${id}/print`,
    '/no-such-page',
  ];
  const problems: Record<string, string[]> = {};
  for (const route of routes) {
    await page.goto(route);
    if (route === '/events') await dismissStorageNotice(page);
    await page.waitForLoadState('networkidle');
    const found = await seriousViolations(page);
    if (found.length) problems[route] = found;
  }
  expect(problems).toEqual({});
});
