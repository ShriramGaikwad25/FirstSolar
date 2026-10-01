"use client";

// useUrlFilters — keep filter state in the URL so links are shareable and
// survive a reload. Uses router.replace so typing in a search box doesn't
// flood the history stack.
//
//   const [filters, setFilters, reset] = useUrlFilters<MyFilters>({ status: "OPEN", page: 1 });
//   setFilters({ status: "CLOSED" });              // merges
//   setFilters((prev) => ({ page: prev.page + 1 }));
//
// Values are coerced to/from strings. Number/boolean defaults keep their type
// after a roundtrip. Values equal to the default, `null` and "" are stripped
// from the URL; an explicit "" param decodes to `null` (e.g. "any status").
// Callers must use useSearchParams' Suspense boundary (wrap the page in <Suspense>).

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Primitive = string | number | boolean | null | undefined;
type FilterRecord = Record<string, Primitive>;

function decode<T extends FilterRecord>(params: URLSearchParams, defaults: T): T {
  const out: Record<string, Primitive> = { ...defaults };
  for (const k of Object.keys(defaults)) {
    const raw = params.get(k);
    if (raw === null) continue;
    if (raw === "") {
      out[k] = null;
    } else if (typeof defaults[k] === "number") {
      const n = Number(raw);
      out[k] = Number.isFinite(n) ? n : defaults[k];
    } else if (typeof defaults[k] === "boolean") {
      out[k] = raw === "1" || raw === "true";
    } else {
      out[k] = raw;
    }
  }
  return out as T;
}

function encode<T extends FilterRecord>(next: T, defaults: T, prev: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(prev);
  for (const k of Object.keys(next)) {
    const v = next[k];
    const d = defaults[k];
    if (v === d || v === undefined) {
      out.delete(k);
    } else if (v === null || v === "") {
      // Keep an explicit empty value only when it overrides a non-empty default.
      if (d === null || d === undefined || d === "") out.delete(k);
      else out.set(k, "");
    } else if (typeof v === "boolean") {
      out.set(k, v ? "1" : "0");
    } else {
      out.set(k, String(v));
    }
  }
  return out;
}

export function useUrlFilters<T extends FilterRecord>(
  defaults: T
): [T, (patch: Partial<T> | ((prev: T) => Partial<T>)) => void, () => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(
    () => decode(new URLSearchParams(params.toString()), defaults),
    [params, defaults]
  );

  const set = useCallback(
    (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
      const prevParams = new URLSearchParams(window.location.search);
      const prev = decode(prevParams, defaults);
      const delta = typeof patch === "function" ? patch(prev) : patch;
      const qs = encode({ ...prev, ...delta } as T, defaults, prevParams).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [defaults, pathname, router]
  );

  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return [filters, set, reset];
}
