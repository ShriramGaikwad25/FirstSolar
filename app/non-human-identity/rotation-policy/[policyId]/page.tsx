import { RotationPolicyEditorPage } from "@/components/non-human-identity/RotationPolicyEditorPage";

type PageProps = { params: Promise<{ policyId: string }> };

export default async function EditRotationPolicyPage({ params }: PageProps) {
  const { policyId } = await params;
  return <RotationPolicyEditorPage key={policyId} policyId={policyId} />;
}
