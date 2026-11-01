/**
 * E2E-1 … E2E-8 (Phase 5): real typed input → real backend output on screen.
 * Backend: FastAPI + Postgres, AI from recorded fixtures (see playwright.config.ts).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { MEERA, acceptAiConsent, createPlan, dismissStorageNotice, inr, readPlan } from './helpers';

test('E2E-1 wizard values reach Overview; budget figures come from /plan/summary', async ({
  page,
}) => {
  const template = page.waitForResponse((r) => r.url().endsWith('/api/v1/plan/template'));
  const summary = page.waitForResponse((r) => r.url().endsWith('/api/v1/plan/summary'));
  await createPlan(page);
  expect((await template).status()).toBe(200);
  const res = await summary;
  expect(res.status()).toBe(200);
  const body = await res.json();

  const main = page.locator('main');
  await expect(main).toContainText(MEERA.name);
  await expect(main).toContainText(MEERA.city);
  await expect(main).toContainText('14 Mar 2027');
  await expect(main).toContainText(String(MEERA.guests));
  // The figures on screen are the backend's.
  expect(body.budget.allocatedPaise).toBe(MEERA.budgetRupees * 100);
  await expect(main).toContainText(inr(body.budget.allocatedPaise / 100));
  await expect(page.locator('.live-check-note')).toHaveCount(0);
  // Deterministic Next best actions from the same summary response.
  expect(Array.isArray(body.nextActions)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Next best actions' })).toBeVisible();
  // Nothing from the old example data leaks in.
  await expect(main).not.toContainText('Ananya');
  await expect(main).not.toContainText('Jaipur');
});

test('E2E-2 expenses push a category over; backend status and UI agree', async ({ page }) => {
  const id = await createPlan(page);
  await page.goto(`/events/${id}/budget`);
  const venue = (await readPlan(page, id))!.budgetCategories as {
    id: string;
    label: string;
    allocatedPaise: number;
  }[];
  const first = venue[0];
  const addExpense = async (rupees: number, description: string) => {
    await page.getByRole('button', { name: 'Add expense' }).first().click();
    await page.getByLabel('Description').fill(description);
    await page.getByLabel(/Amount/).fill(String(rupees));
    // The summary for the plan that already contains this expense (not an earlier one).
    const summary = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/v1/plan/summary') &&
        (r.request().postData() ?? '').includes(description),
    );
    await page.getByRole('button', { name: 'Add expense' }).last().click();
    return (await summary).json();
  };

  const half = first.allocatedPaise / 200;
  let body = await addExpense(half, 'Advance');
  expect(body.categories[0].status).toBe('ok');

  body = await addExpense(half + 50000, 'Balance');
  const cat = body.categories.find((c: { categoryId: string }) => c.categoryId === first.id);
  expect(cat.status).toBe('over');
  const overBy = (cat.committedPaise - cat.allocatedPaise) / 100;
  expect(overBy).toBe(50000);
  await expect(page.getByText(`Over by ${inr(overBy)}`).first()).toBeVisible();
});

test('E2E-3 date change previews from /plan/date-preview, then the timeline moves', async ({
  page,
}) => {
  const id = await createPlan(page);
  const before = (await readPlan(page, id))!.tasks as { id: string; dueDate: string }[];
  await page.goto(`/events/${id}/settings`);
  await page.getByRole('button', { name: /Change date/ }).click();

  const preview = page.waitForResponse((r) => r.url().endsWith('/api/v1/plan/date-preview'));
  await page.getByLabel('New celebration date:').fill('2027-04-14');
  const res = await preview;
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.deltaDays).toBe(31);
  await expect(page.locator('.date-preview-summary')).toContainText('+31');
  await page.getByRole('button', { name: 'Confirm date change' }).click();

  await expect
    .poll(async () => ((await readPlan(page, id))!.event as { eventDate: string }).eventDate)
    .toBe('2027-04-14');
  const after = (await readPlan(page, id))!.tasks as { id: string; dueDate: string }[];
  const shifted = body.shifted[0];
  expect(after.find((t) => t.id === shifted.id)!.dueDate).toBe(shifted.newDue);
  expect(after.find((t) => t.id === shifted.id)!.dueDate).not.toBe(
    before.find((t) => t.id === shifted.id)!.dueDate,
  );
});

test('E2E-4 AI plan: warning, meter, generate, accept 2 / reject 1, apply, counter drops', async ({
  page,
}) => {
  const id = await createPlan(page);
  const status = page.waitForResponse((r) => r.url().endsWith('/api/v1/ai/status'));
  await page.goto(`/events/${id}/ai-plan`);
  const first = await (await status).json();
  await expect(page.getByRole('note')).toContainText('AI suggestions can be wrong or incomplete');
  await expect(page.locator('.ai-meter-text')).toHaveText(
    `AI suggestions left today: ${first.remainingToday} of ${first.limitToday}`,
  );

  await page.getByRole('radio', { name: 'Full plan' }).click();
  await page.getByRole('button', { name: 'Generate suggestions' }).click();
  await acceptAiConsent(page);
  const items = page.locator('.ai-item');
  await expect(items.first()).toBeVisible();
  await expect(items.first()).toContainText('Suggested');

  const ideaCards = items.filter({ hasText: '→ Ideas' });
  const taskCards = items.filter({ hasText: '→ Timeline' });
  const ideaTitle = (await ideaCards.first().locator('.ai-item-title').innerText()).trim();
  const taskTitle = (await taskCards.first().locator('.ai-item-title').innerText()).trim();
  await ideaCards
    .first()
    .getByRole('button', { name: /^Accept/ })
    .click();
  await taskCards
    .first()
    .getByRole('button', { name: /^Accept/ })
    .click();
  await ideaCards
    .nth(1)
    .getByRole('button', { name: /^Reject/ })
    .click();
  await expect(page.getByRole('button', { name: /Undo/ })).toBeVisible();

  await page.getByRole('button', { name: 'Apply selected (2)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add these to your plan?' });
  await expect(dialog).toContainText(ideaTitle);
  await dialog.getByRole('button', { name: 'Apply to plan' }).click();

  await expect(page.locator('.ai-meter-text')).toHaveText(
    `AI suggestions left today: ${first.remainingToday - 1} of ${first.limitToday}`,
  );
  const plan = (await readPlan(page, id))! as {
    ideas: { title: string; source: string }[];
    tasks: { title: string; source: string }[];
  };
  expect(plan.ideas.find((i) => i.title === ideaTitle)?.source).toBe('ai');
  // Vendor-type items become "Book …" tasks; plain tasks keep their title.
  expect(plan.tasks.some((t) => t.source === 'ai' && taskTitle.includes(t.title))).toBe(true);

  await page.goto(`/events/${id}/ideas`);
  await expect(page.locator('main')).toContainText(ideaTitle);
  await expect(page.locator('main')).toContainText('AI idea');
});

test('E2E-5 daily limit disables Generate with the reset time; 503 busy counts down', async ({
  page,
}) => {
  const id = await createPlan(page);
  await page.goto(`/events/${id}/ai-plan`);
  const generate = page.getByRole('button', { name: 'Generate suggestions' });
  await page.getByRole('radio', { name: 'Menu' }).click();
  for (let i = 0; i < 3; i++) {
    await expect(generate).toBeEnabled();
    const done = page.waitForResponse((r) => r.url().endsWith('/api/v1/ai/suggest'));
    await generate.click();
    if (i === 0) await acceptAiConsent(page);
    expect((await done).status()).toBe(200);
  }
  await expect(page.locator('.ai-meter-text')).toHaveText('AI suggestions left today: 0 of 3');
  await expect(generate).toBeDisabled();
  await expect(
    page.getByText(/You've used today's AI suggestions\. They reset at \d\d:\d\d\./),
  ).toBeVisible();

  // A fresh device with a plan whose theme word makes every fixture provider answer 429.
  await page.context().clearCookies();
  const busyId = await createPlan(page, { ...MEERA, name: 'Busy test', themeWord: 'e2e-busy' });
  await page.goto(`/events/${busyId}/ai-plan`);
  await page.getByRole('radio', { name: 'Menu' }).click();
  const busy = page.waitForResponse((r) => r.url().endsWith('/api/v1/ai/suggest'));
  await page.getByRole('button', { name: 'Generate suggestions' }).click();
  const res = await busy;
  expect(res.status()).toBe(503);
  expect(Number(res.headers()['retry-after'])).toBeGreaterThan(0);
  await expect(page.getByText(/AI is busy right now\. Try again in \d+ seconds\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate suggestions' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Generate suggestions' })).toBeEnabled({
    timeout: 10_000,
  });
});

test('E2E-6 backend unreachable: the planner still works and says so honestly', async ({
  page,
}) => {
  const id = await createPlan(page);
  // Every API call fails as if the backend were stopped; the app itself is already loaded.
  await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'));
  await page.goto(`/events/${id}/budget`);
  await expect(page.locator('.live-check-note')).toHaveText(
    'Live check unavailable. Showing figures calculated on this device.',
  );
  await expect(page.locator('main')).toContainText(inr(MEERA.budgetRupees));

  await page.goto(`/events/${id}/ai-plan`);
  await expect(
    page.getByText("AI suggestions aren't available right now. Everything else works as usual."),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate suggestions' })).toBeDisabled();

  // Edits still save on the device.
  await page.goto(`/events/${id}/timeline`);
  await page.getByRole('checkbox').first().click();
  await expect
    .poll(async () =>
      ((await readPlan(page, id))!.tasks as { status: string }[]).some((t) => t.status === 'done'),
    )
    .toBe(true);
});

test('E2E-7 backup, delete, import restores; an invalid file is rejected', async ({
  page,
}, testInfo) => {
  const id = await createPlan(page, { ...MEERA, name: 'Backup test' });
  await page.goto('/events');
  await dismissStorageNotice(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup for Backup test' }).click();
  const file = testInfo.outputPath('backup.toranly.json');
  await (await download).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf-8')).format).toBe('toranly-backup');

  await page.getByRole('button', { name: 'Delete Backup test' }).click();
  await page.locator('#delete-confirm-input').fill('Backup test');
  await page.getByRole('button', { name: 'Delete this plan' }).click();
  await expect(page.getByRole('button', { name: 'Delete Backup test' })).toHaveCount(0);
  expect(await readPlan(page, id)).toBeNull();

  const validate = page.waitForResponse((r) => r.url().endsWith('/api/v1/plan/validate'));
  await page.locator('input[type=file]').setInputFiles(file);
  expect((await validate).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Delete Backup test' })).toBeVisible();
  expect(((await readPlan(page, id))!.event as { title: string }).title).toBe('Backup test');

  const bad = testInfo.outputPath('not-a-backup.json');
  await writeFile(bad, JSON.stringify({ hello: 'world' }));
  await page.goto('/events');
  await page.locator('input[type=file]').setInputFiles(bad);
  await expect(page.getByText(/Unrecognised backup format/)).toBeVisible();
});

test('E2E-8 refresh on every route keeps the screen and the data', async ({ page }) => {
  const id = await createPlan(page, { ...MEERA, name: 'Refresh test' });
  const routes = [
    '/',
    '/events',
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
  ];
  for (const route of routes) {
    await page.goto(route);
    await page.reload();
    await expect(page).toHaveURL(route === '/' ? /\/$/ : new RegExp(`${route}$`));
    await expect(page.locator('#root')).not.toBeEmpty();
    if (route.includes(id)) await expect(page.locator('body')).toContainText('Refresh test');
  }
  expect(((await readPlan(page, id))!.event as { title: string }).title).toBe('Refresh test');
});
