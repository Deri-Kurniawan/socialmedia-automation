"use client";

import { signOut } from "@/lib/auth/client";

interface DashboardClientWrapperProps {
  children: React.ReactNode;
}

export function DashboardClientWrapper({ children }: DashboardClientWrapperProps) {
  // This wrapper provides a client-side context for any client-only functionality
  // The actual auth check is now done server-side in layout.tsx
  return <>{children}</>;
}

// Re-export signOut for use in navbar
export { signOut };
