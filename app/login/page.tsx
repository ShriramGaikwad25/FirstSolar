import { redirect } from 'next/navigation';

/** Legacy /login: no default tenant, so send users to the sign-out page that asks for their tenant URL. */
export default function LoginRedirectPage() {
  redirect('/logged-out');
}
