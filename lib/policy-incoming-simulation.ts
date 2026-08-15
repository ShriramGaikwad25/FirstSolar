import type {
  PolicyIncomingSimulationConflictRow,
  PolicyIncomingSimulationResult,
} from "@/types/oci-policy";

const CONFLICT_SECTIONS: {
  category: string;
  key: keyof Pick<
    PolicyIncomingSimulationResult,
    | "exactDuplicates"
    | "coveredByHigherVerb"
    | "coveredByScope"
    | "makesVerbRedundant"
    | "makesScopeRedundant"
  >;
}[] = [
  { category: "EXACT_DUPLICATE", key: "exactDuplicates" },
  { category: "COVERED_BY_HIGHER_VERB", key: "coveredByHigherVerb" },
  { category: "COVERED_BY_SCOPE", key: "coveredByScope" },
  { category: "MAKES_VERB_REDUNDANT", key: "makesVerbRedundant" },
  { category: "MAKES_SCOPE_REDUNDANT", key: "makesScopeRedundant" },
];

export function flattenIncomingSimulationConflicts(
  result: PolicyIncomingSimulationResult
): PolicyIncomingSimulationConflictRow[] {
  return CONFLICT_SECTIONS.flatMap(({ category, key }) =>
    (result[key] ?? []).map((item) => ({
      category,
      policy: item.policy,
      statementId: item.statementId,
      fullText: item.fullText,
    }))
  );
}
