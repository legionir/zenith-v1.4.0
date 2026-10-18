import { setOwner, getOwner, disposeOwner, createOwner, _getMutableContext, _runInEffectContext } from './context';

/** Create a detached reactivity root; ambient ownership is synchronous. @public */
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const context = _getMutableContext();
  return _runInEffectContext(context, () => {
    const previousOwner = getOwner();
    const rootOwner = createOwner(null);
    const dispose = () => disposeOwner(rootOwner);
    setOwner(rootOwner);
    try { return fn(dispose); }
    catch (error) { dispose(); throw error; }
    finally { context.owner = previousOwner; }
  });
}
