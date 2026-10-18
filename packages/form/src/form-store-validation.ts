import type { Signal } from '@zenith/state';
import { validateFieldAsync, validateFormAsync, type FormValidation } from './validator';
import { readFormValues, readFormValidation } from './form-reset';
import type { FormFieldState, FormStoreState } from './form-types';

/** Honest shared state/abort owner; independent field runs never cancel peers. @internal */
export class StoreValidation {
  private epoch = 0;
  private fieldRuns = new Map<string, number>();
  private allRun = 0;
  private allPending = false;
  private controller = new AbortController();
  private disposed = false;
  constructor(private state: Signal<FormStoreState>, private rules: Record<string, string>) {}

  invalidate(): void {
    this.epoch++; this.allRun++; this.allPending = false; this.fieldRuns.clear();
    const previous = this.controller; this.controller = new AbortController(); previous.abort();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.invalidate(); this.controller.abort();
  }
  private sameValues(snapshot: FormStoreState): boolean {
    const fields = this.state.peek().fields, names = Object.keys(snapshot.fields);
    return names.length === Object.keys(fields).length && names.every(name => name in fields && Object.is(fields[name]?.value, snapshot.fields[name]?.value));
  }
  private busy(fields: Record<string, FormFieldState>): boolean {
    return this.allPending || Object.values(fields).some(field => field.validating);
  }
  async field(name: string): Promise<void> {
    if (this.disposed) return;
    const snapshot = this.state.peek(), field = snapshot.fields[name];
    if (!field) return;
    const epoch = this.epoch, run = (this.fieldRuns.get(name) ?? 0) + 1;
    this.fieldRuns.set(name, run);
    const current = () => !this.disposed && this.epoch === epoch && this.fieldRuns.get(name) === run && this.sameValues(snapshot);
    this.state.set({ ...snapshot, fields: { ...snapshot.fields, [name]: { ...field, validating: true } }, validating: true });
    try {
      const result = await validateFieldAsync(field.value, { rules: this.rules[name] || '', allValues: readFormValues(snapshot), signal: this.controller.signal });
      if (!current()) return;
      const state = this.state.peek(), existing = state.fields[name];
      if (!existing) return;
      const fields = { ...state.fields, [name]: { ...existing, validation: result, validating: false } };
      this.state.set({ ...state, fields, valid: Object.values(fields).every(value => value.validation.valid), validating: this.busy(fields) });
    } finally {
      if (current()) {
        const state = this.state.peek(), existing = state.fields[name];
        if (existing?.validating) {
          const fields = { ...state.fields, [name]: { ...existing, validating: false } };
          this.state.set({ ...state, fields, validating: this.busy(fields) });
        }
      }
    }
  }
  async all(): Promise<FormValidation> {
    const snapshot = this.state.peek();
    if (this.disposed) return readFormValidation(snapshot);
    this.invalidate();
    const epoch = this.epoch, run = ++this.allRun;
    const current = () => !this.disposed && this.epoch === epoch && this.allRun === run && this.sameValues(snapshot);
    this.allPending = true;
    const fields: Record<string, FormFieldState> = {};
    for (const [name, field] of Object.entries(snapshot.fields)) fields[name] = { ...field, validating: false };
    this.state.set({ ...snapshot, fields, validating: true });
    try {
      const result = await validateFormAsync({ values: readFormValues(snapshot), rules: { ...this.rules }, signal: this.controller.signal });
      if (!current()) return result;
      const state = this.state.peek(), next = { ...state.fields };
      for (const [name, validation] of Object.entries(result.fields)) {
        const field = next[name];
        // A newer field request owns its own result, even while all() settles.
        if (field && !this.fieldRuns.has(name)) next[name] = { ...field, validation };
      }
      this.state.set({ ...state, fields: next, valid: Object.values(next).every(field => field.validation.valid), validating: this.busy(next) });
      return result;
    } finally {
      if (current()) {
        this.allPending = false;
        const state = this.state.peek(); this.state.set({ ...state, validating: this.busy(state.fields) });
      }
    }
  }
}
