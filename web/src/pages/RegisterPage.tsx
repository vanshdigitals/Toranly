import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Info, CircleAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { ToranlyLogomark } from '../components/ToranlyLogomark';
import { Select } from '../components/Select';
import './RegisterPage.css';

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
];

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    setConflictError(null);

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
    } else if (password.length < 10) {
      setPasswordError('Use at least 10 characters.');
      isValid = false;
    } else if (password.length > 128) {
      setPasswordError('Password must be 128 characters or fewer.');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setConflictError(null);

    // Simulate registration request
    setTimeout(() => {
      setIsLoading(false);
      // Demonstrate 409 Conflict if entering mock existing account
      if (email.trim().toLowerCase() === 'arun.sharma@example.com') {
        setConflictError('An account with this email exists.');
        return;
      }

      // Successful prototype registration state
      setIsSuccess(true);
    }, 600);
  };

  const handleReset = () => {
    setEmail('');
    setPassword('');
    setTimezone('Asia/Kolkata');
    setIsSuccess(false);
    setEmailError(null);
    setPasswordError(null);
    setConflictError(null);
  };

  return (
    <div className="register-page">
      {/* Top Bar Header */}
      <header className="register-header" aria-label="Create account header">
        <div className="register-header-inner">
          <div className="register-header-left">
            <Link to="/" className="register-back-link" aria-label="Back to home">
              <ArrowLeft size={18} aria-hidden="true" />
              <span>Back</span>
            </Link>
          </div>

          <div className="register-header-center">
            <Link to="/" className="register-header-brand" aria-label="Toranly home">
              <span className="register-header-wordmark">Toranly</span>
            </Link>
          </div>

          <div className="register-header-right" aria-hidden="true" />
        </div>
      </header>

      {/* Main Content: Centered Register Card */}
      <main id="main-content" className="register-main">
        <div className="register-card">
          {/* Card Branding */}
          <div className="register-card-brand">
            <ToranlyLogomark className="register-card-logomark" aria-hidden="true" />
            <span className="register-card-brand-name">Toranly</span>
          </div>

          {/* Card Heading & Supporting Text */}
          <div className="register-card-heading-block">
            <span className="register-card-eyebrow">YOUR CELEBRATION STARTS HERE</span>
            <h1 className="register-card-title">Create your Toranly account.</h1>
            <p className="register-card-subtitle">
              Your celebration deserves a plan of its own. Create an account to get started with
              organizing your event details, budget, and plans in one place.
            </p>
          </div>

          {/* Prototype Success Confirmation State */}
          {isSuccess ? (
            <div className="register-success-state" role="status" aria-live="polite">
              <div className="register-success-icon-wrap" aria-hidden="true">
                <CheckCircle2 size={36} className="register-success-icon" />
              </div>
              <h2 className="register-success-title">Account created!</h2>
              <p className="register-success-desc">
                Welcome to Toranly. Your account for <strong>{email}</strong> has been configured
                with timezone <strong>{timezone}</strong>.
              </p>
              <div className="register-prototype-notice">
                <Info size={16} className="register-prototype-notice-icon" aria-hidden="true" />
                <p className="register-prototype-notice-text">
                  <strong>Prototype Status:</strong> In the live app, this advances directly to{' '}
                  <code>S-04 Event Dashboard</code>. Backend database persistence is not connected
                  in this frontend build.
                </p>
              </div>

              <div className="register-success-actions">
                <Link to="/events/new" className="btn btn-primary register-success-btn">
                  Start celebration setup
                </Link>
                <Link to="/" className="btn btn-secondary register-success-btn">
                  Back to home
                </Link>
                <button type="button" onClick={handleReset} className="register-try-again-btn">
                  Create another account
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Canonical 409 Conflict Error Banner */}
              {conflictError && (
                <div className="register-alert-conflict" role="alert" aria-live="assertive">
                  <CircleAlert size={20} className="register-alert-icon" aria-hidden="true" />
                  <div className="register-alert-text">
                    <p className="register-alert-title">Registration conflict</p>
                    <p className="register-alert-desc">
                      {conflictError}{' '}
                      <Link to="/login" className="register-conflict-link">
                        Sign in instead.
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              {/* Registration Form */}
              <form className="register-form" noValidate onSubmit={handleSubmit}>
                {/* Field 1: Email Address */}
                <div className="register-field-group">
                  <label htmlFor="register-email" className="register-label">
                    Email address
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    className={`register-input ${emailError || conflictError ? 'is-invalid' : ''}`}
                    placeholder="arun.sharma@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                      if (conflictError) setConflictError(null);
                    }}
                    disabled={isLoading}
                    aria-invalid={emailError || conflictError ? 'true' : 'false'}
                    aria-describedby={emailError ? 'register-email-error' : undefined}
                  />
                  <div
                    className="register-field-feedback"
                    id="register-email-error"
                    aria-live="polite"
                  >
                    {emailError && <span className="register-error-text">{emailError}</span>}
                  </div>
                </div>

                {/* Field 2: Password */}
                <div className="register-field-group">
                  <label htmlFor="register-password" className="register-label">
                    Password
                  </label>
                  <div className="register-password-wrapper">
                    <input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      className={`register-input register-password-input ${
                        passwordError ? 'is-invalid' : ''
                      }`}
                      placeholder="Enter a strong password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      disabled={isLoading}
                      aria-invalid={passwordError ? 'true' : 'false'}
                      aria-describedby={
                        passwordError ? 'register-password-error' : 'register-password-hint'
                      }
                    />
                    <button
                      type="button"
                      className="register-password-toggle"
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
                  <div
                    className="register-field-feedback"
                    id="register-password-error"
                    aria-live="polite"
                  >
                    {passwordError ? (
                      <span className="register-error-text">{passwordError}</span>
                    ) : (
                      <span id="register-password-hint" className="register-hint-text">
                        At least 10 characters
                      </span>
                    )}
                  </div>
                </div>

                {/* Field 3: Timezone Dropdown */}
                <div className="register-field-group">
                  <label htmlFor="register-timezone" className="register-label">
                    Timezone
                  </label>
                  <Select
                    id="register-timezone"
                    name="timezone"
                    value={timezone}
                    onChange={setTimezone}
                    disabled={isLoading}
                    searchable={true}
                    searchPlaceholder="Search timezone…"
                    options={TIMEZONES.map((tz) => ({
                      value: tz.value,
                      label: tz.label,
                    }))}
                  />
                  <div className="register-field-feedback register-field-feedback--empty" />
                </div>

                {/* Security Callout Box (SECURITY.md §2 specification) */}
                <div className="register-security-callout">
                  <Info size={16} className="register-security-icon" aria-hidden="true" />
                  <p className="register-security-text">
                    There is no password reset yet, so keep your password safe.
                  </p>
                </div>

                {/* Submit Row & Button */}
                <div className="register-submit-row">
                  <button type="submit" className="register-submit-btn" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="register-spinner" aria-hidden="true" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </div>
              </form>

              {/* Card Footer: Already have an account? Sign in */}
              <div className="register-card-footer">
                <span className="register-footer-prompt">Already have an account?</span>{' '}
                <Link to="/login" className="register-footer-link">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Subtle Bottom Operational Bar */}
      <footer className="register-bottom-bar" aria-label="System status and legal links">
        <div className="register-bottom-inner">
          <div className="register-status-indicator">
            <span className="register-status-dot" aria-hidden="true" />
            <span className="register-status-text">All systems operational</span>
          </div>

          <div className="register-legal-links">
            <span className="register-legal-item">Privacy</span>
            <span className="register-legal-sep" aria-hidden="true">
              ·
            </span>
            <span className="register-legal-item">Terms</span>
            <span className="register-legal-sep" aria-hidden="true">
              ·
            </span>
            <span className="register-legal-item">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
