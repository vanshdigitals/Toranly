import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from './Header';
import { Container } from './Container';
import './PlaceholderPage.css';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

/**
 * Temporary page shell for routes whose screens are not built yet.
 * Uses the shared header and container so navigation and alignment can be tested.
 */
export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
  return (
    <div className="placeholder-page">
      <Header />
      <main id="main-content" className="placeholder-main">
        <Container className="placeholder-content">
          <h1>{title}</h1>
          <p>{description}</p>
          <Link to="/" className="placeholder-back-link">
            Back to home
          </Link>
        </Container>
      </main>
    </div>
  );
};
