import { type FormSchema, type SchemaField } from './validator';
import { type FormStore } from './form';
export interface ZodSchema {
    safeParse(data: any): {
        success: boolean;
        data?: any;
        error?: {
            issues: Array<{
                path: (string | number)[];
                message: string;
            }>;
        };
    };
}
/**
 * تبدیل Zod schema به Zenith form config.
 *
 * استفاده:
 *   import { z } from 'zod';
 *   import { fromZod } from '@zenith/form';
 *
 *   const schema = z.object({
 *     email: z.string().email(),
 *     password: z.string().min(8),
 *   });
 *
 *   const form = fromZod(schema, {
 *     email: { initial: '', label: 'Email' },
 *     password: { initial: '', label: 'Password', type: 'password' },
 *   });
 */
export declare function fromZod(zodSchema: ZodSchema, fieldConfig?: Record<string, Partial<SchemaField>>): FormStore;
/**
 * اعتبارسنجی کل فرم با Zod schema.
 * مفید برای cross-field validation که در قوانین ساده قابل بیان نیست.
 */
export declare function validateWithZod(form: FormStore, zodSchema: ZodSchema): Promise<boolean>;
export interface JsonSchema {
    type?: string;
    properties?: Record<string, {
        type?: string;
        format?: string;
        minLength?: number;
        maxLength?: number;
        minimum?: number;
        maximum?: number;
        pattern?: string;
        enum?: any[];
        description?: string;
    }>;
    required?: string[];
}
/**
 * تبدیل JSON Schema به Zenith form config.
 */
export declare function fromJsonSchema(jsonSchema: JsonSchema, initialValues?: Record<string, any>): FormStore;
/**
 * ساخت فرم از Schema (FormSchema interface).
 */
export declare function createFormFromSchema(schema: FormSchema): FormStore;
export { type FormSchema, type SchemaField, schemaToFormConfig, schemaToHtml } from './validator';
