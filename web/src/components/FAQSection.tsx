import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Container } from './Container';
import { SectionHeading } from './SectionHeading';
import './FAQSection.css';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const LEFT_COLUMN_FAQS: FAQItem[] = [
  {
    id: 'plan-types',
    question: 'What can I plan with Toranly?',
    answer:
      'Weddings, engagements, birthdays, anniversaries, community events and family celebrations. Each event type starts with its own budget categories and checklist.',
  },
  {
    id: 'plan-storage',
    question: 'Where is my plan saved?',
    answer:
      "In this browser on this device. It isn't uploaded to an account. Clearing browsing data or using a private window removes it, so download a backup to keep a copy.",
  },
  {
    id: 'budget-accuracy',
    question: 'How does Toranly keep my budget accurate?',
    answer:
      "Toranly calculates every amount in rupees itself. It doesn't leave the maths to AI. It warns you when a category reaches 90% of its budget and shows clearly when it goes over.",
  },
  {
    id: 'date-change',
    question: 'What happens if my event date changes?',
    answer:
      'You see a preview of which tasks will move and which ones would become overdue. Nothing changes until you confirm the new date.',
  },
  {
    id: 'food-preferences',
    question: 'Can I plan for guests with different food preferences?',
    answer:
      "Yes. Record how many guests are veg, non-veg, Jain, eggetarian or vegan, plus any allergies. Toranly shows which groups your menu ideas don't cover yet.",
  },
];

const RIGHT_COLUMN_FAQS: FAQItem[] = [
  {
    id: 'ai-changes',
    question: 'Will AI change my plan without asking?',
    answer:
      'No. Suggestions stay marked as suggested until you accept them, and you can reject any of them. Prices from suggestions are always labelled as estimates.',
  },
  {
    id: 'vendor-booking',
    question: 'Does Toranly book vendors for me?',
    answer:
      'No. You add the vendors you are talking to and the quotes they give you. Toranly helps you compare quotes per guest and see what each one leaves out.',
  },
  {
    id: 'ai-information',
    question: 'What information is shared with AI?',
    answer:
      'Only event details needed for ideas, such as the event type, month, city, guest range, budget and preferences. Guest names, phone numbers, emails and your notes are never sent.',
  },
  {
    id: 'download-plan',
    question: 'Can I download my plan?',
    answer:
      'Yes. You can download your budget and your task list as CSV files that open in any spreadsheet app.',
  },
];

export const FAQSection: React.FC = () => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderFAQList = (items: FAQItem[]) => (
    <ul className="faq-list">
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        const buttonId = `faq-btn-${item.id}`;
        const panelId = `faq-panel-${item.id}`;

        return (
          <li key={item.id} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
            <h3 className="faq-question-heading">
              <button
                type="button"
                id={buttonId}
                className="faq-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleItem(item.id)}
              >
                <span className="faq-question-text">{item.question}</span>
                <ChevronDown size={20} className="faq-chevron" aria-hidden="true" />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="faq-panel"
              data-open={isOpen ? 'true' : 'false'}
            >
              <div className="faq-panel-inner">
                <p className="faq-answer-text">{item.answer}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section id="faq" className="faq-section" aria-labelledby="faq-heading">
      <Container>
        <SectionHeading
          headingId="faq-heading"
          heading="Questions, answered"
          intro="The short version of how Toranly works."
        />

        <div className="faq-columns">
          <div className="faq-column">{renderFAQList(LEFT_COLUMN_FAQS)}</div>
          <div className="faq-column">{renderFAQList(RIGHT_COLUMN_FAQS)}</div>
        </div>
      </Container>
    </section>
  );
};
