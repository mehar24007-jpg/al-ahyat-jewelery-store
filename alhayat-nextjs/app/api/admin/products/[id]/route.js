import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request, { params }) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const db = supabaseAdmin();

  const productFields = {};
  ["name", "category", "price", "description", "icon", "image_url", "video_url"].forEach((key) => {
    if (body[key] !== undefined) productFields[key] = body[key];
  });

  if (Object.keys(productFields).length > 0) {
    const { error } = await db.from("products").update(productFields).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body.variants)) {
    for (const v of body.variants) {
      if (v.id) {
        const { error } = await db
          .from("product_variants")
          .update({ stock: Math.max(0, Number(v.stock) || 0), variant_name: v.variant_name })
          .eq("id", v.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else if (v.variant_name) {
        const { error } = await db
          .from("product_variants")
          .insert({ product_id: id, variant_name: v.variant_name, stock: Math.max(0, Number(v.stock) || 0) });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  if (Array.isArray(body.deleteVariantIds)) {
    for (const vid of body.deleteVariantIds) {
      await db.from("product_variants").delete().eq("id", vid);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = params;
  const db = supabaseAdmin();
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
