"use client";

import { signOut } from "@/lib/auth/client";
import { DashboardNavbar } from "@/components/dashboard-navbar";

interface DashboardNavbarWrapperProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function DashboardNavbarWrapper({ user }: DashboardNavbarWrapperProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return <DashboardNavbar user={user} onSignOut={handleSignOut} />;
}
