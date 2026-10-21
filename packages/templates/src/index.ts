/**
 * `@zenith/templates` — data-driven project templates and scaffold engine.
 *
 * Template content lives in real files under `templates/` (not nested escaped
 * literals); see `./engine.ts`. All exports are public API (#158).
 *
 * @packageDocumentation
 */

/** @public */
export {
  DEFAULTS,
  ScaffoldError,
  TEMPLATE_KINDS,
  getTemplateManifest,
  gitignoreTemplate,
  indexHtmlTemplate,
  listTemplateFiles,
  mainTsTemplate,
  packageJsonTemplate,
  pwaMainTsTemplate,
  pwaManifestTemplate,
  pwaReadmeTemplate,
  pwaServiceWorkerTemplate,
  pwaViteConfigTemplate,
  readmeTemplate,
  renderTemplateFile,
  scaffoldProject,
  tsConfigTemplate,
  viteConfigTemplate,
} from './engine';

/** @public */
export type {
  ScaffoldHost,
  ScaffoldOptions,
  ScaffoldResult,
  ZenithTemplateKind,
} from './engine';

/** @public */
export { TEMPLATE_PACKAGE_VERSIONS, dependencyVersion } from './versions';

/** @public */
export { MAX_PROJECT_NAME_LENGTH, validateProjectName } from './validate-project-name';
