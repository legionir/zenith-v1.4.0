/** A CLI failure distinguishes invalid input/failed checks from infrastructure failure. */
export class CliFailure extends Error {
  override readonly name = 'CliFailure';
  constructor(message: string, readonly exitCode: 1 | 2 = 1) { super(message); }
}
export function exitCode(value: number): 0 | 1 | 2 { return value === 0 ? 0 : value === 1 ? 1 : 2; }

/** Preserve the standalone JSON writer's TypeError contract. */
export class CliDataError extends TypeError { override readonly name = 'CliDataError'; }
