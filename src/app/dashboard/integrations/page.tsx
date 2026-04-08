import { redirect } from "next/navigation";
import { getSessionCached } from "@/lib/auth";
import { getIntegrationsForUser, getIntegrationsByGoogleAccountForUser, type GoogleAccount, type Integration } from "./actions";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function IntegrationsPage() {
  // Server-side auth check - uses cached session (shared with layout)
  const session = await getSessionCached();
  
  if (!session) {
    redirect("/login");
  }

  // Fetch ALL data server-side in parallel (avoids client-side fetching)
  const [integrationsResult, groupedResult] = await Promise.all([
    getIntegrationsForUser(session.user.id),
    getIntegrationsByGoogleAccountForUser(session.user.id),
  ]);

  const initialIntegrations = integrationsResult.success ? integrationsResult.integrations || [] : [];
  const initialGoogleAccounts = groupedResult.success ? groupedResult.accounts || [] : [];
  const initialUngrouped = groupedResult.success ? groupedResult.ungrouped || [] : [];

  return (
    <IntegrationsClient 
      initialIntegrations={initialIntegrations}
      initialGoogleAccounts={initialGoogleAccounts}
      initialUngrouped={initialUngrouped}
    />
  );
}
