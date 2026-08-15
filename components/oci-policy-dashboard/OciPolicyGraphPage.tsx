"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OciPolicyGraphView } from "@/components/OciPolicyGraphView";
import PolicyStatementScopesSidebar from "@/components/oci-policy-dashboard/PolicyStatementScopesSidebar";
import {
  formatStatementRef,
  PolicyStatementsPanel,
} from "@/components/oci-policy-dashboard/PolicyStatementsPanel";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import { useOciPolicyGraph } from "@/hooks/useOciPolicyGraph";
import { useOciPolicyList } from "@/hooks/useOciPolicyList";
import type { PolicyListStatement } from "@/types/oci-policy";

export default function OciPolicyGraphPage({ policyName }: { policyName: string }) {
  const { data, isLoading, isError, error } = useOciPolicyGraph(policyName);
  const { data: policyListData, isLoading: isPolicyListLoading } = useOciPolicyList();
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [selectedStatementIndex, setSelectedStatementIndex] = useState<number | null>(null);
  const [scopeStatement, setScopeStatement] = useState<{
    index: number;
    statement: PolicyListStatement;
  } | null>(null);

  const statements = useMemo(() => {
    const policy = policyListData?.policies.find((item) => item.name === policyName);
    return policy?.statements ?? [];
  }, [policyListData?.policies, policyName]);

  const handleStatementClick = useCallback(
    (index: number, statement: PolicyListStatement) => {
      setSelectedStatementIndex(index);
      setScopeStatement({ index, statement });
    },
    []
  );

  useEffect(() => {
    if (!scopeStatement) return;

    const { index, statement } = scopeStatement;
    const statementRef = formatStatementRef(statement.ref, index);

    openSidebar(
      <PolicyStatementScopesSidebar
        policyName={policyName}
        statementRef={statementRef}
        statementIndex={index}
        statement={statement}
        onClose={closeSidebar}
        key={`${policyName}-stmt-${index}`}
      />,
      {
        widthPx: 520,
        title: "Statement scopes",
        closeOnOutsideClick: false,
      }
    );
  }, [closeSidebar, openSidebar, policyName, scopeStatement]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-8">
      <div className="flex h-[min(560px,calc(100vh-140px))] min-h-[420px] flex-col">
        <OciPolicyGraphView
          graph={data?.graph}
          isLoading={isLoading}
          isError={isError}
          error={error}
          policyFilter={policyName}
          onPolicyFilterChange={() => {}}
          statementLimit={data?.graph?.meta.statementLimit ?? 100}
          onStatementLimitChange={() => {}}
          policyNames={[policyName]}
          lockPolicyFilter
          hideStatementLimit
        />
      </div>

      <PolicyStatementsPanel
        policyName={policyName}
        statements={statements}
        isLoading={isPolicyListLoading}
        selectedStatementIndex={selectedStatementIndex}
        onStatementClick={handleStatementClick}
      />
    </div>
  );
}
