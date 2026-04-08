import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginClient from "./client";

export default async function LoginPage() {
  // Check if user is already logged in
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If logged in, redirect to dashboard
  if (session) {
    redirect("/dashboard");
  }

  // Otherwise, show login page
  return <LoginClient />;
}
