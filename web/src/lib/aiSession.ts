/**
 * Device-local AI state kept in IndexedDB meta: the privacy consent and the last AI results
 * per plan (so a refresh does not lose suggestions that were not applied yet).
 */
import type { AiContract, AiItem, AiSuggestResult } from '../api/ai';
import { getMeta, setMeta } from '../storage/db';

export const AI_CONSENT_KEY = 'aiConsentGiven.v2';

export const AI_CONSENT_TEXT =
  'To suggest ideas, Toranly sends your event type, month, city, guest range, budget and ' +
  'preferences to our AI provider, xAI (Groq is used as a backup when xAI is unavailable). ' +
  'Names, contact details and notes are never sent.';

export async function getAiConsent(): Promise<boolean> {
  return (await getMeta<boolean>(AI_CONSENT_KEY)) === true;
}

export async function setAiConsent(value: boolean): Promise<void> {
  await setMeta(AI_CONSENT_KEY, value);
}

export type AiItemState = 'suggested' | 'accepted' | 'rejected' | 'applied';

export interface AiRun {
  id: string;
  contract: AiContract;
  createdAt: string;
  status: AiSuggestResult['status'];
  message: string | null;
  assumptions: string[];
  warnings: string[];
  items: { item: AiItem; state: AiItemState }[];
}

const MAX_RUNS = 5;
const runsKey = (planId: string) => `aiResults.v1:${planId}`;

export async function loadAiRuns(planId: string): Promise<AiRun[]> {
  return (await getMeta<AiRun[]>(runsKey(planId))) ?? [];
}

/** Saves the runs, newest first, keeping the last five. */
export async function saveAiRuns(planId: string, runs: AiRun[]): Promise<AiRun[]> {
  const kept = runs.slice(0, MAX_RUNS);
  await setMeta(runsKey(planId), kept);
  return kept;
}

export function runFromResult(contract: AiContract, result: AiSuggestResult): AiRun {
  return {
    id: `run-${Date.now().toString(36)}`,
    contract,
    createdAt: new Date().toISOString(),
    status: result.status,
    message: result.message,
    assumptions: result.assumptions,
    warnings: result.warnings,
    items: (result.items as AiItem[]).map((item) => ({ item, state: 'suggested' })),
  };
}
