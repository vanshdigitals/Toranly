import React from 'react';
import './SectionHeading.css';

export interface SectionHeadingProps {
  eyebrow?: string;
  heading: string;
  intro?: string;
  headingId?: string;
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  heading,
  intro,
  headingId,
  className = '',
}) => {
  return (
    <div className={`section-heading-block ${className}`}>
      {eyebrow && <span className="section-heading-eyebrow">{eyebrow}</span>}
      <h2 id={headingId} className="section-heading-title">
        {heading}
      </h2>
      {intro && <p className="section-heading-intro">{intro}</p>}
    </div>
  );
};
