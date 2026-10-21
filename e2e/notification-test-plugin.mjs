// A product component, not a mock of focus handling or accessible markup.
import { openDialog } from '@zenith/notifications';

export default {
  name: 'e2e:notifications',
  install(app) {
    return app.directive({
      name: 'fixture-dialog',
      bind(el) {
        const dialogs = new Set();
        const onClick = () => {
          const dialog = openDialog({
            kind: 'confirm', title: 'Confirm change', message: 'Continue?',
            confirmText: 'Continue', cancelText: 'Cancel',
          }, { idPrefix: 'e2e-confirm' });
          dialogs.add(dialog);
        };
        el.addEventListener('click', onClick);
        return () => {
          el.removeEventListener('click', onClick);
          for (const dialog of dialogs) dialog.dispose();
          dialogs.clear();
        };
      },
    });
  },
};
