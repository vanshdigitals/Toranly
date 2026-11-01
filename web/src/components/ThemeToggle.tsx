import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import './ThemeToggle.css';

/**
 * Flag determining if theme toggle is enabled.
 * Per DESIGN_SYSTEM.md §9 and User requirements, light theme only is defined for MVP.
 * Set to false until dark theme tokens are finalized.
 */
export const THEME_TOGGLE_ENABLED = false;

interface ThemeToggleProps {
  size?: 'desktop' | 'mobile';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ size = 'desktop', className = '' }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('toranly-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    // While disabled, never apply a theme: an OS dark preference must not switch on an unapproved palette
    if (!THEME_TOGGLE_ENABLED) return;
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('toranly-theme', theme);
    } catch {
      // Ignore localStorage errors (e.g. private browsing)
    }
  }, [theme]);

  if (!THEME_TOGGLE_ENABLED) {
    // Keep clearly marked slot in code without rendering unapproved dark palette
    return null;
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${size} ${className}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
    </button>
  );
};
