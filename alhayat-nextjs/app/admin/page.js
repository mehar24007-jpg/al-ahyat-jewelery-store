import { isAdminRequest } from "@/lib/requireAdmin";
import AdminClient from "../components/AdminClient";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const authed = isAdminRequest();
  return <AdminClient initiallyAuthed={authed} />;
}
