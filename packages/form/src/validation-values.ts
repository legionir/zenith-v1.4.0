/** @public */
export function getNestedValue(values: Record<string, unknown>, path: string): unknown {
  if (!path.includes('.')) return values[path];
  const parts = path.split('.');
  let current: unknown = values;
  for (const part of parts) {
    if (current == null) return undefined;
    current = Reflect.get(Object(current), part);
  }
  return current;
}

/**
 * تنظیم مقدار یک فیلد با پشتیبانی از dot notation.
 * @public
 */
export function setNestedValue(
  values: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (!path.includes('.')) {
    return { ...values, [path]: value };
  }
  const parts = path.split('.');
  const result = { ...values };
  let current: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const child = current[part];
    const next = child == null || typeof child !== 'object' ? {} : { ...child };
    current[part] = next;
    current = next;
  }
  current[parts[parts.length - 1]!] = value;
  return result;
}

/**
 * ساخت یک flat object از nested values برای validation.
 * مثلاً { address: { city: 'Tehran' } } → { 'address.city': 'Tehran' }
 * @public
 */
export function flattenValues(values: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenValues(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// ── Validation Functions ──

