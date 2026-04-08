import { redirect } from "next/navigation";
import { getSessionCached } from "@/lib/auth";
import { DashboardNavbarWrapper } from "./DashboardNavbarWrapper";
import { DashboardClientWrapper } from "./DashboardClientWrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check - uses cached session to avoid double DB hits
  const session = await getSessionCached();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <DashboardNavbarWrapper
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
      />
      <DashboardClientWrapper>
        <main className="max-w-[1440px] mx-auto py-8 px-4">{children}</main>
      </DashboardClientWrapper>
    </div>
  );
}
