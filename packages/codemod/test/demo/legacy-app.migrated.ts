import { signal } from '@zenith/state';
import { monthDays } from '@zenith/jalali';
import { logger } from '@zenith/logger';
import { ZenithError } from '@zenith/errors';
import { resetForTesting } from '@zenith/testing';
import { Auth } from '@zenith/auth';
import { createForm } from '@zenith/form';

const auth = new Auth({ loginUrl: '/login' });

export function setup(email: string) {
  logger.info(email);
  const days = monthDays(1405, 1);
  const count = signal(days);
  const form = createForm({ initialValues: { email } });
  resetForTesting();
  if (days < 0) {
    throw new ZenithError({ code: '' /* TODO(codemod): set a real ZEN-xxxx code */, category: 'Internal', message: 'negative days' });
  }
  auth.dispose();
  void count;
  return form;
}
