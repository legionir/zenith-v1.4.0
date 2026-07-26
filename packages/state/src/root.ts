import { setOwner, getOwner, disposeOwner, createOwner } from './context';

/**
 * Create a new reactivity root.
 * All effects/computeds created inside will be owned by this root
 * and can be disposed all at once.
 */
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const prevOwner = getOwner();
  const rootOwner = createOwner(null);

  setOwner(rootOwner);

  let result: T;
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeOwner(rootOwner);
    setOwner(prevOwner);
  };

  try {
    result = fn(dispose);
  } catch (err) {
    dispose();
    throw err;
  }

  setOwner(prevOwner);
  return result;
}
