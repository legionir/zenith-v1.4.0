// @vitest-environment jsdom
// #136 — every built-in event modifier has a test: prevent, stop, immediate, self, once,
// passive, capture, debounce, throttle, the ten key modifiers and the four modifier keys.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BUILTIN_MODIFIERS,
  DELEGATED_EVENTS,
  PASSIVE_BY_DEFAULT_EVENTS,
  checkKeyboardModifiers,
  clearBindingCache,
  extractListenerOptions,
  initEventDelegation,
  registerEventModifier,
  resetPassiveWarnings,
  clearEventModifiers,
} from '../src/index';
import { registerAction, clearActions } from '@zenith/actions';
import { addSink, type LogEntry } from '@zenith/logger';

/** modifier → where it is covered below. Adding a built-in without a test fails the first test. */
const COVERAGE: Record<string, string> = {
  prevent: 'behavior',
  stop: 'behavior',
  immediate: 'behavior',
  self: 'behavior',
  once: 'once',
  passive: 'passive',
  capture: 'capture',
  debounce: 'timing',
  throttle: 'timing',
  enter: 'keys',
  escape: 'keys',
  tab: 'keys',
  space: 'keys',
  backspace: 'keys',
  del: 'keys',
  up: 'keys',
  down: 'keys',
  left: 'keys',
  right: 'keys',
  shift: 'modifier-keys',
  ctrl: 'modifier-keys',
  alt: 'modifier-keys',
  meta: 'modifier-keys',
};

let root: HTMLDivElement;
let teardown: (() => void) | null = null;
const calls: string[] = [];

function mount(html: string): HTMLDivElement {
  root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  teardown = initEventDelegation({}, { root });
  return root;
}

function fire(el: Element, type: string, init: EventInit & Record<string, unknown> = {}): Event {
  const ev = type.startsWith('key')
    ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
    : new Event(type, { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev;
}

beforeEach(() => {
  document.body.innerHTML = '';
  clearActions();
  clearBindingCache();
  clearEventModifiers();
  resetPassiveWarnings();
  calls.length = 0;
  registerAction('act', () => {
    calls.push('act');
  });
});

afterEach(() => {
  teardown?.();
  teardown = null;
  vi.useRealTimers();
});

describe('#136 modifier coverage matrix', () => {
  it('every built-in modifier is accounted for in this file (new ones must add a test)', () => {
    expect(Object.keys(COVERAGE).sort()).toEqual([...BUILTIN_MODIFIERS].sort());
  });

  it('passive and capture are official built-ins and map to listener options', () => {
    expect(BUILTIN_MODIFIERS.has('passive')).toBe(true);
    expect(BUILTIN_MODIFIERS.has('capture')).toBe(true);
    expect(extractListenerOptions(['once', 'passive', 'capture'])).toEqual({
      once: true,
      passive: true,
      capture: true,
    });
    expect(extractListenerOptions([])).toEqual({ once: false, passive: false, capture: false });
    expect(() => registerEventModifier('passive', () => true)).toThrow(/built-in/);
  });
});

describe('#136 behavior modifiers: prevent / stop / immediate / self', () => {
  it('.prevent calls preventDefault; without it the default is untouched', () => {
    mount(
      '<a href="#x" id="p" zen-action:click.prevent="act">p</a><a href="#y" id="n" zen-action:click="act">n</a>',
    );
    expect(fire(root.querySelector('#p')!, 'click').defaultPrevented).toBe(true);
    expect(fire(root.querySelector('#n')!, 'click').defaultPrevented).toBe(false);
  });

  it('.stop stops propagation beyond the delegation root', () => {
    const outer: string[] = [];
    document.addEventListener('click', () => outer.push('document'));
    mount(
      '<button id="s" zen-action:click.stop="act">s</button><button id="t" zen-action:click="act">t</button>',
    );
    fire(root.querySelector('#s')!, 'click');
    expect(outer).toEqual([]);
    fire(root.querySelector('#t')!, 'click');
    expect(outer).toEqual(['document']);
  });

  it('.immediate stops other listeners on the same root', () => {
    mount('<button id="i" zen-action:click.immediate="act">i</button>');
    const later = vi.fn();
    root.addEventListener('click', later);
    fire(root.querySelector('#i')!, 'click');
    expect(calls).toEqual(['act']);
    expect(later).not.toHaveBeenCalled();
  });

  it('.self only fires when the element itself is the target', () => {
    mount('<div id="box" zen-action:click.self="act"><span id="kid">kid</span></div>');
    fire(root.querySelector('#kid')!, 'click');
    expect(calls).toEqual([]);
    fire(root.querySelector('#box')!, 'click');
    expect(calls).toEqual(['act']);
  });

  it('combines: .prevent.stop.self together', () => {
    mount('<a id="c" href="#z" zen-action:click.prevent.stop.self="act">c</a>');
    const ev = fire(root.querySelector('#c')!, 'click');
    expect(calls).toEqual(['act']);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('#136 .once', () => {
  it('fires a single time per element and removes the binding', () => {
    mount('<button id="o" zen-action:click.once="act">o</button>');
    const btn = root.querySelector('#o')!;
    fire(btn, 'click');
    fire(btn, 'click');
    expect(calls).toEqual(['act']);
    expect(btn.hasAttribute('zen-action:click.once')).toBe(false);
  });
});

describe('#136 .passive', () => {
  it('scroll-blocking events are registered as passive root listeners; others are not', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    teardown = initEventDelegation({}, { root: document });
    const byEvent = new Map<string, boolean[]>();
    for (const [type, , opts] of spy.mock.calls) {
      const passive = typeof opts === 'object' ? opts?.passive === true : false;
      byEvent.set(String(type), [...(byEvent.get(String(type)) ?? []), passive]);
    }
    for (const type of ['wheel', 'touchstart', 'touchmove', 'scroll']) {
      expect(PASSIVE_BY_DEFAULT_EVENTS.has(type)).toBe(true);
      expect(byEvent.get(type)?.every(Boolean), `${type} must be passive`).toBe(true);
    }
    for (const type of ['click', 'keydown', 'submit', 'input']) {
      expect(byEvent.get(type)?.some(Boolean), `${type} must not be passive`).toBe(false);
    }
    expect(DELEGATED_EVENTS).toEqual(
      expect.arrayContaining(['touchstart', 'touchmove', 'touchend', 'scroll', 'wheel']),
    );
    spy.mockRestore();
  });

  it('scroll / touch / wheel bindings work without preventing the default (no console error)', () => {
    mount(
      '<div id="a" zen-action:touchmove.passive="act"></div><div id="b" zen-action:wheel="act"></div><div id="c" zen-action:scroll="act"></div>',
    );
    const ev1 = fire(root.querySelector('#a')!, 'touchmove');
    const ev2 = fire(root.querySelector('#b')!, 'wheel');
    // scroll does not bubble: it is observed through the capture-phase root listener
    const ev3 = new Event('scroll', { bubbles: false, cancelable: false });
    root.querySelector('#c')!.dispatchEvent(ev3);
    expect(calls).toEqual(['act', 'act', 'act']);
    expect(ev1.defaultPrevented || ev2.defaultPrevented).toBe(false);
  });

  it('.prevent is ignored (with a single warning) on passive listeners', () => {
    const logs: LogEntry[] = [];
    const remove = addSink((e: LogEntry) => {
      logs.push(e);
    });
    mount(
      '<div id="m" zen-action:touchmove.prevent="act"></div><button id="k" zen-action:click.passive.prevent="act">k</button>',
    );
    const ev = fire(root.querySelector('#m')!, 'touchmove');
    fire(root.querySelector('#m')!, 'touchmove');
    expect(ev.defaultPrevented, 'touchmove is passive at the root').toBe(false);
    expect(fire(root.querySelector('#k')!, 'click').defaultPrevented).toBe(false);
    expect(calls).toHaveLength(3); // the actions still run
    const warnings = logs.filter((l) => l.level === 'warn' && /passive/.test(l.message));
    expect(warnings.map((w) => w.message).join('\n')).toMatch(/touchmove/);
    expect(warnings.filter((w) => /"touchmove"/.test(w.message))).toHaveLength(1);
    remove();
  });
});

describe('#136 .capture', () => {
  it('runs before descendants’ native listeners; a non-capture binding runs after them', () => {
    const order: string[] = [];
    registerAction('cap', () => void order.push('capture-action'));
    registerAction('bub', () => void order.push('bubble-action'));
    mount(
      '<div zen-action:click.capture="cap"><button id="b" zen-action:click="bub">b</button></div>',
    );
    root.querySelector('#b')!.addEventListener('click', () => order.push('child-native'));
    fire(root.querySelector('#b')!, 'click');
    expect(order).toEqual(['capture-action', 'child-native', 'bubble-action']);
  });

  it('a capture binding fires exactly once (not again in the bubble phase)', () => {
    mount('<div id="d" zen-action:click.capture="act"><button id="b">b</button></div>');
    fire(root.querySelector('#b')!, 'click');
    expect(calls).toEqual(['act']);
  });

  it('.capture.stop prevents descendants’ handlers from ever running', () => {
    mount('<div zen-action:click.capture.stop="act"><button id="b">b</button></div>');
    const child = vi.fn();
    root.querySelector('#b')!.addEventListener('click', child);
    fire(root.querySelector('#b')!, 'click');
    expect(calls).toEqual(['act']);
    expect(child).not.toHaveBeenCalled();
  });
});

describe('#136 .debounce / .throttle (with cancel on teardown)', () => {
  it('.debounce.100 coalesces a burst into one trailing call', () => {
    vi.useFakeTimers();
    mount('<input id="i" zen-action:input.debounce.100="act">');
    const el = root.querySelector('#i')!;
    fire(el, 'input');
    vi.advanceTimersByTime(60);
    fire(el, 'input');
    vi.advanceTimersByTime(60);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(60);
    expect(calls).toEqual(['act']);
  });

  it('.debounce pending call is cancelled by teardown', () => {
    vi.useFakeTimers();
    mount('<input id="i" zen-action:input.debounce.100="act">');
    fire(root.querySelector('#i')!, 'input');
    teardown!();
    teardown = null;
    vi.advanceTimersByTime(500);
    expect(calls).toEqual([]);
  });

  it('.throttle.100 fires immediately, drops the middle of a burst, keeps the trailing call', () => {
    vi.useFakeTimers();
    mount('<div id="t" zen-action:pointerdown.throttle.100="act"></div>');
    const el = root.querySelector('#t')!;
    fire(el, 'pointerdown');
    expect(calls).toEqual(['act']);
    vi.advanceTimersByTime(30);
    fire(el, 'pointerdown');
    vi.advanceTimersByTime(30);
    fire(el, 'pointerdown');
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(calls).toHaveLength(2);
  });

  it('.throttle pending trailing call is cancelled by teardown', () => {
    vi.useFakeTimers();
    mount('<div id="t" zen-action:pointerdown.throttle.100="act"></div>');
    const el = root.querySelector('#t')!;
    fire(el, 'pointerdown');
    fire(el, 'pointerdown');
    teardown!();
    teardown = null;
    vi.advanceTimersByTime(500);
    expect(calls).toHaveLength(1);
  });
});

describe('#136 key modifiers', () => {
  const KEYS: Record<string, string[]> = {
    enter: ['Enter'],
    escape: ['Escape', 'Esc'],
    tab: ['Tab'],
    space: [' ', 'Space', 'Spacebar'],
    backspace: ['Backspace'],
    del: ['Delete', 'Del'],
    up: ['ArrowUp', 'Up'],
    down: ['ArrowDown', 'Down'],
    left: ['ArrowLeft', 'Left'],
    right: ['ArrowRight', 'Right'],
  };

  for (const [mod, keys] of Object.entries(KEYS)) {
    it(`.${mod} matches ${keys.join(' / ')} and rejects other keys`, () => {
      for (const key of keys) {
        expect(checkKeyboardModifiers(new KeyboardEvent('keydown', { key }), [mod])).toBe(true);
      }
      expect(checkKeyboardModifiers(new KeyboardEvent('keydown', { key: 'q' }), [mod])).toBe(false);
    });
  }

  it('several key modifiers are an OR (.enter.escape)', () => {
    const e = (key: string) => new KeyboardEvent('keydown', { key });
    expect(checkKeyboardModifiers(e('Enter'), ['enter', 'escape'])).toBe(true);
    expect(checkKeyboardModifiers(e('Escape'), ['enter', 'escape'])).toBe(true);
    expect(checkKeyboardModifiers(e('Tab'), ['enter', 'escape'])).toBe(false);
  });

  it('delegated: keydown.enter only fires for Enter', () => {
    mount('<input id="k" zen-action:keydown.enter="act">');
    fire(root.querySelector('#k')!, 'keydown', { key: 'a' });
    expect(calls).toEqual([]);
    fire(root.querySelector('#k')!, 'keydown', { key: 'Enter' });
    expect(calls).toEqual(['act']);
  });
});

describe('#136 modifier keys (shift / ctrl / alt / meta) and combinations', () => {
  for (const [mod, flag] of [
    ['shift', 'shiftKey'],
    ['ctrl', 'ctrlKey'],
    ['alt', 'altKey'],
    ['meta', 'metaKey'],
  ] as const) {
    it(`.${mod} requires ${flag}`, () => {
      expect(checkKeyboardModifiers(new KeyboardEvent('keydown', { key: 'a' }), [mod])).toBe(false);
      expect(
        checkKeyboardModifiers(new KeyboardEvent('keydown', { key: 'a', [flag]: true }), [mod]),
      ).toBe(true);
    });
  }

  it('.ctrl.enter needs both; .shift.ctrl needs both flags', () => {
    const e = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
    expect(checkKeyboardModifiers(e({ key: 'Enter', ctrlKey: true }), ['ctrl', 'enter'])).toBe(
      true,
    );
    expect(checkKeyboardModifiers(e({ key: 'Enter' }), ['ctrl', 'enter'])).toBe(false);
    expect(checkKeyboardModifiers(e({ key: 'x', ctrlKey: true }), ['ctrl', 'enter'])).toBe(false);
    expect(checkKeyboardModifiers(e({ key: 'x', shiftKey: true }), ['shift', 'ctrl'])).toBe(false);
  });
});
