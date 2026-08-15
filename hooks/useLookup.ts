import { useQuery } from "@tanstack/react-query";
import { getLookupByCategory, type RmLookupValue } from "@/lib/api/rm";

/**
 * KeyForge-style lookup (e.g. `RULESET_STATUS` → `value_code` + `color_hex` for {@link Badge}).
 * @param locale BCP-47 / UI locale passed to `kf_rm_list_lookup_values` (default `en`).
 */
export function useLookup(category: string, locale: string = "en") {
  return useQuery({
    queryKey: ["lookup", category, locale],
    queryFn: async (): Promise<RmLookupValue[]> => {
      const { data } = await getLookupByCategory(category, locale);
      return data ?? [];
    },
  });
}

export type { RmLookupValue };
