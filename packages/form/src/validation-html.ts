/** @public */
export interface SchemaField {
  initial?: unknown;
  rules?: string;
  label?: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'checkbox' | 'select' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

/** @public */
export interface FormSchema {
  fields: Record<string, SchemaField>;
  submitLabel?: string;
  /** FEATURE (v1.0.0): Nested schema برای sub-forms. */
  nested?: Record<string, FormSchema>;
}

/** @public */
export function schemaToFormConfig(
  schema: FormSchema,
): Record<string, { initial: unknown; rules?: string }> {
  const config: Record<string, { initial: unknown; rules?: string }> = {};
  for (const [name, field] of Object.entries(schema.fields)) {
    config[name] = {
      initial: field.initial ?? (field.type === 'checkbox' ? false : ''),
      rules: field.rules,
    };
  }
  // FEATURE (v1.0.0): Nested schema support.
  if (schema.nested) {
    for (const [group, nestedSchema] of Object.entries(schema.nested)) {
      const nestedConfig = schemaToFormConfig(nestedSchema);
      for (const [key, val] of Object.entries(nestedConfig)) {
        config[`${group}.${key}`] = val;
      }
    }
  }
  return config;
}

/**
 * FIX (v1.2.3): escape کاراکترهای HTML برای جلوگیری از XSS در schemaToHtml.
 * قبلاً label/placeholder/option.value/option.label مستقیماً در رشته‌ی HTML
 * قرار می‌گرفتند که اگر کاربر رشته‌ای با <script> در label داشت، XSS رخ می‌داد.
 */
function escapeHTML(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @public */
export function schemaToHtml(schema: FormSchema, formVar = '$form'): string {
  const lines: string[] = [];
  for (const [name, field] of Object.entries(schema.fields)) {
    // FIX (v1.2.3): escape label و placeholder برای جلوگیری از XSS.
    const label = escapeHTML(field.label || name);
    const rules = field.rules || '';
    const placeholder = escapeHTML(field.placeholder || '');
    const modelExpr = `${formVar}.fields.${name}.value`;

    lines.push(`<div class="form-field">`);
    lines.push(`  <label>${label}</label>`);

    if (field.type === 'select' && field.options) {
      lines.push(`  <select zen-model="${modelExpr}">`);
      for (const opt of field.options) {
        // FIX (v1.2.3): escape option value و label.
        lines.push(
          `    <option value="${escapeHTML(opt.value)}">${escapeHTML(opt.label)}</option>`,
        );
      }
      lines.push(`  </select>`);
    } else if (field.type === 'textarea') {
      lines.push(`  <textarea zen-model="${modelExpr}" placeholder="${placeholder}"></textarea>`);
    } else if (field.type === 'checkbox') {
      lines.push(`  <input type="checkbox" zen-model="${modelExpr}">`);
    } else {
      lines.push(
        `  <input type="${field.type || 'text'}" zen-model="${modelExpr}" zen-validate="${rules}" placeholder="${placeholder}">`,
      );
    }

    lines.push(
      `  <span zen-if="!${formVar}.fields.${name}.validation.valid && ${formVar}.fields.${name}.touched" class="error">`,
    );
    lines.push(`    <span zen-text="${formVar}.fields.${name}.validation.error"></span>`);
    lines.push(`  </span>`);
    lines.push(`</div>`);
  }

  lines.push(
    `<button zen-action:submit.prevent="formSubmit" zen-bind:disabled="!${formVar}.valid">${escapeHTML(schema.submitLabel || 'Submit')}</button>`,
  );
  return lines.join('\n');
}
