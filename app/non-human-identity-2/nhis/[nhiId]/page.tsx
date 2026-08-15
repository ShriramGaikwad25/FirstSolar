import { notFound } from "next/navigation";
import { Nhi2IdentityEditorPage } from "@/components/non-human-identity/nhi2/Nhi2IdentityEditorPage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = { params: Promise<{ nhiId: string }> };

export default async function Nhi2IdentityDetailPage({ params }: PageProps) {
  const { nhiId } = await params;
  if (!UUID_RE.test(nhiId)) notFound();
  return <Nhi2IdentityEditorPage nhiId={nhiId} />;
}
