import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Container } from './Container';
import { Button } from './Button';
import { ThemeToggle } from './ThemeToggle';
import { ToranlyLogomark } from './ToranlyLogomark';
import { scrollToSection } from '../lib/scrollToSection';
import { hasAnyPlans } from '../storage/db';
import { getAllEvents } from '../lib/eventState';
import { useStartPlanning } from '../lib/useStartPlanning';
import './Header.css';

// The drawer (and react-aria) downloads only when the menu is first opened.
const MobileDrawer = lazy(() =>
  import('./MobileDrawer').then((m) => ({ default: m.MobileDrawer })),
);

export const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerUsed, setDrawerUsed] = useState(false);
  useEffect(() => {
    if (isDrawerOpen) setDrawerUsed(true);
  }, [isDrawerOpen]);
  const [hasPlans, setHasPlans] = useState(false);
  const navigate = useNavigate();
  const { startPlanning, welcomeBackDialog } = useStartPlanning();

  // Scroll listener: when scrolled > 8px, show 1px bottom border using border token
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if browser has any existing plans
  useEffect(() => {
    let active = true;
    const checkPlans = async () => {
      const anyInDb = await hasAnyPlans();
      const anyInLocal = getAllEvents().length > 0;
      if (active) {
        setHasPlans(anyInDb || anyInLocal);
      }
    };
    checkPlans();
    return () => {
      active = false;
    };
  }, []);

  const handleNavAnchor = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    if (!scrollToSection(id)) {
      // Not on the landing page: navigate there with hash
      navigate(`/#${id}`);
    }
  };

  const handleStartPlanning = () => {
    void startPlanning();
  };

  return (
    <>
      <header className={`site-header ${isScrolled ? 'is-scrolled' : ''}`}>
        <Container className="header-container">
          {/* Left: Logo linking to / with aria-label "Toranly home" */}
          <Link to="/" className="header-logo-link" aria-label="Toranly home">
            <ToranlyLogomark className="header-logomark" aria-hidden="true" />
            <span className="header-wordmark">Toranly</span>
          </Link>

          {/* Desktop & Laptop Navigation */}
          <nav className="header-desktop-nav" aria-label="Main Navigation">
            <div className="header-nav-links">
              <a
                href="#features"
                className="header-nav-link"
                onClick={(e) => handleNavAnchor(e, 'features')}
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="header-nav-link"
                onClick={(e) => handleNavAnchor(e, 'how-it-works')}
              >
                How it works
              </a>
              <a href="#faq" className="header-nav-link" onClick={(e) => handleNavAnchor(e, 'faq')}>
                FAQ
              </a>
              {/* Under guest-first flow, "My plans" is shown only when at least one plan exists */}
              {hasPlans && (
                <Link to="/events" className="header-nav-link">
                  My plans
                </Link>
              )}
            </div>

            <div className="header-nav-actions">
              {/* Theme toggle slot (desktop) */}
              <ThemeToggle size="desktop" />

              {/* Primary Pill Button */}
              <Button variant="primary" className="header-cta-btn" onClick={handleStartPlanning}>
                Start planning
              </Button>
            </div>
          </nav>

          {/* Mobile Actions: Theme toggle + Hamburger button */}
          <div className="header-mobile-actions">
            <ThemeToggle size="mobile" />

            <button
              type="button"
              className="hamburger-btn"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={isDrawerOpen}
              aria-controls="mobile-drawer"
            >
              <Menu size={24} aria-hidden="true" />
            </button>
          </div>
        </Container>
      </header>

      {/* Right-side Mobile Drawer */}
      {(drawerUsed || isDrawerOpen) && (
        <Suspense fallback={null}>
          <MobileDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            hasPlans={hasPlans}
            onStartPlanning={handleStartPlanning}
          />
        </Suspense>
      )}
      {welcomeBackDialog}
    </>
  );
};
