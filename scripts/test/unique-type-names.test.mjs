import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditUniqueTypeNames } from '../check-unique-type-names.mjs';

const ROOT = process.cwd();

describe('unique public type names (#50)', () => {
  it('has zero non-deprecated duplicate public type names across packages', () => {
    const { conflicts, totalTypes } = auditUniqueTypeNames(ROOT);
    expect(totalTypes).toBeGreaterThan(200);
    expect(conflicts).toEqual([]);
  });

  it('exports CompilerOptions in @zenith/compiler and VitePluginCompileOptions in @zenith/vite-plugin with @deprecated CompileOptions aliases', () => {
    const compilerSrc = readFileSync(join(ROOT, 'packages/compiler/src/compiler.ts'), 'utf8');
    const compilerIndex = readFileSync(join(ROOT, 'packages/compiler/src/index.ts'), 'utf8');
    expect(compilerSrc).toContain('export interface CompilerOptions');
    expect(compilerSrc).toMatch(/@deprecated[\s\S]*?export type CompileOptions = CompilerOptions/);
    expect(compilerIndex).toContain('type CompilerOptions');

    const viteCompileSrc = readFileSync(
      join(ROOT, 'packages/unplugin-zenith/src/compile-types.ts'),
      'utf8',
    );
    const viteIndex = readFileSync(join(ROOT, 'packages/unplugin-zenith/src/index.ts'), 'utf8');
    expect(viteCompileSrc).toContain('export interface VitePluginCompileOptions');
    expect(viteCompileSrc).toMatch(
      /@deprecated[\s\S]*?export type CompileOptions = VitePluginCompileOptions/,
    );
    expect(viteIndex).toContain('type VitePluginCompileOptions');
  });

  it('unifies FormOptions in @zenith/form and marks AdvancedFormOptions and VirtualListConfig @deprecated', () => {
    const formSrc = readFileSync(join(ROOT, 'packages/form/src/form.ts'), 'utf8');
    expect(formSrc).toContain('export interface FormOptions');
    expect(formSrc).toMatch(
      /@deprecated[\s\S]*?export interface AdvancedFormOptions<T extends Record<string, any>> extends FormOptions<T>/,
    );

    const vlistSrc = readFileSync(join(ROOT, 'packages/virtual-list/src/virtual-list.ts'), 'utf8');
    expect(vlistSrc).toMatch(/@deprecated[\s\S]*?export (?:interface|type) VirtualListConfig/);
  });
});
