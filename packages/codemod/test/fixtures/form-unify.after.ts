import { createForm } from '@zenith/form';

export function makeLoginForm() {
  return createForm({ initialValues: { email: '' } });
}
