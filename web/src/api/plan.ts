/**
 * Plan calculation endpoints (/api/v1/plan/*). The backend is stateless: the plan is sent in
 * the request and nothing is stored. The Python result is the source of truth; the browser's
 * own calculation is only an instant preview or an offline fallback.
 */
import { apiRequest } from './client';
import type { components } from './schema';

type Schemas = components['schemas'];

export type ApiPlan = Schemas['Plan'];
export type TemplateRequest = Schemas['TemplateRequest'];
export type TemplateResponse = Schemas['TemplateResponse'];
export type SummaryResponse = Schemas['SummaryResponse'];
export type DatePreviewRequest = Schemas['DatePreviewRequest'];
export type DatePreviewResponse = Schemas['DatePreviewResponse'];
export type ValidateResponse = Schemas['ValidateResponse'];

/** Shown whenever a backend check falls back to the browser's own figures. */
export const LIVE_CHECK_UNAVAILABLE =
  'Live check unavailable. Showing figures calculated on this device.';

export function fetchPlanTemplate(body: TemplateRequest, signal?: AbortSignal) {
  return apiRequest<TemplateResponse>('/plan/template', { method: 'POST', body, signal });
}

export function fetchPlanSummary(plan: ApiPlan, signal?: AbortSignal) {
  return apiRequest<SummaryResponse>('/plan/summary', { method: 'POST', body: { plan }, signal });
}

export function fetchDatePreview(body: DatePreviewRequest, signal?: AbortSignal) {
  return apiRequest<DatePreviewResponse>('/plan/date-preview', { method: 'POST', body, signal });
}

export function validatePlan(plan: ApiPlan, signal?: AbortSignal) {
  return apiRequest<ValidateResponse>('/plan/validate', { method: 'POST', body: { plan }, signal });
}
