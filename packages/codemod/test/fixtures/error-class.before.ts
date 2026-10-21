export function loadUser(id: string): void {
  if (!id) {
    throw new Error('missing id');
  }
}
