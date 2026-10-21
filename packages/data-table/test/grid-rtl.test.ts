// @vitest-environment jsdom
//
// #100 — data-table grid arrows follow the effective direction (APG grid
// pattern). Code-first tests, not executed.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDataTable } from '../src/index';

interface Row {
  id: number;
  name: string;
  role: string;
}

function mount(dir?: 'rtl' | 'ltr', inherit?: 'rtl' | 'ltr') {
  const table = createDataTable<Row>({
    data: [
      { id: 1, name: 'Alice', role: 'admin' },
      { id: 2, name: 'Bob', role: 'editor' },
    ],
    rowKey: 'id',
    columns: [
      { key: 'name', title: 'Name' },
      { key: 'role', title: 'Role' },
    ],
  });
  const host = document.createElement('div');
  if (inherit) host.setAttribute('dir', inherit);
  const container = document.createElement('div');
  if (dir) container.setAttribute('dir', dir);
  host.appendChild(container);
  document.body.appendChild(host);
  const dispose = table.renderAriaGrid(container);
  const cells = () =>
    Array.from(container.querySelectorAll('[role="columnheader"], [role="gridcell"]')) as HTMLElement[];
  return { container, cells, dispose };
}

function key(el: HTMLElement, name: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('dir');
});

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('dir');
});

describe('data-table grid keyboard direction (#100)', () => {
  it('moves ArrowRight forward and ArrowLeft back in LTR', () => {
    const { cells, dispose } = mount();
    expect(cells()).toHaveLength(6);
    cells()[0]!.focus();
    key(cells()[0]!, 'ArrowRight');
    expect(document.activeElement).toBe(cells()[1]!);
    key(cells()[1]!, 'ArrowLeft');
    expect(document.activeElement).toBe(cells()[0]!);
    dispose();
  });

  it('flips horizontal arrows with an explicit dir=rtl', () => {
    const { cells, dispose } = mount('rtl');
    cells()[1]!.focus();
    key(cells()[1]!, 'ArrowRight');
    expect(document.activeElement).toBe(cells()[0]!);
    key(cells()[0]!, 'ArrowLeft');
    expect(document.activeElement).toBe(cells()[1]!);
    dispose();
  });

  it('inherits the direction from an ancestor', () => {
    const { cells, dispose } = mount(undefined, 'rtl');
    cells()[1]!.focus();
    key(cells()[1]!, 'ArrowRight');
    expect(document.activeElement).toBe(cells()[0]!);
    dispose();
  });

  it('follows a runtime dir switch with no re-render', () => {
    const { container, cells, dispose } = mount();
    cells()[0]!.focus();
    key(cells()[0]!, 'ArrowRight');
    expect(document.activeElement).toBe(cells()[1]!);
    container.setAttribute('dir', 'rtl');
    cells()[1]!.focus();
    key(cells()[1]!, 'ArrowRight');
    expect(document.activeElement).toBe(cells()[0]!);
    dispose();
  });

  it('keeps vertical arrows direction-neutral', () => {
    const { cells, dispose } = mount('rtl');
    cells()[0]!.focus();
    key(cells()[0]!, 'ArrowDown');
    expect(document.activeElement).toBe(cells()[2]!);
    key(cells()[2]!, 'ArrowUp');
    expect(document.activeElement).toBe(cells()[0]!);
    dispose();
  });
});
