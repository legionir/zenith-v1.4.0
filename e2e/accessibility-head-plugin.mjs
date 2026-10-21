import { a11yPlugin } from '@zenith/a11y';
import { createHead, headPlugin } from '@zenith/head';
import { installRouteAnnouncer, navigate } from '@zenith/router';

export default {
  name: 'e2e:accessibility-head',
  install(app) {
    app.use(a11yPlugin()); app.use(headPlugin());
    return app.directive({ name: 'fixture-route-navigation', bind(el) {
      const head = createHead({ document: el.ownerDocument, titleTemplate: '%s | Routes' });
      const release = installRouteAnnouncer({ doc: el.ownerDocument, head, routes: [{ path: '/fixture-about', meta: { title: 'About' } }], clearAfter: 0 });
      const click = () => { void navigate('/fixture-about'); };
      el.addEventListener('click', click);
      return () => { el.removeEventListener('click', click); try { release(); } finally { head.dispose(); } };
    } });
  },
};
