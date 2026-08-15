import OciPolicyWorkspacePage from "@/components/oci-policy-dashboard/OciPolicyWorkspacePage";

export default async function Page({
  params,
}: {
  params: Promise<{ policyName: string }>;
}) {
  const { policyName } = await params;
  return <OciPolicyWorkspacePage policyName={decodeURIComponent(policyName)} />;
}
