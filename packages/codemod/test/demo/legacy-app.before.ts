import { clearAuth } from '@zenith/auth';
import { Auth } from '@zenith/auth';
import { createAdvancedForm } from '@zenith/form';
import { jalaliMonthDays } from '@zenith/i18n';
import { signal } from '@zenith/runtime';

const auth = new Auth({ loginUrl: '/login' });

export function setup(email: string) {
  console.log(email);
  const days = jalaliMonthDays(1405, 1);
  const count = signal(days);
  const form = createAdvancedForm({ initialValues: { email } });
  clearAuth();
  if (days < 0) {
    throw new Error('negative days');
  }
  auth.destroy();
  void count;
  return form;
}
