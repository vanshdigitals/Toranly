/** Settings control for the app-wide text size (radio group, keyboard accessible). */
import { useState } from 'react';
import { getTextSize, setTextSize, TEXT_SIZES, type TextSize } from '../lib/textSize';
import './TextSizeControl.css';

export function TextSizeControl() {
  const [size, setSize] = useState<TextSize>(getTextSize);

  const choose = (next: TextSize) => {
    setSize(next);
    setTextSize(next);
  };

  return (
    <fieldset className="text-size-control">
      <legend className="text-size-legend">Text size</legend>
      <p className="text-size-help">
        Makes all text in Toranly bigger or smaller. Saved on this device.
      </p>
      <div className="text-size-options">
        {TEXT_SIZES.map((option) => (
          <label
            key={option.value}
            className={`text-size-option ${size === option.value ? 'is-active' : ''}`}
          >
            <input
              type="radio"
              name="text-size"
              value={option.value}
              checked={size === option.value}
              onChange={() => choose(option.value)}
            />
            <span className={`text-size-sample sample-${option.value}`} aria-hidden="true">
              Aa
            </span>
            <span className="text-size-label">{option.label}</span>
            <span className="text-size-hint">{option.hint}</span>
          </label>
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        Text size: {TEXT_SIZES.find((o) => o.value === size)?.label}
      </p>
    </fieldset>
  );
}
