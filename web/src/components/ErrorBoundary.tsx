import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, LayoutDashboard } from 'lucide-react';
import { ToranlyLogomark } from './ToranlyLogomark';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoToMyPlans = () => {
    window.location.href = '/events';
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-wrapper" role="alert" aria-live="assertive">
          <div className="error-boundary-card">
            <div className="error-boundary-header">
              <ToranlyLogomark size={40} className="error-boundary-logo" />
            </div>

            <div className="error-boundary-icon-badge" aria-hidden="true">
              <AlertCircle size={28} />
            </div>

            <h1 className="error-boundary-title">Something went wrong</h1>
            <p className="error-boundary-desc">
              An unexpected error occurred while rendering this page. Your planning data remains saved in your browser storage.
            </p>

            {this.state.error && (
              <div className="error-boundary-details" aria-label="Error details">
                <code>{this.state.error.message || String(this.state.error)}</code>
              </div>
            )}

            <div className="error-boundary-actions">
              <button
                type="button"
                className="btn btn-primary error-boundary-btn"
                onClick={this.handleReload}
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>Reload page</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary error-boundary-btn"
                onClick={this.handleGoToMyPlans}
              >
                <LayoutDashboard size={16} aria-hidden="true" />
                <span>Go to My plans</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
