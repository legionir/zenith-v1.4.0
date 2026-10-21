import { signal } from '@zenith/state';
import { Zen } from '@zenith/runtime';

export function start(): void {
  const count = signal(0);
  void Zen;
  void count;
}
