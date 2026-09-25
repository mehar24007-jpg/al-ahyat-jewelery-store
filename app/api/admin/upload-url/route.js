import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const IMAGE_BUCKET = "product-images";
const VIDEO_BUCKET = "product-videos";

export async function POST(request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "video" ? "video" : "image";
  const bucket = kind === "video" ? VIDEO_BUCKET : IMAGE_BUCKET;
  const ext = (body.filename && body.filename.split(".").pop()) || (kind === "video" ? "mp4" : "jpg");
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bucket, path, token: data.token });
}
