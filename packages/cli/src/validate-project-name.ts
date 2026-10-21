// Canonical validation now lives in `@zenith/templates` (#158, AUDIT CLI-03).
// This module stays as a facade so existing imports keep working.
export { MAX_PROJECT_NAME_LENGTH, validateProjectName } from '@zenith/templates';
