import React from 'react';
import { Container } from './Container';
import { scrollToSection } from '../lib/scrollToSection';
import './Footer.css';

const COPYRIGHT_YEAR = 2026;

export const Footer: React.FC = () => {
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const scrolled = scrollToSection(id);
    if (scrolled) {
      e.preventDefault();
    }
  };

  return (
    <footer className="landing-footer" aria-label="Site Footer">
      <Container>
        <div className="footer-main">
          {/* 1. Distinctive Brand Area */}
          <div className="footer-brand-area">
            <img
              src="/toranly-logo.png"
              alt="Toranly"
              className="footer-brand-logo"
              width={220}
              height={88}
              loading="lazy"
            />
            <p className="footer-brand-tagline">Make room for the moments that matter.</p>
            <p className="footer-brand-desc">
              Plan your celebrations with more clarity, less stress, and everything in its place.
            </p>
          </div>

          {/* 2. Category-Wise Navigation */}
          <nav aria-label="Footer" className="footer-nav">
            {/* Explore Group */}
            <div className="footer-nav-group">
              <h3 className="footer-group-title">Explore</h3>
              <ul className="footer-group-list">
                <li className="footer-nav-item">
                  <a
                    href="#features"
                    className="footer-nav-link"
                    onClick={(e) => handleAnchorClick(e, 'features')}
                  >
                    Features
                  </a>
                </li>
                <li className="footer-nav-item">
                  <a
                    href="#how-it-works"
                    className="footer-nav-link"
                    onClick={(e) => handleAnchorClick(e, 'how-it-works')}
                  >
                    How it works
                  </a>
                </li>
                <li className="footer-nav-item">
                  <a
                    href="#faq"
                    className="footer-nav-link"
                    onClick={(e) => handleAnchorClick(e, 'faq')}
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Information Group */}
            <div className="footer-nav-group">
              <h3 className="footer-group-title">Information</h3>
              <ul className="footer-group-list">
                <li className="footer-nav-item">
                  <span className="footer-nav-unavailable" aria-disabled="true">
                    Privacy Policy
                  </span>
                </li>
                <li className="footer-nav-item">
                  <span className="footer-nav-unavailable" aria-disabled="true">
                    Terms of Service
                  </span>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* 4. Bottom Horizontal Divider & Copyright Bar */}
        <div className="footer-divider" role="separator" />

        <div className="footer-bottom-row">
          <p className="footer-copyright">&copy; {COPYRIGHT_YEAR} Toranly. All rights reserved.</p>
          <p className="footer-signature">Made for meaningful moments.</p>
        </div>
      </Container>
    </footer>
  );
};
