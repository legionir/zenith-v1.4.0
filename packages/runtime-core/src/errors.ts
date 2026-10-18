import { ZenithError, emitError } from '@zenith/errors';
import type { App } from './types';

export function handleAppError(app: App, err: unknown): void {
  const zenErr =
    err instanceof ZenithError
      ? err
      : new ZenithError({
          code: 'ZEN-905',
          category: 'Runtime',
          message: err instanceof Error ? err.message : String(err),
          cause: err,
        });
  if (app.config.errorHandler) {
    app.config.errorHandler(zenErr);
  } else {
    emitError(zenErr);
  }
}

