import { redirect } from "next/navigation";
import { getSessionCached } from "@/lib/auth";
import { db } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { uploadHistory, integrationAccount } from "@/lib/db/schema";
import { HistoryClient } from "./HistoryClient";

export default async function HistoryPage() {
  const session = await getSessionCached();
  
  if (!session) {
    redirect("/login");
  }

  // Fetch upload history with integration details
  const uploads = await db.query.uploadHistory.findMany({
    where: eq(uploadHistory.userId, session.user.id),
    orderBy: desc(uploadHistory.createdAt),
    limit: 100,
    with: {
      integrationAccount: true,
    },
  });

  // Fetch all integrations for filter dropdown
  const integrations = await db.query.integrationAccount.findMany({
    where: eq(integrationAccount.userId, session.user.id),
    orderBy: desc(integrationAccount.createdAt),
  });

  // Parse tags and format data
  const formattedUploads = uploads.map((upload) => ({
    ...upload,
    tags: upload.tags ? JSON.parse(upload.tags) as string[] : [],
    metadata: upload.integrationAccount?.metadata 
      ? JSON.parse(upload.integrationAccount.metadata) 
      : null,
    channelName: upload.integrationAccount?.name || "Unknown Channel",
    channelHandle: upload.integrationAccount?.handle || null,
    // Convert Date objects to ISO strings for client component
    createdAt: upload.createdAt.toISOString(),
    updatedAt: upload.updatedAt.toISOString(),
    integrationAccount: undefined, // Remove nested object
  }));

  const formattedIntegrations = integrations.map((integration) => ({
    id: integration.id,
    name: integration.name,
    handle: integration.handle,
    platform: integration.platform,
    isActive: integration.isActive,
    metadata: integration.metadata ? JSON.parse(integration.metadata) : null,
  }));

  return (
    <HistoryClient 
      initialUploads={formattedUploads}
      integrations={formattedIntegrations}
      userName={session.user.name}
    />
  );
}
