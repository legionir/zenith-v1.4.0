// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initEventDelegation,
  parseBinding,
  checkKeyboardModifiers,
  applyBehaviorModifiers,
  applyTimingModifiers,
  registerEventModifier,
  unregisterEventModifier,
  clearBindingCache,
} from '../src/index';
import { registerAction, clearActions } from '@zenith/actions';

describe('@zenith/events DOM unit tests (#28)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearActions();
    clearBindingCache();
  });

  it('parses bindings and applies keyboard, behavior, custom, and timing modifiers', () => {
    const parsed = parseBinding('keydown.enter.prevent.stop');
    expect(parsed.eventName).toBe('keydown');
    expect(parsed.modifiers).toEqual(['enter', 'prevent', 'stop']);

    const el = document.createElement('input');
    const enterEvt = new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
      bubbles: true,
    });
    const escEvt = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
      bubbles: true,
    });

    expect(checkKeyboardModifiers(enterEvt, ['enter'])).toBe(true);
    expect(checkKeyboardModifiers(escEvt, ['enter'])).toBe(false);

    applyBehaviorModifiers(enterEvt, ['prevent', 'stop'], el);
    expect(enterEvt.defaultPrevented).toBe(true);

    registerEventModifier(
      'onlyDataOk',
      (_event, element) => element.getAttribute('data-ok') === '1',
    );
    expect(checkKeyboardModifiers(enterEvt, ['onlyDataOk'])).toBe(true);
    unregisterEventModifier('onlyDataOk');

    let count = 0;
    const wrapped = applyTimingModifiers(() => {
      count += 1;
    }, ['throttle', '300']);
    wrapped(enterEvt);
    wrapped(enterEvt);
    expect(count).toBe(1);
    wrapped.cancel();
  });

  it('delegates parameterized actions and .once modifier, and cleans up on teardown', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button class="btn-param" zen-action:click="selectItem(42, 'featured')">Select</button>
      <button class="btn-once" zen-action:click.once="pingOnce">Once</button>
    `;
    document.body.appendChild(root);

    const received: Array<{ args: unknown[] }> = [];
    let onceCalls = 0;

    registerAction('selectItem', ({ args }) => {
      received.push({ args });
    });
    registerAction('pingOnce', () => {
      onceCalls += 1;
    });

    const cleanup = initEventDelegation({}, { root });

    const paramBtn = root.querySelector('.btn-param') as HTMLButtonElement;
    paramBtn.click();
    expect(received).toEqual([{ args: [42, 'featured'] }]);

    const onceBtn = root.querySelector('.btn-once') as HTMLButtonElement;
    onceBtn.click();
    onceBtn.click();
    expect(onceCalls).toBe(1);

    cleanup();
    paramBtn.click();
    expect(received.length).toBe(1);
  });
});
