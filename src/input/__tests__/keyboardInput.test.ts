import { describe, expect, it, vi } from 'vitest';
import { KeyboardInput } from '../keyboardInput';
import { GameCommandType } from '../../core/types/commands';

type Listener = (event: KeyboardEvent) => void;

class FakeTarget {
  private listeners: Record<string, Listener[]> = {};

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener);
  }

  dispatch(type: string, event: Partial<KeyboardEvent>) {
    (this.listeners[type] ?? []).forEach((listener) => listener(event as KeyboardEvent));
  }
}

describe('KeyboardInput', () => {
  it('emits mapped command on keydown', () => {
    const target = new FakeTarget();
    const onCommand = vi.fn();
    const input = new KeyboardInput({ target: target as unknown as Window, onCommand });

    input.start();
    target.dispatch('keydown', { code: 'ArrowLeft', repeat: false });

    expect(onCommand).toHaveBeenCalledWith({ type: GameCommandType.MoveLeft });
  });

  it('ignores unmapped keys and repeats', () => {
    const target = new FakeTarget();
    const onCommand = vi.fn();
    const input = new KeyboardInput({ target: target as unknown as Window, onCommand });

    input.start();
    target.dispatch('keydown', { code: 'KeyX', repeat: false });
    target.dispatch('keydown', { code: 'ArrowRight', repeat: true });

    expect(onCommand).not.toHaveBeenCalled();
  });

  it('prevents default for mapped keys when enabled', () => {
    const target = new FakeTarget();
    const onCommand = vi.fn();
    const preventDefault = vi.fn();
    const input = new KeyboardInput({ target: target as unknown as Window, onCommand });

    input.start();
    target.dispatch('keydown', { code: 'ArrowDown', repeat: false, preventDefault });
    target.dispatch('keyup', { code: 'ArrowDown', preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it('fires hard drop only once per key press', () => {
    const target = new FakeTarget();
    const onCommand = vi.fn();
    const input = new KeyboardInput({ target: target as unknown as Window, onCommand });

    input.start();
    target.dispatch('keydown', { code: 'Space', repeat: false });
    target.dispatch('keydown', { code: 'Space', repeat: false });
    expect(onCommand).toHaveBeenCalledTimes(1);

    target.dispatch('keyup', { code: 'Space', preventDefault: vi.fn() });
    target.dispatch('keydown', { code: 'Space', repeat: false });
    expect(onCommand).toHaveBeenCalledTimes(2);
  });
});

describe('KeyboardInput auto-repeat', () => {
  it('repeats commands after initial delay while key is held', () => {
    vi.useFakeTimers();
    const target = new FakeTarget();
    const onCommand = vi.fn();
    const input = new KeyboardInput({
      target: target as unknown as Window,
      onCommand,
      autoRepeat: { initialDelayMs: 100, repeatIntervalMs: 50 },
    });

    input.start();
    target.dispatch('keydown', { code: 'ArrowLeft', repeat: false, preventDefault: vi.fn() });

    expect(onCommand).toHaveBeenCalledTimes(1); // immediate
    vi.advanceTimersByTime(90);
    expect(onCommand).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60); // past initial delay + one interval
    expect(onCommand).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(100); // two more intervals
    expect(onCommand).toHaveBeenCalledTimes(4);

    target.dispatch('keyup', { code: 'ArrowLeft', preventDefault: vi.fn() });
    vi.advanceTimersByTime(200);
    expect(onCommand).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });
});
