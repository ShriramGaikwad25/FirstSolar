/** Users restricted to only the Non Human Identity and Policy Dashboard pages. */
const RESTRICTED_USERNAMES = ['josh.hammer', 'atul.goyal', 'george.hong'];

export const RESTRICTED_NAV_ITEM_NAMES = ['Non Human Identity', 'Policy Dashboard'];

/** Landing page these users are sent to right after login. */
export const RESTRICTED_LANDING_PATH = '/non-human-identity-2';

export function isRestrictedNavUser(username: string | null | undefined): boolean {
  return RESTRICTED_USERNAMES.includes((username ?? '').trim().toLowerCase());
}
