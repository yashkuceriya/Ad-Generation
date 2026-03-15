import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PipelineProgress from '../components/PipelineProgress';
import type { PipelineStatus } from '../types';

const baseStatus: PipelineStatus = {
  status: 'running',
  current_brief_index: 2,
  total_briefs: 5,
  current_phase: 'copy_generation',
  current_brief_id: 'brief-001',
  elapsed_seconds: 30,
  error: null,
  completed_ads: 7,
  completed_run_ads: 2,
};

describe('PipelineProgress', () => {
  it('renders RUNNING label when status is running', () => {
    render(<PipelineProgress status={baseStatus} />);
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });

  it('shows completed_run_ads / total_briefs count', () => {
    render(<PipelineProgress status={baseStatus} />);
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('returns null for idle status', () => {
    const idle: PipelineStatus = { ...baseStatus, status: 'idle' };
    const { container } = render(<PipelineProgress status={idle} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows error message when present', () => {
    const errStatus: PipelineStatus = {
      ...baseStatus,
      status: 'error',
      error: 'Something went wrong',
    };
    render(<PipelineProgress status={errStatus} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows ETA when running with completed ads', () => {
    render(<PipelineProgress status={baseStatus} />);
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });
});
