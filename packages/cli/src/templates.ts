export { componentTemplate, pageTemplate, actionTemplate } from './templates/generate';

// Project templates moved to `@zenith/templates` (#158); the names below are
// compatibility facades with identical output (see scaffold-manifest tests).
export {
  getTemplateManifest,
  gitignoreTemplate,
  indexHtmlTemplate,
  mainTsTemplate,
  packageJsonTemplate,
  pwaMainTsTemplate,
  pwaManifestTemplate,
  pwaReadmeTemplate,
  pwaServiceWorkerTemplate,
  pwaViteConfigTemplate,
  readmeTemplate,
  tsConfigTemplate,
  viteConfigTemplate,
  type ZenithTemplateKind,
} from '@zenith/templates';
