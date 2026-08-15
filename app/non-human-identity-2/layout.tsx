import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";

export default function NonHumanIdentity2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={NHI2_PAGE_SHELL_CLASS}>{children}</div>;
}
