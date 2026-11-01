import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { scrollToSection } from '../lib/scrollToSection';
import { CalendarDays, ListChecks, Lightbulb, Wallet } from 'lucide-react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Container } from '../components/Container';
import { SectionHeading } from '../components/SectionHeading';
import { ProblemSolutionSection } from '../components/ProblemSolutionSection';
import { FeaturesSection } from '../components/FeaturesSection';
import { CelebrationsSection } from '../components/CelebrationsSection';
import { FAQSection } from '../components/FAQSection';
import { useStartPlanning } from '../lib/useStartPlanning';
import { FEATURE_ACCOUNTS } from '../config/features';
import './LandingPage.css';

export const LandingPage: React.FC = () => {
  const { hash } = useLocation();
  const { startPlanning, welcomeBackDialog } = useStartPlanning();

  // Keep real links (new tab, middle click); a plain click checks for saved plans first.
  const handleStartClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void startPlanning();
  };

  // Arriving from another page via "/#how-it-works": scroll to that section
  useEffect(() => {
    if (hash) scrollToSection(hash.slice(1));
  }, [hash]);

  return (
    <div className="landing-page">
      {/* 1. Responsive Public Header */}
      <Header />

      <main id="main-content" className="main-content">
        {/* 2. Hero Section (Centred with background image & 78% flat overlay) */}
        <section className="hero-section" aria-labelledby="hero-heading">
          <div className="hero-bg" aria-hidden="true">
            <picture>
              <source
                type="image/webp"
                srcSet="/hero-courtyard-1200.webp 1200w, /hero-courtyard-1600.webp 1600w"
                sizes="100vw"
              />
              <img
                src="/hero-courtyard-1600.webp"
                alt=""
                className="hero-bg-img"
                width={1600}
                height={900}
                loading="eager"
                fetchPriority="high"
              />
            </picture>
            <div className="hero-bg-overlay" />
          </div>

          <Container className="hero-container">
            <div className="hero-content">
              <span className="hero-eyebrow">AI-POWERED CELEBRATION PLANNER</span>
              <h1 id="hero-heading" className="hero-headline">
                Every celebration, calmly in order.
              </h1>
              <p className="hero-subtitle">
                Plan weddings, birthdays and family celebrations with a budget that adds up and a
                checklist that keeps time.
              </p>
              <p className="hero-body">
                Toranly suggests ideas for themes, menus and savings. You decide what stays.
              </p>
              <div className="hero-actions">
                <Link
                  to="/events/new"
                  className="hero-btn hero-btn-primary"
                  onClick={handleStartClick}
                >
                  Start planning
                </Link>
                <a
                  href="#how-it-works"
                  className="hero-btn hero-btn-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('how-it-works');
                  }}
                >
                  See how it works
                </a>
              </div>
            </div>
          </Container>
        </section>

        {/* 3. Problem to Solution Section (id="why-toranly") */}
        <ProblemSolutionSection />

        {/* 4. Features Section (id="features") */}
        <FeaturesSection />

        {/* 5. How It Works Section (id="how-it-works") */}
        <section
          id="how-it-works"
          className="how-it-works-section"
          aria-labelledby="how-it-works-heading"
        >
          <Container>
            <SectionHeading
              headingId="how-it-works-heading"
              heading="Four steps to a plan you can trust"
              intro="From the first idea to the big day, Toranly keeps everything in one place."
            />

            <div className="how-it-works-container">
              {/* Desktop-only decorative connector line */}
              <div className="how-it-works-connector" aria-hidden="true" />

              <ol className="how-it-works-steps">
                <li className="how-it-works-card">
                  <div className="how-it-works-card-header">
                    <span className="step-pill">Step 1</span>
                    <CalendarDays size={24} className="step-icon" aria-hidden="true" />
                  </div>
                  <h3 className="step-title">Tell us about the occasion</h3>
                  <p className="step-text">
                    Pick the event type, date, city, budget and guest count. It takes four short
                    steps, and you can change anything later.
                  </p>
                </li>

                <li className="how-it-works-card">
                  <div className="how-it-works-card-header">
                    <span className="step-pill">Step 2</span>
                    <ListChecks size={24} className="step-icon" aria-hidden="true" />
                  </div>
                  <h3 className="step-title">Get a starter plan</h3>
                  <p className="step-text">
                    Toranly sets up budget categories and a checklist with due dates counted back
                    from your event.
                  </p>
                </li>

                <li className="how-it-works-card">
                  <div className="how-it-works-card-header">
                    <span className="step-pill">Step 3</span>
                    <Lightbulb size={24} className="step-icon" aria-hidden="true" />
                  </div>
                  <h3 className="step-title">Add ideas you like</h3>
                  <p className="step-text">
                    Ask for theme, menu or saving ideas. Accept the ones you like. Nothing is added
                    without your yes.
                  </p>
                </li>

                <li className="how-it-works-card">
                  <div className="how-it-works-card-header">
                    <span className="step-pill">Step 4</span>
                    <Wallet size={24} className="step-icon" aria-hidden="true" />
                  </div>
                  <h3 className="step-title">Stay on track</h3>
                  <p className="step-text">
                    Log expenses, compare vendor quotes and tick off tasks. Toranly warns you before
                    your budget slips.
                  </p>
                </li>
              </ol>
            </div>
          </Container>
        </section>

        {/* 4. Every Celebration, Your Way Section */}
        <CelebrationsSection />

        {/* 5. FAQ Section */}
        <FAQSection />

        {/* 5. Final Call-to-Action Section */}
        <section className="final-cta-section" aria-labelledby="final-cta-heading">
          <Container>
            <div className="final-cta-panel">
              {/* Toran motif: CSS only, decorative, aria-hidden */}
              <div className="final-cta-toran" aria-hidden="true">
                <div className="toran-line" />
                <div className="toran-dots">
                  <span className="toran-dot" />
                  <span className="toran-dot" />
                  <span className="toran-dot" />
                  <span className="toran-dot" />
                  <span className="toran-dot" />
                  <span className="toran-dot toran-dot--tablet" />
                  <span className="toran-dot toran-dot--tablet" />
                  <span className="toran-dot toran-dot--desktop" />
                  <span className="toran-dot toran-dot--desktop" />
                </div>
              </div>

              <div className="final-cta-content">
                <span className="final-cta-eyebrow">YOUR NEXT CHAPTER OF CELEBRATION</span>
                <h2 id="final-cta-heading" className="final-cta-headline">
                  The celebration is yours. The planning is ours.
                </h2>
                <p className="final-cta-supporting">
                  Bring your ideas, budget, and plans together in one place—so you can spend less
                  time organizing and more time enjoying the moments that matter.
                </p>
                <div className="final-cta-actions">
                  <Link
                    to="/events/new"
                    className="btn btn-primary final-cta-btn"
                    onClick={handleStartClick}
                  >
                    Start Planning
                  </Link>
                  {FEATURE_ACCOUNTS && (
                    <p className="final-cta-secondary">
                      Already have an account?{' '}
                      <Link to="/login" className="final-cta-signin-link">
                        Sign in
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Container>
        </section>
      </main>

      {/* 5. Footer */}
      <Footer />
      {welcomeBackDialog}
    </div>
  );
};
