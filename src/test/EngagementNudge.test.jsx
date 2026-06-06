// Component tests for the onboarding engagement nudge — the user-facing driver of adoption.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EngagementNudge from '../components/EngagementNudge.jsx';
import { uniqueDailyInteractions, resetEngagementLedger } from '../lib/analytics.js';

describe('EngagementNudge', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetEngagementLedger();
  });

  it('shows for low-activity users and records an impression interaction', () => {
    render(<EngagementNudge activityCount={0} onStart={() => {}} />);
    expect(screen.getByRole('region', { name: /شروع تمرین/ })).toBeInTheDocument();
    // impression tracked → at least one unique interaction recorded today.
    expect(uniqueDailyInteractions()).toBeGreaterThanOrEqual(1);
  });

  it('hides for already-engaged users (activity >= threshold)', () => {
    render(<EngagementNudge activityCount={5} onStart={() => {}} threshold={3} />);
    expect(screen.queryByRole('region', { name: /شروع تمرین/ })).toBeNull();
  });

  it('calls onStart and tracks the CTA click', () => {
    const onStart = vi.fn();
    render(<EngagementNudge activityCount={0} onStart={onStart} />);
    const before = uniqueDailyInteractions();
    fireEvent.click(screen.getByRole('button', { name: /تمرین|بساز/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(uniqueDailyInteractions()).toBeGreaterThan(before);
  });

  it('dismiss hides the nudge and persists across remounts', () => {
    const { unmount } = render(<EngagementNudge activityCount={0} onStart={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'بستن' }));
    expect(screen.queryByRole('region', { name: /شروع تمرین/ })).toBeNull();
    unmount();
    // Remount: dismissal was persisted, so it stays hidden.
    render(<EngagementNudge activityCount={0} onStart={() => {}} />);
    expect(screen.queryByRole('region', { name: /شروع تمرین/ })).toBeNull();
  });

  it('assigns a stable A/B variant that survives remounts', () => {
    const { unmount } = render(<EngagementNudge activityCount={0} onStart={() => {}} />);
    const v1 = screen.getByRole('region', { name: /شروع تمرین/ }).getAttribute('data-variant');
    expect(['A', 'B']).toContain(v1);
    unmount();
    render(<EngagementNudge activityCount={0} onStart={() => {}} />);
    const v2 = screen.getByRole('region', { name: /شروع تمرین/ }).getAttribute('data-variant');
    expect(v2).toBe(v1);
  });
});
