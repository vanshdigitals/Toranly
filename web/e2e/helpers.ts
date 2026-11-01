import { expect, type Page } from '@playwright/test';

export interface WizardValues {
  name: string;
  date: string; // YYYY-MM-DD
  city: string;
  budgetRupees: number;
  guests: number;
  themeWord?: string;
}

export const MEERA: WizardValues = {
  name: "Meera & Kabir's Wedding",
  date: '2027-03-14',
  city: 'Pune',
  budgetRupees: 1250000,
  guests: 180,
  themeWord: 'Marigold',
};

/** Fills the four wizard steps through the real UI; returns the new plan id. */
export async function createPlan(page: Page, v: WizardValues = MEERA): Promise<string> {
  await page.goto('/events/new');
  await page
    .getByRole('radio', { name: /Wedding/ })
    .first()
    .click();
  await page.getByLabel('Celebration name').fill(v.name);
  await page.getByRole('button', { name: 'Continue to next wizard step' }).click();

  await page.getByLabel('Event date').fill(v.date);
  await page.getByLabel('City').fill(v.city);
  await page.getByRole('button', { name: 'Continue to next wizard step' }).click();

  await page.getByLabel('Total budget').fill(String(v.budgetRupees));
  await page.getByLabel('Expected guests').fill(String(v.guests));
  await page.getByRole('button', { name: 'Continue to next wizard step' }).click();

  if (v.themeWord) {
    await page.getByLabel('Add a theme word').fill(v.themeWord);
    await page.getByLabel('Add a theme word').press('Enter');
  }
  await page.getByRole('button', { name: 'Finish celebration setup' }).click();
  await page.waitForURL(/\/events\/evt-[a-z0-9]+$/);
  return page.url().split('/').pop()!;
}

/** Reads one saved plan straight from the browser's IndexedDB (the app's own store). */
export async function readPlan(page: Page, id: string): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    (planId) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('toranly');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          try {
            const db = open.result;
            const get = db.transaction('plans', 'readonly').objectStore('plans').get(planId);
            get.onsuccess = () => resolve(get.result ?? null);
            get.onerror = () => reject(get.error);
          } catch (err) {
            reject(err);
          }
        };
      }),
    id,
  );
}

/** Indian digit grouping as the app shows it, e.g. 1250000 -> "₹12,50,000". */
export function inr(rupees: number): string {
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export async function acceptAiConsent(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Before you use AI suggestions' });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(dialog).toBeHidden();
}

/** My Plans shows a one-time "saved in this browser" notice; acknowledge it like a visitor. */
export async function dismissStorageNotice(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'I understand' });
  try {
    await button.click({ timeout: 3000 });
  } catch {
    // Already acknowledged on this device.
  }
}
