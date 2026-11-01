import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, CircleAlert, Loader2 } from 'lucide-react';
import { ToranlyLogomark } from '../components/ToranlyLogomark';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    setAuthError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Email address is required.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setAuthError(null);

    // Simulate authentication request
    setTimeout(() => {
      setIsLoading(false);
      // Backend authentication is not connected; display the authentic 401 Auth Error specification
      setAuthError('Email or password is incorrect.');
    }, 600);
  };

  return (
    <div className="signin-page">
      {/* Top Bar Header */}
      <header className="signin-header" aria-label="Sign in header">
        <div className="signin-header-inner">
          <div className="signin-header-left">
            <Link to="/" className="signin-back-link" aria-label="Back to home">
              <ArrowLeft size={18} aria-hidden="true" />
              <span>Back</span>
            </Link>
          </div>

          <div className="signin-header-center">
            <Link to="/" className="signin-header-brand" aria-label="Toranly home">
              <span className="signin-header-wordmark">Toranly</span>
            </Link>
          </div>

          <div className="signin-header-right" aria-hidden="true" />
        </div>
      </header>

      {/* Main Content: Centered Sign In Card */}
      <main id="main-content" className="signin-main">
        <div className="signin-card">
          {/* Card Branding */}
          <div className="signin-card-brand">
            <ToranlyLogomark className="signin-card-logomark" aria-hidden="true" />
            <span className="signin-card-brand-name">Toranly</span>
          </div>

          {/* Heading & Supporting Text */}
          <div className="signin-card-heading-block">
            <h1 className="signin-card-title">Welcome back</h1>
            <p className="signin-card-subtitle">
              Sign in to manage your celebrations, budgets, and vendors.
            </p>
          </div>

          {/* Accessible 401 Auth Error State Alert */}
          {authError && (
            <div
              className="signin-alert-error"
              role="alert"
              aria-live="assertive"
            >
              <CircleAlert size={20} className="signin-alert-icon" aria-hidden="true" />
              <div className="signin-alert-text">
                <p className="signin-alert-title">Authentication failed</p>
                <p className="signin-alert-desc">{authError}</p>
              </div>
            </div>
          )}

          {/* Sign In Form */}
          <form className="signin-form" noValidate onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="signin-field-group">
              <label htmlFor="signin-email" className="signin-label">
                Email address
              </label>
              <input
                id="signin-email"
                type="email"
                name="email"
                autoComplete="email"
                className={`signin-input ${emailError || authError ? 'is-invalid' : ''}`}
                placeholder="arun.sharma@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                  if (authError) setAuthError(null);
                }}
                disabled={isLoading}
                aria-invalid={emailError || authError ? 'true' : 'false'}
                aria-describedby={emailError ? 'signin-email-error' : undefined}
              />
              <div className="signin-field-feedback" id="signin-email-error" aria-live="polite">
                {emailError && <span className="signin-error-text">{emailError}</span>}
              </div>
            </div>

            {/* Password Field */}
            <div className="signin-field-group">
              <label htmlFor="signin-password" className="signin-label">
                Password
              </label>
              <div className="signin-password-wrapper">
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  className={`signin-input signin-password-input ${passwordError || authError ? 'is-invalid' : ''}`}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                    if (authError) setAuthError(null);
                  }}
                  disabled={isLoading}
                  aria-invalid={passwordError || authError ? 'true' : 'false'}
                  aria-describedby={passwordError ? 'signin-password-error' : undefined}
                />
                <button
                  type="button"
                  className="signin-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              <div className="signin-field-feedback" id="signin-password-error" aria-live="polite">
                {passwordError && <span className="signin-error-text">{passwordError}</span>}
              </div>
            </div>

            {/* Submit Button */}
            <div className="signin-submit-row">
              <button
                type="submit"
                className="signin-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="signin-spinner" aria-hidden="true" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          {/* Card Footer: New here? Create an account */}
          <div className="signin-card-footer">
            <span className="signin-footer-prompt">New here?</span>{' '}
            <Link to="/register" className="signin-footer-link">
              Create an account
            </Link>
          </div>
        </div>
      </main>

      {/* Subtle Bottom Operational Bar */}
      <footer className="signin-bottom-bar" aria-label="System status and legal links">
        <div className="signin-bottom-inner">
          <div className="signin-status-indicator">
            <span className="signin-status-dot" aria-hidden="true" />
            <span className="signin-status-text">All systems operational</span>
          </div>

          <div className="signin-legal-links">
            <span className="signin-legal-item">Privacy</span>
            <span className="signin-legal-sep" aria-hidden="true">·</span>
            <span className="signin-legal-item">Terms</span>
            <span className="signin-legal-sep" aria-hidden="true">·</span>
            <span className="signin-legal-item">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
