export const MODAL_TH =
  "px-2 py-2 text-left text-[11px] font-semibold text-blue-800 uppercase tracking-wide bg-blue-50/80 border-b border-blue-100";
export const MODAL_TD = "px-2 py-2 align-top text-sm text-gray-800 bg-white";
export const POLICY_NAME_TD = `${MODAL_TD} font-medium text-gray-900 whitespace-nowrap truncate`;
export const POLICY_NAME_WRAP_TD = `${MODAL_TD} font-medium text-gray-900 whitespace-normal break-words [overflow-wrap:anywhere] leading-snug`;
export const STATEMENT_REF_TD = `${MODAL_TD} font-mono text-xs text-gray-600 whitespace-nowrap`;
export const STATEMENT_TEXT_TD = `${MODAL_TD} whitespace-normal break-words [overflow-wrap:anywhere]`;

export function PolicyStatementTableColgroup({
  actionsWidth = "3rem",
  showStatementRef = true,
}: {
  actionsWidth?: string;
  showStatementRef?: boolean;
}) {
  if (!showStatementRef) {
    return (
      <colgroup>
        <col style={{ width: "18rem" }} />
        <col />
        <col style={{ width: actionsWidth }} />
      </colgroup>
    );
  }

  return (
    <colgroup>
      <col style={{ width: "18rem" }} />
      <col style={{ width: "8.5rem" }} />
      <col />
      <col style={{ width: actionsWidth }} />
    </colgroup>
  );
}
