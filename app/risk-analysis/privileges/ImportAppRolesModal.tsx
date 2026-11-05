"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, UserCog } from "lucide-react";
import Modal from "@/components/Modal";
import { listAppInstances, onboardAppRoles } from "@/lib/api/rm";
import { SYSTEM_CODE_RE, SYSTEM_CODE_HINT, systemCodeFromName } from "./constants";

const field = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const label = "mb-1 block text-xs font-medium text-gray-600";

const KINDS = [
  ["ROLE", "Roles or groups"],
  ["SCOPE", "API or tool scopes"],
] as const;

/** Turns an application's roles into privileges (and a function per privilege) via rm_onboard_app_roles. */
export function ImportAppRolesModal({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const qc = useQueryClient();
  const apps = useQuery({
    queryKey: ["app-instances"],
    queryFn: listAppInstances,
    select: (rows) => rows.filter((a) => a.roles > 0),
  });
  const sorted = useMemo(
    () => [...(apps.data ?? [])].sort((a, b) => a.instance_name.localeCompare(b.instance_name)),
    [apps.data]
  );

  const [appId, setAppId] = useState("");
  const [codeEdit, setCodeEdit] = useState<string | null>(null);
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [kind, setKind] = useState<"ROLE" | "SCOPE">("ROLE");

  const app = apps.data?.find((a) => a.instance_id === appId);
  const code =
    codeEdit ??
    (app ? app.system_type ?? (app.system_source === "saved" ? app.system_code : null) ?? systemCodeFromName(app.instance_name) : "");
  const name = nameEdit ?? app?.instance_name ?? "";
  const codeOk = !!app && SYSTEM_CODE_RE.test(code);

  const pickApp = (id: string) => {
    setAppId(id);
    setCodeEdit(null);
    setNameEdit(null);
  };

  // Dry run: how many roles would become new privileges.
  const preview = useQuery({
    queryKey: ["app-roles-preview", appId, code, kind],
    enabled: codeOk,
    queryFn: () => onboardAppRoles({ instanceId: appId, systemType: code, systemName: name, kind, dryRun: true }),
  });

  const run = useMutation({
    mutationFn: () =>
      onboardAppRoles({ instanceId: appId, systemType: code, systemName: name.trim() || undefined, kind, dryRun: false }),
    onSuccess: (r) => {
      onDone(
        `${r.instance ?? app?.instance_name}: ${r.privileges_created ?? 0} new privileges and ${r.functions_created ?? 0} new functions in ${r.system_type ?? code}`
      );
      void qc.invalidateQueries({ queryKey: ["privileges"] });
      void qc.invalidateQueries({ queryKey: ["functions"] });
      void qc.invalidateQueries({ queryKey: ["app-instances"] });
      void qc.invalidateQueries({ queryKey: ["app-roles-preview"] });
      onClose();
    },
  });

  const toCreate = preview.data?.privileges_to_create ?? 0;
  const found = preview.data?.entitlements_found ?? 0;
  const alreadyFiner = app ? app.linked - app.imported : 0;

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={!codeOk || !preview.data || run.isPending}
        onClick={() => run.mutate()}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <UserCog className="h-3.5 w-3.5" />
        {run.isPending ? "Importing…" : toCreate > 0 ? `Import ${toCreate} role${toCreate === 1 ? "" : "s"}` : "Import"}
      </button>
    </>
  );

  return (
    <Modal open title="Import app roles as privileges" onClose={onClose} footer={footer} wide>
      <div className="mb-3.5 rounded-md bg-blue-50 p-2.5 text-[13px] text-blue-900">
        <Info className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        For an application whose roles are the finest access it has. Each role becomes a privilege with the same code,
        and a function that uses it, so SoD rules can be written on the roles directly.
      </div>

      {apps.isLoading && <div className="text-slate-500">Loading…</div>}
      {apps.isError && <ErrorText>{(apps.error as Error).message}</ErrorText>}

      {apps.data && (
        <div className="space-y-3">
          <div>
            <label htmlFor="ar-app" className={label}>
              Application
            </label>
            <select id="ar-app" className={field} value={appId} onChange={(e) => pickApp(e.target.value)}>
              <option value="">Choose an application…</option>
              {sorted.map((a) => (
                <option key={a.instance_id} value={a.instance_id}>
                  {a.instance_name} — {a.roles} role{a.roles === 1 ? "" : "s"}
                  {a.imported > 0 ? `, ${a.imported} imported` : ""}
                </option>
              ))}
            </select>
          </div>

          {app && alreadyFiner > 0 && (
            <div className="rounded-md bg-amber-50 p-2.5 text-[13px] text-amber-900">
              {alreadyFiner} of {app.roles} roles already map to privileges of their own — this application has
              finer-grained access, and rules are usually better written on that. Import its roles only if you want
              rules on whole roles as well.
            </div>
          )}

          {app && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ar-code" className={label}>
                    System code
                  </label>
                  <input
                    id="ar-code"
                    className={`${field} font-mono`}
                    value={code}
                    onChange={(e) => setCodeEdit(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <label htmlFor="ar-name" className={label}>
                    System name
                  </label>
                  <input id="ar-name" className={field} value={name} onChange={(e) => setNameEdit(e.target.value)} />
                </div>
              </div>
              {!SYSTEM_CODE_RE.test(code) && <ErrorText>{SYSTEM_CODE_HINT}</ErrorText>}
              {app.system_type && code !== app.system_type && SYSTEM_CODE_RE.test(code) && (
                <p className="text-xs text-slate-500">
                  Its roles were imported under {app.system_type} before; another code makes a second set.
                </p>
              )}

              <div role="radiogroup" aria-label="The roles are">
                <div className={label}>The roles are</div>
                <div className="flex gap-4">
                  {KINDS.map(([k, text]) => (
                    <label key={k} className="flex items-center gap-1.5 text-sm">
                      <input type="radio" name="ar-kind" checked={kind === k} onChange={() => setKind(k)} />
                      {text}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[13px]">
                {preview.isLoading && <span className="text-slate-500">Counting…</span>}
                {preview.isError && <span className="text-red-800">{(preview.error as Error).message}</span>}
                {preview.data &&
                  (toCreate > 0 ? (
                    <>
                      <b>{toCreate}</b> of {found} roles become new privileges in <b>{code}</b>
                      {toCreate < found && " — the others are privileges already"}.
                    </>
                  ) : (
                    <>
                      All {found} roles are privileges in <b>{code}</b> already. Importing again only fills in a missing
                      link or function.
                    </>
                  ))}
              </div>
            </>
          )}

          {run.isError && <ErrorText>{(run.error as Error).message}</ErrorText>}
        </div>
      )}
    </Modal>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</div>;
}
