import { supabaseAdmin } from "./supabaseAdmin";

export async function getProductsWithVariants() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("products")
    .select("*, product_variants(*)")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    icon: p.icon,
    description: p.description || "",
    image_url: p.image_url || null,
    video_url: p.video_url || null,
    variants: (p.product_variants || []).map((v) => ({
      id: v.id,
      variant_name: v.variant_name,
      stock: v.stock
    }))
  }));
}
