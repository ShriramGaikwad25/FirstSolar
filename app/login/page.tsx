import { redirect } from 'next/navigation';
import { tenantId } from '@/lib/config';

/** Legacy /login → tenant URL (e.g. /ACMECOM). */
export default function LoginRedirectPage() {
  redirect(`/${tenantId || 'ACMECOM'}`);
}
