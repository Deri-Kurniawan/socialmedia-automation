import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { uploadHistory } from "@/lib/db/schema";

export async function GET() {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch upload history for the user
    const uploads = await db.query.uploadHistory.findMany({
      where: eq(uploadHistory.userId, session.user.id),
      orderBy: desc(uploadHistory.createdAt),
      limit: 50, // Limit to last 50 uploads
    });

    // Parse tags from JSON
    const formattedUploads = uploads.map((upload) => ({
      ...upload,
      tags: upload.tags ? JSON.parse(upload.tags) as string[] : [],
    }));

    return NextResponse.json({ uploads: formattedUploads });
  } catch (error) {
    console.error("Error fetching upload history:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload history" },
      { status: 500 }
    );
  }
}
