import { notFound } from "next/navigation";
import { NHI_2_NAV_ITEMS, NHI_2_SECTION_SLUGS } from "@/lib/nhi-shell";
import { Nhi2ActivityPage } from "@/components/non-human-identity/nhi2/Nhi2ActivityPage";
import { Nhi2GovernancePage } from "@/components/non-human-identity/nhi2/Nhi2GovernancePage";
import { Nhi2AdminPage } from "@/components/non-human-identity/nhi2/Nhi2AdminPage";
import { Nhi2AgentPosturePage } from "@/components/non-human-identity/nhi2/Nhi2AgentPosturePage";
import { MyNhisPage } from "@/components/non-human-identity/MyNhisPage";
import { Nhi2InventoryPage } from "@/components/non-human-identity/nhi2/Nhi2InventoryPage";

type PageProps = { params: Promise<{ section: string }> };

export default async function NonHumanIdentity2SectionPage({ params }: PageProps) {
  const { section } = await params;
  if (!NHI_2_SECTION_SLUGS.has(section)) {
    notFound();
  }

  const label =
    NHI_2_NAV_ITEMS.find((i) => i.href === `/non-human-identity-2/${section}`)?.label ??
    section;

  if (section === "my-nhis") {
    return <MyNhisPage />;
  }
  if (section === "agents") {
    return <Nhi2AgentPosturePage />;
  }
  if (section === "nhis") {
    return <Nhi2InventoryPage />;
  }
  if (section === "activity") {
    return <Nhi2ActivityPage />;
  }
  if (section === "governance") {
    return <Nhi2GovernancePage />;
  }
  if (section === "admin") {
    return <Nhi2AdminPage />;
  }

  return (
    <div className="w-full min-w-0">
      <h1 className="text-2xl font-semibold text-gray-900">{label}</h1>
      <p className="mt-2 text-sm text-gray-600">Content for this section will go here.</p>
    </div>
  );
}
