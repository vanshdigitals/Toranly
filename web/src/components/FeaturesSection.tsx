import React from 'react';
import { Wallet, ListChecks, Users, Lightbulb, AlertCircle, Check } from 'lucide-react';
import { Container } from './Container';
import { SectionHeading } from './SectionHeading';
import './FeaturesSection.css';

interface FeatureItem {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  title: string;
  description: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: Wallet,
    title: 'Budget in rupees that adds up',
    description: 'Set what each part can cost, log expenses, and see the moment a category goes over.',
  },
  {
    icon: ListChecks,
    title: 'A checklist tied to your date',
    description: 'Tasks count back from the event. Move the date and see what shifts before you confirm.',
  },
  {
    icon: Users,
    title: 'Guests and food preferences',
    description:
      "Track veg, non-veg, Jain and other diets, and see which groups your menu doesn't cover yet.",
  },
  {
    icon: Lightbulb,
    title: 'Ideas you approve',
    description: 'Ask for theme, menu or saving ideas. Nothing is added until you accept it.',
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="features-section" aria-labelledby="features-heading">
      <Container>
        <SectionHeading
          headingId="features-heading"
          eyebrow="FEATURES"
          heading="Your budget, checklist and plans, together"
          intro="Everything you need to plan a celebration, kept in one calm place."
        />

        <div className="features-layout">
          {/* Feature List (stacked first on <1024px, right column on >=1024px) */}
          <div className="features-list-wrapper">
            <ul className="features-list">
              {FEATURES.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <li key={index} className="feature-item-row">
                    <div className="feature-item-icon-col">
                      <IconComponent size={24} className="feature-item-icon" aria-hidden={true} />
                    </div>
                    <div className="feature-item-text-col">
                      <h3 className="feature-item-title">{item.title}</h3>
                      <p className="feature-item-desc">{item.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Product Showcase Panel (stacked second on <1024px, left 7/12 column on >=1024px) */}
          <div className="features-showcase-wrapper">
            <p className="sr-only">Example of a Toranly event overview.</p>
            <div className="showcase-panel" tabIndex={-1} aria-hidden="true">
              {/* Header */}
              <div className="showcase-header">
                <div className="showcase-header-main">
                  <h4 className="showcase-event-title">Ananya &amp; Rohan's Wedding</h4>
                  <p className="showcase-event-meta">Wedding · Jaipur · 14 Feb 2027</p>
                </div>
                <div className="showcase-countdown">
                  <span className="showcase-countdown-num">110</span>
                  <span className="showcase-countdown-label">days to go</span>
                </div>
              </div>

              {/* Budget Row */}
              <div className="showcase-budget-card">
                <div className="showcase-budget-figures">
                  <span className="budget-stat">
                    Allocated <strong className="budget-val">₹18,00,000</strong>
                  </span>
                  <span className="budget-dot">·</span>
                  <span className="budget-stat">
                    Committed <strong className="budget-val">₹9,47,000</strong>
                  </span>
                  <span className="budget-dot">·</span>
                  <span className="budget-stat">
                    Remaining <strong className="budget-val">₹8,53,000</strong>
                  </span>
                </div>

                <div className="showcase-progress-bar" role="progressbar" aria-valuenow={53} aria-valuemin={0} aria-valuemax={100}>
                  <div className="showcase-progress-fill" style={{ width: '53%' }} />
                </div>

                <div className="showcase-budget-alert-row">
                  <span className="showcase-status-chip">
                    <AlertCircle size={14} className="status-chip-icon" />
                    Catering: over by ₹25,000
                  </span>
                </div>
              </div>

              {/* Task Rows */}
              <div className="showcase-tasks-list">
                {/* Task 1 */}
                <div className="showcase-task-row">
                  <div className="showcase-checkbox">
                    <Check size={12} className="showcase-check-icon" />
                  </div>
                  <div className="showcase-task-info">
                    <span className="showcase-task-name">Finalise decor vendor</span>
                    <span className="showcase-task-date">· 15 Nov 2026</span>
                  </div>
                </div>

                {/* Task 2 */}
                <div className="showcase-task-row">
                  <div className="showcase-checkbox" />
                  <div className="showcase-task-info">
                    <span className="showcase-task-name">Book mehendi artist</span>
                    <span className="showcase-task-date">· 1 Dec 2026</span>
                  </div>
                </div>

                {/* Task 3 (hidden below 640px) */}
                <div className="showcase-task-row showcase-task--milestone">
                  <div className="showcase-checkbox" />
                  <div className="showcase-task-info">
                    <span className="showcase-task-name">Send invitations</span>
                    <span className="showcase-task-date">· 15 Dec 2026</span>
                  </div>
                  <span className="showcase-chip showcase-chip--milestone">Milestone</span>
                </div>
              </div>

              {/* Suggestion Row (hidden below 640px) */}
              <div className="showcase-suggestion-card">
                <div className="showcase-suggestion-top">
                  <span className="showcase-chip showcase-chip--suggested">Suggested</span>
                  <span className="showcase-chip showcase-chip--estimate">Save ₹20,000 to ₹35,000</span>
                </div>
                <p className="showcase-suggestion-text">Reuse sangeet stage decor for the reception</p>
                <div className="showcase-suggestion-actions">
                  <button type="button" tabIndex={-1} className="showcase-btn showcase-btn--primary">
                    Accept
                  </button>
                  <button type="button" tabIndex={-1} className="showcase-btn showcase-btn--secondary">
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};
