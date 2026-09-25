import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { customer_name, phone, address, city, payment_method, items } = body;
  if (!customer_name || !phone || !address || !city) {
    return NextResponse.json({ error: "Please fill in all delivery details" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
  }
  if (!["cod", "gpay"].includes(payment_method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db.rpc("place_order", {
    p_customer_name: customer_name,
    p_phone: phone,
    p_address: address,
    p_city: city,
    p_payment_method: payment_method,
    p_items: items.map((i) => ({
      product_id: i.product_id,
      variant_name: i.variant_name,
      quantity: i.quantity
    }))
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ order: data });
}
