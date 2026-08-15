import { cookies } from 'next/headers';
import { REGISTERED_APP_COOKIE } from '@/lib/tenant';

export async function getRegisteredAppFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REGISTERED_APP_COOKIE)?.value?.trim() || null;
}
