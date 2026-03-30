/**
 * React error boundary that catches render errors in child components.
 *
 * Wraps individual view panels so a crash in one doesn't kill the whole app.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorCard } from './ErrorCard';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // ErrorBoundary requires console.error — React DevTools and error reporting rely on this.
    // In production, replace with a monitoring service call.
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="p-4">
          <ErrorCard
            message={this.state.error.message}
            suggestion="Reload the page to try again."
            onDismiss={this.handleRetry}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
