/**
 * Modal-based guided tour for first-time users.
 *
 * Walks through the 5 main views with descriptions.
 * Persists completion state in localStorage.
 */

import { type ReactNode, useState, useCallback } from 'react';

interface GuidedTourProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

const TOUR_STEPS = [
  {
    title: 'Overview',
    description:
      'Your project dashboard showing ecosystem breakdown, module count, and health summary.',
  },
  {
    title: 'Explorer',
    description:
      'Browse and filter modules and their dependencies across all ecosystems.',
  },
  {
    title: 'Health',
    description:
      'View outdated, unused, and license-audited dependencies at a glance.',
  },
  {
    title: 'Cross-Language',
    description:
      'See how different language ecosystems connect through shared configs and APIs.',
  },
  {
    title: 'Getting Started',
    description:
      'Create a .deckgraph.yaml and scan your project to get started!',
  },
] as const;

const STORAGE_KEY = 'deckgraph.tourCompleted';

export function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function GuidedTour({ open, onClose }: GuidedTourProps): ReactNode {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = useCallback((): void => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const handlePrev = useCallback((): void => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleFinish = useCallback((): void => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage may be unavailable — ignore
    }
    onClose();
  }, [onClose]);

  const handleSkip = useCallback((): void => {
    handleFinish();
  }, [handleFinish]);

  if (!open) return null;

  const step = TOUR_STEPS[currentStep];
  if (!step) return null;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip
            </button>
          </div>
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={isFirst}
            className="rounded-md px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-accent"
          >
            Previous
          </button>
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          <button
            onClick={isLast ? handleFinish : handleNext}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
