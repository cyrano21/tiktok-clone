import { act, renderHook } from '@testing-library/react';
import { useDoubleTap } from '../../src/hooks/useDoubleTap';

describe('useDoubleTap', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-07T12:00:00Z'));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const eventAt = (locationX: number) => ({
    nativeEvent: { locationX, pageX: locationX, pageY: 200 },
    target: { offsetWidth: 375 },
  }) as any;

  it('triggers onDoubleTap on two quick taps', () => {
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useDoubleTap({ onDoubleTap, maxDelay: 300 }));
    const event = eventAt(100);

    act(() => { result.current.handlePress(event); });
    act(() => { jest.advanceTimersByTime(100); });
    act(() => { result.current.handlePress(event); });

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onDoubleTap after maxDelay', () => {
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useDoubleTap({ onDoubleTap, maxDelay: 100 }));
    const event = eventAt(100);

    act(() => { result.current.handlePress(event); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { result.current.handlePress(event); });

    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('does not treat taps in the right action area as content taps', () => {
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useDoubleTap({ onDoubleTap, excludeRight: true }));
    const event = eventAt(350);

    act(() => { result.current.handlePress(event); });
    act(() => { jest.advanceTimersByTime(100); });
    act(() => { result.current.handlePress(event); });

    expect(onDoubleTap).not.toHaveBeenCalled();
  });
});
