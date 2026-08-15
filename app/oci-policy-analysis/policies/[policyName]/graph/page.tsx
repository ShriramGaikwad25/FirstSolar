import OciPolicyGraphPage from "@/components/oci-policy-dashboard/OciPolicyGraphPage";

export default async function Page({
  params,
}: {
  params: Promise<{ policyName: string }>;
}) {
  const { policyName } = await params;
  return <OciPolicyGraphPage policyName={decodeURIComponent(policyName)} />;
}
