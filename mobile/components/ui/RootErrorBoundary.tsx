import React from 'react';
import { reportError } from '../../utils/analytics';

/**
 * Catches an error anywhere in the app, reports it as a crash report and lets the root show
 * "Something went wrong" instead of closing the app.
 */
export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    reportError(error, {
      source: 'error_boundary',
      // Which components it happened in (the first lines are the closest ones)
      component_stack: info?.componentStack?.trim().slice(0, 2000) ?? null,
    });
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
