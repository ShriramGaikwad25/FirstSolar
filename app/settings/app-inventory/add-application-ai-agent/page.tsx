import { redirect } from "next/navigation";

/** Legacy route — AI Agent types are now in the main Add Application flow. */
export default function AddApplicationAiAgentPage() {
  redirect("/settings/app-inventory/add-application");
}
