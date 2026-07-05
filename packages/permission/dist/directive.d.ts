/**
 * پردازش دایرکتیو zen-permission.
 *
 * @param el    عنصر.
 * @param expr  Expression دسترسی (مثل "users:delete" یا "any:a,b").
 * @returns تابع dispose.
 */
export declare function processPermission(el: HTMLElement, expr: string): () => void;
/**
 * پردازش دایرکتیو zen-role.
 *
 * @param el    عنصر.
 * @param expr  Expression role (مثل "admin" یا "any:admin,editor").
 * @returns تابع dispose.
 */
export declare function processRole(el: HTMLElement, expr: string): () => void;
