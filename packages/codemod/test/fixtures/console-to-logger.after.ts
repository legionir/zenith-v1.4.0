import { logger } from '@zenith/logger';
export function greet(name: string): void {
  logger.info(name);
  console.warn('slow', name);
}
