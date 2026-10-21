// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { flushSync } from '@zenith/scheduler';
import { Zen, signal, registerAction, clearActions } from '../src/index';

describe('@zenith/runtime DOM directives suite (#28)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearActions();
  });

  it('processes zen-text, zen-html, zen-show, zen-bind, zen-model, zen-ref, zen-memo, zen-cloak, and zen-action', () => {
    const title = signal('Hello Zenith');
    const htmlContent = signal('<strong>Bold</strong><script>alert(1)</script>');
    const visible = signal(true);
    const activeClass = signal('is-active');
    const username = signal('alice');
    const memoDep = signal(1);
    const memoText = signal('Memo v1');
    const refTarget = signal<HTMLElement | null>(null);
    let clicks = 0;

    registerAction('incrementClick', () => {
      clicks += 1;
    });

    const root = document.createElement('div');
    root.innerHTML = `
      <h1 class="t-text" zen-text="$title" zen-cloak></h1>
      <div class="t-html" zen-html="$htmlContent"></div>
      <p class="t-show" zen-show="$visible">Shown</p>
      <span id="t-bind" zen-bind:class="$activeClass" zen-bind:data-user="$username"></span>
      <input class="t-model" type="text" zen-model="$username" />
      <div class="t-ref" zen-ref="$refTarget">Ref Box</div>
      <div class="t-memo" zen-memo="[$memoDep]">
        <span class="t-memo-inner" zen-text="$memoText"></span>
      </div>
      <button class="t-btn" zen-action:click="incrementClick">Click</button>
    `;
    document.body.appendChild(root);

    Zen.start(root, {
      title,
      htmlContent,
      visible,
      activeClass,
      username,
      memoDep,
      memoText,
      refTarget,
    });

    const h1 = root.querySelector('.t-text') as HTMLElement;
    expect(h1.textContent).toBe('Hello Zenith');
    expect(h1.hasAttribute('zen-cloak')).toBe(false);

    const htmlEl = root.querySelector('.t-html') as HTMLElement;
    expect(htmlEl.innerHTML).toContain('<strong>Bold</strong>');
    expect(htmlEl.innerHTML).not.toContain('<script>');

    const showEl = root.querySelector('.t-show') as HTMLElement;
    expect(showEl.style.display).not.toBe('none');
    visible.set(false);
    flushSync();
    expect(showEl.style.display).toBe('none');

    const bindEl = root.querySelector('#t-bind') as HTMLElement;
    expect(bindEl.getAttribute('class')).toBe('is-active');
    expect(bindEl.getAttribute('data-user')).toBe('alice');

    const inputEl = root.querySelector('.t-model') as HTMLInputElement;
    expect(inputEl.value).toBe('alice');
    inputEl.value = 'bob';
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(username.get()).toBe('bob');
    expect(bindEl.getAttribute('data-user')).toBe('bob');

    expect(refTarget.get()).toBe(root.querySelector('.t-ref'));

    const memoInner = root.querySelector('.t-memo-inner') as HTMLElement;
    expect(memoInner.textContent).toBe('Memo v1');

    const btn = root.querySelector('.t-btn') as HTMLButtonElement;
    btn.click();
    expect(clicks).toBe(1);

    Zen.stop(root);
  });

  it('processes zen-if / zen-else-if / zen-else and zen-for + zen-key', () => {
    const status = signal<'loading' | 'ready' | 'error'>('loading');
    const list = signal([
      { id: '1', label: 'One' },
      { id: '2', label: 'Two' },
    ]);

    const root = document.createElement('div');
    root.innerHTML = `
      <div class="branch">
        <span class="s-loading" zen-if="$status === 'loading'">Loading...</span>
        <span class="s-ready" zen-else-if="$status === 'ready'">Ready</span>
        <span class="s-error" zen-else>Error</span>
      </div>
      <ul class="items">
        <li zen-for="row in $list" zen-key="row.id" zen-text="row.label"></li>
      </ul>
    `;
    document.body.appendChild(root);

    Zen.start(root, { status, list });

    expect(root.querySelector('.s-loading')?.textContent).toBe('Loading...');
    expect(root.querySelector('.s-ready')).toBeNull();
    expect(root.querySelectorAll('.items li').length).toBe(2);
    expect(Array.from(root.querySelectorAll('.items li')).map((el) => el.textContent)).toEqual([
      'One',
      'Two',
    ]);

    status.set('ready');
    list.set([
      { id: '3', label: 'Three' },
      { id: '2', label: 'Two' },
    ]);
    flushSync();

    expect(root.querySelector('.s-loading')).toBeNull();
    expect(root.querySelector('.s-ready')?.textContent).toBe('Ready');
    expect(Array.from(root.querySelectorAll('.items li')).map((el) => el.textContent)).toEqual([
      'Three',
      'Two',
    ]);

    status.set('error');
    flushSync();
    expect(root.querySelector('.s-error')?.textContent).toBe('Error');

    Zen.stop(root);
  });

  it('processes zen-portal, zen-error, zen-suspense, zen-transition, zen-date-picker, and zen-virtual-list', () => {
    const portalTarget = document.createElement('div');
    portalTarget.id = 'modal-host';
    document.body.appendChild(portalTarget);

    const pickedDate = signal('1403/01/15');
    const showBox = signal(true);
    const vItems = signal(
      Array.from({ length: 20 }, (_, i) => ({ id: i + 1, label: `Row ${i + 1}` })),
    );

    const root = document.createElement('div');
    root.innerHTML = `
      <div zen-portal="#modal-host">
        <p class="portaled-node">Inside Portal</p>
      </div>
      <div class="err-box" zen-error>
        <span class="err-ok">Healthy</span>
        <template zen-fallback><span class="err-fallback">Caught</span></template>
      </div>
      <div class="susp-box" zen-suspense>
        <span class="susp-ready">Loaded</span>
        <template zen-fallback><span class="susp-loading">Wait</span></template>
      </div>
      <div class="trans-box" zen-transition="fade" zen-show="$showBox">Animated</div>
      <input class="dp-input" zen-date-picker zen-model="$pickedDate" />
      <div class="vlist" style="height: 120px" zen-virtual-list="item in $vItems" zen-item-height="30">
        <div class="vrow" zen-text="item.label"></div>
      </div>
    `;
    document.body.appendChild(root);

    Zen.start(root, { pickedDate, showBox, vItems });

    expect(portalTarget.querySelector('.portaled-node')?.textContent).toBe('Inside Portal');
    expect(root.querySelector('.err-ok')?.textContent).toBe('Healthy');
    expect(root.querySelector('.susp-ready')?.textContent).toBe('Loaded');
    expect((root.querySelector('.dp-input') as HTMLInputElement).value).toBe('1403/01/15');
    expect(root.querySelectorAll('.vlist .vrow').length).toBeGreaterThan(0);

    Zen.stop(root);
    portalTarget.remove();
  });
});
