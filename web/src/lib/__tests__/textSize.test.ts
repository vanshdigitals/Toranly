import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTextSize, setTextSize } from '../textSize';

const store = new Map<string, string>();
const root = { dataset: {} as Record<string, string> };
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});
vi.stubGlobal('document', { documentElement: root });

beforeEach(() => {
  store.clear();
  root.dataset = {};
});

describe('text size', () => {
  it('defaults to Standard and ignores unknown stored values', () => {
    expect(getTextSize()).toBe('standard');
    store.set('toranly.textSize', 'huge');
    expect(getTextSize()).toBe('standard');
  });

  it('applies the size to <html> and remembers it on this device', () => {
    setTextSize('x-large');
    expect(root.dataset.textSize).toBe('x-large');
    expect(getTextSize()).toBe('x-large');
  });
});
