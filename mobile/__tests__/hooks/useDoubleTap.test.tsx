import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { DOUBLE_TAP_MS, useDoubleTap } from '../../hooks/useDoubleTap';

let tap: () => void = () => {};
const onDoubleTap = jest.fn();
const onSingleTap = jest.fn();

function Probe() {
  tap = useDoubleTap({ onDoubleTap, onSingleTap });
  return null;
}

let renderer: ReactTestRenderer;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
});

afterEach(() => {
  act(() => renderer.unmount());
  jest.useRealTimers();
});

const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));

describe('useDoubleTap', () => {
  it('runs the single-tap action once no second tap can come', () => {
    act(() => tap());
    wait(DOUBLE_TAP_MS - 10);
    expect(onSingleTap).not.toHaveBeenCalled();
    wait(20);
    expect(onSingleTap).toHaveBeenCalledTimes(1);
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('runs the double-tap action for two quick taps, and not the single one', () => {
    act(() => tap());
    wait(120);
    act(() => tap());
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    wait(1000);
    expect(onSingleTap).not.toHaveBeenCalled();
  });

  it('treats two slow taps as two single taps', () => {
    act(() => tap());
    wait(DOUBLE_TAP_MS + 50);
    act(() => tap());
    wait(DOUBLE_TAP_MS + 50);
    expect(onSingleTap).toHaveBeenCalledTimes(2);
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('keeps counting fast taps after a double tap as double taps, never as a single tap', () => {
    act(() => tap());
    wait(100);
    act(() => tap());
    wait(100);
    act(() => tap());
    wait(1000);
    expect(onDoubleTap).toHaveBeenCalledTimes(2);
    expect(onSingleTap).not.toHaveBeenCalled();
  });

  it('drops a pending single tap when the screen goes away', () => {
    act(() => tap());
    act(() => renderer.unmount());
    jest.advanceTimersByTime(1000);
    expect(onSingleTap).not.toHaveBeenCalled();
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
  });
});
