import { processTrack } from '@zenith/runtime';

export function trackClick(el: HTMLElement): () => void {
  return processTrack(el, 'click:buy', {});
}
