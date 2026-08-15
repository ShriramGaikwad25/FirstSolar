import { notFound } from "next/navigation";
import { NhiInventoryDetailPageClient } from "@/components/non-human-identity/NhiInventoryDetailPageClient";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = { params: Promise<{ nhiId: string }> };

export default async function NhiInventoryDetailPage({ params }: PageProps) {
  const { nhiId } = await params;
  if (!UUID_RE.test(nhiId)) notFound();
  return <NhiInventoryDetailPageClient nhiId={nhiId} />;
}
