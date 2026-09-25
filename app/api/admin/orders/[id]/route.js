import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export async function PATCH(request, { params }) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = params;
  const body = await request.json().catch(() => ({}));
  if (!ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { error } = await db.from("orders").update({ status: body.status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
