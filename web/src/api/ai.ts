/**
 * AI endpoints. The browser talks only to the Toranly backend (same origin, /api/v1/ai/*).
 * No provider URL or key exists in this bundle; the server holds the provider keys.
 */
import { apiRequest } from './client';
import type { components } from './schema';

type Schemas = components['schemas'];

export type AiStatus = Schemas['AiStatusResponse'];
export type AiContract = Schemas['SuggestRequest']['contract'];
export type AiSuggestRequest = Schemas['SuggestRequest'];
export type AiSuggestResult = Schemas['SuggestResponse'];
export type AiItem = { kind: string } & Record<string, unknown>;

export const AI_UNAVAILABLE_MESSAGE = "AI suggestions aren't available right now.";

export function getAiStatus(signal?: AbortSignal): Promise<AiStatus> {
  return apiRequest<AiStatus>('/ai/status', { signal });
}

export function requestAiSuggestions(
  contract: AiContract,
  context: AiSuggestRequest['context'],
  feedback?: string,
  signal?: AbortSignal,
): Promise<AiSuggestResult> {
  const body: AiSuggestRequest = { contract, context, feedback: feedback?.trim() || null };
  // Generation can take a while on the provider side; the backend has its own timeout.
  return apiRequest<AiSuggestResult>('/ai/suggest', {
    method: 'POST',
    body,
    signal,
    timeoutMs: 90_000,
  });
}
