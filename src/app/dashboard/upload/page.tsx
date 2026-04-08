"use server";

import { redirect } from "next/navigation";
import { getSessionCached } from "@/lib/auth";
import { getIntegrationsForUser } from "../integrations/actions";
import { UploadClient } from "./UploadClient";

export default async function UploadPage() {
  // Server-side auth check - uses cached session
  const session = await getSessionCached();

  if (!session) {
    redirect("/login");
  }

  // Fetch integrations on the server (pass userId to avoid double auth)
  const result = await getIntegrationsForUser(session.user.id);
  const integrations = result.success ? result.integrations || [] : [];

  return (
    <UploadClient
      initialIntegrations={integrations}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    />
  );
}
