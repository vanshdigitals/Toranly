import React, { useCallback, useEffect, useRef } from 'react';
import { ModalOverlay, Modal, Dialog } from 'react-aria-components';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { ToranlyLogomark } from './ToranlyLogomark';
import { scrollToSection } from '../lib/scrollToSection';
import './MobileDrawer.css';

/** Calls `callback` when the drawer content unmounts, i.e. after the exit animation. */
const OnUnmount: React.FC<{ callback: () => void }> = ({ callback }) => {
  useEffect(() => callback, [callback]);
  return null;
};

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hasPlans?: boolean;
  /** Shared Start planning behaviour from the header; defaults to opening the wizard. */
  onStartPlanning?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  hasPlans = false,
  onStartPlanning,
}) => {
  const navigate = useNavigate();

  // Close drawer automatically if viewport grows past the collapse point (768px)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handleResize = (e: MediaQueryListEvent) => {
      if (e.matches) {
        onClose();
      }
    };
    mql.addEventListener('change', handleResize);
    return () => mql.removeEventListener('change', handleResize);
  }, [onClose]);

  // In-page anchor chosen in the drawer, handled once the drawer has fully closed
  const pendingAnchorRef = useRef<string | null>(null);

  const runPendingAnchor = useCallback(() => {
    const href = pendingAnchorRef.current;
    if (!href) return;
    pendingAnchorRef.current = null;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!scrollToSection(href.slice(1))) navigate(`/${href}`);
      }),
    );
  }, [navigate]);

  const handleLinkClick = (href: string, isAnchor = false) => {
    if (isAnchor) pendingAnchorRef.current = href;
    onClose();
    if (!isAnchor) navigate(href);
  };

  const handleStartPlanning = () => {
    onClose();
    if (onStartPlanning) onStartPlanning();
    else navigate('/events/new');
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
      className="drawer-overlay"
    >
      <Modal className="drawer-panel">
        <Dialog id="mobile-drawer" aria-label="Menu" className="drawer-dialog">
          <OnUnmount callback={runPendingAnchor} />
          {/* Header Row: Logo + Close Button */}
          <div className="drawer-header">
            <Link
              to="/"
              className="drawer-logo-link"
              onClick={() => handleLinkClick('/')}
              aria-label="Toranly home"
            >
              <ToranlyLogomark className="drawer-logomark" aria-hidden="true" />
              <span className="drawer-wordmark">Toranly</span>
            </Link>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={onClose}
              aria-label="Close menu"
              autoFocus
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>

          {/* Navigation Links in exact header order */}
          <nav className="drawer-nav" aria-label="Mobile Navigation">
            <a
              href="#features"
              className="drawer-nav-item"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#features', true);
              }}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="drawer-nav-item"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#how-it-works', true);
              }}
            >
              How it works
            </a>
            <a
              href="#faq"
              className="drawer-nav-item"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#faq', true);
              }}
            >
              FAQ
            </a>
            {hasPlans && (
              <Link to="/events" className="drawer-nav-item" onClick={() => handleLinkClick('/events')}>
                My plans
              </Link>
            )}
          </nav>

          {/* Action Button: Full Width Primary Pill */}
          <div className="drawer-actions">
            <Button variant="primary" fullWidth onClick={handleStartPlanning}>
              Start planning
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
