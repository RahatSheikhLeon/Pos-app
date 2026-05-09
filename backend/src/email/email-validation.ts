import * as dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'temp-mail.org', 'throwam.com',
  'sharklasers.com', 'trashmail.com', 'yopmail.com', 'fakeinbox.com',
  'tempmail.com', 'dispostable.com', 'maildrop.cc', 'mailsac.com',
  'discard.email', 'spam4.me', 'tempr.email', 'tempinbox.com',
  '10minutemail.com', 'getnada.com',
]);

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isDisposableDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
}

export async function hasMxRecord(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const records = await resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

export async function validateEmail(email: string): Promise<string | null> {
  if (!isValidEmailFormat(email))   return 'Invalid email format';
  if (isDisposableDomain(email))    return 'Disposable email addresses are not allowed';
  if (process.env.EMAIL_SKIP_MX !== 'true') {
    const valid = await hasMxRecord(email);
    if (!valid) return 'Email domain does not exist';
  }
  return null;
}
