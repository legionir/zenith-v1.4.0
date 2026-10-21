import { ZenithError } from '@zenith/errors';
export function loadUser(id: string): void {
  if (!id) {
    throw new ZenithError({ code: '' /* TODO(codemod): set a real ZEN-xxxx code */, category: 'Internal', message: 'missing id' });
  }
}
