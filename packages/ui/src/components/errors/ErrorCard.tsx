/**
 * Error card component for displaying user-facing errors.
 */

import type { ReactNode } from 'react';

interface ErrorCardProps {
  readonly message: string;
  readonly suggestion: string;
  readonly onDismiss?: () => void;
}

export function ErrorCard({ message, suggestion, onDismiss }: ErrorCardProps): ReactNode {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-destructive">{message}</p>
          <p className="text-sm text-muted-foreground">{suggestion}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Dismiss error"
          >
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
