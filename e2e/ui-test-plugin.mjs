import { uiPlugin, createDialog } from '@zenith/ui';

export default {
  name: 'e2e:ui',
  install(app) {
    app.use(uiPlugin());
    return app.directive({ name: 'fixture-ui-dialog', bind(el) {
      const panel = el.ownerDocument.getElementById(el.getAttribute('aria-controls'));
      const dialog = createDialog(panel);
      const open = () => dialog.open(); el.addEventListener('click', open);
      return () => { el.removeEventListener('click', open); dialog.dispose(); };
    } });
  },
};
