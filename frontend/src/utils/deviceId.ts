/**
 * Returns a stable device identifier stored in localStorage.
 * Generated once per browser profile; persists across sessions.
 * Used to track authorised devices for Pro plan access control.
 */
export function getDeviceId(): string {
  const KEY = 'shopiq_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
