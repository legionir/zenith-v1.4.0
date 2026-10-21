// @vitest-environment jsdom
//
// #88 — heavy directives (date-picker, virtual-repeat) leave the eager entry
// and bind on first discovery. Code-first tests, not executed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLazyDirectivesInternal,
  ensureLazyProcessor,
  getLoadedProcessor,
  isLazyBound,
  lazyDirectiveManifest,
  listLazyDirectives,
  preloadLazyDirectives,
  processLazyDirective,
  registerLazyDirective,
  unregisterLazyDirective,
} from '../src/directives/lazy';
import { processDOM } from '../src/walker';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => {
  clearLazyDirectivesInternal();
  document.body.innerHTML = '';
});

describe('lazy directive registry (#88)', () => {
  it('ships virtual-repeat and date-picker built-ins with an SSR manifest', () => {
    expect(listLazyDirectives()).toEqual(['zen-date-picker', 'zen-virtual']);
    expect(lazyDirectiveManifest()).toEqual([
      { name: 'zen-date-picker', tag: 'zen-date-picker', chunk: '@zenith/ui/date-picker' },
      { name: 'zen-virtual', attribute: 'zen-virtual', chunk: 'zen-virtual' },
    ]);
  });

  it('registers customs with validation and idempotent removal', () => {
    const cleanup = registerLazyDirective({
      name: 'zen-fancy',
      match: { attribute: 'zen-fancy' },
      load: async () => ({}),
    });
    expect(listLazyDirectives()).toContain('zen-fancy');
    cleanup();
    cleanup();
    expect(listLazyDirectives()).not.toContain('zen-fancy');
    // Invalid specs warn and register nothing.
    expect(registerLazyDirective({ name: '', match: {}, load: async () => ({}) })).toBeDefined();
    expect(listLazyDirectives()).toEqual(['zen-date-picker', 'zen-virtual']);
    expect(unregisterLazyDirective('zen-nope')).toBe(false);
  });

  it('preloads known names and rejects unknown ones', async () => {
    await expect(preloadLazyDirectives(['zen-nope'])).rejects.toThrow(/Unknown lazy directive/);
    await expect(ensureLazyProcessor('zen-nope')).rejects.toThrow(/Unknown lazy directive/);
    expect(getLoadedProcessor('zen-virtual')).toBeUndefined();
  });
});

describe('lazy binding through the walker (#88)', () => {
  it('never loads without discovery', async () => {
    const load = vi.fn(async () => ({}));
    registerLazyDirective({ name: 'zen-fancy', match: { attribute: 'zen-fancy' }, load });
    document.body.innerHTML = '<div id="root"><p>plain</p></div>';
    const dispose = processDOM(document.getElementById('root')!, {});
    await tick();
    expect(load).not.toHaveBeenCalled();
    dispose();
  });

  it('binds a discovered date-picker asynchronously with markers', async () => {
    document.body.innerHTML = '<div id="root"><zen-date-picker value="1403/01/01"></zen-date-picker></div>';
    const el = document.querySelector('zen-date-picker') as HTMLElement;
    const dispose = processDOM(document.getElementById('root')!, {});
    // Synchronous discovery mark: the chunk is on its way.
    expect(el.getAttribute('data-zen-lazy')).toBe('loading');
    expect(isLazyBound(el, 'zen-date-picker')).toBe(false);
    await tick();
    await tick();
    expect(isLazyBound(el, 'zen-date-picker')).toBe(true);
    expect(el.getAttribute('data-zen-lazy')).toBeNull();
    // Parity with the eager path: the same calendar rendered.
    expect(el.shadowRoot?.querySelector('.zen-date-picker__label')?.textContent).toContain('فروردین');
    dispose();
    // Re-walk never double-binds.
    const second = processDOM(document.getElementById('root')!, {});
    await tick();
    expect(el.getAttribute('data-zen-lazy')).toBeNull();
    second();
  });
});

describe('lazy load lifecycle (#88)', () => {  it('shares one import across concurrent discoveries (single-flight)', async () => {
    const gate = deferred<Record<string, unknown>>();
    const load = vi.fn(() => gate.promise);
    registerLazyDirective({ name: 'zen-fancy', match: { attribute: 'zen-fancy' }, load });
    document.body.innerHTML = '<div><b id="a"></b><b id="b"></b></div>';
    const disposes: Array<() => void> = [];
    const invoke = vi.fn();
    processLazyDirective('zen-fancy', document.getElementById('a')!, disposes, invoke);
    processLazyDirective('zen-fancy', document.getElementById('b')!, disposes, invoke);
    expect(load).toHaveBeenCalledTimes(1);
    gate.resolve({});
    await tick();
    expect(invoke).toHaveBeenCalledTimes(2);
    for (const dispose of disposes) dispose();
  });

  it('retries after a rejected import and marks the failed element', async () => {
    let calls = 0;
    registerLazyDirective({
      name: 'zen-fancy',
      match: { attribute: 'zen-fancy' },
      load: () => (calls++ === 0 ? Promise.reject(new Error('chunk 404')) : Promise.resolve({})),
    });
    document.body.innerHTML = '<div><b id="a"></b><b id="b"></b></div>';
    const disposes: Array<() => void> = [];
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    try {
      const invoke = vi.fn();
      processLazyDirective('zen-fancy', document.getElementById('a')!, disposes, invoke);
      await tick();
      // Negative control: the failed element is marked, boot continued.
      expect(document.getElementById('a')!.getAttribute('data-zen-lazy')).toBe('error');
      expect(invoke).not.toHaveBeenCalled();
      processLazyDirective('zen-fancy', document.getElementById('b')!, disposes, invoke);
      await tick();
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(isLazyBound(document.getElementById('b')!, 'zen-fancy')).toBe(true);
    } finally {
      spy.mockRestore();
    }
    for (const dispose of disposes) dispose();
  });

  it('never binds an element removed before the load finishes', async () => {
    const gate = deferred<Record<string, unknown>>();
    registerLazyDirective({ name: 'zen-fancy', match: { attribute: 'zen-fancy' }, load: () => gate.promise });
    const el = document.createElement('b'); // detached: isConnected === false
    const disposes: Array<() => void> = [];
    const invoke = vi.fn();
    processLazyDirective('zen-fancy', el, disposes, invoke);
    gate.resolve({});
    await tick();
    expect(invoke).not.toHaveBeenCalled();
    expect(el.getAttribute('data-zen-lazy')).toBe('cancelled');
  });

  it('skips the bind when navigation disposes before the load finishes', async () => {
    const gate = deferred<Record<string, unknown>>();
    registerLazyDirective({ name: 'zen-fancy', match: { attribute: 'zen-fancy' }, load: () => gate.promise });
    document.body.innerHTML = '<div><b id="a"></b></div>';
    const disposes: Array<() => void> = [];
    const invoke = vi.fn(() => () => undefined);
    processLazyDirective('zen-fancy', document.getElementById('a')!, disposes, invoke);
    for (const dispose of disposes) dispose(); // navigation teardown first
    gate.resolve({});
    await tick();
    expect(invoke).not.toHaveBeenCalled();
    expect(document.getElementById('a')!.getAttribute('data-zen-lazy')).toBe('cancelled');
  });

  it('binds synchronously once preloaded (SSR path)', async () => {
    const invoke = vi.fn(() => () => undefined);
    registerLazyDirective({ name: 'zen-fancy', match: { attribute: 'zen-fancy' }, load: async () => ({}) });
    await preloadLazyDirectives(['zen-fancy']);
    expect(getLoadedProcessor('zen-fancy')).toBeDefined();
    document.body.innerHTML = '<div><b id="a"></b></div>';
    const disposes: Array<() => void> = [];
    processLazyDirective('zen-fancy', document.getElementById('a')!, disposes, invoke);
    // No loading marker on the preloaded path — identical to eager binding.
    expect(document.getElementById('a')!.getAttribute('data-zen-lazy')).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(isLazyBound(document.getElementById('a')!, 'zen-fancy')).toBe(true);
    for (const dispose of disposes) dispose();
  });

  it('lazy and eager paths resolve to the same processor module', async () => {
    const { processVirtualRepeat } = await import('../src/directives/virtual-repeat');
    const module = await ensureLazyProcessor('zen-virtual');
    expect(module['processVirtualRepeat']).toBe(processVirtualRepeat);
    const { processDatePicker } = await import('../src/directives/date-picker');
    const picker = await ensureLazyProcessor('zen-date-picker');
    expect(picker['processDatePicker']).toBe(processDatePicker);
  });
});

describe('generic lazy path for consumer directives (#88)', () => {
  it('discovers a registered attribute, passes its value, and owns the subtree', async () => {
    const processFancy = vi.fn((target: HTMLElement, config: string | null) => {
      target.setAttribute('data-fancy', config ?? 'none');
      return () => undefined;
    });
    registerLazyDirective({
      name: 'zen-fancy',
      match: { attribute: 'zen-fancy' },
      load: async () => ({ processFancy }),
      processExport: 'processFancy',
      chunk: 'zen-fancy',
    });
    document.body.innerHTML =
      '<div id="root"><section zen-fancy=\'{"a":1}\'><span>child</span></section></div>';
    const dispose = processDOM(document.getElementById('root')!, {});
    await tick();
    await tick();
    const section = document.querySelector('section')!;
    expect(processFancy).toHaveBeenCalledTimes(1);
    expect(processFancy.mock.calls[0]?.[1]).toBe('{"a":1}');
    expect(isLazyBound(section, 'zen-fancy')).toBe(true);
    expect(section.getAttribute('data-fancy')).toBe('{"a":1}');
    dispose();
  });

  it('marks the element when the module lacks the declared export', async () => {
    registerLazyDirective({
      name: 'zen-broken',
      match: { attribute: 'zen-broken' },
      load: async () => ({}),
      processExport: 'processBroken',
    });
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    try {
      document.body.innerHTML = '<div id="root"><i zen-broken="x"></i></div>';
      const dispose = processDOM(document.getElementById('root')!, {});
      await tick();
      await tick();
      // Negative control: boot continued, the element carries the failure.
      expect(document.querySelector('i')!.getAttribute('data-zen-lazy')).toBe('error');
      expect(errors.some((line) => line.includes('processBroken'))).toBe(true);
      dispose();
    } finally {
      spy.mockRestore();
    }
  });
});
