import { renderHook, act } from '@testing-library/react-native';
import { useDoubleTap } from '../../src/hooks/useDoubleTap';

describe('useDoubleTap', () => {
  it('should trigger onDoubleTap on two quick taps', () => {
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useDoubleTap({ onDoubleTap, maxDelay: 300 }));

    const mockEvent = {
      nativeEvent: { locationX: 100, pageX: 100, pageY: 200 },
      target: { offsetWidth: 375 },
    } as any;

    act(() => { result.current.handlePress(mockEvent); });
    act(() => { result.current.handlePress(mockEvent); });

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('should not trigger onDoubleTap if delay is too long', async () => {
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useDoubleTap({ onDoubleTap, maxDelay: 100 }));

    const mockEvent = {
      nativeEvent: { locationX: 100, pageX: 100, pageY: 200 },
      target: { offsetWidth: 375 },
    } as any;

    act(() => { result.current.handlePress(mockEvent); });
    await new Promise(r => setTimeout(r, 150));
    act(() => { result.current.handlePress(mockEvent); });

    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('should not trigger onDoubleTap when tapping right side (excludeRight)', () => {
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useDoubleTap({ onDoubleTap, excludeRight: true }));

    const rightSideEvent = {
      nativeEvent: { locationX: 350, pageX: 350, pageY: 200 },
      target: { offsetWidth: 375 },
    } as any;

    act(() => { result.current.handlePress(rightSideEvent); });
    act(() => { result.current.handlePress(rightSideEvent); });

    expect(onDoubleTap).not.toHaveBeenCalled();
  });
});
