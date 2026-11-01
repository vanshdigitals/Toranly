import type { WizardData } from '../types/wizard';
import {
  getWizardDraft as getDraft,
  saveWizardDraft as saveDraft,
  clearWizardDraft as clearDraft,
  createInitialWizardData,
} from './eventState';

export type WizardDraft = WizardData;

export function getWizardDraft(initialType?: string | null): WizardData {
  return getDraft(initialType);
}

export function saveWizardDraft(updates: Partial<WizardData>): WizardData {
  return saveDraft(updates);
}

export function clearWizardDraft(): void {
  clearDraft();
}

export const DEFAULT_WIZARD_DRAFT = createInitialWizardData('wedding');
