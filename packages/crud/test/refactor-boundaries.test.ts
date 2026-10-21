// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Zen } from '@zenith/runtime';
import { getAction, registerAction, type ActionContext } from '@zenith/actions';
import { createResource, getResource, resetResourceRegistry } from '@zenith/resource';
import { isReadable, Signal } from '@zenith/state';
import { CrudEngine, processCrud } from '../src';
import { CrudEngine as Engine } from '../src/engine';
import { CrudEngine as Facade, processCrud as FacadeDirective } from '../src/crud-engine';
import { processCrud as Directive } from '../src/directive';
import type { CrudHost } from '../src/scope';

const owners: CrudEngine[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.dispose();
  resetResourceRegistry(); vi.restoreAllMocks(); document.body.innerHTML = '';
});
function setup() {
  const resource = createResource('boundary', { url: '/items' });
  resource.setData(() => [{ id: 1, name: 'Zed' }, { id: 2, name: 'Ada' }, { id: 3, name: 'Bea' }]);
  const start = vi.spyOn(Zen, 'start').mockImplementation(() => {});
  const host: CrudHost = document.createElement('section'); document.body.append(host);
  const engine = new CrudEngine({ resource: 'boundary', columns: [{ field: 'name', sortable: true }], pageSize: 2,
    tableActions: [{ name: 'open', label: 'Open', action: 'boundary-user' }] }, host);
  owners.push(engine); engine.render();
  const state: Record<string, unknown> = start.mock.calls[0]?.[1] ?? {};
  const read = (key: string): unknown => { const value = state[key]; if (!isReadable(value)) throw new Error(`Missing readable ${key}`); return value.get(); };
  const write = (key: string, next: unknown): void => { const value = state[key]; if (!(value instanceof Signal)) throw new Error(`Missing writable ${key}`); value.set(next); };
  return { resource, engine, host, state, read, write };
}
it('retains constructor and directive identity through the established facades', () => {
  expect(CrudEngine).toBe(Engine); expect(Facade).toBe(Engine);
  expect(processCrud).toBe(Directive); expect(FacadeDirective).toBe(Directive);
});
it('keeps live computed pagination/search and passes the original resource signal', () => {
  const { resource, state, read, write } = setup();
  expect(state.resource).toBe(resource.signal);
  expect(read('viewData')).toEqual([{ id: 1, name: 'Zed' }, { id: 2, name: 'Ada' }]);
  write('searchQuery', 'Ada');
  expect(read('viewData')).toEqual([{ id: 2, name: 'Ada' }]);
  expect(read('totalItems')).toBe(3); // Legacy pagination counts the unfiltered resource.
  resource.setData(() => [{ id: 4, name: 'Ada II' }]);
  expect(read('viewData')).toEqual([{ id: 4, name: 'Ada II' }]);
});
it('keeps double-event guards and updates the same live sort state', () => {
  const { host, read } = setup(); const sort = getAction('__crud_boundary_sort_name')!;
  const context: ActionContext = { event: new Event('click'), state: {}, element: host };
  void sort(context); void sort(context);
  expect(read('sortBy')).toBe('name'); expect(read('sortDir')).toBe('asc');
  expect(read('viewData')).toEqual([{ id: 2, name: 'Ada' }, { id: 3, name: 'Bea' }]);
  void sort({ ...context, event: new Event('click') }); expect(read('sortDir')).toBe('desc');
});
it('releases only its own DOM/action ownership and keeps the resource registered', () => {
  const { engine, host } = setup(); const dispose = vi.fn(), teardown = vi.fn(), user = vi.fn();
  const releaseUser = registerAction('boundary-user', user);
  try {
    host.__zenithDisposes = [dispose]; host.__zenithDelegationTeardown = teardown;
    engine.render(); expect(dispose).toHaveBeenCalledOnce(); expect(teardown).toHaveBeenCalledOnce();
    expect(host.__zenithDisposes).toBeUndefined(); expect(host.__zenithDelegationTeardown).toBeUndefined();
    engine.dispose(); engine.dispose();
    expect(getAction('__crud_boundary_sort_name')).toBeUndefined();
    expect(getAction('boundary-user')).toBe(user); expect(getResource('boundary')).toBeDefined();
  } finally { releaseUser(); }
});
