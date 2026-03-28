import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrossEdgeFilter } from '@/components/crosslang/CrossEdgeFilter';
import type { CrossEdgeType } from '@deckgraph/shared';

describe('CrossEdgeFilter', () => {
  const allTypes = new Set<CrossEdgeType>(['proto', 'openapi', 'ffi', 'build', 'shared-config']);
  const onToggleType = vi.fn();
  const onConfidenceChange = vi.fn();

  it('renders all edge type toggles', () => {
    render(
      <CrossEdgeFilter
        edgeTypeFilter={allTypes}
        minConfidence={0}
        onToggleType={onToggleType}
        onConfidenceChange={onConfidenceChange}
      />,
    );

    expect(screen.getByTestId('filter-proto')).toBeInTheDocument();
    expect(screen.getByTestId('filter-ffi')).toBeInTheDocument();
    expect(screen.getByTestId('filter-openapi')).toBeInTheDocument();
    expect(screen.getByTestId('filter-build')).toBeInTheDocument();
    expect(screen.getByTestId('filter-shared-config')).toBeInTheDocument();
  });

  it('calls onToggleType when a type button is clicked', () => {
    render(
      <CrossEdgeFilter
        edgeTypeFilter={allTypes}
        minConfidence={0}
        onToggleType={onToggleType}
        onConfidenceChange={onConfidenceChange}
      />,
    );

    fireEvent.click(screen.getByTestId('filter-proto'));
    expect(onToggleType).toHaveBeenCalledWith('proto');
  });

  it('renders confidence slider', () => {
    render(
      <CrossEdgeFilter
        edgeTypeFilter={allTypes}
        minConfidence={0.5}
        onToggleType={onToggleType}
        onConfidenceChange={onConfidenceChange}
      />,
    );

    const slider = screen.getByTestId('confidence-slider');
    expect(slider).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('calls onConfidenceChange when slider changes', () => {
    render(
      <CrossEdgeFilter
        edgeTypeFilter={allTypes}
        minConfidence={0}
        onToggleType={onToggleType}
        onConfidenceChange={onConfidenceChange}
      />,
    );

    fireEvent.change(screen.getByTestId('confidence-slider'), { target: { value: '70' } });
    expect(onConfidenceChange).toHaveBeenCalledWith(0.7);
  });
});
