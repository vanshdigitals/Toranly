/**
 * Text size preference (Standard / Large / Extra large). It scales the root font size, so
 * every rem-based font grows; the choice is remembered on this device only.
 */
export type TextSize = 'standard' | 'large' | 'x-large';

export const TEXT_SIZES: { value: TextSize; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard', hint: 'Default size' },
  { value: 'large', label: 'Large', hint: 'About 12% bigger' },
  { value: 'x-large', label: 'Extra large', hint: 'About 25% bigger' },
];

const STORAGE_KEY = 'toranly.textSize';

function isTextSize(value: unknown): value is TextSize {
  return value === 'standard' || value === 'large' || value === 'x-large';
}

export function getTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTextSize(stored) ? stored : 'standard';
  } catch {
    return 'standard'; // private mode or blocked storage: use the default
  }
}

/** Sets the size on <html data-text-size> (CSS in index.css does the scaling). */
export function applyTextSize(size: TextSize): void {
  document.documentElement.dataset.textSize = size;
}

export function setTextSize(size: TextSize): void {
  applyTextSize(size);
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Not remembered on this device, but still applied for this visit.
  }
}
