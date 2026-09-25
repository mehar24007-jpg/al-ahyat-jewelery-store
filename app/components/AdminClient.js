"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const ICONS = ["necklace", "earring", "bangle", "ring", "choker", "pendant", "tikka"];
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB — original quality, no forced compression
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB — Supabase free-tier per-file cap
const SHARPEN_PIXEL_LIMIT = 2_000_000; // skip the convolution pass on huge photos so the browser doesn't freeze

function money(n) { return "Rs. " + Number(n).toLocaleString("en-PK"); }

// Loads an image file into a canvas, applies a gentle contrast/saturation lift
// and (for reasonably sized photos) a sharpening pass, then exports it back
// out at FULL original resolution and high quality — no downscaling, no
// lossy compression. This cannot invent detail a blurry source photo lacks;
// it only makes a good photo look crisper.
async function autoEnhanceImage(file) {
  if (!file.type || !file.type.startsWith("image/") || file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.filter = "contrast(1.07) saturate(1.1) brightness(1.02)";
  ctx.drawImage(bitmap, 0, 0);
  ctx.filter = "none";

  if (bitmap.width * bitmap.height <= SHARPEN_PIXEL_LIMIT) {
    sharpenCanvas(ctx, canvas.width, canvas.height);
  }

  const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outType, 0.95));
  return blob || file;
}

function sharpenCanvas(ctx, width, height) {
  const src = ctx.getImageData(0, 0, width, height);
  const s = src.data;
  const out = new Uint8ClampedArray(s.length);
  const kernel = [0, -0.15, 0, -0.15, 1.6, -0.15, 0, -0.15, 0]; // light unsharp mask
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        out[idx] = s[idx]; out[idx + 1] = s[idx + 1]; out[idx + 2] = s[idx + 2]; out[idx + 3] = s[idx + 3];
        continue;
      }
      for (let c = 0; c < 3; c++) {
        let sum = 0, k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const nIdx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += s[nIdx] * kernel[k];
            k++;
          }
        }
        out[idx + c] = sum;
      }
      out[idx + 3] = s[idx + 3];
    }
  }
  ctx.putImageData(new ImageData(out, width, height), 0, 0);
}

// Uploads directly from the browser to Supabase Storage using a short-lived
// signed URL (issued by our protected API). This bypasses our own server
// entirely for the actual file bytes, so large "ultra HD" photos and videos
// are not limited by the hosting platform's small request-body cap.
async function uploadDirect(fileOrBlob, kind, filename) {
  const urlRes = await fetch("/api/admin/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, filename })
  });
  const { bucket, path, token, error } = await urlRes.json();
  if (!urlRes.ok) throw new Error(error || "Could not prepare upload");

  const sb = supabaseBrowser();
  const { error: upErr } = await sb.storage.from(bucket).uploadToSignedUrl(path, token, fileOrBlob, {
    contentType: fileOrBlob.type || (kind === "video" ? "video/mp4" : "image/jpeg")
  });
  if (upErr) throw new Error(upErr.message || "Upload failed");

  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export default function AdminClient({ initiallyAuthed }) {
  const [authed, setAuthed] = useState(initiallyAuthed);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState("inventory");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2600);
  }

  async function loadProducts() {
    const res = await fetch("/api/admin/products");
    if (res.ok) { const data = await res.json(); setProducts(data.products || []); }
  }
  async function loadOrders() {
    const res = await fetch("/api/admin/orders");
    if (res.ok) { const data = await res.json(); setOrders(data.orders || []); }
  }

  useEffect(() => {
    if (authed) { loadProducts(); loadOrders(); }
  }, [authed]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    const form = e.target;
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email.value, password: form.password.value })
    });
    const data = await res.json();
    setLoggingIn(false);
    if (!res.ok) { setLoginError(data.error || "Could not sign in"); return; }
    setAuthed(true);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  async function saveStock(product, stockEdits) {
    setBusy(true);
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variants: stockEdits })
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json(); showToast("Update failed: " + d.error); return; }
    showToast("Inventory updated");
    loadProducts();
  }

  async function changePhoto(product, file) {
    if (file.size > MAX_IMAGE_BYTES) { showToast("Please choose an image under 20MB"); return; }
    setBusy(true);
    try {
      const enhanced = await autoEnhanceImage(file);
      const url = await uploadDirect(enhanced, "image", file.name);
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      showToast("Photo updated for " + product.name);
      loadProducts();
    } catch (err) {
      showToast(err.message || "Could not upload photo");
    }
    setBusy(false);
  }

  async function changeVideo(product, file) {
    if (file.size > MAX_VIDEO_BYTES) { showToast("Please choose a video under 50MB"); return; }
    setBusy(true);
    try {
      const url = await uploadDirect(file, "video", file.name);
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: url })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      showToast("Video updated for " + product.name);
      loadProducts();
    } catch (err) {
      showToast(err.message || "Could not upload video");
    }
    setBusy(false);
  }

  async function removeVideo(product) {
    setBusy(true);
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: null })
    });
    setBusy(false);
    if (!res.ok) { showToast("Could not remove video"); return; }
    showToast("Video removed");
    loadProducts();
  }

  async function saveDetails(product, fields) {
    setBusy(true);
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json(); showToast("Update failed: " + d.error); return; }
    showToast("Details updated");
    loadProducts();
  }

  async function deleteProduct(product) {
    if (!confirm(`Remove "${product.name}" from the store?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { const d = await res.json(); showToast("Could not delete: " + d.error); return; }
    showToast("Removed " + product.name);
    loadProducts();
  }

  async function addProduct(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const price = Number(form.price.value);
    if (!name || !price) { showToast("Please add a name and a valid price"); return; }
    const photoFile = form.photo.files[0];
    const videoFile = form.video.files[0];

    setBusy(true);
    try {
      let image_url = null;
      if (photoFile) {
        if (photoFile.size > MAX_IMAGE_BYTES) throw new Error("Please choose an image under 20MB");
        const enhanced = await autoEnhanceImage(photoFile);
        image_url = await uploadDirect(enhanced, "image", photoFile.name);
      }
      let video_url = null;
      if (videoFile) {
        if (videoFile.size > MAX_VIDEO_BYTES) throw new Error("Please choose a video under 50MB");
        video_url = await uploadDirect(videoFile, "video", videoFile.name);
      }
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, price, category: form.category.value.trim() || "Uncategorised", icon: form.icon.value,
          variant_name: form.variant.value.trim() || "Gold",
          stock: Number(form.stock.value) || 0,
          image_url, video_url
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      showToast("Added " + name);
      form.reset();
      loadProducts();
    } catch (err) {
      showToast(err.message || "Could not add product");
    }
    setBusy(false);
  }

  async function updateOrderStatus(order, status) {
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!res.ok) { showToast("Could not update order"); return; }
    showToast("Order status updated");
    loadOrders();
  }

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="login-box" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16 }}>
          <h2>Store admin</h2>
          <p>Sign in with your admin account.</p>
          {loginError && <div className="error-note">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="field"><label>Email</label><input name="email" type="email" placeholder="you@example.com" /></div>
            <div className="field"><label>Password</label><input name="password" type="password" placeholder="••••••••" /></div>
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loggingIn} type="submit">
              {loggingIn ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 0 60px" }}>
      <div className="admin-header-row">
        <h2 style={{ fontSize: "1.6rem", padding: "20px 4px 0" }}>Store admin</h2>
        <span className="who">
          <button className="mini-btn" onClick={handleLogout}>Sign out</button>
          &nbsp;·&nbsp; <a href="/" style={{ fontSize: ".75rem" }}>View store →</a>
        </span>
      </div>
      <div className="admin-tabs">
        <button className={"admin-tab" + (tab === "inventory" ? " active" : "")} onClick={() => setTab("inventory")}>Inventory</button>
        <button className={"admin-tab" + (tab === "orders" ? " active" : "")} onClick={() => setTab("orders")}>Orders</button>
      </div>

      <div className="admin-body">
        {tab === "inventory" ? (
          <InventoryTab products={products} busy={busy} onSaveStock={saveStock} onChangePhoto={changePhoto} onChangeVideo={changeVideo} onRemoveVideo={removeVideo} onDelete={deleteProduct} onAdd={addProduct} onSaveDetails={saveDetails} />
        ) : (
          <OrdersTab orders={orders} onUpdateStatus={updateOrderStatus} />
        )}
      </div>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}

function InventoryTab({ products, busy, onSaveStock, onChangePhoto, onChangeVideo, onRemoveVideo, onDelete, onAdd, onSaveDetails }) {
  const existingCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();
  const [edits, setEdits] = useState({}); // productId -> { variantId: stockValue }
  const [editingId, setEditingId] = useState(null);

  function setEdit(pid, vid, value) {
    setEdits((prev) => ({ ...prev, [pid]: { ...(prev[pid] || {}), [vid]: value } }));
  }

  return (
    <>
      <div className="orders-table-wrap">
        <table className="inv">
          <thead><tr><th>Product</th><th>Colour</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <ProductRows key={p.id} product={p} edits={edits[p.id] || {}} setEdit={setEdit}
                editing={editingId === p.id} onToggleEdit={() => setEditingId(editingId === p.id ? null : p.id)}
                existingCategories={existingCategories}
                onSaveDetails={(fields) => { onSaveDetails(p, fields); setEditingId(null); }}
                onSave={() => {
                  const variants = p.variants.map((v) => ({
                    id: v.id, variant_name: v.variant_name,
                    stock: (edits[p.id] && edits[p.id][v.id] !== undefined) ? edits[p.id][v.id] : v.stock
                  }));
                  onSaveStock(p, variants);
                }}
                onChangePhoto={(file) => onChangePhoto(p, file)}
                onChangeVideo={(file) => onChangeVideo(p, file)}
                onRemoveVideo={() => onRemoveVideo(p)}
                onDelete={() => onDelete(p)} busy={busy}
              />
            ))}
          </tbody>
        </table>
      </div>

      <form className="add-form" onSubmit={onAdd}>
        <h4>Add a new piece</h4>
        <div className="field full"><label>Photo</label><input name="photo" type="file" accept="image/*" /></div>
        <div className="field full"><label>Video (optional, under 50MB)</label><input name="video" type="file" accept="video/*" /></div>
        <div className="field full"><label>Name</label><input name="name" type="text" placeholder="e.g. Sana Drop Earrings" /></div>
        <div className="field"><label>Category</label>
          <input name="category" type="text" list="categoryOptions" placeholder="e.g. Necklace Sets" defaultValue={existingCategories[0] || ""} />
          <datalist id="categoryOptions">{existingCategories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="field"><label>Price (PKR)</label><input name="price" type="number" min="0" placeholder="2500" /></div>
        <div className="field"><label>Style icon (used if no photo)</label>
          <select name="icon" defaultValue={ICONS[0]}>{ICONS.map((i) => <option key={i} value={i}>{i}</option>)}</select>
        </div>
        <div className="field"><label>Colour / variant name</label><input name="variant" type="text" placeholder="e.g. Gold" /></div>
        <div className="field"><label>Starting stock</label><input name="stock" type="number" min="0" placeholder="10" /></div>
        <div className="full"><button className="btn btn-primary" disabled={busy} type="submit">Add product</button></div>
      </form>
    </>
  );
}

function ProductRows({ product, edits, setEdit, editing, onToggleEdit, existingCategories, onSaveDetails, onSave, onChangePhoto, onChangeVideo, onRemoveVideo, onDelete, busy }) {
  return (
    <>
      {product.variants.map((v, idx) => (
        <tr key={v.id}>
          {idx === 0 && (
            <td rowSpan={product.variants.length}>
              {editing ? (
                <EditDetailsForm product={product} existingCategories={existingCategories} onSave={onSaveDetails} onCancel={onToggleEdit} busy={busy} />
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", position: "relative", flex: "0 0 auto", background: "var(--bg-alt)" }}>
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%" }} />}
                    </div>
                    <div><strong>{product.name}</strong><br /><span style={{ color: "var(--ink-soft)", fontSize: ".72rem" }}>{product.category} · {money(product.price)}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label className="mini-btn" style={{ cursor: "pointer" }}>
                      Change photo
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={(e) => { const f = e.target.files[0]; if (f) onChangePhoto(f); e.target.value = ""; }} />
                    </label>
                    <label className="mini-btn" style={{ cursor: "pointer" }}>
                      {product.video_url ? "Replace video" : "Add video"}
                      <input type="file" accept="video/*" style={{ display: "none" }}
                        onChange={(e) => { const f = e.target.files[0]; if (f) onChangeVideo(f); e.target.value = ""; }} />
                    </label>
                    {product.video_url && <button className="mini-btn danger" onClick={onRemoveVideo}>Remove video</button>}
                    <button className="mini-btn" onClick={onToggleEdit}>Edit details</button>
                  </div>
                  {product.video_url && <span style={{ fontSize: ".68rem", color: "var(--ok)", display: "block", marginTop: 4 }}>🎬 Has a video</span>}
                </>
              )}
            </td>
          )}
          <td>{v.variant_name}</td>
          <td>
            <input type="number" min="0" defaultValue={v.stock}
              onChange={(e) => setEdit(product.id, v.id, Number(e.target.value))} />
          </td>
          {idx === 0 && (
            <td rowSpan={product.variants.length} className="row-actions">
              <button className="mini-btn" disabled={busy} onClick={onSave}>Save stock</button>
              <button className="mini-btn danger" disabled={busy} onClick={onDelete}>Delete</button>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

function EditDetailsForm({ product, existingCategories, onSave, onCancel, busy }) {
  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.target;
        onSave({
          name: f.name.value.trim(),
          category: f.category.value.trim() || "Uncategorised",
          price: Number(f.price.value),
          description: f.description.value
        });
      }}
    >
      <input name="name" type="text" defaultValue={product.name} placeholder="Name" />
      <input name="category" type="text" list={`cat-${product.id}`} defaultValue={product.category} placeholder="Category" />
      <datalist id={`cat-${product.id}`}>{existingCategories.map((c) => <option key={c} value={c} />)}</datalist>
      <input name="price" type="number" min="0" defaultValue={product.price} placeholder="Price" />
      <textarea name="description" rows={2} defaultValue={product.description} placeholder="Description" style={{ fontFamily: "inherit", fontSize: ".8rem", padding: 6, border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg)", color: "var(--ink)" }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button className="mini-btn" disabled={busy} type="submit">Save</button>
        <button className="mini-btn" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function OrdersTab({ orders, onUpdateStatus }) {
  if (orders.length === 0) return <p className="empty-note">No orders yet.</p>;
  return (
    <div className="orders-table-wrap">
      <table className="inv">
        <thead><tr><th>Order</th><th>Customer</th><th>City</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.order_number}</td>
              <td>{o.customer_name}<br /><span style={{ color: "var(--ink-soft)", fontSize: ".72rem" }}>{o.phone}</span></td>
              <td>{o.city}</td>
              <td>{o.payment_method}</td>
              <td>{money(o.total)}</td>
              <td>
                <select defaultValue={o.status} onChange={(e) => onUpdateStatus(o, e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
