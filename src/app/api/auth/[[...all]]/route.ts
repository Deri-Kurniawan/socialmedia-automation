import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Export all HTTP methods that Better Auth might need
export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(auth);
