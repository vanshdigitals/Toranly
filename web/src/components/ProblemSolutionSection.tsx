import React from 'react';
import { CircleAlert, ArrowDown, CircleCheck } from 'lucide-react';
import { Container } from './Container';
import { SectionHeading } from './SectionHeading';
import './ProblemSolutionSection.css';

interface ProblemSolutionItem {
  problem: string;
  solution: string;
}

const ITEMS: ProblemSolutionItem[] = [
  {
    problem: 'Your budget is scattered across notes and chats.',
    solution: 'One budget in rupees that always adds up.',
  },
  {
    problem: "The date moves, but your tasks don't.",
    solution: 'Tasks count back from your date and shift when it changes.',
  },
  {
    problem: 'Vendor quotes are hard to compare.',
    solution: 'Quotes side by side, worked out per guest.',
  },
];

export const ProblemSolutionSection: React.FC = () => {
  return (
    <section id="why-toranly" className="why-toranly-section" aria-labelledby="why-toranly-heading">
      <Container>
        <SectionHeading
          headingId="why-toranly-heading"
          eyebrow="WHY TORANLY"
          heading="Planning shouldn't feel like a second job"
          intro="Most celebrations are planned across notes, chats and spreadsheets. Toranly brings it into one plan."
        />

        <div className="why-toranly-grid">
          {ITEMS.map((item, idx) => (
            <div key={idx} className="why-toranly-card">
              <div className="why-card-problem">
                <CircleAlert
                  size={20}
                  className="why-card-icon why-icon-warning"
                  aria-hidden="true"
                />
                <p className="why-problem-text">{item.problem}</p>
              </div>

              <div className="why-card-arrow" aria-hidden="true">
                <ArrowDown size={18} className="why-icon-muted" />
              </div>

              <div className="why-card-solution">
                <CircleCheck
                  size={20}
                  className="why-card-icon why-icon-success"
                  aria-hidden="true"
                />
                <p className="why-solution-text">{item.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};
