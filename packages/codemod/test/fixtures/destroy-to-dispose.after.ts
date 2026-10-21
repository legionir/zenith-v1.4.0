import { Auth } from '@zenith/auth';
import { signal } from '@zenith/state';

const auth = new Auth();
const count = signal(0);

export function logout(): void {
  auth.dispose();
  count.set(0);
}

export function stop(controller: { destroy(): void }): void {
  controller.destroy();
}
