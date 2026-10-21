import { createAdvancedForm } from '@zenith/form';

export function makeLoginForm() {
  return createAdvancedForm({ initialValues: { email: '' } });
}
