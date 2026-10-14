// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPermissionManager,
  clearPermissionManagers,
  processPermission,
  processRole,
  deepFreeze,
} from '../src/index';

describe('@zenith/permission RBAC, freeze defense, and directives (#12 / BUG-PRM-01/03, SEC-A5/A6/A7/A12)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearPermissionManagers();
  });

  it('evaluates permissions/roles, enforces deepFreeze after freeze(), and processes zen-permission / zen-role', () => {
    const manager = createPermissionManager();
    manager.setUserAccess(['editor'], ['posts:read', 'posts:write']);

    expect(manager.hasRole('editor')).toBe(true);
    expect(manager.hasRole('admin')).toBe(false);
    expect(manager.can('posts:write')).toBe(true);
    expect(manager.checkPermission('any(posts:delete,posts:write)')).toBe(true);
    expect(manager.checkPermission('all(posts:read,posts:write)')).toBe(true);

    // Freeze prevents privilege escalation mutations (BUG-PRM-01 / SEC-A7)
    manager.freeze();
    manager.setUserAccess(['super-admin'], ['*']);
    expect(manager.hasRole('super-admin')).toBe(false);
    expect(Object.isFrozen(manager.signal.get())).toBe(true);
    expect(Object.isFrozen(deepFreeze({ a: { b: [1, 2] } }).a.b)).toBe(true);

    const elPerm = document.createElement('div');
    elPerm.innerHTML = `<span class="allowed">Can Edit</span><template zen-fallback><span class="denied">No Access</span></template>`;
    document.body.appendChild(elPerm);
    const cleanupPerm = processPermission(elPerm, 'posts:delete');
    expect(elPerm.querySelector('.denied')?.textContent).toBe('No Access');
    cleanupPerm();

    const elRole = document.createElement('div');
    elRole.innerHTML = `<span class="role-ok">Editor Area</span>`;
    document.body.appendChild(elRole);
    const cleanupRole = processRole(elRole, 'editor');
    expect(elRole.style.display).not.toBe('none');
    cleanupRole();
  });
});
