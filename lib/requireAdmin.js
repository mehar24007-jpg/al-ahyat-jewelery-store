import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

// Use inside Route Handlers or Server Components (Node.js runtime).
export function isAdminRequest() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token, process.env.SESSION_SECRET || "");
  return !!(payload && payload.admin === true);
}
