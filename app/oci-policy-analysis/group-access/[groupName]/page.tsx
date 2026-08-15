import OciGroupAccessDetailPage from "@/components/oci-group-access/OciGroupAccessDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ groupName: string }>;
}) {
  const { groupName } = await params;
  return <OciGroupAccessDetailPage groupName={decodeURIComponent(groupName)} />;
}
