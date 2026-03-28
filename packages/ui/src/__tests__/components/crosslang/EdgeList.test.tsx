import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EdgeList } from '@/components/crosslang/EdgeList';
import type { GraphLayoutEdge } from '@/stores/graphStore';

const mockEdges: GraphLayoutEdge[] = [
  {
    id: 'a|b|proto',
    from: 'services/api',
    to: 'services/auth',
    type: 'proto',
    confidence: 0.8,
    evidence: 'api.proto service definition',
    points: [{ x: 0, y: 0 }],
  },
  {
    id: 'a|c|openapi',
    from: 'services/api',
    to: 'services/pay',
    type: 'openapi',
    confidence: 0.7,
    evidence: 'openapi.yaml reference',
    points: [{ x: 0, y: 0 }],
  },
];

describe('EdgeList', () => {
  it('renders empty state when no edges', () => {
    render(<EdgeList edges={[]} selectedEdgeId={null} onSelectEdge={vi.fn()} />);
    expect(screen.getByText(/no cross-language edges/i)).toBeInTheDocument();
  });

  it('renders edge rows', () => {
    render(<EdgeList edges={mockEdges} selectedEdgeId={null} onSelectEdge={vi.fn()} />);
    expect(screen.getAllByText('services/api')).toHaveLength(2);
    expect(screen.getByText('services/auth')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('highlights selected edge', () => {
    render(<EdgeList edges={mockEdges} selectedEdgeId="a|b|proto" onSelectEdge={vi.fn()} />);
    const row = screen.getByTestId('edge-row-a|b|proto');
    expect(row.className).toContain('bg-accent');
  });

  it('calls onSelectEdge when row is clicked', () => {
    const onSelect = vi.fn();
    render(<EdgeList edges={mockEdges} selectedEdgeId={null} onSelectEdge={onSelect} />);
    fireEvent.click(screen.getByTestId('edge-row-a|b|proto'));
    expect(onSelect).toHaveBeenCalledWith('a|b|proto');
  });
});
