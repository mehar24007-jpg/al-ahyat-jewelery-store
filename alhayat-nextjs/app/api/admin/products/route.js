import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getProductsWithVariants } from "@/lib/db";

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const products = await getProductsWithVariants();
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.price) {
    return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: product, error: pErr } = await db
    .from("products")
    .insert({
      name: body.name,
      category: body.category || "Necklace Sets",
      price: Number(body.price),
      icon: body.icon || "necklace",
      description: body.description || "",
      image_url: body.image_url || null,
      video_url: body.video_url || null
    })
    .select()
    .single();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const variantName = body.variant_name || "Gold";
  const stock = Number.isFinite(Number(body.stock)) ? Math.max(0, Number(body.stock)) : 0;

  const { error: vErr } = await db
    .from("product_variants")
    .insert({ product_id: product.id, variant_name: variantName, stock });

  if (vErr) return NextResponse.json({ error: vErr.message, product }, { status: 207 });

  return NextResponse.json({ ok: true, product });
}
