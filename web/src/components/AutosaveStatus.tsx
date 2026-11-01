import React from 'react';
import { CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import './AutosaveStatus.css';

export type SaveState = 'saved' | 'saving' | 'error';

interface AutosaveStatusProps {
  state: SaveState;
  lastSavedAt?: string | null;
  className?: string;
}

export const AutosaveStatus: React.FC<AutosaveStatusProps> = ({
  state,
  lastSavedAt,
  className = '',
}) => {
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const timeFormatted = formatTime(lastSavedAt);

  return (
    <div
      className={`autosave-status status-${state} ${className}`}
      role="status"
      aria-live="polite"
    >
      {state === 'saving' && (
        <>
          <RefreshCw size={13} className="autosave-spinner" aria-hidden="true" />
          <span>Saving…</span>
        </>
      )}

      {state === 'saved' && (
        <>
          <CheckCircle2 size={13} className="autosave-icon-saved" aria-hidden="true" />
          <span>Saved on this device{timeFormatted ? ` · ${timeFormatted}` : ''}</span>
        </>
      )}

      {state === 'error' && (
        <>
          <AlertCircle size={13} className="autosave-icon-error" aria-hidden="true" />
          <span>Failed to save</span>
        </>
      )}
    </div>
  );
};

