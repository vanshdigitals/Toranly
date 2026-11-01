import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';
import './WelcomeBackDialog.css';

interface WelcomeBackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
  onStartNew: () => void;
}

const EXIT_MS = 160;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Shown when "Start planning" is clicked in a browser that already has saved plans.
 * It only navigates: closing it creates or changes nothing.
 */
export const WelcomeBackDialog: React.FC<WelcomeBackDialogProps> = ({
  isOpen,
  onClose,
  onViewPlans,
  onStartNew,
}) => {
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const exitTimer = useRef<number | undefined>(undefined);

  // Play the exit transition, then run the chosen action once.
  const leave = useCallback((action: () => void) => {
    if (exitTimer.current !== undefined) return;
    if (prefersReducedMotion()) {
      action();
      return;
    }
    setClosing(true);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = undefined;
      setClosing(false);
      action();
    }, EXIT_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        leave(onClose);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previous?.focus?.();
    };
  }, [isOpen, leave, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="welcome-overlay"
      data-state={closing ? 'closing' : 'open'}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) leave(onClose);
      }}
    >
      <div
        ref={dialogRef}
        className="welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-dialog-title"
        aria-describedby="welcome-dialog-desc"
      >
        <button
          type="button"
          className="welcome-close-btn"
          onClick={() => leave(onClose)}
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id="welcome-dialog-title" className="welcome-title">
          Welcome back!
        </h2>
        <p id="welcome-dialog-desc" className="welcome-desc">
          You already have saved event plans. Would you like to continue planning or start a new
          celebration?
        </p>

        <div className="welcome-actions">
          <button
            ref={primaryRef}
            type="button"
            className="welcome-btn welcome-btn-primary"
            onClick={() => leave(onViewPlans)}
          >
            <FolderOpen size={16} aria-hidden="true" />
            View My Plans
          </button>
          <button
            type="button"
            className="welcome-btn welcome-btn-secondary"
            onClick={() => leave(onStartNew)}
          >
            <Plus size={16} aria-hidden="true" />
            Start New Planning
          </button>
        </div>
        <p className="welcome-note">Plans are saved in this browser on this device.</p>
      </div>
    </div>
  );
};
