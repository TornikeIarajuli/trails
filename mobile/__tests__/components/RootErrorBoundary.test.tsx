/**
 * The root error boundary: an error anywhere in the app is reported as a crash report, and the
 * root is told so it can show "Something went wrong" instead of the app closing.
 */
jest.mock('../../utils/analytics', () => ({ reportError: jest.fn() }));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { RootErrorBoundary } from '../../components/ui/RootErrorBoundary';
import { reportError } from '../../utils/analytics';

function Broken(): React.ReactElement {
  throw new Error('Cannot read property name of undefined');
}

describe('RootErrorBoundary', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    // React logs caught render errors; they are expected here
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('reports the error with the components it happened in, and tells the root', () => {
    const onError = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <RootErrorBoundary onError={onError}>
          <Broken />
        </RootErrorBoundary>,
      );
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Cannot read property name of undefined' }),
      expect.objectContaining({ source: 'error_boundary', component_stack: expect.stringContaining('Broken') }),
    );
    expect(renderer.toJSON()).toBeNull();
  });

  it('shows the app as usual when nothing goes wrong', () => {
    const onError = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <RootErrorBoundary onError={onError}>
          <Text>Explore</Text>
        </RootErrorBoundary>,
      );
    });

    expect(onError).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(Text)[0].props.children).toBe('Explore');
  });
});
